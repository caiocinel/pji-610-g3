import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { cn } from "./cn";

export type ItemTrilha = { rotulo: string; href?: string };

/** Trilha de navegação (breadcrumb). O último item é a página atual. */
export function Breadcrumb({ itens, className }: { itens: ItemTrilha[]; className?: string }) {
  return (
    <nav aria-label="Trilha de navegação" className={cn("min-w-0", className)}>
      <ol className="flex flex-wrap items-center gap-1 text-sm text-suave">
        {itens.map((item, i) => {
          const ultimo = i === itens.length - 1;
          return (
            <li key={`${item.rotulo}-${i}`} className="flex min-w-0 items-center gap-1">
              {item.href && !ultimo ? (
                <Link href={item.href} className="truncate rounded hover:text-tinta hover:underline">
                  {item.rotulo}
                </Link>
              ) : (
                <span aria-current={ultimo ? "page" : undefined} className={cn("truncate", ultimo && "text-tinta")}>
                  {item.rotulo}
                </span>
              )}
              {!ultimo && <ChevronRight aria-hidden className="size-3.5 shrink-0" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export type PageHeaderProps = {
  titulo: ReactNode;
  descricao?: ReactNode;
  /** Botões/links à direita (no celular quebram para baixo do título). */
  acoes?: ReactNode;
  /** Trilha acima do título, ex.: [{rotulo:"Produtos", href:"/produtos"}, {rotulo:"Vela Lavanda"}]. */
  breadcrumb?: ItemTrilha[];
  /** Link "voltar" acima do título (alternativa simples à trilha). */
  voltar?: { href: string; rotulo?: string };
  /** Selos ao lado do título (ex.: <Badge>Cancelada</Badge>). */
  badges?: ReactNode;
  className?: string;
  children?: ReactNode;
};

/** Cabeçalho da página: h1 em serifa, descrição, ações. Use UM por página. */
export function PageHeader({ titulo, descricao, acoes, breadcrumb, voltar, badges, className, children }: PageHeaderProps) {
  return (
    <header className={cn("mb-6 sm:mb-8", className)}>
      {breadcrumb && breadcrumb.length > 0 && <Breadcrumb itens={breadcrumb} className="mb-2" />}
      {voltar && !breadcrumb && (
        <Link
          href={voltar.href}
          className="-ml-1 mb-1 inline-flex min-h-10 items-center gap-1 rounded px-1 text-sm text-suave hover:text-tinta sm:mb-2 sm:min-h-8 print:hidden"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {voltar.rotulo ?? "Voltar"}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="font-serif text-[1.75rem] leading-tight font-semibold tracking-tight text-tinta sm:text-3xl">
              {titulo}
            </h1>
            {badges}
          </div>
          {descricao && <p className="mt-1.5 max-w-2xl text-sm text-suave sm:text-[0.9375rem]">{descricao}</p>}
          {children}
        </div>
        {acoes && <div className="flex flex-wrap items-center gap-2 print:hidden [&>*]:grow sm:[&>*]:grow-0">{acoes}</div>}
      </div>
    </header>
  );
}

/** Título de seção dentro da página (h2), com ações opcionais. */
export function SectionHeader({
  titulo,
  descricao,
  acoes,
  className,
}: {
  titulo: ReactNode;
  descricao?: ReactNode;
  acoes?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex flex-wrap items-end justify-between gap-2", className)}>
      <div className="min-w-0">
        <h2 className="font-serif text-xl font-semibold text-tinta">{titulo}</h2>
        {descricao && <p className="mt-0.5 text-sm text-suave">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  );
}
