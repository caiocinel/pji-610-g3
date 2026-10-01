"use client";

import { useState, type ComponentProps, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { Eye, EyeOff, KeyRound, TriangleAlert } from "lucide-react";
import { Field, cn, descritoPor } from "@/components/ui";

type CampoSenhaProps = Omit<ComponentProps<"input">, "type" | "ref"> & {
  name: string;
  label: ReactNode;
  hint?: ReactNode;
  erro?: ReactNode;
  inputRef?: Ref<HTMLInputElement>;
  wrapperClassName?: string;
};

/** Campo de senha com botão de mostrar/ocultar e aviso de Caps Lock ligado. */
export function CampoSenha({ name, label, hint, erro, inputRef, wrapperClassName, className, id, ...rest }: CampoSenhaProps) {
  const [visivel, setVisivel] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const campoId = id ?? name;
  const idCaps = `${campoId}-caps`;

  function verificarCaps(e: KeyboardEvent<HTMLInputElement>) {
    if (typeof e.getModifierState === "function") setCapsLock(e.getModifierState("CapsLock"));
  }

  const descricao = [descritoPor(campoId, hint, erro), capsLock ? idCaps : null].filter(Boolean).join(" ") || undefined;

  return (
    <Field id={campoId} label={label} hint={hint} erro={erro} className={wrapperClassName}>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-suave [&_svg]:size-4">
          <KeyRound aria-hidden />
        </span>
        <input
          {...rest}
          ref={inputRef}
          id={campoId}
          name={name}
          type={visivel ? "text" : "password"}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={erro ? true : undefined}
          aria-describedby={descricao}
          onKeyDown={verificarCaps}
          onKeyUp={verificarCaps}
          onBlur={(e) => {
            setCapsLock(false);
            rest.onBlur?.(e);
          }}
          className={cn("campo pr-12 pl-9", className)}
        />
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          aria-pressed={visivel}
          aria-controls={campoId}
          aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
          title={visivel ? "Ocultar senha" : "Mostrar senha"}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-suave transition hover:text-tinta [&_svg]:size-[18px]"
        >
          {visivel ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </button>
      </div>
      {capsLock && (
        <p id={idCaps} className="mt-1.5 flex items-center gap-1 text-xs font-medium text-mel">
          <TriangleAlert aria-hidden className="size-3.5" />
          Caps Lock está ativado.
        </p>
      )}
    </Field>
  );
}
