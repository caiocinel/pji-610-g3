"use client";

import { useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "./cn";

export type OpcaoSegmento<V extends string> = { valor: V; rotulo: ReactNode; icone?: ReactNode; desabilitada?: boolean };

export type SegmentedControlProps<V extends string> = {
  opcoes: OpcaoSegmento<V>[];
  /** Valor controlado. */
  valor?: V;
  /** Valor inicial (não controlado). */
  valorPadrao?: V;
  onChange?: (valor: V) => void;
  /** Se informado, envia o valor num input hidden (para formulários). */
  name?: string;
  /** Rótulo acessível do grupo. */
  rotulo: string;
  tamanho?: "sm" | "md";
  /** Ocupa toda a largura, dividindo igualmente. */
  larguraTotal?: boolean;
  className?: string;
};

/**
 * Escolha única entre poucas opções (estado local, sem URL). Ex.: desconto em "R$" | "%",
 * forma de pagamento. Teclado: setas esquerda/direita.
 */
export function SegmentedControl<V extends string>({
  opcoes,
  valor,
  valorPadrao,
  onChange,
  name,
  rotulo,
  tamanho = "md",
  larguraTotal,
  className,
}: SegmentedControlProps<V>) {
  const [interno, setInterno] = useState<V | undefined>(valorPadrao ?? opcoes[0]?.valor);
  const atual = valor ?? interno;
  const grupo = useId();

  function escolher(v: V) {
    if (valor === undefined) setInterno(v);
    onChange?.(v);
  }

  function teclado(e: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const habilitadas = opcoes.filter((o) => !o.desabilitada);
    const i = habilitadas.findIndex((o) => o.valor === atual);
    const passo = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1;
    const prox = habilitadas[(i + passo + habilitadas.length) % habilitadas.length];
    if (!prox) return;
    escolher(prox.valor);
    document.getElementById(`${grupo}-${prox.valor}`)?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={rotulo}
      onKeyDown={teclado}
      className={cn(
        "gap-1 rounded-xl border border-linha bg-areia/70 p-1",
        larguraTotal ? "grid w-full auto-cols-fr grid-flow-col" : "inline-flex max-w-full",
        className,
      )}
    >
      {name && <input type="hidden" name={name} value={atual ?? ""} />}
      {opcoes.map((o) => {
        const ativo = o.valor === atual;
        return (
          <button
            key={o.valor}
            id={`${grupo}-${o.valor}`}
            type="button"
            role="radio"
            aria-checked={ativo}
            tabIndex={ativo ? 0 : -1}
            disabled={o.desabilitada}
            onClick={() => escolher(o.valor)}
            className={cn(
              "inline-flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-3 font-medium whitespace-nowrap transition disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0",
              tamanho === "sm" ? "h-10 text-xs sm:h-8" : "h-10 text-sm sm:h-9",
              ativo ? "bg-papel text-tinta shadow-suave" : "text-suave hover:text-tinta",
            )}
          >
            {o.icone}
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}
