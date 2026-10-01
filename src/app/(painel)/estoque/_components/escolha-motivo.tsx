"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/components/ui";

export type OpcaoMotivo<V extends string> = { valor: V; rotulo: string; descricao?: string; icone?: ReactNode };

/** Grupo de rádios em cartões (motivo da entrada/saída). Funciona com teclado (setas) por ser rádio nativo. */
export function EscolhaMotivo<V extends string>({
  legenda,
  opcoes,
  valor,
  onChange,
  name,
  erro,
  colunas = 2,
}: {
  legenda: string;
  opcoes: OpcaoMotivo<V>[];
  valor: V;
  onChange: (v: V) => void;
  name?: string;
  erro?: string;
  colunas?: 2 | 3;
}) {
  const grupo = useId();
  return (
    <fieldset aria-describedby={erro ? `${grupo}-erro` : undefined}>
      <legend className="rotulo">{legenda}</legend>
      <div className={cn("grid gap-2", colunas === 3 ? "grid-cols-3" : "grid-cols-2")}>
        {opcoes.map((o) => {
          const marcado = o.valor === valor;
          return (
            <label
              key={o.valor}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border py-2 text-sm transition",
                colunas === 3 ? "justify-center px-2 text-center" : "px-3",
                "has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-chama/30",
                marcado
                  ? "border-chama bg-chama-clara font-medium text-chama-escura"
                  : "border-linha-forte bg-papel text-tinta hover:bg-areia",
              )}
            >
              <input
                type="radio"
                name={name ?? grupo}
                value={o.valor}
                checked={marcado}
                onChange={() => onChange(o.valor)}
                className="sr-only"
              />
              {o.icone && colunas !== 3 && <span className="shrink-0 [&_svg]:size-4" aria-hidden>{o.icone}</span>}
              <span className="min-w-0 leading-tight">
                {o.rotulo}
                {o.descricao && <span className="block text-xs font-normal text-suave">{o.descricao}</span>}
              </span>
            </label>
          );
        })}
      </div>
      {erro && (
        <p id={`${grupo}-erro`} className="mt-1.5 text-xs font-medium text-alerta">
          {erro}
        </p>
      )}
    </fieldset>
  );
}
