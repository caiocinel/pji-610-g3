"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Ellipsis } from "lucide-react";
import { Button, type OpcoesBotao } from "./button";
import { cn } from "./cn";

export type ItemMenu =
  | {
      rotulo: string;
      icone?: ReactNode;
      /** Navega para a rota. */
      href?: string;
      /** Ação no cliente (só funciona se o Dropdown for usado dentro de um Client Component). */
      onSelect?: () => void;
      /** Texto vermelho (excluir, cancelar). */
      perigo?: boolean;
      desabilitado?: boolean;
      /** Abre em nova aba (ex.: recibo para imprimir). */
      novaAba?: boolean;
    }
  | { separador: true };

export type DropdownProps = {
  itens: ItemMenu[];
  /** Botão que abre o menu. Padrão: ícone "…" com rótulo "Mais ações". */
  gatilho?: OpcoesBotao & { rotulo: string; icone?: ReactNode; somenteIcone?: boolean };
  /** Lado em que o menu se alinha ao botão. */
  alinhar?: "inicio" | "fim";
  className?: string;
};

/** Menu suspenso simples (setas, Esc, clique fora). */
export function Dropdown({ itens, gatilho, alinhar = "fim", className }: DropdownProps) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const idMenu = useId();
  const g = gatilho ?? { rotulo: "Mais ações", icone: <Ellipsis />, somenteIcone: true, variante: "fantasma" as const };

  useEffect(() => {
    if (!aberto) return;
    function fora(e: PointerEvent) {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("pointerdown", fora);
    // Foca o primeiro item ao abrir.
    menu.current?.querySelector<HTMLElement>("[role=menuitem]:not([aria-disabled=true])")?.focus();
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberto]);

  function fechar(focarBotao = true) {
    setAberto(false);
    if (focarBotao) botao.current?.focus();
  }

  function teclado(e: KeyboardEvent<HTMLDivElement>) {
    const itensEl = [...(menu.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not([aria-disabled=true])") ?? [])];
    const i = itensEl.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.preventDefault();
      fechar();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      itensEl[(i + 1) % itensEl.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      itensEl[(i - 1 + itensEl.length) % itensEl.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      itensEl[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      itensEl[itensEl.length - 1]?.focus();
    } else if (e.key === "Tab") {
      setAberto(false);
    }
  }

  const { rotulo, icone, ...opcoes } = g;
  const classeItem = (perigo?: boolean, desabilitado?: boolean) =>
    cn(
      "flex h-11 w-full items-center gap-2.5 rounded-md px-3 text-left text-sm outline-none transition sm:h-9 [&_svg]:size-4 [&_svg]:shrink-0",
      perigo ? "text-alerta hover:bg-alerta-clara focus:bg-alerta-clara" : "text-tinta hover:bg-areia focus:bg-areia",
      desabilitado && "pointer-events-none opacity-45",
    );

  return (
    <div ref={raiz} className={cn("relative inline-block", className)} onKeyDown={aberto ? teclado : undefined}>
      <Button
        ref={botao}
        variante="secundario"
        {...opcoes}
        icone={icone}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? idMenu : undefined}
        aria-label={opcoes.somenteIcone ? rotulo : undefined}
        title={opcoes.somenteIcone ? rotulo : undefined}
        onClick={() => setAberto((a) => !a)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !aberto) {
            e.preventDefault();
            setAberto(true);
          }
        }}
      >
        {!opcoes.somenteIcone && rotulo}
      </Button>
      {aberto && (
        <div
          ref={menu}
          id={idMenu}
          role="menu"
          aria-label={rotulo}
          className={cn(
            "animate-entrada absolute z-40 mt-1.5 min-w-52 rounded-xl border border-linha bg-papel p-1 shadow-elevado",
            alinhar === "fim" ? "right-0" : "left-0",
          )}
        >
          {itens.map((item, i) => {
            if ("separador" in item) return <div key={`s${i}`} role="separator" className="my-1 h-px bg-linha" />;
            const conteudo = (
              <>
                {item.icone}
                <span className="truncate">{item.rotulo}</span>
              </>
            );
            if (item.href && !item.desabilitado) {
              return (
                <Link
                  key={item.rotulo}
                  href={item.href}
                  role="menuitem"
                  tabIndex={-1}
                  target={item.novaAba ? "_blank" : undefined}
                  onClick={() => fechar(false)}
                  className={classeItem(item.perigo)}
                >
                  {conteudo}
                </Link>
              );
            }
            return (
              <button
                key={item.rotulo}
                type="button"
                role="menuitem"
                tabIndex={-1}
                aria-disabled={item.desabilitado || undefined}
                onClick={() => {
                  if (item.desabilitado) return;
                  fechar();
                  item.onSelect?.();
                }}
                className={classeItem(item.perigo, item.desabilitado)}
              >
                {conteudo}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
