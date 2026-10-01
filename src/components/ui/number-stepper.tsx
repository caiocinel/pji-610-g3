"use client";

import { useState, type ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import { Field, descritoPor } from "./campos";
import { cn } from "./cn";

export type NumberStepperProps = {
  name?: string;
  id?: string;
  /** Valor inicial (modo não controlado). */
  defaultValue?: number;
  /** Valor (modo controlado). Use junto com onValueChange. */
  value?: number;
  onValueChange?: (valor: number) => void;
  /** Chamado quando a pessoa digita um valor acima de `max` (o campo já mostra o máximo). Use para avisar. */
  onAcimaDoMaximo?: (max: number, digitado: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  required?: boolean;
  tamanho?: "sm" | "md";
  label?: ReactNode;
  hint?: ReactNode;
  erro?: ReactNode;
  labelOculto?: boolean;
  /** Texto acessível do campo quando não há label visível (ex.: "Quantidade de Vela Lavanda"). */
  rotuloAcessivel?: string;
  /** Sufixo exibido após o número (ex.: "un."). */
  sufixo?: string;
  className?: string;
  wrapperClassName?: string;
};

function limitar(n: number, min: number, max?: number) {
  if (Number.isNaN(n)) return min;
  return Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min, n));
}

/** Quantidade com botões − e +. Aceita digitação; limita a min/max. */
export function NumberStepper({
  name,
  id,
  defaultValue,
  value,
  onValueChange,
  onAcimaDoMaximo,
  min = 0,
  max,
  step = 1,
  disabled,
  required,
  tamanho = "md",
  label,
  hint,
  erro,
  labelOculto,
  rotuloAcessivel,
  sufixo,
  className,
  wrapperClassName,
}: NumberStepperProps) {
  const [interno, setInterno] = useState<number>(() => limitar(defaultValue ?? min, min, max));
  // Texto enquanto a pessoa digita (permite apagar e redigitar).
  const [rascunho, setRascunho] = useState<string | null>(null);
  const controlado = value !== undefined;
  const atual = controlado ? value : interno;
  const campoId = id ?? name ?? "";

  function definir(n: number) {
    const v = limitar(n, min, max);
    if (!controlado) setInterno(v);
    onValueChange?.(v);
  }

  const botao = cn(
    "flex shrink-0 items-center justify-center text-tinta transition hover:bg-areia disabled:pointer-events-none disabled:opacity-35",
    tamanho === "sm" ? "size-10 sm:size-8" : "size-11 sm:size-10",
  );

  const controle = (
    <div
      className={cn(
        "inline-flex items-stretch overflow-hidden rounded-lg border border-borda-campo bg-papel shadow-suave",
        "focus-within:border-chama focus-within:ring-3 focus-within:ring-chama/20",
        erro && "border-alerta",
        disabled && "opacity-60",
        className,
      )}
    >
      <button
        type="button"
        className={botao}
        onClick={() => definir(atual - step)}
        disabled={disabled || atual <= min}
        aria-label="Diminuir"
        aria-controls={campoId || undefined}
      >
        <Minus aria-hidden className="size-4" />
      </button>
      <div className="relative flex items-center border-x border-linha">
        <input
          id={campoId || undefined}
          name={name}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={step}
          required={required}
          disabled={disabled}
          aria-label={!label ? rotuloAcessivel : undefined}
          aria-invalid={erro ? true : undefined}
          aria-describedby={campoId ? descritoPor(campoId, hint, erro) : undefined}
          value={rascunho ?? String(atual)}
          onChange={(e) => {
            const t = e.currentTarget.value;
            const n = Number(t);
            if (t !== "" && !Number.isNaN(n) && max !== undefined && n > max) {
              // Acima do máximo: mostra logo o valor limitado, para o número na tela bater com o estado.
              setRascunho(String(max));
              definir(max);
              onAcimaDoMaximo?.(max, n);
              return;
            }
            setRascunho(t);
            if (t !== "" && !Number.isNaN(n)) definir(n);
          }}
          onBlur={() => setRascunho(null)}
          onFocus={(e) => e.currentTarget.select()}
          className={cn(
            "tabular h-full w-14 bg-transparent text-center text-base font-medium text-tinta outline-none sm:text-sm",
            sufixo && "pr-5",
          )}
        />
        {sufixo && <span className="pointer-events-none absolute right-1.5 text-xs text-suave">{sufixo}</span>}
      </div>
      <button
        type="button"
        className={botao}
        onClick={() => definir(atual + step)}
        disabled={disabled || (max !== undefined && atual >= max)}
        aria-label="Aumentar"
        aria-controls={campoId || undefined}
      >
        <Plus aria-hidden className="size-4" />
      </button>
    </div>
  );

  if (!label && !hint && !erro) return controle;
  return (
    <Field id={campoId} label={label} hint={hint} erro={erro} labelOculto={labelOculto} className={wrapperClassName}>
      <div>{controle}</div>
    </Field>
  );
}
