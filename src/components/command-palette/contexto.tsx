"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { PaletaComandos } from "./paleta";

type ContextoPaleta = { abrir: () => void; fechar: () => void; aberta: boolean };

const Contexto = createContext<ContextoPaleta>({ abrir: () => {}, fechar: () => {}, aberta: false });

/** Abre a paleta de comandos de qualquer lugar do painel: const { abrir } = usePaleta(); */
export function usePaleta() {
  return useContext(Contexto);
}

function editavel(alvo: EventTarget | null) {
  if (!(alvo instanceof HTMLElement)) return false;
  return alvo.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(alvo.tagName);
}

/**
 * Provedor da paleta (Ctrl/Cmd+K). Fica no layout do painel, em volta de todo o conteúdo.
 * Atalhos: Ctrl+K / ⌘K abre ou fecha; "/" abre quando o foco não está num campo.
 */
export function PaletaProvider({ children }: { children: ReactNode }) {
  const [aberta, setAberta] = useState(false);
  const abrir = useCallback(() => setAberta(true), []);
  const fechar = useCallback(() => setAberta(false), []);

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAberta((v) => !v);
        return;
      }
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !editavel(e.target) && !document.querySelector("dialog[open]")) {
        e.preventDefault();
        setAberta(true);
      }
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, []);

  const valor = useMemo(() => ({ abrir, fechar, aberta }), [abrir, fechar, aberta]);

  return (
    <Contexto.Provider value={valor}>
      {children}
      <PaletaComandos aberta={aberta} onFechar={fechar} />
    </Contexto.Provider>
  );
}

const semInscricao = () => () => {};

/** "⌘" no Mac/iPhone, "Ctrl" nos demais (no servidor, sempre "Ctrl"). */
export function useTeclaComando(): string {
  return useSyncExternalStore(
    semInscricao,
    () => (/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl"),
    () => "Ctrl",
  );
}
