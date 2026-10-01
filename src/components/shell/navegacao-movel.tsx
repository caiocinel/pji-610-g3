"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronRight, Ellipsis, Search } from "lucide-react";
import { usePaleta } from "@/components/command-palette";
import { Logo } from "@/components/logo";
import { Drawer, cn } from "@/components/ui";
import { BotaoSair } from "./botao-sair";
import {
  NAV_INFERIOR_DIREITA,
  NAV_INFERIOR_ESQUERDA,
  NAV_MAIS,
  NAV_NOVA_VENDA,
  itemAtivo,
  type ItemNav,
} from "./navegacao";

/** Barra superior do celular: marca + busca. */
export function TopoMovel({ lojaNome }: { lojaNome: string }) {
  const { abrir } = usePaleta();
  return (
    <header className="sticky top-0 z-30 border-b border-linha bg-creme/90 pt-[env(safe-area-inset-top)] backdrop-blur-md md:hidden print:hidden">
      <div className="flex h-14 items-center gap-2 px-4">
        <Link href="/" className="flex min-w-0 flex-1 items-center gap-2 rounded-lg" aria-label={`${lojaNome} — início`}>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-chama-clara text-chama">
            <Logo className="size-5" />
          </span>
          <span className="truncate font-serif text-lg font-semibold text-tinta">{lojaNome}</span>
        </Link>
        <button
          type="button"
          onClick={abrir}
          aria-label="Buscar produtos, clientes e vendas"
          className="-mr-2 flex size-11 items-center justify-center rounded-lg text-suave transition hover:bg-areia hover:text-tinta active:bg-areia"
        >
          <Search aria-hidden className="size-[22px]" />
        </button>
      </div>
    </header>
  );
}

function ItemBarra({ item, ativo, alertas }: { item: ItemNav; ativo: boolean; alertas: number }) {
  const Icone = item.icone;
  const mostrarAlerta = item.alertaEstoque && alertas > 0;
  return (
    <Link
      href={item.href}
      aria-current={ativo ? "page" : undefined}
      className={cn(
        "relative flex h-full flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium transition active:scale-95",
        ativo ? "text-chama-escura" : "text-suave",
      )}
    >
      <span className={cn("relative flex h-7 w-12 items-center justify-center rounded-full transition", ativo && "bg-chama-clara")}>
        <Icone aria-hidden className="size-[22px]" strokeWidth={ativo ? 2.25 : 2} />
        {mostrarAlerta && (
          <span className="absolute -top-0.5 right-1 size-2.5 rounded-full bg-mel ring-2 ring-papel">
            <span className="sr-only">
              {alertas} {alertas === 1 ? "produto precisa" : "produtos precisam"} de reposição
            </span>
          </span>
        )}
      </span>
      {item.rotuloCurto ?? item.rotulo}
    </Link>
  );
}

/** Barra inferior do celular (Início, Vendas, Nova venda, Estoque, Mais) + gaveta "Mais". */
export function BarraInferior({ alertasEstoque, lojaNome }: { alertasEstoque: number; lojaNome: string }) {
  const pathname = usePathname();
  const { abrir } = usePaleta();
  const [maisAberto, setMaisAberto] = useState(false);
  const maisAtivo = NAV_MAIS.some((i) => itemAtivo(pathname, i.href));
  const vendaAtiva = itemAtivo(pathname, NAV_NOVA_VENDA.href);
  const fechar = () => setMaisAberto(false);

  return (
    <>
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-linha bg-papel/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_-8px_rgb(0_0_0/0.12)] backdrop-blur-md md:hidden print:hidden"
      >
        <ul className="mx-auto grid h-16 max-w-md grid-cols-5">
          {NAV_INFERIOR_ESQUERDA.map((item) => (
            <li key={item.href}>
              <ItemBarra item={item} ativo={itemAtivo(pathname, item.href)} alertas={alertasEstoque} />
            </li>
          ))}
          <li className="flex justify-center">
            <Link
              href={NAV_NOVA_VENDA.href}
              aria-current={vendaAtiva ? "page" : undefined}
              className="flex flex-col items-center gap-0.5 text-[0.6875rem] font-medium text-chama-escura active:scale-95"
            >
              <span
                className={cn(
                  "-mt-5 flex size-14 items-center justify-center rounded-full bg-chama text-sobre shadow-elevado ring-4 ring-creme transition",
                  vendaAtiva && "bg-chama-escura",
                )}
              >
                <NAV_NOVA_VENDA.icone aria-hidden className="size-6" />
              </span>
              {NAV_NOVA_VENDA.rotulo}
            </Link>
          </li>
          {NAV_INFERIOR_DIREITA.map((item) => (
            <li key={item.href}>
              <ItemBarra item={item} ativo={itemAtivo(pathname, item.href)} alertas={alertasEstoque} />
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => setMaisAberto(true)}
              aria-haspopup="dialog"
              aria-expanded={maisAberto}
              className={cn(
                "flex h-full w-full flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium transition active:scale-95",
                maisAtivo ? "text-chama-escura" : "text-suave",
              )}
            >
              <span className={cn("flex h-7 w-12 items-center justify-center rounded-full", maisAtivo && "bg-chama-clara")}>
                <Ellipsis aria-hidden className="size-[22px]" />
              </span>
              Mais
            </button>
          </li>
        </ul>
      </nav>

      <Drawer aberto={maisAberto} onFechar={fechar} titulo="Mais opções" descricao={lojaNome} lado="baixo">
        <ul className="-mx-2 space-y-0.5">
          {NAV_MAIS.map((item) => {
            const Icone = item.icone;
            const ativo = itemAtivo(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={fechar}
                  aria-current={ativo ? "page" : undefined}
                  className={cn(
                    "flex h-13 items-center gap-3 rounded-xl px-2 text-base font-medium transition active:bg-areia",
                    ativo ? "bg-chama-clara text-chama-escura" : "text-tinta hover:bg-areia",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center rounded-lg",
                      ativo ? "bg-papel/70" : "bg-areia text-suave",
                    )}
                  >
                    <Icone aria-hidden className="size-5" />
                  </span>
                  <span className="flex-1">{item.rotulo}</span>
                  <ChevronRight aria-hidden className="size-4 text-suave" />
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => {
                fechar();
                abrir();
              }}
              className="flex h-13 w-full items-center gap-3 rounded-xl px-2 text-base font-medium text-tinta transition hover:bg-areia active:bg-areia"
            >
              <span className="flex size-9 items-center justify-center rounded-lg bg-areia text-suave">
                <Search aria-hidden className="size-5" />
              </span>
              <span className="flex-1 text-left">Buscar</span>
              <ChevronRight aria-hidden className="size-4 text-suave" />
            </button>
          </li>
        </ul>
        <div className="mt-3 border-t border-linha pt-3 pb-[env(safe-area-inset-bottom)]">
          <BotaoSair className="-mx-2 flex h-13 w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 text-base font-medium text-alerta transition hover:bg-alerta-clara active:bg-alerta-clara disabled:opacity-60 [&>svg]:mx-2 [&>svg]:size-5" />
        </div>
      </Drawer>
    </>
  );
}
