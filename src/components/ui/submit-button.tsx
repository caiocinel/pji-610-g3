"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Spinner, classesBotao, type OpcoesBotao } from "./button";
import { cn } from "./cn";

export type SubmitButtonProps = OpcoesBotao & {
  children: ReactNode;
  /** Texto enquanto o formulário é enviado. */
  pendente?: ReactNode;
  icone?: ReactNode;
  className?: string;
  disabled?: boolean;
  /** Para botões com várias ações no mesmo form: <SubmitButton name="acao" value="duplicar">. */
  name?: string;
  value?: string;
  /** Envia para outra Server Action (formAction do HTML). */
  formAction?: (formData: FormData) => void | Promise<void>;
  form?: string;
};

/**
 * Botão de envio que mostra spinner + texto "pendente" enquanto a Server Action roda.
 * Compatível com a v1: className="btn-primario"/"btn-perigo" continua funcionando.
 */
export function SubmitButton({
  children,
  pendente = "Salvando…",
  icone,
  className,
  variante,
  tamanho,
  larguraTotal,
  somenteIcone,
  disabled,
  ...rest
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  // v1 passava a classe pronta (btn-primario, btn-perigo…). Sem variante explícita, respeita isso.
  const legado = !variante && !!className && /\bbtn(-|\b)/.test(className);
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      className={legado ? className : cn(classesBotao({ variante, tamanho, larguraTotal, somenteIcone }), className)}
      {...rest}
    >
      {pending ? <Spinner /> : icone}
      {pending ? pendente : children}
    </button>
  );
}
