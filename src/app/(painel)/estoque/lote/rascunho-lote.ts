"use client";

// Rascunho do lote guardado no navegador (como o do PDV): se a usuária sair da tela sem registrar,
// dá para retomar. Nada aqui é confiável: só voltam produtos que ainda estão na lista.
import { useSyncExternalStore } from "react";
import { MOTIVOS_ENTRADA, type MotivoEntrada } from "@/lib/dominio";

const CHAVE = "luamme:estoque:lote:v1";
const EVENTO = "luamme:estoque:lote";

export type RascunhoLote = { qtd: Record<number, number>; motivo: MotivoEntrada; observacao: string };

function ler(): string | null {
  try {
    return window.localStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}

function inscrever(aviso: () => void) {
  window.addEventListener("storage", aviso);
  window.addEventListener(EVENTO, aviso);
  return () => {
    window.removeEventListener("storage", aviso);
    window.removeEventListener(EVENTO, aviso);
  };
}

/** Texto bruto do rascunho salvo (null no servidor ou se não houver). */
export function useRascunhoLote(): string | null {
  return useSyncExternalStore(inscrever, ler, () => null);
}

/** Grava o rascunho; sem unidades (ou com null), apaga. `avisar` atualiza quem lê nesta aba. */
export function salvarRascunhoLote(r: RascunhoLote | null, avisar = false) {
  try {
    if (r && Object.values(r.qtd).some((n) => n > 0)) window.localStorage.setItem(CHAVE, JSON.stringify(r));
    else window.localStorage.removeItem(CHAVE);
  } catch {
    // armazenamento bloqueado (aba anônima etc.): segue sem rascunho
  }
  if (avisar) window.dispatchEvent(new Event(EVENTO));
}

/** Interpreta o rascunho, mantendo só produtos que ainda existem e quantidades válidas. */
export function interpretarRascunhoLote(
  bruto: string | null,
  idsValidos: Set<number>,
): (RascunhoLote & { velas: number; unidades: number }) | null {
  if (!bruto) return null;
  let dado: Partial<RascunhoLote>;
  try {
    dado = JSON.parse(bruto) as Partial<RascunhoLote>;
  } catch {
    return null;
  }
  if (!dado || typeof dado.qtd !== "object" || dado.qtd === null) return null;
  const qtd: Record<number, number> = {};
  let unidades = 0;
  for (const [chave, valor] of Object.entries(dado.qtd)) {
    const id = Number(chave);
    const n = Math.floor(Number(valor));
    if (!idsValidos.has(id) || !(n > 0) || n > 100000) continue;
    qtd[id] = n;
    unidades += n;
  }
  const velas = Object.keys(qtd).length;
  if (velas === 0) return null;
  return {
    qtd,
    motivo: (MOTIVOS_ENTRADA as readonly string[]).includes(dado.motivo ?? "") ? (dado.motivo as MotivoEntrada) : "producao",
    observacao: typeof dado.observacao === "string" ? dado.observacao.slice(0, 300) : "",
    velas,
    unidades,
  };
}
