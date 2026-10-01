"use server";

import { requireAuth } from "@/lib/auth";
import { clienteComTelefone } from "@/lib/consultas/clientes";

/** Leitura usada pelo formulário para avisar (sem bloquear) quando o telefone já está cadastrado. */
export async function verificarTelefone(
  telefone: string,
  ignorarId?: number,
): Promise<{ id: number; nome: string; ativo: boolean } | null> {
  await requireAuth();
  if (typeof telefone !== "string" || telefone.length > 40) return null;
  const id = Number.isInteger(ignorarId) && (ignorarId ?? 0) > 0 ? ignorarId : undefined;
  try {
    return await clienteComTelefone(telefone, id);
  } catch {
    return null;
  }
}
