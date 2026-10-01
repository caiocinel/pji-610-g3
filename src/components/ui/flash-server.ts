import "server-only";
import { cookies } from "next/headers";
import { COOKIE_FLASH, type MensagemFlash } from "./flash-tipos";

/**
 * Agenda um toast para aparecer na PRÓXIMA página (use antes de redirect() numa Server Action).
 *   await flashToast("Produto salvo.");
 *   redirect(`/produtos/${id}`);
 * O <Toaster /> do layout raiz lê o cookie ao navegar e mostra a mensagem.
 */
export async function flashToast(mensagem: string, tipo: MensagemFlash["tipo"] = "sucesso") {
  const jar = await cookies();
  // O Next já aplica encodeURIComponent no valor; o cliente decodifica.
  jar.set(COOKIE_FLASH, JSON.stringify({ tipo, mensagem } satisfies MensagemFlash), {
    path: "/",
    maxAge: 60,
    sameSite: "lax",
    httpOnly: false,
  });
}
