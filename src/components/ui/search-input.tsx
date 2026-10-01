"use client";

import { useRef, useTransition, type InputHTMLAttributes } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Spinner } from "./button";
import { cn } from "./cn";

export type SearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  /** Rótulo acessível (fica oculto). Padrão: "Buscar". */
  rotulo?: string;
  /**
   * Atualiza a URL (?q=…) enquanto digita, sem precisar de botão. Remove ?pagina.
   * Sem isso, o campo funciona como um input comum dentro de um <form method="get"> / <FilterBar>.
   */
  instantaneo?: boolean;
  /** Espera (ms) antes de atualizar a URL no modo instantâneo. */
  atraso?: number;
  wrapperClassName?: string;
};

/** Campo de busca com ícone de lupa e botão de limpar. name padrão: "q". */
export function SearchInput({
  rotulo = "Buscar",
  instantaneo,
  atraso = 350,
  name = "q",
  id,
  placeholder = "Buscar…",
  className,
  wrapperClassName,
  onChange,
  ...rest
}: SearchInputProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [pendente, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const campoId = id ?? `busca-${name}`;

  function navegar(valor: string) {
    const sp = new URLSearchParams(window.location.search);
    if (valor.trim()) sp.set(name, valor.trim());
    else sp.delete(name);
    sp.delete("pagina");
    const qs = sp.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  function limpar() {
    if (!ref.current) return;
    ref.current.value = "";
    ref.current.focus();
    if (instantaneo) navegar("");
    else ref.current.form?.requestSubmit();
  }

  return (
    <div className={cn("relative min-w-0", wrapperClassName)}>
      <label htmlFor={campoId} className="sr-only">
        {rotulo}
      </label>
      <input
        ref={ref}
        id={campoId}
        type="search"
        name={name}
        placeholder={placeholder}
        autoComplete="off"
        enterKeyHint="search"
        className={cn("campo peer pr-10 pl-9", className)}
        onChange={(e) => {
          onChange?.(e);
          if (!instantaneo) return;
          const valor = e.currentTarget.value;
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => navegar(valor), atraso);
        }}
        {...rest}
      />
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-suave">
        {pendente ? <Spinner className="size-4" /> : <Search aria-hidden className="size-4" />}
      </span>
      <button
        type="button"
        onClick={limpar}
        aria-label="Limpar busca"
        className="absolute inset-y-0 right-1 my-auto flex size-9 items-center justify-center rounded-md text-suave peer-placeholder-shown:hidden hover:bg-areia hover:text-tinta sm:size-8"
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}
