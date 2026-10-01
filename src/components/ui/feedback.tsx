import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Inbox, Info, TriangleAlert } from "lucide-react";
import { cn } from "./cn";

/* ---------- EmptyState ---------- */

export type EmptyStateProps = {
  /** Ícone grande, ex.: <Package />. Padrão: caixa vazia. */
  icone?: ReactNode;
  titulo: ReactNode;
  descricao?: ReactNode;
  /** Ação principal, ex.: <ButtonLink href="/produtos/novo">Cadastrar vela</ButtonLink>. */
  acao?: ReactNode;
  /** Versão menor para dentro de cartões/listas. */
  compacto?: boolean;
  className?: string;
};

/** Estado vazio: explica o que falta e oferece o próximo passo. */
export function EmptyState({ icone, titulo, descricao, acao, compacto, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compacto ? "gap-2 px-4 py-8" : "gap-3 px-6 py-14",
        className,
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-full bg-chama-clara text-chama-escura",
          compacto ? "size-10 [&_svg]:size-5" : "size-14 [&_svg]:size-7",
        )}
      >
        {icone ?? <Inbox aria-hidden />}
      </span>
      <div className="max-w-sm">
        <p className={cn("font-serif font-semibold text-tinta", compacto ? "text-base" : "text-lg")}>{titulo}</p>
        {descricao && <p className="mt-1 text-sm text-suave">{descricao}</p>}
      </div>
      {acao && <div className="mt-1 flex flex-wrap justify-center gap-2">{acao}</div>}
    </div>
  );
}

/** Compatibilidade v1: texto simples centralizado. Prefira <EmptyState>. */
export function Vazio({ children }: { children: ReactNode }) {
  return <p className="py-10 text-center text-sm text-suave">{children}</p>;
}

/* ---------- Aviso (alerta inline) ---------- */

export type TipoAviso = "erro" | "ok" | "info" | "atencao";

const AVISO: Record<TipoAviso, { classes: string; icone: ReactNode }> = {
  erro: { classes: "border-alerta/30 bg-alerta-clara text-alerta", icone: <CircleAlert aria-hidden /> },
  ok: { classes: "border-salvia/30 bg-salvia-clara text-salvia", icone: <CircleCheck aria-hidden /> },
  info: { classes: "border-info/25 bg-info-clara text-info", icone: <Info aria-hidden /> },
  atencao: { classes: "border-mel/30 bg-mel-clara text-mel", icone: <TriangleAlert aria-hidden /> },
};

export type AvisoProps = {
  tipo: TipoAviso;
  titulo?: ReactNode;
  children?: ReactNode;
  /** Link/botão à direita (ex.: "Dar entrada"). */
  acao?: ReactNode;
  /** Esconde o ícone. */
  semIcone?: boolean;
  className?: string;
};

/** Mensagem dentro da página (erro de formulário, aviso de estoque, informação). */
export function Aviso({ tipo, titulo, children, acao, semIcone, className }: AvisoProps) {
  const { classes, icone } = AVISO[tipo];
  return (
    <div
      role={tipo === "erro" ? "alert" : "status"}
      className={cn("flex items-start gap-3 rounded-lg border px-3.5 py-3 text-sm", classes, className)}
    >
      {!semIcone && <span className="mt-px shrink-0 [&_svg]:size-[18px]">{icone}</span>}
      <div className="min-w-0 flex-1">
        {titulo && <p className="font-semibold">{titulo}</p>}
        {children && <div className={cn(titulo && "mt-0.5 text-tinta/80")}>{children}</div>}
      </div>
      {acao && <div className="shrink-0 self-center">{acao}</div>}
    </div>
  );
}

/* ---------- Skeleton ---------- */

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-brilho rounded-md bg-linha/70", className)} />;
}

