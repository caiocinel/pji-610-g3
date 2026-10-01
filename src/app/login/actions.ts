"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSession } from "@/lib/auth";
import { credenciaisValidas } from "@/lib/dominio/configuracoes";
import { limiteLogin, limiteLoginGlobal, textoEspera } from "@/lib/rate-limit";
import { destinoInterno } from "./destino";

export type EstadoLogin = {
  erro: string;
  /** Usuário digitado, para não precisar redigitar. */
  usuario: string;
  /** Muda a cada tentativa (remonta o campo com o usuário mantido). */
  tentativa: number;
  bloqueado?: boolean;
  /** Tentativas restantes antes do bloqueio (só quando poucas). */
  restantes?: number;
} | null;

/**
 * IP do visitante, a partir do cabeçalho que o proxy reverso SOBRESCREVE (configurável em
 * LOGIN_IP_HEADER): "x-real-ip" (padrão; o nginx precisa de `proxy_set_header X-Real-IP $remote_addr;`),
 * "x-forwarded-for" (usa só o último salto, o que o proxy adicionou) ou "nenhum" (sem limite por IP;
 * só o limite global vale). Um cabeçalho que o proxy não sobrescreve pode ser forjado pelo cliente —
 * por isso existe também o limite global, que não depende do IP.
 */
async function ipCliente() {
  const modo = (process.env.LOGIN_IP_HEADER ?? "x-real-ip").trim().toLowerCase();
  if (modo === "nenhum") return "todos";
  const h = await headers();
  if (modo === "x-forwarded-for") {
    return h.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean).at(-1)?.slice(0, 64) ?? "local";
  }
  return h.get("x-real-ip")?.trim().slice(0, 64) || "local";
}

const CHAVE_GLOBAL = "admin";

function respostaBloqueio(esperaMs: number, usuario: string, tentativa: number): EstadoLogin {
  return {
    erro: `Muitas tentativas seguidas. Por segurança, aguarde ${textoEspera(esperaMs)} e tente de novo.`,
    usuario,
    tentativa,
    bloqueado: true,
  };
}

export async function entrar(anterior: EstadoLogin, formData: FormData): Promise<EstadoLogin> {
  const usuario = String(formData.get("usuario") ?? "").trim().slice(0, 100);
  const senha = String(formData.get("senha") ?? "").slice(0, 200);
  const tentativa = (anterior?.tentativa ?? 0) + 1;

  if (!usuario || !senha) {
    return { erro: "Preencha o usuário e a senha.", usuario, tentativa };
  }

  const ip = await ipCliente();

  // Reserva a tentativa ANTES da verificação (lenta): requisições simultâneas não passam todas juntas.
  const global = limiteLoginGlobal.reservar(CHAVE_GLOBAL);
  if (global.bloqueado) return respostaBloqueio(global.esperaMs, usuario, tentativa);
  const porIp = limiteLogin.reservar(ip);
  if (porIp.bloqueado) {
    limiteLoginGlobal.liberar(CHAVE_GLOBAL);
    return respostaBloqueio(porIp.esperaMs, usuario, tentativa);
  }

  let valido = false;
  try {
    valido = await credenciaisValidas(usuario, senha);
    if (!valido) {
      // Atraso pequeno para dificultar tentativas em massa (a reserva continua valendo enquanto isso).
      await new Promise((r) => setTimeout(r, 600));
    }
  } finally {
    limiteLogin.liberar(ip);
    limiteLoginGlobal.liberar(CHAVE_GLOBAL);
  }

  if (!valido) {
    const depoisGlobal = limiteLoginGlobal.registrarFalha(CHAVE_GLOBAL);
    const depois = limiteLogin.registrarFalha(ip);
    if (depois.bloqueado || depoisGlobal.bloqueado) {
      const espera = Math.max(depois.bloqueado ? depois.esperaMs : 0, depoisGlobal.bloqueado ? depoisGlobal.esperaMs : 0);
      return {
        erro: `Muitas tentativas seguidas. Por segurança, o acesso foi pausado por ${textoEspera(espera)}.`,
        usuario,
        tentativa,
        bloqueado: true,
      };
    }
    return {
      erro: "Usuário ou senha incorretos.",
      usuario,
      tentativa,
      restantes: depois.restantes <= 2 ? depois.restantes : undefined,
    };
  }

  limiteLogin.limpar(ip);
  await createSession();
  redirect(destinoInterno(formData.get("de")) ?? "/");
}
