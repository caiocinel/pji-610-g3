"use server";

import { requireAuth } from "@/lib/auth";
import { transaction } from "@/lib/db";
import { diferencaInventario } from "../calculos";
import { ROTULO_MOTIVO } from "../enums";
import {
  ajusteInventarioSchema,
  entradaEstoqueSchema,
  entradaLoteSchema,
  saidaEstoqueSchema,
  type AjusteInventarioInput,
  type EntradaEstoqueInput,
  type EntradaLoteInput,
  type SaidaEstoqueInput,
} from "../schemas";
import { falhaValidacao, lerEntrada, sucesso, type EstadoAcao, type ResultadoAcao } from "../resultado";
import { ErroNegocio, movimentar, revalidarPainel, travarProdutos, tratarErro } from "../servidor";

/** Dados extras devolvidos pelas ações de estoque de um produto. */
export type DadosMovimentacao = { produto_id: number; saldo: number };

const un = (n: number) => `${n} ${n === 1 ? "unidade" : "unidades"}`;

async function travarUm(c: Parameters<typeof travarProdutos>[0], id: number) {
  const p = (await travarProdutos(c, [id])).get(id);
  if (!p) throw new ErroNegocio("Produto não encontrado.");
  return p;
}

/** Entrada manual (motivo producao | compra | outro; padrão producao). `id` = id da movimentação. */
export async function registrarEntrada(
  a: EstadoAcao<DadosMovimentacao> | FormData | EntradaEstoqueInput,
  b?: FormData,
): Promise<ResultadoAcao<DadosMovimentacao>> {
  await requireAuth();
  const parsed = entradaEstoqueSchema.safeParse(lerEntrada(a, b));
  if (!parsed.success) return falhaValidacao(parsed.error);
  const e = parsed.data;
  try {
    const r = await transaction(async (c) => {
      const p = await travarUm(c, e.produto_id);
      if (!p.ativo) throw new ErroNegocio(`"${p.nome}" está desativada. Reative o produto antes.`);
      const mov = await movimentar(c, p, { tipo: "entrada", quantidade: e.quantidade, motivo: e.motivo, observacao: e.observacao });
      return { ...mov, nome: p.nome };
    });
    revalidarPainel();
    return sucesso(`Entrada de ${un(e.quantidade)} em "${r.nome}". Estoque agora: ${r.saldo}.`, {
      id: r.movimentacaoId,
      dados: { produto_id: e.produto_id, saldo: r.saldo },
    });
  } catch (erro) {
    return tratarErro(erro);
  }
}

/** Saída manual (motivo perda | avaria | uso_interno | outro). Recusa se o estoque não for suficiente. */
export async function registrarSaida(
  a: EstadoAcao<DadosMovimentacao> | FormData | SaidaEstoqueInput,
  b?: FormData,
): Promise<ResultadoAcao<DadosMovimentacao>> {
  await requireAuth();
  const parsed = saidaEstoqueSchema.safeParse(lerEntrada(a, b));
  if (!parsed.success) return falhaValidacao(parsed.error);
  const s = parsed.data;
  try {
    const r = await transaction(async (c) => {
      const p = await travarUm(c, s.produto_id);
      const mov = await movimentar(c, p, { tipo: "saida", quantidade: s.quantidade, motivo: s.motivo, observacao: s.observacao });
      return { ...mov, nome: p.nome };
    });
    revalidarPainel();
    return sucesso(
      `Saída de ${un(s.quantidade)} de "${r.nome}" (${ROTULO_MOTIVO[s.motivo].toLowerCase()}). Estoque agora: ${r.saldo}.`,
      { id: r.movimentacaoId, dados: { produto_id: s.produto_id, saldo: r.saldo } },
    );
  } catch (erro) {
    return tratarErro(erro);
  }
}

/**
 * Ajuste de inventário: recebe a CONTAGEM real e grava a diferença (entrada ou saída, motivo
 * ajuste_inventario). Se a contagem já confere, não grava nada e devolve ok sem `id`.
 */
