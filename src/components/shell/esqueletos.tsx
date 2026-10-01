import type { ReactNode } from "react";
import { Skeleton, SkeletonStatCards, SkeletonText, SkeletonTabela, cn } from "@/components/ui";

/*
 * Esqueletos de página para os loading.tsx do painel. Imitam o layout final de cada tela
 * (cabeçalho, cartões, tabela no desktop / cartões no celular) para a troca não "pular".
 */

function Carregando({ children, rotulo = "Carregando…" }: { children: ReactNode; rotulo?: string }) {
  return (
    <div role="status" aria-live="polite" aria-label={rotulo} className="animate-entrada space-y-6">
      {children}
      <span className="sr-only">{rotulo}</span>
    </div>
  );
}

function Cartao({ className, children }: { className?: string; children?: ReactNode }) {
  return <div className={cn("cartao p-5", className)}>{children}</div>;
}

export function EsqueletoCabecalho({ acoes = 1, trilha = false }: { acoes?: number; trilha?: boolean }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between" aria-hidden>
      <div className="min-w-0 space-y-2.5">
        {trilha && <Skeleton className="h-3.5 w-36" />}
        <Skeleton className="h-8 w-52 sm:h-9" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {acoes > 0 && (
        <div className="flex gap-2">
          {Array.from({ length: acoes }, (_, i) => (
            <Skeleton key={i} className={cn("h-11 flex-1 rounded-lg sm:h-10 sm:w-32 sm:flex-none", i > 0 && "hidden sm:block")} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Lista em cartões (como o DataTable fica no celular). */
function CartoesMoveis({ quantidade = 5 }: { quantidade?: number }) {
  return (
    <div className="space-y-3 md:hidden" aria-hidden>
      {Array.from({ length: quantidade }, (_, i) => (
        <Cartao key={i} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="mt-3 flex gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        </Cartao>
      ))}
    </div>
  );
}

function BarraFiltros() {
  return (
    <div className="flex gap-2" aria-hidden>
      <Skeleton className="h-11 flex-1 rounded-lg sm:h-10" />
      <Skeleton className="h-11 w-24 rounded-lg sm:h-10 md:hidden" />
      <Skeleton className="hidden h-10 w-40 rounded-lg md:block" />
      <Skeleton className="hidden h-10 w-40 rounded-lg md:block" />
    </div>
  );
}

/** Listagem: cabeçalho, (indicadores), filtros, tabela/cartões e paginação. */
export function EsqueletoLista({
  cartoes = 0,
  linhas = 8,
  colunas = 5,
  filtros = true,
  acoes = 1,
  abas = false,
}: {
  cartoes?: number;
  linhas?: number;
  colunas?: number;
  filtros?: boolean;
  acoes?: number;
  abas?: boolean;
}) {
  return (
    <Carregando>
      <EsqueletoCabecalho acoes={acoes} />
      {cartoes > 0 && <SkeletonStatCards quantidade={cartoes} />}
      {abas && (
        <div className="flex gap-2" aria-hidden>
          {["w-16", "w-24", "w-20"].map((w, i) => (
            <Skeleton key={i} className={cn("h-9 rounded-full", w)} />
          ))}
        </div>
      )}
      {filtros && <BarraFiltros />}
      <div className="hidden md:block">
        <SkeletonTabela linhas={linhas} colunas={colunas} />
      </div>
      <CartoesMoveis quantidade={Math.min(linhas, 5)} />
      <div className="flex items-center justify-between" aria-hidden>
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-10 w-48 rounded-lg" />
      </div>
    </Carregando>
  );
}

/** Detalhe: trilha, cabeçalho, indicadores e grade 2/3 + 1/3. */
export function EsqueletoDetalhe({ cartoes = 4, acoes = 2 }: { cartoes?: number; acoes?: number }) {
  return (
    <Carregando>
      <EsqueletoCabecalho trilha acoes={acoes} />
      {cartoes > 0 && <SkeletonStatCards quantidade={cartoes} />}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Cartao>
            <Skeleton className="h-5 w-40" />
            <div className="mt-5 space-y-4">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="size-8 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-1/2" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          </Cartao>
        </div>
        <div className="space-y-6">
          {[4, 3].map((n, i) => (
            <Cartao key={i}>
              <Skeleton className="h-5 w-32" />
              <div className="mt-4 space-y-3">
                {Array.from({ length: n }, (_, j) => (
                  <div key={j} className="space-y-1.5">
                    <Skeleton className="h-2.5 w-16" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ))}
              </div>
            </Cartao>
          ))}
        </div>
      </div>
    </Carregando>
  );
}

/** Formulário: cabeçalho e cartões com pares de campos. */
export function EsqueletoFormulario({ secoes = 3, largura = "max-w-3xl" }: { secoes?: number; largura?: string }) {
  return (
    <Carregando>
      <EsqueletoCabecalho trilha acoes={0} />
      <div className={cn("space-y-6", largura)}>
        {Array.from({ length: secoes }, (_, s) => (
          <Cartao key={s}>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-2 h-3.5 w-64 max-w-full" />
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {Array.from({ length: s === 0 ? 4 : 2 }, (_, c) => (
                <div key={c} className="space-y-2">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-11 w-full rounded-lg sm:h-10" />
                </div>
              ))}
            </div>
          </Cartao>
        ))}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end" aria-hidden>
          <Skeleton className="h-11 rounded-lg sm:h-10 sm:w-28" />
          <Skeleton className="h-11 rounded-lg sm:h-10 sm:w-36" />
        </div>
      </div>
    </Carregando>
  );
}

function CartaoGrafico({ altura = "h-56 sm:h-64", className }: { altura?: string; className?: string }) {
  return (
    <Cartao className={className}>
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-3 w-28" />
        </div>
        <Skeleton className="hidden h-8 w-24 rounded-lg sm:block" />
      </div>
      <div className={cn("mt-5 flex items-end gap-1.5", altura)} aria-hidden>
        {[40, 62, 48, 75, 55, 88, 60, 70, 45, 82, 66, 92, 58, 74].map((h, i) => (
          <div key={i} className={cn("flex-1 animate-brilho rounded-t bg-linha/70", i > 9 && "hidden sm:block")} style={{ height: `${h}%` }} />
        ))}
      </div>
    </Cartao>
  );
}

function CartaoLista({ itens = 5, titulo = "w-36" }: { itens?: number; titulo?: string }) {
  return (
    <Cartao>
      <Skeleton className={cn("h-5", titulo)} />
      <div className="mt-4 divide-y divide-linha">
        {Array.from({ length: itens }, (_, i) => (
          <div key={i} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-4 w-14" />
          </div>
        ))}
      </div>
    </Cartao>
  );
}

/** Dashboard: saudação, 4 indicadores, gráfico de 30 dias, top produtos, alertas e últimas vendas. */
export function EsqueletoDashboard() {
  return (
    <Carregando rotulo="Carregando o resumo…">
      <EsqueletoCabecalho acoes={2} />
      <div className="flex gap-2 overflow-hidden sm:hidden" aria-hidden>
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-11 w-32 shrink-0 rounded-lg" />
        ))}
      </div>
      <SkeletonStatCards quantidade={4} />
      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <CartaoGrafico className="lg:col-span-2" />
        <CartaoLista itens={5} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <CartaoLista itens={4} titulo="w-44" />
        <CartaoLista itens={5} titulo="w-32" />
      </div>
    </Carregando>
  );
}

/** Relatórios: período, indicadores, grade de gráficos e rankings. */
export function EsqueletoRelatorios() {
  return (
    <Carregando rotulo="Montando os relatórios…">
      <EsqueletoCabecalho acoes={2} />
      <div className="flex flex-wrap items-center gap-3" aria-hidden>
        <Skeleton className="h-11 w-full rounded-lg sm:h-10 sm:w-56" />
        <Skeleton className="h-3.5 w-40" />
      </div>
      <SkeletonStatCards quantidade={4} />
      <CartaoGrafico />
      <div className="grid gap-4 md:grid-cols-2 lg:gap-6">
        <CartaoGrafico altura="h-48" />
        <CartaoGrafico altura="h-48" />
        <CartaoGrafico altura="h-48" className="hidden md:block" />
        <CartaoGrafico altura="h-48" className="hidden md:block" />
      </div>
      <div className="hidden md:block">
        <SkeletonTabela linhas={6} colunas={5} />
      </div>
      <CartoesMoveis quantidade={3} />
    </Carregando>
  );
}

/** PDV: busca, categorias, grade de produtos e carrinho (lateral no desktop, barra no celular). */
export function EsqueletoPDV() {
  return (
    <Carregando rotulo="Abrindo o caixa…">
      <EsqueletoCabecalho acoes={0} />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <Skeleton className="h-11 w-full rounded-lg sm:h-10" />
          <div className="flex gap-2 overflow-hidden" aria-hidden>
            {["w-16", "w-24", "w-20", "w-28", "w-20"].map((w, i) => (
              <Skeleton key={i} className={cn("h-9 shrink-0 rounded-full", w)} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 12 }, (_, i) => (
              <Cartao key={i} className={cn("p-4", i > 7 && "hidden sm:block")}>
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="mt-2 h-3 w-1/2" />
                <div className="mt-4 flex items-center justify-between">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="size-9 rounded-lg" />
                </div>
              </Cartao>
            ))}
          </div>
        </div>
        <Cartao className="hidden h-fit space-y-4 lg:block">
          <Skeleton className="h-5 w-28" />
          <SkeletonText linhas={4} />
          <div className="space-y-2 border-t border-linha pt-4">
            <Skeleton className="h-11 w-full rounded-lg" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
          <Skeleton className="h-12 w-full rounded-lg" />
        </Cartao>
      </div>
    </Carregando>
  );
}

/** Recibo: folha centralizada. */
export function EsqueletoRecibo() {
  return (
    <Carregando rotulo="Preparando o recibo…">
      <div className="mx-auto flex max-w-md justify-between gap-2" aria-hidden>
        <Skeleton className="h-10 w-24 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
      <Cartao className="mx-auto max-w-md p-6">
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-52" />
        </div>
        <div className="my-5 border-t border-dashed border-linha-forte" />
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex justify-between gap-4">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3.5 w-14" />
            </div>
          ))}
        </div>
        <div className="my-5 border-t border-dashed border-linha-forte" />
        <div className="flex justify-between">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-24" />
        </div>
        <SkeletonText linhas={2} className="mt-6" />
      </Cartao>
    </Carregando>
  );
}
