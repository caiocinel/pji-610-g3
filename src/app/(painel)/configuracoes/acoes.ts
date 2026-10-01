"use server";

import { redirect } from "next/navigation";
import { requireAuth, revogarTodasSessoes } from "@/lib/auth";

/** Desconecta todos os aparelhos (inclusive este): qualquer cookie emitido até agora deixa de valer. */
export async function sairDeTodosAparelhos() {
  await requireAuth();
  await revogarTodasSessoes();
  redirect("/login");
}
