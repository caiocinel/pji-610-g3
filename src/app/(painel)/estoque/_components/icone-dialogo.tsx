import type { ReactNode } from "react";

/** Pastilha redonda do ícone no cabeçalho dos diálogos (mesmo visual do PDV e do cadastro rápido). */
export function IconeDialogo({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-chama-clara text-chama-escura [&_svg]:size-5"
    >
      {children}
    </span>
  );
}
