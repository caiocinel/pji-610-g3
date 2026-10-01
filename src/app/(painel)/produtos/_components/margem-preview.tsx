"use client";

import { HandCoins, Wand2 } from "lucide-react";
import { ProgressBar, cn } from "@/components/ui";
import { calcularMargem, precoPorMargem } from "@/lib/dominio";
import { formatBRL, formatPercent } from "@/lib/format";
import { CLASSE_TEXTO_MARGEM, MARGENS_SUGERIDAS, resumoMargem, tomMargem } from "./margem";

const FUNDO: Record<ReturnType<typeof tomMargem>, string> = {
  alerta: "border-alerta/30 bg-alerta-clara",
  mel: "border-mel/30 bg-mel-clara",
  salvia: "border-salvia/30 bg-salvia-clara",
  neutro: "border-linha bg-areia/50",
};

/** Lucro e margem ao vivo + atalhos de preço sugerido a partir do custo. */
export function MargemPreview({
  preco,
  custo,
  onSugerirPreco,
  className,
}: {
  preco: number | null;
  custo: number | null;
  onSugerirPreco: (preco: number) => void;
  className?: string;
}) {
  const c = custo ?? 0;
  const temPreco = preco !== null && preco > 0;
  const { lucro, margem, markup } = calcularMargem(temPreco ? preco : 0, c);
  const m = temPreco ? margem : null;
  const tom = tomMargem(m);
  const sugestoes =
    c > 0
      ? MARGENS_SUGERIDAS.map((alvo) => ({ alvo, valor: precoPorMargem(c, alvo) })).filter(
          (s): s is { alvo: (typeof MARGENS_SUGERIDAS)[number]; valor: number } => s.valor !== null,
        )
      : [];

  return (
    <div className={cn("rounded-xl border p-4", FUNDO[tom], className)}>
      <div aria-live="polite" aria-atomic="true">
        <div className="flex items-start gap-3">
          <span className="hidden size-9 shrink-0 items-center justify-center rounded-lg bg-papel sm:flex text-tinta shadow-suave">
            <HandCoins aria-hidden className="size-[18px]" />
          </span>
          <dl className="grid min-w-0 flex-1 grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="min-w-0">
              <dt className="text-xs font-medium text-suave">Lucro por vela</dt>
              <dd className={cn("tabular mt-0.5 font-serif text-lg font-semibold sm:text-xl", temPreco ? CLASSE_TEXTO_MARGEM[tom] : "text-suave")}>
                {temPreco ? formatBRL(lucro) : "—"}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs font-medium text-suave">Margem</dt>
              <dd className={cn("tabular mt-0.5 font-serif text-lg font-semibold sm:text-xl", CLASSE_TEXTO_MARGEM[tom])}>
                {formatPercent(m)}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs font-medium text-suave" title="Quanto o preço está acima do custo">
                Sobre o custo
              </dt>
              <dd className="tabular mt-0.5 font-serif text-lg font-semibold sm:text-xl text-tinta">
                {temPreco && markup !== null ? formatPercent(markup, { sinal: true }) : "—"}
              </dd>
            </div>
          </dl>
        </div>
        {m !== null && m > 0 && (
          <ProgressBar
            valor={Math.min(m, 1) * 100}
            max={100}
            tom={tom === "salvia" ? "salvia" : "mel"}
            rotulo={`Margem de ${formatPercent(m)}`}
            className="mt-3"
          />
        )}
        <p className="mt-2 text-sm text-tinta">{resumoMargem(m, c)}</p>
      </div>

      {sugestoes.length > 0 && (
        <div className="mt-3 border-t border-linha/70 pt-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-suave">
            <Wand2 aria-hidden className="size-3.5" />
            Sugerir preço pela margem
          </p>
          <div className="flex flex-wrap gap-2">
            {sugestoes.map((s) => {
              const ativo = preco !== null && Math.abs(preco - s.valor) < 0.005;
              return (
                <button
                  key={s.alvo}
                  type="button"
                  onClick={() => onSugerirPreco(s.valor)}
                  aria-pressed={ativo}
                  aria-label={`Usar ${formatBRL(s.valor)} (margem de ${formatPercent(s.alvo, { casas: 0 })})`}
                  className={cn(
                    "inline-flex h-10 items-center gap-1.5 rounded-full border px-3 text-sm transition sm:h-9",
                    ativo
                      ? "border-chama bg-chama text-sobre"
                      : "border-linha-forte bg-papel text-tinta hover:border-chama hover:bg-chama-clara",
                  )}
                >
                  <span className="tabular font-semibold">{formatBRL(s.valor)}</span>
                  <span className={cn("text-xs", ativo ? "text-sobre/90" : "text-suave")}>
                    {formatPercent(s.alvo, { casas: 0 })}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
