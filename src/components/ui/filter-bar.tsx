"use client";

import Form from "next/form";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLayoutEffect, useRef, useState, type ChangeEvent, type FocusEvent, type ReactNode } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Button, classesBotao } from "./button";
import { cn } from "./cn";

export type FilterBarProps = {
  /** Rota da listagem (o formulário faz GET para ela), ex.: "/produtos". */
  caminho: string;
  /** Campo sempre visível (normalmente <SearchInput />). */
  busca?: ReactNode;
  /** Filtros extras (Select, PeriodoSelect modo="form", inputs de data). No celular ficam atrás do botão "Filtros". */
  children?: ReactNode;
  /** Parâmetros a preservar que não têm campo no formulário (ex.: { ordenar: "nome" }). */
  manter?: Record<string, string | number | undefined | null>;
  /** Quantos filtros (de children) estão ativos: aparece no botão "Filtros" do celular. */
  totalAtivos?: number;
  /** Link para limpar tudo (mostrado quando totalAtivos > 0 ou há busca). Ex.: "/produtos". */
  limparHref?: string;
  /** Envia ao mudar selects/datas/checkboxes (padrão: true). Campos com data-manual não disparam. */
  autoEnviar?: boolean;
  className?: string;
};

/**
 * Barra de filtros de listagem: um <form method="get"> (next/form, navegação no cliente).
 * Ao enviar, a URL vira ?q=…&categoria=… (e ?pagina some, voltando à página 1).
 */
export function FilterBar({
  caminho,
  busca,
  children,
  manter,
  totalAtivos = 0,
  limparHref,
  autoEnviar = true,
  className,
}: FilterBarProps) {
  const [aberto, setAberto] = useState(false);
  // Os campos usam defaultValue: quando a URL muda (chip removido, "Limpar filtros", envio), o formulário
  // é remontado pela chave para não reenviar um filtro que a pessoa já tirou.
  const chave = useSearchParams().toString();
  const formRef = useRef<HTMLFormElement>(null);
  const focado = useRef<string | null>(null);

  // Depois da remontagem, devolve o foco ao campo que estava em uso (ex.: o select que acabou de mudar).
  useLayoutEffect(() => {
    const nome = focado.current;
    const form = formRef.current;
    if (!nome || !form || (document.activeElement && document.activeElement !== document.body)) return;
    const campo = form.elements.namedItem(nome);
    if (!(campo instanceof HTMLElement)) return;
    const digitavel = campo instanceof HTMLInputElement && !["date", "month", "checkbox", "radio"].includes(campo.type);
    // No celular, refocar um campo de texto reabriria o teclado por cima dos resultados.
    if (digitavel && !window.matchMedia("(pointer: fine)").matches) return;
    campo.focus({ preventScroll: true });
  }, [chave]);

  function aoFocar(e: FocusEvent<HTMLFormElement>) {
    const alvo: EventTarget = e.target;
    focado.current = alvo instanceof HTMLInputElement || alvo instanceof HTMLSelectElement ? alvo.name || null : null;
  }

  function aoDesfocar(e: FocusEvent<HTMLFormElement>) {
    // Foco foi para outro elemento (fora ou dentro do form): esquece. Sem relatedTarget pode ser a remontagem.
    if (e.relatedTarget) focado.current = null;
  }

  function aoMudar(e: ChangeEvent<HTMLFormElement>) {
    if (!autoEnviar) return;
    const alvo = e.target as HTMLElement;
    if (alvo.dataset.manual !== undefined) return;
    const automatico =
      alvo instanceof HTMLSelectElement ||
      (alvo instanceof HTMLInputElement && ["date", "month", "checkbox", "radio"].includes(alvo.type));
    if (automatico) e.currentTarget.requestSubmit();
  }

  return (
    <Form
      key={chave}
      ref={formRef}
      action={caminho}
      replace
      scroll={false}
      onChange={aoMudar}
      onFocus={aoFocar}
      onBlur={aoDesfocar}
      role="search"
      className={cn("cartao mb-4 p-3 sm:p-4 print:hidden", className)}
    >
      {manter &&
        Object.entries(manter).map(([k, v]) =>
          v === undefined || v === null || v === "" ? null : <input key={k} type="hidden" name={k} value={v} />,
        )}
      <div className="flex items-center gap-2">
        {busca && <div className="min-w-0 flex-1">{busca}</div>}
        {children && (
          <Button
            variante="secundario"
            className="md:hidden"
            icone={<SlidersHorizontal />}
            aria-expanded={aberto}
            onClick={() => setAberto((a) => !a)}
          >
            Filtros
            {totalAtivos > 0 && (
              <span className="tabular rounded-full bg-chama px-1.5 text-xs text-sobre">{totalAtivos}</span>
            )}
          </Button>
        )}
        <Button type="submit" variante={busca ? "secundario" : "primario"} className={cn(busca && "hidden sm:inline-flex")}>
          Filtrar
        </Button>
      </div>
      {children && (
        <div
          className={cn(
            "mt-3 grid gap-3 sm:grid-cols-2 md:grid md:grid-cols-3 lg:grid-cols-4 [&_.rotulo]:text-xs [&_.rotulo]:text-suave",
            aberto ? "grid" : "hidden",
          )}
        >
          {children}
        </div>
      )}
      {limparHref && totalAtivos > 0 && (
        <div className="mt-3 flex justify-end">
          <Link href={limparHref} className={classesBotao({ variante: "fantasma", tamanho: "sm" })}>
            <X aria-hidden />
            Limpar filtros
          </Link>
        </div>
      )}
    </Form>
  );
}

export type FiltroAtivo = { rotulo: ReactNode; hrefRemover: string };

/** Chips dos filtros aplicados, cada um com "x" para remover (hrefs montados com montarHref). */
export function FiltrosAtivos({
  itens,
  limparHref,
  className,
}: {
  itens: FiltroAtivo[];
  limparHref?: string;
  className?: string;
}) {
  if (!itens.length) return null;
  return (
    <div className={cn("mb-4 flex flex-wrap items-center gap-2 print:hidden", className)}>
      <span className="text-xs text-suave">Filtros:</span>
      {itens.map((f, i) => (
        <Link
          key={i}
          href={f.hrefRemover}
          scroll={false}
          className="inline-flex h-10 items-center gap-1 rounded-full border border-linha-forte bg-papel pr-2 pl-3 text-xs font-medium text-tinta transition hover:bg-areia sm:h-8"
        >
          {f.rotulo}
          <X aria-hidden className="size-3.5 text-suave" />
          <span className="sr-only">(remover filtro)</span>
        </Link>
      ))}
      {limparHref && itens.length > 1 && (
        <Link href={limparHref} scroll={false} className="inline-flex min-h-10 items-center px-1 text-xs font-medium text-chama-escura hover:underline sm:min-h-8">
          Limpar tudo
        </Link>
      )}
    </div>
  );
}
