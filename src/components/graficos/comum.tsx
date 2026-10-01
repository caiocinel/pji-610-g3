"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { formatBRL, formatBRLCompacto, formatInt } from "@/lib/format";

// Peças compartilhadas pelos gráficos recharts (cliente).

export type FormatoValor = "brl" | "int";

export const formatar = (v: number, formato: FormatoValor) => (formato === "brl" ? formatBRL(v) : formatInt(v));
export const formatarEixo = (v: number, formato: FormatoValor) =>
  formato === "brl" ? (v === 0 ? "R$ 0" : formatBRLCompacto(v)) : formatInt(v);

/** Estilo de eixo recessivo: texto suave, sem linha/traço. */
export const EIXO = {
  tick: { fill: "var(--color-suave)", fontSize: 12 },
  axisLine: false,
  tickLine: false,
} as const;

const consultaMovimento = "(prefers-reduced-motion: reduce)";

/** true quando o sistema pede menos animação (desliga as animações do recharts). */
export function useMovimentoReduzido() {
  return useSyncExternalStore(
    (avisar) => {
      const mq = window.matchMedia(consultaMovimento);
      mq.addEventListener("change", avisar);
      return () => mq.removeEventListener("change", avisar);
    },
    () => window.matchMedia(consultaMovimento).matches,
    () => true,
  );
}

/** Caixa do tooltip (fundo papel, borda linha). */
export function CaixaDica({ titulo, children }: { titulo: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-44 rounded-lg border border-linha bg-papel px-3 py-2.5 text-sm shadow-elevado">
      <p className="mb-1.5 text-xs font-medium text-suave">{titulo}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

/** Linha do tooltip: marcador da série + rótulo + valor (texto sempre na cor de texto, nunca na da série). */
export function LinhaDica({ cor, rotulo, valor, tracejado }: { cor?: string; rotulo: string; valor: string; tracejado?: boolean }) {
  return (
    <p className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-2 text-suave">
        {cor && <MarcaSerie cor={cor} linha={tracejado} />}
        {rotulo}
      </span>
      <span className="tabular font-semibold text-tinta">{valor}</span>
    </p>
  );
}

/** Marcador de série para legendas e tooltips. */
export function MarcaSerie({ cor, linha }: { cor: string; linha?: boolean }) {
  return linha ? (
    <span aria-hidden className="inline-block h-0.5 w-3.5 shrink-0 rounded-full" style={{ background: cor }} />
  ) : (
    <span aria-hidden className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: cor }} />
  );
}
