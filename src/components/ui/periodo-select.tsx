"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, ChevronDown } from "lucide-react";
import { ATALHOS_PERIODO, ROTULO_ATALHO, hojeSP, somarDias, type AtalhoPeriodo } from "@/lib/periodo";
import { Button, Spinner } from "./button";
import { cn } from "./cn";
import { montarHref, type ParamsBusca } from "./url";

export type PeriodoSelectProps = {
  /**
   * Período atual, normalmente o retorno de parsePeriodo(searchParams) de @/lib/periodo.
   * null = sem filtro de período (só com `rotuloTodos`).
   */
  periodo: { atalho: AtalhoPeriodo; de: string; ate: string } | null;
  /** Mostra a opção "sem período" com este texto (ex.: "Todo o período"); escolhê-la remove periodo/de/ate. */
  rotuloTodos?: string;
  /**
   * "navegar" (padrão): muda a URL sozinho (precisa de `caminho` e `searchParams`).
   * "form": vira campos name="periodo"/"de"/"ate" de um <FilterBar>/<form method="get"> e envia o form.
   */
  modo?: "navegar" | "form";
  /** Rota atual, ex.: "/relatorios" (modo navegar). */
  caminho?: string;
  /** searchParams atuais, preservados ao trocar o período (modo navegar). ?pagina é sempre removido. */
  searchParams?: ParamsBusca;
  /** Atalhos exibidos (padrão: todos). */
  atalhos?: readonly AtalhoPeriodo[];
  rotulo?: string;
  /** Esconde o rótulo visualmente. */
  rotuloOculto?: boolean;
  className?: string;
};

/**
 * Seletor de período: Hoje, 7 dias, 30 dias, Este mês, Mês anterior, Este ano, Personalizado (de/até).
 * Gera ?periodo=mes ou ?periodo=personalizado&de=AAAA-MM-DD&ate=AAAA-MM-DD (lido por parsePeriodo).
 */
export function PeriodoSelect({
  periodo,
  modo = "navegar",
  caminho = "",
  searchParams,
  atalhos = ATALHOS_PERIODO,
  rotulo = "Período",
  rotuloOculto,
  rotuloTodos,
  className,
}: PeriodoSelectProps) {
  const router = useRouter();
  const [pendente, startTransition] = useTransition();
  const atalhoAtual: AtalhoPeriodo | "" = periodo?.atalho ?? (rotuloTodos ? "" : "30d");
  const deAtual = periodo?.de ?? somarDias(hojeSP(), -29);
  const ateAtual = periodo?.ate ?? hojeSP();
  const [escolhido, setEscolhido] = useState<AtalhoPeriodo | "">(atalhoAtual);
  const [de, setDe] = useState(deAtual);
  const [ate, setAte] = useState(ateAtual);
  // Sincroniza quando a URL muda por fora (voltar do navegador, link de atalho).
  const chave = `${atalhoAtual}|${deAtual}|${ateAtual}`;
  const [chaveAnterior, setChaveAnterior] = useState(chave);
  if (chave !== chaveAnterior) {
    setChaveAnterior(chave);
    setEscolhido(atalhoAtual);
    setDe(deAtual);
    setAte(ateAtual);
  }
  const id = useId();
  const personalizado = escolhido === "personalizado";
  const invalido = personalizado && (!de || !ate || de > ate);

  function navegar(alteracoes: Record<string, string | null>) {
    startTransition(() =>
      router.push(montarHref(caminho, searchParams, { ...alteracoes, pagina: null }), { scroll: false }),
    );
  }

  function escolher(valor: AtalhoPeriodo | "", form: HTMLFormElement | null) {
    setEscolhido(valor);
    if (valor === "personalizado") return; // espera as datas
    if (modo === "form") {
      // Deixa o React renderizar sem os campos de data antes de enviar.
      setTimeout(() => form?.requestSubmit(), 0);
    } else {
      navegar({ periodo: valor || null, de: null, ate: null });
    }
  }

  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={`${id}-atalho`} className={cn("rotulo", rotuloOculto && "sr-only")}>
        {rotulo}
      </label>
      <div className="flex flex-wrap items-end gap-2">
        <div className="relative min-w-44 flex-1 sm:flex-none">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-suave">
            {pendente ? <Spinner className="size-4" /> : <CalendarRange aria-hidden className="size-4" />}
          </span>
          <select
            id={`${id}-atalho`}
            name={modo === "form" && escolhido ? "periodo" : undefined}
            data-manual
            value={escolhido}
            onChange={(e) => escolher(e.currentTarget.value as AtalhoPeriodo | "", e.currentTarget.form)}
            className="campo cursor-pointer appearance-none pr-9 pl-9"
          >
            {rotuloTodos && <option value="">{rotuloTodos}</option>}
            {atalhos.map((a) => (
              <option key={a} value={a}>
                {ROTULO_ATALHO[a]}
              </option>
            ))}
          </select>
          <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-suave" />
        </div>
        {personalizado && (
          <>
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
              <label htmlFor={`${id}-de`} className="sr-only">
                Data inicial
              </label>
              <input
                id={`${id}-de`}
                type="date"
                name={modo === "form" ? "de" : undefined}
                data-manual
                value={de}
                max={ate || undefined}
                onChange={(e) => setDe(e.currentTarget.value)}
                className="campo min-w-0 sm:w-40"
              />
              <span className="text-sm text-suave">até</span>
              <label htmlFor={`${id}-ate`} className="sr-only">
                Data final
              </label>
              <input
                id={`${id}-ate`}
                type="date"
                name={modo === "form" ? "ate" : undefined}
                data-manual
                value={ate}
                min={de || undefined}
                onChange={(e) => setAte(e.currentTarget.value)}
                className="campo min-w-0 sm:w-40"
              />
            </div>
            <Button
              type={modo === "form" ? "submit" : "button"}
              variante="secundario"
              disabled={invalido}
              carregando={pendente}
              onClick={modo === "navegar" ? () => navegar({ periodo: "personalizado", de, ate }) : undefined}
            >
              Aplicar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
