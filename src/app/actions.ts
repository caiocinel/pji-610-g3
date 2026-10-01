"use server";

// Resto da v1: só o `logout` continua aqui (importado pelo menu e pela paleta de comandos).
// Não adicione outras actions neste arquivo: o login fica em src/app/login/actions.ts (com limite
// de tentativas) e as ações de escrita em src/lib/dominio/acoes.
import { redirect } from "next/navigation";
import { destroySession } from "@/lib/auth";

export async function logout() {
  await destroySession();
  redirect("/login");
}
