"use client";

import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Field, descritoPor } from "./campos";
import { cn } from "./cn";

const fmt = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Converte um valor em reais (número ou texto "39,90"/"39.90") para centavos inteiros, ou null. */
function paraCentavos(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  let n: number;
  if (typeof v === "number") n = v;
  else {
    const t = v.trim();
    n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  }
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export type MoneyInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "defaultValue" | "onChange" | "name" | "min" | "max"
> & {
  /** Nome enviado no formulário. O valor vai como "1234.56" (ponto decimal), ou "" se vazio. */
  name?: string;
  /** Valor inicial em reais (modo não controlado). */
  defaultValue?: number | string | null;
  /** Valor em reais (modo controlado). Use junto com onValueChange. */
  value?: number | null;
  onValueChange?: (reais: number | null) => void;
  /** Limite em reais (o campo não deixa digitar mais que isso). */
  max?: number;
  label?: ReactNode;
  hint?: ReactNode;
  erro?: ReactNode;
  opcional?: boolean;
  labelOculto?: boolean;
  extra?: ReactNode;
  wrapperClassName?: string;
};

/**
 * Campo de dinheiro com máscara BRL estilo caixa: digitar 3990 mostra "39,90".
 * Teclado numérico no celular. Envia um input hidden `name` com "39.90".
 */
export function MoneyInput({
  name,
  id,
  defaultValue,
  value,
  onValueChange,
  max,
  label,
  hint,
  erro,
  opcional,
  labelOculto,
  extra,
  wrapperClassName,
  className,
  placeholder = "0,00",
  ...rest
}: MoneyInputProps) {
  const [interno, setInterno] = useState<number | null>(() => paraCentavos(defaultValue));
  const controlado = value !== undefined;
  const centavos = controlado ? paraCentavos(value) : interno;
  const campoId = id ?? name ?? "";

  function alterar(texto: string) {
    const digitos = texto.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 11);
    let novo = digitos ? Number(digitos) : null;
    if (novo !== null && max !== undefined) novo = Math.min(novo, Math.round(max * 100));
    if (!controlado) setInterno(novo);
    onValueChange?.(novo === null ? null : novo / 100);
  }

  const controle = (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-suave">R$</span>
      <input
        id={campoId || undefined}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        value={centavos === null ? "" : fmt.format(centavos / 100)}
        onChange={(e) => alterar(e.currentTarget.value)}
        aria-invalid={erro ? true : undefined}
        aria-describedby={campoId ? descritoPor(campoId, hint, erro) : undefined}
        className={cn("campo tabular pl-10 text-right", className)}
        data-autofocus={rest.autoFocus || undefined}
        {...rest}
      />
      {name && <input type="hidden" name={name} value={centavos === null ? "" : (centavos / 100).toFixed(2)} />}
    </div>
  );

  if (!label && !hint && !erro) return wrapperClassName ? <div className={wrapperClassName}>{controle}</div> : controle;
  return (
    <Field
      id={campoId}
      label={label}
      hint={hint}
      erro={erro}
      opcional={opcional}
      labelOculto={labelOculto}
      extra={extra}
      className={wrapperClassName}
    >
      {controle}
    </Field>
  );
}
