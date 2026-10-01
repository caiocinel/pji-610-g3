import "server-only";
import { revalidatePath } from "next/cache";
import type { PoolClient } from "pg";
import type { MotivoMovimentacao, TipoMovimentacao } from "./enums";
import { falha, type Falha } from "./resultado";

/**
 * Todas as telas do painel são dinâmicas (dependem do cookie de sessão), mas o Router Cache do
 * navegador guarda páginas visitadas: invalidamos o layout raiz para que dashboard, listas,
 * detalhes e relatórios reflitam a mudança imediatamente.
 */
export function revalidarPainel() {
  revalidatePath("/", "layout");
}

export class ErroNegocio extends Error {}

/** Traduz erros conhecidos do Postgres/negócio em Falha amigável; relança o resto. */
export function tratarErro(erro: unknown, mensagens: { unico?: string; fk?: string } = {}): Falha {
  if (erro instanceof ErroNegocio) return falha(erro.message);
  const codigo = (erro as { code?: string })?.code;
  if (codigo === "23505") return falha(mensagens.unico ?? "Já existe um registro com esses dados.");
  if (codigo === "23503") return falha(mensagens.fk ?? "Registro relacionado não encontrado.");
  if (codigo === "23514") return falha("Algum valor está fora do permitido. Confira os dados.");
  if (codigo === "22003") return falha("Valor alto demais. Confira os preços e as quantidades digitadas.");
  console.error(erro);
  return falha("Não foi possível salvar agora. Tente novamente em instantes.");
}

export type ProdutoTravado = {
  id: number;
  nome: string;
  aroma: string;
  preco: number;
  custo: number;
  estoque: number;
  ativo: boolean;
};

/** "Nome – Aroma" para mensagens: com vários aromas do mesmo produto, a usuária precisa saber qual é. */
export function nomeComAroma(p: { nome: string; aroma?: string | null }): string {
  return p.aroma ? `${p.nome} – ${p.aroma}` : p.nome;
}

/** Trava (FOR UPDATE) os produtos em ordem de id para evitar deadlock entre transações. */
export async function travarProdutos(c: PoolClient, ids: number[]): Promise<Map<number, ProdutoTravado>> {
  const { rows } = await c.query<ProdutoTravado>(
    `SELECT id, nome, aroma, preco, custo, estoque, ativo FROM produtos
     WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE`,
    [[...new Set(ids)]],
  );
  return new Map(rows.map((r) => [r.id, r]));
}

/**
 * Aplica uma movimentação num produto JÁ TRAVADO: atualiza `produtos.estoque` e grava a linha em
 * `movimentacoes_estoque` com `saldo_apos`. Lança ErroNegocio se o saldo ficaria negativo.
 * Atualiza o objeto `produto` em memória com o novo estoque.
 */
export async function movimentar(
  c: PoolClient,
  produto: ProdutoTravado,
  mov: {
    tipo: TipoMovimentacao;
    quantidade: number;
    motivo: MotivoMovimentacao;
    observacao?: string;
    vendaId?: number | null;
  },
): Promise<{ movimentacaoId: number; saldo: number }> {
  const saldo = produto.estoque + (mov.tipo === "entrada" ? mov.quantidade : -mov.quantidade);
  if (saldo < 0) {
    throw new ErroNegocio(
      `Estoque insuficiente para "${nomeComAroma(produto)}": só há ${produto.estoque} (pedido: ${mov.quantidade}).`,
    );
  }
  await c.query(`UPDATE produtos SET estoque = $1, atualizado_em = now() WHERE id = $2`, [saldo, produto.id]);
  const { rows } = await c.query<{ id: number }>(
    `INSERT INTO movimentacoes_estoque (produto_id, tipo, quantidade, motivo, saldo_apos, observacao, venda_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [produto.id, mov.tipo, mov.quantidade, mov.motivo, saldo, mov.observacao ?? "", mov.vendaId ?? null],
  );
  produto.estoque = saldo;
  return { movimentacaoId: rows[0].id, saldo };
}
