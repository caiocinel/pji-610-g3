"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CircleCheck, Download, Smartphone } from "lucide-react";
import { Aviso, Button, Card, CardHeader, toast } from "@/components/ui";

type EventoInstalacao = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function assinarModo(aviso: () => void) {
  const mq = window.matchMedia("(display-mode: standalone)");
  mq.addEventListener("change", aviso);
  return () => mq.removeEventListener("change", aviso);
}

function instalado() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

const nada = () => () => {};
const ehIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** Cartão "Instalar o app": botão nativo quando o navegador permite, senão o passo a passo. */
export function InstalarApp() {
  const jaInstalado = useSyncExternalStore(assinarModo, instalado, () => false);
  const ios = useSyncExternalStore(nada, ehIOS, () => false);
  const [evento, setEvento] = useState<EventoInstalacao | null>(null);

  useEffect(() => {
    const capturar = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoInstalacao);
    };
    const concluir = () => {
      setEvento(null);
      toast.success("App instalado! Procure o ícone da Luamme na tela inicial.");
    };
    window.addEventListener("beforeinstallprompt", capturar);
    window.addEventListener("appinstalled", concluir);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturar);
      window.removeEventListener("appinstalled", concluir);
    };
  }, []);

  async function instalar() {
    if (!evento) return;
    await evento.prompt();
    await evento.userChoice;
    setEvento(null);
  }

  return (
    <Card id="aplicativo" className="scroll-mt-24">
      <CardHeader
        icone={<Smartphone />}
        titulo="App no celular"
        descricao="Abra o sistema direto da tela inicial, como um aplicativo."
      />
      {jaInstalado ? (
        <Aviso tipo="ok">Você já está usando o app instalado neste aparelho.</Aviso>
      ) : evento ? (
        <Button icone={<Download />} onClick={instalar} larguraTotal>
          Instalar o app
        </Button>
      ) : ios ? (
        <ol className="list-inside list-decimal space-y-1.5 text-sm text-tinta marker:font-semibold marker:text-chama">
          <li>Abra este endereço no Safari.</li>
          <li>Toque em Compartilhar (o quadrado com a seta para cima).</li>
          <li>Escolha “Adicionar à Tela de Início”.</li>
        </ol>
      ) : (
        <ol className="list-inside list-decimal space-y-1.5 text-sm text-tinta marker:font-semibold marker:text-chama">
          <li>No celular, abra este endereço no Chrome.</li>
          <li>Toque no menu ⋮ no canto da tela.</li>
          <li>Escolha “Instalar app” ou “Adicionar à tela inicial”.</li>
        </ol>
      )}
      {!jaInstalado && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-suave">
          <CircleCheck aria-hidden className="size-3.5 text-salvia" />
          Seus dados continuam no servidor: nada fica guardado só no aparelho.
        </p>
      )}
    </Card>
  );
}
