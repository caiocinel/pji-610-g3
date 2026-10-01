import type { ReactNode } from "react";
import { CircleCheck, CircleX, TriangleAlert } from "lucide-react";
import { cn } from "./cn";

export type TomBadge = "neutro" | "chama" | "salvia" | "alerta" | "info" | "mel";

const TONS: Record<TomBadge, string> = {
  neutro: "bg-areia text-suave ring-linha-forte/60",
  chama: "bg-chama-clara text-chama-escura ring-chama/20",
  salvia: "bg-salvia-clara text-salvia ring-salvia/20",
  alerta: "bg-alerta-clara text-alerta ring-alerta/20",
  info: "bg-info-clara text-info ring-info/20",
  mel: "bg-mel-clara text-mel ring-mel/20",
};

const PONTOS: Record<TomBadge, string> = {
  neutro: "bg-suave",
  chama: "bg-chama",
  salvia: "bg-salvia",
  alerta: "bg-alerta",
  info: "bg-info",
  mel: "bg-mel",
};

export type BadgeProps = {
  children: ReactNode;
  tom?: TomBadge;
  /** Ícone pequeno à esquerda, ex.: <Flame />. */
  icone?: ReactNode;
  /** Bolinha colorida à esquerda (status). */
  ponto?: boolean;
  tamanho?: "sm" | "md";
  className?: string;
  title?: string;
};

export function Badge({ children, tom = "neutro", icone, ponto, tamanho = "sm", className, title }: BadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full font-medium whitespace-nowrap ring-1 ring-inset [&_svg]:size-3.5 [&_svg]:shrink-0",
        tamanho === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        TONS[tom],
        className,
      )}
    >
      {ponto && <span aria-hidden className={cn("size-1.5 rounded-full", PONTOS[tom])} />}
      {icone}
      <span className="truncate">{children}</span>
    </span>
  );
}

export type EstadoEstoque = "esgotado" | "baixo" | "ok";

/** Situação de estoque: esgotado (0), baixo (≤ mínimo) ou ok. */
export function estadoEstoque(estoque: number, minimo: number): EstadoEstoque {
  if (estoque <= 0) return "esgotado";
  if (estoque <= minimo) return "baixo";
  return "ok";
}

export const ROTULO_ESTADO_ESTOQUE: Record<EstadoEstoque, string> = {
  esgotado: "Esgotado",
  baixo: "Estoque baixo",
  ok: "Disponível",
};

/** Selo de situação do estoque. `mostrarQuantidade` acrescenta "· 3 un.". */
export function EstoqueBadge({
  estoque,
  minimo,
  mostrarQuantidade,
  className,
}: {
  estoque: number;
  minimo: number;
  mostrarQuantidade?: boolean;
  className?: string;
}) {
  const estado = estadoEstoque(estoque, minimo);
  const tom: TomBadge = estado === "esgotado" ? "alerta" : estado === "baixo" ? "mel" : "salvia";
  const icone =
    estado === "esgotado" ? <CircleX aria-hidden /> : estado === "baixo" ? <TriangleAlert aria-hidden /> : <CircleCheck aria-hidden />;
  return (
    <Badge tom={tom} icone={icone} className={className}>
      {ROTULO_ESTADO_ESTOQUE[estado]}
      {mostrarQuantidade && <span className="tabular font-normal opacity-80"> · {estoque} un.</span>}
    </Badge>
  );
}
