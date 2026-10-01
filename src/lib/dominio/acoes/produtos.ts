"use server";

import { requireAuth } from "@/lib/auth";
import { query, transaction } from "@/lib/db";
import { getConfiguracoes } from "../configuracoes";
import {
  criarProdutoSchema,
  editarProdutoSchema,
  type CriarProdutoInput,
  type EditarProdutoInput,
} from "../schemas";
import { falha, falhaValidacao, lerEntrada, sucesso, type EstadoAcao, type ResultadoAcao } from "../resultado";
import { movimentar, revalidarPainel, tratarErro } from "../servidor";

const MSG_SKU = "Já existe outro produto com esse SKU.";
const MSG_CATEGORIA = "A categoria escolhida não existe mais.";

/** Erro do banco ao gravar produto; SKU duplicado volta marcado no campo `sku` para o formulário destacar. */
function erroProduto(erro: unknown) {
  const f = tratarErro(erro, { unico: MSG_SKU, fk: MSG_CATEGORIA });
  return f.erro === MSG_SKU ? falha(MSG_SKU, { sku: MSG_SKU }) : f;
}

/** Cria produto. Se `estoque_inicial` > 0, grava movimentação "estoque_inicial". Retorna `id`. */
export async function criarProduto(
  a: EstadoAcao | FormData | CriarProdutoInput,
  b?: FormData,
): Promise<ResultadoAcao> {
  await requireAuth();
  const parsed = criarProdutoSchema.safeParse(lerEntrada(a, b));
  if (!parsed.success) return falhaValidacao(parsed.error);
  const p = parsed.data;
  const estoqueMinimo = p.estoque_minimo ?? (await getConfiguracoes()).estoque_minimo_padrao;

  try {
    const id = await transaction(async (c) => {
      const { rows } = await c.query<{ id: number }>(
        `INSERT INTO produtos (nome, aroma, descricao, categoria_id, preco, custo, sku, peso_g,
                               tempo_queima_h, estoque, estoque_minimo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $10) RETURNING id`,
        [p.nome, p.aroma, p.descricao, p.categoria_id, p.preco, p.custo, p.sku, p.peso_g, p.tempo_queima_h, estoqueMinimo],
      );
      const novo = { id: rows[0].id, nome: p.nome, aroma: p.aroma, preco: p.preco, custo: p.custo, estoque: 0, ativo: true };
      if (p.estoque_inicial > 0) {
        await movimentar(c, novo, {
          tipo: "entrada",
          quantidade: p.estoque_inicial,
          motivo: "estoque_inicial",
          observacao: "Estoque inicial",
        });
      }
      return novo.id;
    });
    revalidarPainel();
    return sucesso(`"${p.nome}" cadastrada com sucesso.`, { id });
  } catch (erro) {
    return erroProduto(erro);
  }
}

const COLUNAS_EDITAVEIS = [
  "nome",
  "aroma",
  "descricao",
  "categoria_id",
  "preco",
  "custo",
  "sku",
  "peso_g",
  "tempo_queima_h",
  "estoque_minimo",
] as const;

/**
 * Edição parcial: só altera os campos enviados (ausente = mantém). Nunca altera o estoque
 * (use as ações de estoque, que geram histórico). Funciona também para produtos desativados.
 */
export async function editarProduto(
  a: EstadoAcao | FormData | EditarProdutoInput,
  b?: FormData,
): Promise<ResultadoAcao> {
  await requireAuth();
  const parsed = editarProdutoSchema.safeParse(lerEntrada(a, b));
  if (!parsed.success) return falhaValidacao(parsed.error);
  const { id, ...dados } = parsed.data;

  const sets: string[] = [];
  const params: unknown[] = [];
  for (const coluna of COLUNAS_EDITAVEIS) {
    const valor = dados[coluna];
    if (valor === undefined) continue;
    params.push(valor);
    sets.push(`${coluna} = $${params.length}`);
  }
  params.push(id);

  try {
    const r = await transaction(async (c) => {
      const { rows } = await c.query<{ nome: string }>(
        `UPDATE produtos SET ${[...sets, "atualizado_em = now()"].join(", ")}
         WHERE id = $${params.length} RETURNING nome`,
        params,
      );
      if (rows.length === 0) return null;
      // Vendas com custo 0 foram feitas antes de o custo ser cadastrado (inclusive as da v1): passam a
      // usar este custo, senão o lucro bruto e a margem delas apareceriam como 100%.
      let vendasAtualizadas = 0;
      if (dados.custo != null && dados.custo > 0) {
        const { rowCount } = await c.query(
          `UPDATE itens_venda SET custo_unitario = $1 WHERE produto_id = $2 AND custo_unitario = 0`,
          [dados.custo, id],
        );
        vendasAtualizadas = rowCount ?? 0;
      }
      return { nome: rows[0].nome, vendasAtualizadas };
    });
    if (!r) return falha("Produto não encontrado.");
    revalidarPainel();
    const extra =
      r.vendasAtualizadas > 0
        ? ` O custo também foi aplicado a ${r.vendasAtualizadas === 1 ? "1 venda antiga que estava" : `${r.vendasAtualizadas} vendas antigas que estavam`} sem custo.`
        : "";
    return sucesso(`"${r.nome}" atualizada.${extra}`, { id });
  } catch (erro) {
    return erroProduto(erro);
  }
}

/** Cria uma cópia "Nome (cópia)" com estoque 0 e sem SKU. Retorna o `id` da cópia. */
export async function duplicarProduto(a: EstadoAcao | FormData | { id: number }, b?: FormData): Promise<ResultadoAcao> {
  await requireAuth();
  const id = Number(lerEntrada(a, b).id);
  if (!Number.isInteger(id) || id <= 0) return falha("Produto inválido.");
  try {
    const rows = await query<{ id: number; nome: string }>(
      `INSERT INTO produtos (nome, aroma, descricao, categoria_id, preco, custo, sku, peso_g,
                             tempo_queima_h, estoque, estoque_minimo)
       SELECT left(nome || ' (cópia)', 120), aroma, descricao, categoria_id, preco, custo, NULL, peso_g,
              tempo_queima_h, 0, estoque_minimo
       FROM produtos WHERE id = $1
       RETURNING id, nome`,
      [id],
    );
    if (rows.length === 0) return falha("Produto não encontrado.");
    revalidarPainel();
    return sucesso(`Cópia criada: "${rows[0].nome}".`, { id: rows[0].id });
  } catch (erro) {
    return tratarErro(erro);
  }
}

/** Exclusão lógica (some das listas e do PDV; histórico preservado). */
export async function desativarProduto(a: EstadoAcao | FormData | { id: number }, b?: FormData): Promise<ResultadoAcao> {
  return alterarAtivo(a, b, false);
}

/** Desfaz a desativação. */
export async function reativarProduto(a: EstadoAcao | FormData | { id: number }, b?: FormData): Promise<ResultadoAcao> {
  return alterarAtivo(a, b, true);
}

async function alterarAtivo(a: unknown, b: unknown, ativo: boolean): Promise<ResultadoAcao> {
  await requireAuth();
  const id = Number(lerEntrada(a, b).id);
  if (!Number.isInteger(id) || id <= 0) return falha("Produto inválido.");
  const rows = await query<{ nome: string }>(
    `UPDATE produtos SET ativo = $1, atualizado_em = now() WHERE id = $2 RETURNING nome`,
    [ativo, id],
  );
  if (rows.length === 0) return falha("Produto não encontrado.");
  revalidarPainel();
  return sucesso(ativo ? `"${rows[0].nome}" reativada.` : `"${rows[0].nome}" desativada.`, { id });
}
