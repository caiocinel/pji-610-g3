"use client";

import { useId, type ReactNode } from "react";
import { cn } from "./cn";

/**
 * Dica curta ao passar o mouse ou focar (teclado). Não use para informação essencial:
 * no celular não há hover, então o texto também deve existir de outra forma (rótulo, aria-label).
 * O filho deve ser focável (botão/link) para funcionar no teclado.
 */
export function Tooltip({
  conteudo,
  children,
  lado = "cima",
  className,
}: {
  conteudo: ReactNode;
  children: ReactNode;
  lado?: "cima" | "baixo";
  className?: string;
}) {
  const id = useId();
  return (
    <span className={cn("group/dica relative inline-flex", className)}>
      {children}
      <span
        id={id}
        role="tooltip"
        className={cn(
          "pointer-events-none invisible absolute left-1/2 z-50 w-max max-w-60 -translate-x-1/2 rounded-md bg-tinta px-2 py-1 text-xs font-medium text-creme opacity-0 shadow-elevado transition-opacity duration-150",
          "group-focus-within/dica:visible group-focus-within/dica:opacity-100 group-hover/dica:visible group-hover/dica:opacity-100 group-hover/dica:delay-300",
          lado === "cima" ? "bottom-full mb-1.5" : "top-full mt-1.5",
        )}
      >
        {conteudo}
      </span>
    </span>
  );
}
