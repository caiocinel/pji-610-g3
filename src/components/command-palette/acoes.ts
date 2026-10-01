"use server";

import { requireAuth } from "@/lib/auth";
import { buscarGlobal, type ResultadoBusca } from "@/lib/consultas/busca";

const VAZIO: ResultadoBusca = { produtos: [], clientes: [], vendas: [] };

/** Server Action da paleta de comandos (Ctrl/Cmd+K). Nunca lança: erro vira `{ erro }`. */
export async function buscarNaPaleta(termo: unknown): Promise<ResultadoBusca & { erro?: string }> {
  await requireAuth();
  if (typeof termo !== "string") return VAZIO;
  try {
    return await buscarGlobal(termo);
  } catch (e) {
    console.error("[paleta] falha na busca", e);
    return { ...VAZIO, erro: "Não foi possível buscar agora. Tente de novo em instantes." };
  }
}
