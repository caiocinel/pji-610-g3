import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

const PADDING = { none: "", sm: "p-4", md: "p-5", lg: "p-6 sm:p-7" } as const;

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** Espaçamento interno. Padrão "md" (p-5). Use "none" para cartões com tabela/lista encostada nas bordas. */
  padding?: keyof typeof PADDING;
  /** Elemento HTML (section, article…). */
  as?: "div" | "section" | "article" | "aside";
  /** Efeito de hover para cartões clicáveis. */
  interativo?: boolean;
};

export function Card({ padding = "md", as: Tag = "div", interativo, className, children, ...rest }: CardProps) {
  return (
    <Tag
      className={cn(
        "cartao min-w-0",
        PADDING[padding],
        interativo && "transition hover:border-linha-forte hover:shadow-elevado",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export type CardHeaderProps = {
  titulo?: ReactNode;
  descricao?: ReactNode;
  /** Ícone à esquerda do título, ex.: <Package />. */
  icone?: ReactNode;
  /** Botões/links à direita. */
  acoes?: ReactNode;
  /** Adiciona padding próprio (use dentro de <Card padding="none">). */
  inset?: boolean;
  /** Linha divisória embaixo. */
  divisoria?: boolean;
  className?: string;
  children?: ReactNode;
};

/** Cabeçalho do cartão: título (h2) + descrição + ações. */
export function CardHeader({ titulo, descricao, icone, acoes, inset, divisoria, className, children }: CardHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-x-4 gap-y-2",
        inset ? "px-4 pt-4 pb-3 sm:px-5 sm:pt-5" : "mb-4",
        divisoria && "border-b border-linha pb-3",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icone && (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-chama-clara text-chama-escura [&_svg]:size-[18px]">
            {icone}
          </span>
        )}
        <div className="min-w-0">
          {titulo && <CardTitle>{titulo}</CardTitle>}
          {descricao && <CardDescription>{descricao}</CardDescription>}
          {children}
        </div>
      </div>
      {acoes && <div className="flex shrink-0 flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  );
}

export function CardTitle({
  children,
  className,
  as: Tag = "h2",
}: {
  children: ReactNode;
  className?: string;
  as?: "h2" | "h3" | "p";
}) {
  return <Tag className={cn("font-serif text-lg leading-snug font-semibold text-tinta", className)}>{children}</Tag>;
}

export function CardDescription({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("mt-0.5 text-sm text-suave", className)}>{children}</p>;
}

export function CardContent({ children, className, inset }: { children: ReactNode; className?: string; inset?: boolean }) {
  return <div className={cn(inset && "px-4 pb-4 sm:px-5 sm:pb-5", className)}>{children}</div>;
}

/** Rodapé do cartão (ações, totais). Com `inset`, ganha fundo areia e padding próprio. */
export function CardFooter({ children, className, inset }: { children: ReactNode; className?: string; inset?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3",
        inset ? "rounded-b-xl border-t border-linha bg-areia/50 px-4 py-3 sm:px-5" : "mt-5 border-t border-linha pt-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Lista de pares rótulo/valor (detalhes de produto, venda, cliente). */
export function ListaDetalhes({
  itens,
  colunas = 2,
  className,
}: {
  itens: { rotulo: ReactNode; valor: ReactNode; inteiro?: boolean }[];
  colunas?: 1 | 2 | 3;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid gap-x-6 gap-y-4",
        colunas === 2 && "sm:grid-cols-2",
        colunas === 3 && "sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {itens.map((item, i) => (
        <div key={i} className={cn("min-w-0", item.inteiro && "sm:col-span-full")}>
          <dt className="text-xs font-medium tracking-wide text-suave uppercase">{item.rotulo}</dt>
          <dd className="mt-1 text-sm break-words text-tinta">{item.valor ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
