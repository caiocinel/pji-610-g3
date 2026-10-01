"use server";

import { requireAuth } from "@/lib/auth";
import type { PoolClient } from "pg";
import { pool, transaction } from "@/lib/db";
import { arredondar, calcularDesconto, calcularSubtotal, calcularTroco, subtotalLinha, validarDesconto } from "../calculos";
import { formatBRL } from "@/lib/format";
import {
  cancelarVendaSchema,
  registrarVendaSchema,
  type CancelarVendaInput,
  type RegistrarVendaInput,
} from "../schemas";
import { falhaValidacao, lerEntrada, sucesso, type EstadoAcao, type ResultadoAcao } from "../resultado";
import { ErroNegocio, movimentar, nomeComAroma, revalidarPainel, travarProdutos, tratarErro } from "../servidor";

export type DadosVenda = {
  subtotal: number;
  desconto: number;
  total: number;
  /** Só quando forma_pagamento = dinheiro e valor_recebido foi informado. */
  troco: number | null;
  /** Itens como gravados (nome e preço do banco), para a tela de sucesso e o resumo enviado ao cliente. */
  itens: { produto_id: number; nome: string; quantidade: number; preco_unitario: number; subtotal: number }[];
};

/**
 * Registra uma venda: preços e custos vêm do banco (nunca do navegador), estoque é travado e
 * baixado com movimentação "venda". Retorna `id` da venda e `dados` com subtotal/desconto/total/troco.
 * Não redireciona: a tela decide (ex.: oferecer "Ver recibo" → /vendas/{id}/recibo).
 */
export async function registrarVenda(
  a: EstadoAcao<DadosVenda> | FormData | RegistrarVendaInput,
  b?: FormData,
): Promise<ResultadoAcao<DadosVenda>> {
  await requireAuth();
  const parsed = registrarVendaSchema.safeParse(lerEntrada(a, b));
  if (!parsed.success) return falhaValidacao(parsed.error);
  const v = parsed.data;

  const quantidades = new Map<number, number>();
  const precosVistos = new Map<number, number>();
  for (const item of v.itens) {
    quantidades.set(item.produto_id, (quantidades.get(item.produto_id) ?? 0) + item.quantidade);
    if (item.preco_esperado != null && !precosVistos.has(item.produto_id)) precosVistos.set(item.produto_id, item.preco_esperado);
  }

  try {
    const r = await transaction(async (c) => {
      // Reenvio da mesma venda (resposta perdida na rede): devolve a que já foi gravada.
      if (v.chave_idempotencia) {
        const existente = await vendaPorChave(c, v.chave_idempotencia);
        if (existente) return existente;
      }

      if (v.cliente_id) {
        const { rowCount } = await c.query(`SELECT 1 FROM clientes WHERE id = $1`, [v.cliente_id]);
        if (!rowCount) throw new ErroNegocio("O cliente selecionado não existe mais.");
      }

      const produtos = await travarProdutos(c, [...quantidades.keys()]);
      const linhas = [...quantidades].map(([id, quantidade]) => {
        const p = produtos.get(id);
        if (!p || !p.ativo) throw new ErroNegocio("Um dos produtos não está mais disponível. Recarregue a página.");
        return { produto: p, quantidade, preco_unitario: p.preco, custo_unitario: p.custo };
      });
      // O preço pode ter mudado (em outra aba/aparelho) depois que a tela carregou: não cobra em silêncio.
      for (const l of linhas) {
        const visto = precosVistos.get(l.produto.id);
        if (visto != null && arredondar(visto) !== arredondar(l.preco_unitario)) {
          throw new ErroNegocio(
            `O preço de "${nomeComAroma(l.produto)}" mudou de ${formatBRL(visto)} para ${formatBRL(l.preco_unitario)}. Confira a venda e confirme de novo.`,
          );
        }
      }
      for (const l of linhas) {
        if (l.quantidade > l.produto.estoque) {
          throw new ErroNegocio(
            `Estoque insuficiente para "${nomeComAroma(l.produto)}": só há ${l.produto.estoque} (pedido: ${l.quantidade}).`,
          );
        }
      }

      const subtotal = calcularSubtotal(linhas);
      if (subtotal > LIMITE_VALOR_VENDA) {
        throw new ErroNegocio(
          `O valor desta venda (${formatBRL(subtotal)}) passou do limite do sistema. Confira as quantidades digitadas.`,
        );
      }
      const erroDesconto = validarDesconto(subtotal, v.desconto_tipo, v.desconto_valor);
      if (erroDesconto) throw new ErroNegocio(erroDesconto);
      const desconto = calcularDesconto(subtotal, v.desconto_tipo, v.desconto_valor);
      const total = arredondar(subtotal - desconto);
      if (v.total_esperado != null && arredondar(v.total_esperado) !== total) {
        throw new ErroNegocio(
          `O total mudou de ${formatBRL(v.total_esperado)} para ${formatBRL(total)} (algum preço foi alterado). Confira a venda e confirme de novo.`,
        );
      }

      const valorRecebido = v.forma_pagamento === "dinheiro" ? v.valor_recebido : null;
      if (valorRecebido != null && valorRecebido < total) {
        throw new ErroNegocio("O valor recebido é menor que o total da venda.");
      }

      const { rows } = await c.query<{ id: number }>(
        `INSERT INTO vendas (cliente_id, forma_pagamento, canal, subtotal, desconto, total, valor_recebido, observacao,
                             chave_idempotencia)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [v.cliente_id, v.forma_pagamento, v.canal, subtotal, desconto, total, valorRecebido, v.observacao, v.chave_idempotencia],
      );
      const vendaId = rows[0].id;

      for (const l of linhas) {
        await c.query(
          `INSERT INTO itens_venda (venda_id, produto_id, produto_nome, quantidade, preco_unitario, custo_unitario, subtotal)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [vendaId, l.produto.id, l.produto.nome, l.quantidade, l.preco_unitario, l.custo_unitario, subtotalLinha(l)],
        );
        await movimentar(c, l.produto, {
          tipo: "saida",
          quantidade: l.quantidade,
          motivo: "venda",
          observacao: `Venda #${vendaId}`,
          vendaId,
        });
      }
      const itens = linhas.map((l) => ({
        produto_id: l.produto.id,
        nome: l.produto.nome,
        quantidade: l.quantidade,
        preco_unitario: l.preco_unitario,
        subtotal: subtotalLinha(l),
      }));
      return { vendaId, subtotal, desconto, total, troco: calcularTroco(total, valorRecebido), itens };
    });

    revalidarPainel();
    const { vendaId, ...dados } = r;
    return sucesso(`Venda #${vendaId} registrada.`, { id: vendaId, dados });
  } catch (erro) {
    // Duas tentativas simultâneas com a mesma chave: a segunda esbarra no índice único.
    if (v.chave_idempotencia && (erro as { constraint?: string })?.constraint === "vendas_chave_idempotencia_key") {
      const existente = await vendaPorChave(pool, v.chave_idempotencia).catch(() => null);
      if (existente) {
        const { vendaId, ...dados } = existente;
        return sucesso(`Venda #${vendaId} registrada.`, { id: vendaId, dados });
      }
    }
    return tratarErro(erro, { fk: "O cliente ou um dos produtos não existe mais." });
  }
}

