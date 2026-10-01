import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "./cn";

export type ItemAba = {
  rotulo: ReactNode;
  href: string;
  ativo?: boolean;
  /** Número ao lado do rótulo (ex.: quantidade de itens). */
  contagem?: number;
  icone?: ReactNode;
};

/**
 * Abas como links (cada aba é uma URL: ?aba=… ou rota). Quem chama decide qual está ativa.
 * Rola horizontalmente no celular, sem barra visível.
 */
export function TabsLinks({ itens, rotulo, className }: { itens: ItemAba[]; rotulo: string; className?: string }) {
  return (
    <nav aria-label={rotulo} className={cn("sem-barra -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0", className)}>
      <ul className="flex min-w-max gap-1 border-b border-linha">
        {itens.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.ativo ? "page" : undefined}
              scroll={false}
              className={cn(
                "-mb-px inline-flex h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium whitespace-nowrap transition [&_svg]:size-4",
                item.ativo
                  ? "border-chama text-chama-escura"
                  : "border-transparent text-suave hover:border-linha-forte hover:text-tinta",
              )}
            >
              {item.icone}
              {item.rotulo}
              {item.contagem !== undefined && (
                <span
                  className={cn(
                    "tabular rounded-full px-1.5 text-xs",
                    item.ativo ? "bg-chama-clara text-chama-escura" : "bg-areia text-suave",
                  )}
                >
                  {item.contagem}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Controle segmentado (pílulas) por links. Bom para filtros rápidos: Todos | Baixo | Esgotado. */
export function SegmentedLinks({
  itens,
  rotulo,
  tamanho = "md",
  className,
}: {
  itens: ItemAba[];
  rotulo: string;
  tamanho?: "sm" | "md";
  className?: string;
}) {
  return (
    <nav aria-label={rotulo} className={cn("sem-barra max-w-full overflow-x-auto", className)}>
      <ul className="inline-flex min-w-max gap-1 rounded-xl border border-linha bg-areia/70 p-1">
        {itens.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.ativo ? "page" : undefined}
              scroll={false}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 font-medium whitespace-nowrap transition [&_svg]:size-4",
                tamanho === "sm" ? "h-10 text-xs sm:h-8" : "h-10 text-sm sm:h-9",
                item.ativo ? "bg-papel text-tinta shadow-suave" : "text-suave hover:text-tinta",
              )}
            >
              {item.icone}
              {item.rotulo}
              {item.contagem !== undefined && <span className="tabular text-xs text-suave">{item.contagem}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
