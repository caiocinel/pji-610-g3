import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "./cn";
import { montarHref, type ParamsBusca } from "./url";

/** Números de página com reticências: [1, "…", 4, 5, 6, "…", 12]. */
export function paginasVisiveis(atual: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, atual - 1, atual, atual + 1]);
  if (atual <= 3) [2, 3, 4].forEach((n) => set.add(n));
  if (atual >= total - 2) [total - 1, total - 2, total - 3].forEach((n) => set.add(n));
  const nums = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1] > 1) out.push("…");
    out.push(n);
  });
  return out;
}

export type PaginationProps = {
  /** Página atual (1-based). */
  pagina: number;
  totalPaginas: number;
  /** Caminho da página, ex.: "/produtos". */
  caminho: string;
  /** searchParams atuais (preservados nos links). */
  searchParams?: ParamsBusca;
  /** Nome do parâmetro (padrão "pagina"). */
  parametro?: string;
  /** Total de registros para o texto "Mostrando 21–40 de 135". */
  totalItens?: number;
  porPagina?: number;
  className?: string;
};

const base =
  "inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-lg px-2.5 text-sm font-medium transition sm:h-9 sm:min-w-9";

/** Paginação por links (?pagina=N), preservando os outros filtros. Some quando há só 1 página. */
export function Pagination({
  pagina,
  totalPaginas,
  caminho,
  searchParams,
  parametro = "pagina",
  totalItens,
  porPagina,
  className,
}: PaginationProps) {
  const atual = Math.min(Math.max(1, pagina), Math.max(1, totalPaginas));
  const href = (n: number) => montarHref(caminho, searchParams, { [parametro]: n > 1 ? n : null });
  const resumo =
    totalItens !== undefined && porPagina
      ? `Mostrando ${Math.min((atual - 1) * porPagina + 1, totalItens)}–${Math.min(atual * porPagina, totalItens)} de ${totalItens}`
      : `Página ${atual} de ${Math.max(1, totalPaginas)}`;

  if (totalPaginas <= 1) {
    return totalItens !== undefined ? (
      <p className={cn("tabular text-sm text-suave", className)}>
        {totalItens} {totalItens === 1 ? "registro" : "registros"}
      </p>
    ) : null;
  }

  const anterior = atual > 1;
  const proxima = atual < totalPaginas;

  return (
    <nav aria-label="Paginação" className={cn("flex flex-wrap items-center justify-between gap-3 print:hidden", className)}>
      <p className="tabular text-sm text-suave">{resumo}</p>
      <div className="flex items-center gap-1">
        {anterior ? (
          <Link href={href(atual - 1)} className={cn(base, "text-tinta hover:bg-areia")} aria-label="Página anterior">
            <ChevronLeft aria-hidden className="size-4" />
            <span className="hidden sm:inline">Anterior</span>
          </Link>
        ) : (
          <span className={cn(base, "text-suave opacity-50")} aria-hidden>
            <ChevronLeft className="size-4" />
            <span className="hidden sm:inline">Anterior</span>
          </span>
        )}
        <ul className="hidden items-center gap-1 sm:flex">
          {paginasVisiveis(atual, totalPaginas).map((n, i) =>
            n === "…" ? (
              <li key={`r${i}`} aria-hidden className="px-1 text-suave">
                …
              </li>
            ) : (
              <li key={n}>
                <Link
                  href={href(n)}
                  aria-current={n === atual ? "page" : undefined}
                  aria-label={`Página ${n}`}
                  className={cn(
                    base,
                    "tabular",
                    n === atual ? "bg-chama text-sobre shadow-suave" : "text-tinta hover:bg-areia",
                  )}
                >
                  {n}
                </Link>
              </li>
            ),
          )}
        </ul>
        <span className="tabular px-2 text-sm text-suave sm:hidden">
          {atual}/{totalPaginas}
        </span>
        {proxima ? (
          <Link href={href(atual + 1)} className={cn(base, "text-tinta hover:bg-areia")} aria-label="Próxima página">
            <span className="hidden sm:inline">Próxima</span>
            <ChevronRight aria-hidden className="size-4" />
          </Link>
        ) : (
          <span className={cn(base, "text-suave opacity-50")} aria-hidden>
            <span className="hidden sm:inline">Próxima</span>
            <ChevronRight className="size-4" />
          </span>
        )}
      </div>
    </nav>
  );
}
