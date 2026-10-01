import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "./cn";

/** Variação percentual entre dois valores. null quando não há base de comparação (anterior = 0). */
export function calcularVariacao(atual: number, anterior: number): number | null {
  if (!anterior) return atual ? null : 0;
  return Math.round(((atual - anterior) / Math.abs(anterior)) * 1000) / 10;
}

/** "vs. mês anterior" → "do mês anterior"; "vs. 30/09/2026" → "de 30/09/2026". */
function semDadosDe(referencia: string) {
  const resto = referencia.replace(/^vs\.?\s*/, "");
  if (resto === referencia) return resto;
  return /^\d/.test(resto) ? `de ${resto}` : `do ${resto}`;
}

const pct = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, signDisplay: "exceptZero" });

export function Variacao({
  valor,
  positivoEhBom = true,
  referencia,
  className,
}: {
  /** Variação em % (ex.: 12.5 = +12,5%). null = sem base de comparação. */
  valor: number | null | undefined;
  /** Para custos/perdas, subir é ruim: passe false. */
  positivoEhBom?: boolean;
  referencia?: string;
  className?: string;
}) {
  if (valor === null || valor === undefined) {
    return (
      <p className={cn("text-xs text-suave", className)}>
        Sem dados {referencia ? semDadosDe(referencia) : "anteriores"}
      </p>
    );
  }
  const neutro = Math.abs(valor) < 0.05;
  const bom = valor > 0 === positivoEhBom;
  const Icone = neutro ? Minus : valor > 0 ? ArrowUpRight : ArrowDownRight;
  const tom = neutro ? "bg-areia text-suave" : bom ? "bg-salvia-clara text-salvia" : "bg-alerta-clara text-alerta";
  const sentido = neutro ? "estável" : valor > 0 ? "alta" : "queda";
  return (
    <p className={cn("flex flex-wrap items-center gap-1.5 text-xs text-suave", className)}>
      <span className={cn("tabular inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold", tom)}>
        <Icone aria-hidden className="size-3.5" />
        <span className="sr-only">{sentido} de </span>
        {neutro ? "0%" : `${pct.format(valor)}%`}
      </span>
      {referencia && <span>{referencia}</span>}
    </p>
  );
}

export type StatCardProps = {
  rotulo: string;
  valor: ReactNode;
  /** Texto pequeno abaixo do valor (quando não houver variação). */
  detalhe?: ReactNode;
  /** Cor do valor. */
  destaque?: "alerta" | "chama" | "salvia";
  /** Ícone no canto, ex.: <Wallet />. */
  icone?: ReactNode;
  /** Variação % vs período anterior (use calcularVariacao). null = sem base. */
  variacao?: number | null;
  /** Texto da comparação, ex.: "vs. mês anterior". */
  referencia?: string;
  positivoEhBom?: boolean;
  /** Torna o cartão um link (ex.: para o relatório detalhado). */
  href?: string;
  className?: string;
};

/** Cartão de indicador: rótulo, valor grande, variação com seta. */
export function StatCard({
  rotulo,
  valor,
  detalhe,
  destaque,
  icone,
  variacao,
  referencia,
  positivoEhBom,
  href,
  className,
}: StatCardProps) {
  const cor =
    destaque === "alerta"
      ? "text-alerta"
      : destaque === "chama"
        ? "text-chama"
        : destaque === "salvia"
          ? "text-salvia"
          : "text-tinta";
  const conteudo = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-suave">{rotulo}</p>
        {icone && (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-areia text-suave [&_svg]:size-4">
            {icone}
          </span>
        )}
      </div>
      <p className={cn("tabular mt-1.5 font-serif text-2xl font-semibold tracking-tight sm:text-[1.75rem]", cor)}>{valor}</p>
      <div className="mt-2 min-h-5">
        {variacao !== undefined ? (
          <Variacao valor={variacao} referencia={referencia} positivoEhBom={positivoEhBom} />
        ) : (
          detalhe && <p className="text-xs text-suave">{detalhe}</p>
        )}
      </div>
    </>
  );
  const classes = cn("cartao block min-w-0 p-4 sm:p-5", className);
  if (href) {
    return (
      <Link href={href} className={cn(classes, "transition hover:border-linha-forte hover:shadow-elevado")}>
        {conteudo}
      </Link>
    );
  }
  return <div className={classes}>{conteudo}</div>;
}

/** Grade responsiva para StatCards: 2 colunas no celular, até 4 no desktop. */
export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4", className)}>{children}</div>;
}