/** Maior valor que cabe em NUMERIC(12,2) (vendas.subtotal/total e itens_venda.subtotal). */
const LIMITE_VALOR_VENDA = 9_999_999_999.99;

/** Venda já gravada com esta chave de idempotência, no mesmo formato do retorno de registrarVenda. */
async function vendaPorChave(
  c: Pick<PoolClient, "query">,
  chave: string,
): Promise<(DadosVenda & { vendaId: number }) | null> {
  const { rows } = await c.query<{ id: number; subtotal: number; desconto: number; total: number; valor_recebido: number | null }>(
    `SELECT id, subtotal, desconto, total, valor_recebido FROM vendas WHERE chave_idempotencia = $1`,
    [chave],
  );
  if (rows.length === 0) return null;
  const venda = rows[0];
  const { rows: itens } = await c.query<DadosVenda["itens"][number]>(
    `SELECT produto_id, produto_nome AS nome, quantidade, preco_unitario, subtotal
       FROM itens_venda WHERE venda_id = $1 ORDER BY id`,
    [venda.id],
  );
  return {
    vendaId: venda.id,
    subtotal: venda.subtotal,
    desconto: venda.desconto,
    total: venda.total,
    troco: calcularTroco(venda.total, venda.valor_recebido),
    itens,
  };
}

/**
 * Cancela uma venda concluída: marca status "cancelada" (com data e motivo) e devolve ao estoque
 * cada item com movimentação "cancelamento_venda". Vendas canceladas saem de todos os totais.
 */
export async function cancelarVenda(
  a: EstadoAcao | FormData | CancelarVendaInput,
  b?: FormData,
): Promise<ResultadoAcao> {
  await requireAuth();
  const parsed = cancelarVendaSchema.safeParse(lerEntrada(a, b));
  if (!parsed.success) return falhaValidacao(parsed.error);
  const { id, motivo } = parsed.data;

  try {
    await transaction(async (c) => {
      const { rows: venda } = await c.query<{ status: string }>(`SELECT status FROM vendas WHERE id = $1 FOR UPDATE`, [id]);
      if (venda.length === 0) throw new ErroNegocio("Venda não encontrada.");
      if (venda[0].status === "cancelada") throw new ErroNegocio(`A venda #${id} já está cancelada.`);

      const { rows: itens } = await c.query<{ produto_id: number; quantidade: number }>(
        `SELECT produto_id, sum(quantidade)::int AS quantidade FROM itens_venda WHERE venda_id = $1 GROUP BY produto_id`,
        [id],
      );
      const produtos = await travarProdutos(c, itens.map((i) => i.produto_id));
      for (const item of itens.sort((x, y) => x.produto_id - y.produto_id)) {
        const p = produtos.get(item.produto_id);
        if (!p) continue;
        await movimentar(c, p, {
          tipo: "entrada",
          quantidade: item.quantidade,
          motivo: "cancelamento_venda",
          observacao: `Cancelamento da venda #${id}`,
          vendaId: id,
        });
      }
      await c.query(
        `UPDATE vendas SET status = 'cancelada', cancelada_em = now(), motivo_cancelamento = $1 WHERE id = $2`,
        [motivo, id],
      );
    });
    revalidarPainel();
    return sucesso(`Venda #${id} cancelada e itens devolvidos ao estoque.`, { id });
  } catch (erro) {
    return tratarErro(erro);
  }
}
