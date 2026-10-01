"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { usePaleta, useTeclaComando } from "@/components/command-palette";
import { Logo } from "@/components/logo";
import { Kbd, cn } from "@/components/ui";
import { BotaoSair } from "./botao-sair";
import { COOKIE_SIDEBAR, GRUPOS_NAV, itemAtivo, type ItemNav } from "./navegacao";

/** Dica à direita do ícone quando o menu está recolhido (o texto acessível continua no link). */
function DicaLateral({ texto }: { texto: string }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none invisible absolute top-1/2 left-full z-50 ml-3 -translate-y-1/2 rounded-md bg-tinta px-2 py-1 text-xs font-medium whitespace-nowrap text-creme opacity-0 shadow-elevado transition-opacity group-hover/item:visible group-hover/item:opacity-100 group-focus-visible/item:visible group-focus-visible/item:opacity-100"
    >
      {texto}
    </span>
  );
}

function SeloAlerta({ total, compacta }: { total: number; compacta: boolean }) {
  if (total <= 0) return null;
  const texto = `${total} ${total === 1 ? "produto precisa" : "produtos precisam"} de reposição`;
  if (compacta)
    return (
      <span className="absolute top-1.5 right-1.5 size-2.5 rounded-full bg-mel ring-2 ring-papel">
        <span className="sr-only">{texto}</span>
      </span>
    );
  return (
    <span
      title={texto}
      className="tabular ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-mel-clara px-1.5 text-[0.6875rem] font-semibold text-mel"
    >
      {total}
      <span className="sr-only"> — {texto}</span>
    </span>
  );
}

function LinkNav({ item, ativo, compacta, alertas }: { item: ItemNav; ativo: boolean; compacta: boolean; alertas: number }) {
  const Icone = item.icone;
  const base = "group/item relative flex h-10 items-center gap-3 rounded-lg text-sm font-medium transition [&_svg]:size-[18px] [&_svg]:shrink-0";
  const estilo = item.destaque
    ? cn("bg-chama text-sobre shadow-suave hover:bg-chama-escura", ativo && "ring-2 ring-chama/35 ring-offset-2 ring-offset-papel")
    : ativo
      ? "bg-chama-clara text-chama-escura"
      : "text-suave hover:bg-areia hover:text-tinta";
  return (
    <Link
      href={item.href}
      aria-current={ativo ? "page" : undefined}
      className={cn(base, estilo, compacta ? "justify-center px-0" : "px-3")}
    >
      {ativo && !item.destaque && !compacta && (
        <span aria-hidden className="absolute inset-y-2 -left-3 w-1 rounded-r-full bg-chama" />
      )}
      <Icone aria-hidden />
      <span className={cn("truncate", compacta && "sr-only")}>{item.rotulo}</span>
      {item.alertaEstoque && <SeloAlerta total={alertas} compacta={compacta} />}
      {compacta && <DicaLateral texto={item.rotulo} />}
    </Link>
  );
}

export function Sidebar({
  lojaNome,
  alertasEstoque,
  compactaInicial,
}: {
  lojaNome: string;
  alertasEstoque: number;
  compactaInicial: boolean;
}) {
  const pathname = usePathname();
  const { abrir } = usePaleta();
  const tecla = useTeclaComando();
  const [compacta, setCompacta] = useState(compactaInicial);

  function alternar() {
    const nova = !compacta;
    setCompacta(nova);
    document.cookie = `${COOKIE_SIDEBAR}=${nova ? "compacta" : "expandida"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <aside
      aria-label="Menu principal"
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-linha bg-papel transition-[width] duration-200 md:flex print:hidden",
        compacta ? "w-[4.5rem]" : "w-64",
      )}
    >
      <div className={cn("flex h-16 items-center", compacta ? "justify-center px-2" : "px-5")}>
        <Link href="/" className="group/item relative flex min-w-0 items-center gap-2.5 rounded-lg" aria-label={`${lojaNome} — início`}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-chama-clara text-chama">
            <Logo className="size-6" />
          </span>
          {!compacta && <span className="truncate font-serif text-lg leading-tight font-semibold text-tinta">{lojaNome}</span>}
        </Link>
      </div>

      <div className={cn("pb-3", compacta ? "px-3" : "px-4")}>
        <button
          type="button"
          onClick={abrir}
          aria-keyshortcuts="Control+K Meta+K"
          aria-label={compacta ? "Buscar (Ctrl+K)" : undefined}
          className={cn(
            "group/item relative flex h-10 w-full items-center gap-2 rounded-lg border border-linha-forte bg-creme text-sm text-suave shadow-suave transition hover:border-suave/50 hover:text-tinta",
            compacta ? "justify-center" : "px-3",
          )}
        >
          <Search aria-hidden className="size-4 shrink-0" />
          {!compacta && (
            <>
              <span className="flex-1 text-left">Buscar…</span>
              <span className="flex items-center gap-0.5">
                <Kbd>{tecla}</Kbd>
                <Kbd>K</Kbd>
              </span>
            </>
          )}
          {compacta && <DicaLateral texto={`Buscar (${tecla} K)`} />}
        </button>
      </div>

      <nav
        aria-label="Seções"
        className={cn("flex-1 space-y-5 pt-2 pb-4", compacta ? "overflow-visible px-3" : "rolagem-fina overflow-y-auto px-4")}
      >
        {GRUPOS_NAV.map((grupo, i) => (
          <div key={grupo.titulo}>
            {compacta ? (
              i > 0 && <div role="separator" className="mx-2 mb-3 border-t border-linha" />
            ) : (
              <p className="mb-1.5 px-3 text-[0.6875rem] font-semibold tracking-wider text-suave uppercase">{grupo.titulo}</p>
            )}
            <ul className="space-y-0.5">
              {grupo.itens.map((item) => (
                <li key={item.href} className={cn(item.destaque && "py-1")}>
                  <LinkNav item={item} ativo={itemAtivo(pathname, item.href)} compacta={compacta} alertas={alertasEstoque} />
                </li>
              ))}
              {grupo.titulo === "Sistema" && (
                <li>
                  <BotaoSair
                    compacto={compacta}
                    className={cn(
                      "group/item relative flex h-10 w-full items-center gap-3 rounded-lg text-sm font-medium text-suave transition hover:bg-alerta-clara hover:text-alerta disabled:opacity-60 [&_svg]:size-[18px] [&_svg]:shrink-0",
                      compacta ? "justify-center" : "px-3",
                    )}
                    extra={compacta && <DicaLateral texto="Sair" />}
                  />
                </li>
              )}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cn("border-t border-linha py-3", compacta ? "px-3" : "px-4")}>
        <button
          type="button"
          onClick={alternar}
          aria-expanded={!compacta}
          aria-label={compacta ? "Expandir menu" : "Recolher menu"}
          className={cn(
            "group/item relative flex h-9 w-full items-center gap-3 rounded-lg text-sm text-suave transition hover:bg-areia hover:text-tinta [&_svg]:size-[18px]",
            compacta ? "justify-center" : "px-3",
          )}
        >
          {compacta ? <PanelLeftOpen aria-hidden /> : <PanelLeftClose aria-hidden />}
          {!compacta && <span>Recolher menu</span>}
          {compacta && <DicaLateral texto="Expandir menu" />}
        </button>
      </div>
    </aside>
  );
}
