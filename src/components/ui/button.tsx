import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "./cn";

export type VarianteBotao = "primario" | "secundario" | "fantasma" | "perigo" | "perigo-solido" | "destaque";
export type TamanhoBotao = "sm" | "md" | "lg";

const VARIANTES: Record<VarianteBotao, string> = {
  primario: "bg-chama text-sobre shadow-suave hover:bg-chama-escura",
  secundario: "border border-linha-forte bg-papel text-tinta shadow-suave hover:bg-areia",
  fantasma: "text-suave hover:bg-areia hover:text-tinta",
  perigo: "border border-alerta/35 bg-papel text-alerta hover:bg-alerta-clara",
  "perigo-solido": "bg-alerta text-sobre shadow-suave hover:bg-alerta/90",
  destaque: "bg-chama-clara text-chama-escura hover:bg-chama/20",
};

// Altura maior no celular (alvo de toque ≥ 40px).
const TAMANHOS: Record<TamanhoBotao, string> = {
  sm: "h-10 px-3 text-sm sm:h-8 sm:px-2.5 [&_svg]:size-4",
  md: "h-11 px-4 text-sm sm:h-10 [&_svg]:size-4",
  lg: "h-12 px-5 text-base [&_svg]:size-5",
};

const SO_ICONE: Record<TamanhoBotao, string> = {
  sm: "size-10 sm:size-8 [&_svg]:size-4",
  md: "size-11 sm:size-10 [&_svg]:size-[18px]",
  lg: "size-12 [&_svg]:size-5",
};

export type OpcoesBotao = {
  variante?: VarianteBotao;
  tamanho?: TamanhoBotao;
  /** Ocupa toda a largura disponível. */
  larguraTotal?: boolean;
  /** Botão quadrado só com ícone (prefira <IconButton>). */
  somenteIcone?: boolean;
};

/** Classes de botão para usar em qualquer elemento (ex.: <label>, <a> externo). */
export function classesBotao({ variante = "primario", tamanho = "md", larguraTotal, somenteIcone }: OpcoesBotao = {}) {
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition select-none",
    "active:translate-y-px disabled:pointer-events-none disabled:opacity-55 aria-disabled:pointer-events-none aria-disabled:opacity-55",
    "[&_svg]:shrink-0",
    VARIANTES[variante],
    somenteIcone ? SO_ICONE[tamanho] : TAMANHOS[tamanho],
    larguraTotal && "w-full",
  );
}

type ConteudoProps = {
  /** Ícone à esquerda: passe o elemento, ex.: icone={<Plus />}. */
  icone?: ReactNode;
  /** Ícone à direita, ex.: <ChevronRight />. */
  iconeDireita?: ReactNode;
  /** Mostra um spinner e desabilita o botão. */
  carregando?: boolean;
  /** Texto exibido enquanto carregando (padrão: o próprio children). */
  textoCarregando?: ReactNode;
};

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle aria-hidden className={cn("animate-spin", className)} />;
}

function Conteudo({ icone, iconeDireita, carregando, textoCarregando, children }: ConteudoProps & { children?: ReactNode }) {
  return (
    <>
      {carregando ? <Spinner /> : icone}
      {carregando && textoCarregando !== undefined ? textoCarregando : children}
      {!carregando && iconeDireita}
    </>
  );
}

export type ButtonProps = ComponentProps<"button"> & OpcoesBotao & ConteudoProps;

/** Botão padrão. `type` padrão é "button" (use type="submit" ou <SubmitButton> em formulários). */
export function Button({
  variante,
  tamanho,
  larguraTotal,
  somenteIcone,
  icone,
  iconeDireita,
  carregando,
  textoCarregando,
  className,
  children,
  type = "button",
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      className={cn(classesBotao({ variante, tamanho, larguraTotal, somenteIcone }), className)}
      data-autofocus={rest.autoFocus || undefined}
      {...rest}
    >
      <Conteudo icone={icone} iconeDireita={iconeDireita} carregando={carregando} textoCarregando={textoCarregando}>
        {children}
      </Conteudo>
    </button>
  );
}

export type ButtonLinkProps = ComponentProps<typeof Link> &
  OpcoesBotao &
  Omit<ConteudoProps, "carregando" | "textoCarregando"> & { desabilitado?: boolean };

/** Link com aparência de botão (navegação). Ex.: <ButtonLink href="/vendas/nova" icone={<Plus />}>Nova venda</ButtonLink> */
export function ButtonLink({
  variante,
  tamanho,
  larguraTotal,
  somenteIcone,
  icone,
  iconeDireita,
  desabilitado,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      aria-disabled={desabilitado || undefined}
      tabIndex={desabilitado ? -1 : undefined}
      className={cn(classesBotao({ variante, tamanho, larguraTotal, somenteIcone }), className)}
      {...rest}
    >
      {icone}
      {children}
      {iconeDireita}
    </Link>
  );
}

export type IconButtonProps = Omit<ButtonProps, "somenteIcone" | "children" | "iconeDireita"> & {
  /** Texto acessível (aria-label) e dica ao passar o mouse. Obrigatório. */
  rotulo: string;
  icone: ReactNode;
};

/** Botão quadrado só com ícone. Padrão: variante "fantasma". */
export function IconButton({ rotulo, icone, variante = "fantasma", ...rest }: IconButtonProps) {
  return <Button aria-label={rotulo} title={rotulo} variante={variante} somenteIcone icone={icone} {...rest} />;
}

export type IconLinkProps = Omit<ButtonLinkProps, "somenteIcone" | "children" | "iconeDireita"> & {
  rotulo: string;
  icone: ReactNode;
};

/** Link quadrado só com ícone (ex.: editar numa linha de tabela). */
export function IconLink({ rotulo, icone, variante = "fantasma", ...rest }: IconLinkProps) {
  return <ButtonLink aria-label={rotulo} title={rotulo} variante={variante} somenteIcone icone={icone} {...rest} />;
}
