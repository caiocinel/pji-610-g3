"use server";

import { requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { criarClienteSchema, editarClienteSchema, type CriarClienteInput, type EditarClienteInput } from "../schemas";
import { falha, falhaValidacao, lerEntrada, sucesso, type EstadoAcao, type ResultadoAcao } from "../resultado";
import { revalidarPainel, tratarErro } from "../servidor";

/** Cliente resumido devolvido na criação (para selecionar na hora no PDV). */
export type ClienteCriado = { id: number; nome: string; telefone: string };

/** Cria cliente. Retorna `id` e `dados` { id, nome, telefone } para o cadastro rápido do PDV. */
export async function criarCliente(
  a: EstadoAcao<ClienteCriado> | FormData | CriarClienteInput,
  b?: FormData,
): Promise<ResultadoAcao<ClienteCriado>> {
  await requireAuth();
  const parsed = criarClienteSchema.safeParse(lerEntrada(a, b));
  if (!parsed.success) return falhaValidacao(parsed.error);
  const c = parsed.data;
  try {
    const rows = await query<ClienteCriado>(
      `INSERT INTO clientes (nome, telefone, email, instagram, observacoes)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, nome, telefone`,
      [c.nome, c.telefone, c.email, c.instagram, c.observacoes],
    );
    revalidarPainel();
    return sucesso(`Cliente "${c.nome}" cadastrado.`, { id: rows[0].id, dados: rows[0] });
  } catch (erro) {
    return tratarErro(erro);
  }
}

const COLUNAS = ["nome", "telefone", "email", "instagram", "observacoes"] as const;

/** Edição parcial: campo ausente mantém o valor atual. */
export async function editarCliente(
  a: EstadoAcao | FormData | EditarClienteInput,
  b?: FormData,
): Promise<ResultadoAcao> {
  await requireAuth();
  const parsed = editarClienteSchema.safeParse(lerEntrada(a, b));
  if (!parsed.success) return falhaValidacao(parsed.error);
  const { id, ...dados } = parsed.data;
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const coluna of COLUNAS) {
    if (dados[coluna] === undefined) continue;
    params.push(dados[coluna]);
    sets.push(`${coluna} = $${params.length}`);
  }
  params.push(id);
  try {
    const rows = await query<{ nome: string }>(
      `UPDATE clientes SET ${[...sets, "atualizado_em = now()"].join(", ")} WHERE id = $${params.length} RETURNING nome`,
      params,
    );
    if (rows.length === 0) return falha("Cliente não encontrado.");
    revalidarPainel();
    return sucesso(`Dados de "${rows[0].nome}" atualizados.`, { id });
  } catch (erro) {
    return tratarErro(erro);
  }
}

/** Exclusão lógica: some das buscas e do PDV; o histórico de compras continua. */
export async function desativarCliente(a: EstadoAcao | FormData | { id: number }, b?: FormData): Promise<ResultadoAcao> {
  return alterarAtivo(a, b, false);
}

export async function reativarCliente(a: EstadoAcao | FormData | { id: number }, b?: FormData): Promise<ResultadoAcao> {
  return alterarAtivo(a, b, true);
}

async function alterarAtivo(a: unknown, b: unknown, ativo: boolean): Promise<ResultadoAcao> {
  await requireAuth();
  const id = Number(lerEntrada(a, b).id);
  if (!Number.isInteger(id) || id <= 0) return falha("Cliente inválido.");
  const rows = await query<{ nome: string }>(
    `UPDATE clientes SET ativo = $1, atualizado_em = now() WHERE id = $2 RETURNING nome`,
    [ativo, id],
  );
  if (rows.length === 0) return falha("Cliente não encontrado.");
  revalidarPainel();
  return sucesso(ativo ? `"${rows[0].nome}" reativado.` : `"${rows[0].nome}" desativado.`, { id });
}
