"use server";

import { requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { criarCategoriaSchema, renomearCategoriaSchema } from "../schemas";
import { falha, falhaValidacao, lerEntrada, sucesso, type EstadoAcao, type ResultadoAcao } from "../resultado";
import { revalidarPainel, tratarErro } from "../servidor";

const MSG_DUPLICADA = "Já existe uma categoria com esse nome.";

/** Cria categoria. Retorna `id` e `dados.nome` (útil para a criação rápida no formulário de produto). */
export async function criarCategoria(
  a: EstadoAcao<{ nome: string }> | FormData | { nome: string },
  b?: FormData,
): Promise<ResultadoAcao<{ nome: string }>> {
  await requireAuth();
  const parsed = criarCategoriaSchema.safeParse(lerEntrada(a, b));
  if (!parsed.success) return falhaValidacao(parsed.error);
  try {
    const rows = await query<{ id: number; nome: string }>(
      `INSERT INTO categorias (nome) VALUES ($1) RETURNING id, nome`,
      [parsed.data.nome],
    );
    revalidarPainel();
    return sucesso(`Categoria "${rows[0].nome}" criada.`, { id: rows[0].id, dados: { nome: rows[0].nome } });
  } catch (erro) {
    return tratarErro(erro, { unico: MSG_DUPLICADA });
  }
}

export async function renomearCategoria(
  a: EstadoAcao | FormData | { id: number; nome: string },
  b?: FormData,
): Promise<ResultadoAcao> {
  await requireAuth();
  const parsed = renomearCategoriaSchema.safeParse(lerEntrada(a, b));
  if (!parsed.success) return falhaValidacao(parsed.error);
  try {
    const rows = await query(`UPDATE categorias SET nome = $1 WHERE id = $2 RETURNING id`, [
      parsed.data.nome,
      parsed.data.id,
    ]);
    if (rows.length === 0) return falha("Categoria não encontrada.");
    revalidarPainel();
    return sucesso(`Categoria renomeada para "${parsed.data.nome}".`, { id: parsed.data.id });
  } catch (erro) {
    return tratarErro(erro, { unico: MSG_DUPLICADA });
  }
}

/** Só exclui se nenhum produto ATIVO usa a categoria (produtos desativados ficam sem categoria). */
export async function excluirCategoria(a: EstadoAcao | FormData | { id: number }, b?: FormData): Promise<ResultadoAcao> {
  await requireAuth();
  const id = Number(lerEntrada(a, b).id);
  if (!Number.isInteger(id) || id <= 0) return falha("Categoria inválida.");
  const [uso] = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM produtos WHERE categoria_id = $1 AND ativo`,
    [id],
  );
  if (uso.n > 0) {
    return falha(
      uso.n === 1
        ? "Não dá para excluir: 1 produto usa esta categoria. Mude a categoria dele antes."
        : `Não dá para excluir: ${uso.n} produtos usam esta categoria. Mude a categoria deles antes.`,
    );
  }
  const rows = await query<{ nome: string }>(`DELETE FROM categorias WHERE id = $1 RETURNING nome`, [id]);
  if (rows.length === 0) return falha("Categoria não encontrada.");
  revalidarPainel();
  return sucesso(`Categoria "${rows[0].nome}" excluída.`, { id });
}