export async function ajustarInventario(
  a: EstadoAcao<DadosMovimentacao & { diferenca: number }> | FormData | AjusteInventarioInput,
  b?: FormData,
): Promise<ResultadoAcao<DadosMovimentacao & { diferenca: number }>> {
  await requireAuth();
  const parsed = ajusteInventarioSchema.safeParse(lerEntrada(a, b));
  if (!parsed.success) return falhaValidacao(parsed.error);
  const { produto_id, contagem, observacao } = parsed.data;
  try {
    const r = await transaction(async (c) => {
      const p = await travarUm(c, produto_id);
      const d = diferencaInventario(p.estoque, contagem);
      if (!d.tipo) return { nome: p.nome, diferenca: 0, saldo: p.estoque, movimentacaoId: undefined };
      const mov = await movimentar(c, p, {
        tipo: d.tipo,
        quantidade: d.quantidade,
        motivo: "ajuste_inventario",
        observacao: observacao || `Contagem: ${contagem}`,
      });
      return { nome: p.nome, diferenca: d.diferenca, ...mov };
    });
    const dados = { produto_id, saldo: r.saldo, diferenca: r.diferenca };
    if (r.diferenca === 0) return sucesso(`A contagem de "${r.nome}" já confere com o sistema (${r.saldo}).`, { dados });
    revalidarPainel();
    const sinal = r.diferenca > 0 ? `+${r.diferenca}` : String(r.diferenca);
    return sucesso(`Inventário de "${r.nome}" ajustado (${sinal}). Estoque agora: ${r.saldo}.`, {
      id: r.movimentacaoId,
      dados,
    });
  } catch (erro) {
    return tratarErro(erro);
  }
}

/**
 * Entrada de vários produtos de uma vez (ex.: fim de uma produção), tudo ou nada.
 * Itens: `itens` (array ou JSON) com { produto_id, quantidade }, OU campos `quantidade_<produtoId>`
 * no FormData (vazios/0 são ignorados). Produtos repetidos são somados.
 */
export async function entradaEmLote(
  a: EstadoAcao<{ itens: number; unidades: number }> | FormData | EntradaLoteInput,
  b?: FormData,
): Promise<ResultadoAcao<{ itens: number; unidades: number }>> {
  await requireAuth();
  const entrada = lerEntrada(a, b);
  if (entrada.itens === undefined) {
    entrada.itens = Object.entries(entrada)
      .filter(([k, v]) => /^quantidade_\d+$/.test(k) && typeof v === "string" && v.trim() !== "" && v.trim() !== "0")
      .map(([k, v]) => ({ produto_id: Number(k.slice("quantidade_".length)), quantidade: v }));
  }
  const parsed = entradaLoteSchema.safeParse(entrada);
  if (!parsed.success) return falhaValidacao(parsed.error);
  const { motivo, observacao } = parsed.data;

  const somados = new Map<number, number>();
  for (const i of parsed.data.itens) somados.set(i.produto_id, (somados.get(i.produto_id) ?? 0) + i.quantidade);

  try {
    await transaction(async (c) => {
      const produtos = await travarProdutos(c, [...somados.keys()]);
      for (const [id, quantidade] of [...somados].sort((x, y) => x[0] - y[0])) {
        const p = produtos.get(id);
        if (!p) throw new ErroNegocio("Um dos produtos não existe mais. Recarregue a página.");
        if (!p.ativo) throw new ErroNegocio(`"${p.nome}" está desativada. Remova-a do lote.`);
        await movimentar(c, p, { tipo: "entrada", quantidade, motivo, observacao: observacao || "Entrada em lote" });
      }
    });
    const unidades = [...somados.values()].reduce((s, q) => s + q, 0);
    revalidarPainel();
    return sucesso(
      `Entrada registrada: ${un(unidades)} em ${somados.size} ${somados.size === 1 ? "produto" : "produtos"}.`,
      { dados: { itens: somados.size, unidades } },
    );
  } catch (erro) {
    return tratarErro(erro);
  }
}