export function SkeletonText({ linhas = 3, className }: { linhas?: number; className?: string }) {
  return (
    <div aria-hidden className={cn("space-y-2", className)}>
      {Array.from({ length: linhas }, (_, i) => (
        <Skeleton key={i} className={cn("h-3.5", i === linhas - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

export function SkeletonStatCards({ quantidade = 4 }: { quantidade?: number }) {
  return (
    <div aria-hidden className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {Array.from({ length: quantidade }, (_, i) => (
        <div key={i} className="cartao p-4 sm:p-5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="mt-3 h-7 w-28" />
          <Skeleton className="mt-3 h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTabela({ linhas = 6, colunas = 4 }: { linhas?: number; colunas?: number }) {
  return (
    <div aria-hidden className="cartao overflow-hidden">
      <div className="flex gap-4 border-b border-linha bg-areia/60 px-5 py-3">
        {Array.from({ length: colunas }, (_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: linhas }, (_, l) => (
        <div key={l} className="flex items-center gap-4 border-b border-linha px-5 py-4 last:border-0">
          {Array.from({ length: colunas }, (_, c) => (
            <Skeleton key={c} className={cn("h-3.5 flex-1", c === 0 && "flex-[2]")} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Esqueleto de página inteira (cabeçalho + cartões + tabela). Ideal para loading.tsx. */
export function SkeletonPagina({ cartoes = 0, linhas = 6 }: { cartoes?: number; linhas?: number }) {
  return (
    <div role="status" aria-label="Carregando" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {cartoes > 0 && <SkeletonStatCards quantidade={cartoes} />}
      <Skeleton className="h-11 w-full rounded-lg" />
      <SkeletonTabela linhas={linhas} />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}

/* ---------- Kbd ---------- */

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-linha-forte bg-areia px-1 font-sans text-[0.6875rem] font-medium text-suave shadow-[0_1px_0_var(--color-linha-forte)]",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

/* ---------- Avatar ---------- */

const TONS_AVATAR = [
  "bg-chama-clara text-chama-escura",
  "bg-salvia-clara text-salvia",
  "bg-info-clara text-info",
  "bg-mel-clara text-mel",
  "bg-alerta-clara text-alerta",
];

/** Iniciais (primeira e última palavra): "Ana Maria Souza" → "AS". */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "?";
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

/** Círculo com as iniciais; a cor é sempre a mesma para o mesmo nome. */
export function Avatar({ nome, tamanho = "md", className }: { nome: string; tamanho?: "sm" | "md" | "lg"; className?: string }) {
  let h = 0;
  for (const ch of nome) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden
      title={nome}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold select-none",
        tamanho === "sm" && "size-7 text-[0.6875rem]",
        tamanho === "md" && "size-9 text-xs",
        tamanho === "lg" && "size-14 text-lg",
        TONS_AVATAR[h % TONS_AVATAR.length],
        className,
      )}
    >
      {iniciais(nome)}
    </span>
  );
}

/* ---------- ProgressBar ---------- */

export type ProgressBarProps = {
  valor: number;
  max: number;
  tom?: "chama" | "salvia" | "alerta" | "mel" | "info";
  /** Rótulo acessível (obrigatório se não houver texto visível ao lado). */
  rotulo: string;
  /** Posição (em unidades) de uma marca vertical, ex.: o estoque mínimo. */
  marcador?: number;
  className?: string;
};

const TONS_BARRA = { chama: "bg-chama", salvia: "bg-salvia", alerta: "bg-alerta", mel: "bg-mel", info: "bg-info" };

export function ProgressBar({ valor, max, tom = "chama", rotulo, marcador, className }: ProgressBarProps) {
  const total = max > 0 ? max : 1;
  const pctValor = Math.min(100, Math.max(0, (valor / total) * 100));
  return (
    <div
      role="progressbar"
      aria-label={rotulo}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={valor}
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-areia", className)}
    >
      <div className={cn("h-full rounded-full transition-[width]", TONS_BARRA[tom])} style={{ width: `${pctValor}%` }} />
      {marcador !== undefined && marcador > 0 && (
        <span
          aria-hidden
          className="absolute inset-y-0 w-0.5 bg-tinta/40"
          style={{ left: `${Math.min(100, (marcador / total) * 100)}%` }}
        />
      )}
    </div>
  );
}

/** Barra de estoque vs mínimo, com cor pela situação e texto "12 un. · mín. 5". */
export function EstoqueProgress({
  estoque,
  minimo,
  semTexto,
  className,
}: {
  estoque: number;
  minimo: number;
  semTexto?: boolean;
  className?: string;
}) {
  const max = Math.max(minimo * 3, estoque, 1);
  const tom = estoque <= 0 ? "alerta" : estoque <= minimo ? "mel" : "salvia";
  return (
    <div className={cn("min-w-24", className)}>
      <ProgressBar valor={estoque} max={max} tom={tom} marcador={minimo} rotulo={`Estoque: ${estoque} de mínimo ${minimo}`} />
      {!semTexto && (
        <p className="tabular mt-1 text-xs text-suave">
          <span className="font-medium text-tinta">{estoque} un.</span> · mín. {minimo}
        </p>
      )}
    </div>
  );
}
