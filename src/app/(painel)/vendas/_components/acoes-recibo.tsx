"use client";

import { useEffect, useState } from "react";
import { Check, Copy, MessageCircle, Printer, Share2 } from "lucide-react";
import { Button, classesBotao, toast } from "@/components/ui";
import { linkWhatsApp } from "@/lib/format";

type Props = {
  /** Recibo em texto (ver textoRecibo). */
  texto: string;
  titulo: string;
  /** Telefone do cliente (só dígitos): o WhatsApp abre direto na conversa dele. */
  telefoneCliente?: string | null;
  /** Abre a janela de impressão assim que a página carrega (?imprimir=1). */
  autoImprimir?: boolean;
};

/** Barra de ações do recibo: imprimir, copiar, compartilhar e WhatsApp. Some na impressão. */
export function AcoesRecibo({ texto, titulo, telefoneCliente, autoImprimir }: Props) {
  const [copiado, setCopiado] = useState(false);
  const [podeCompartilhar, setPodeCompartilhar] = useState(false);

  useEffect(() => {
    // navigator só existe no navegador; decidir depois da hidratação evita divergência com o servidor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPodeCompartilhar(typeof navigator !== "undefined" && typeof navigator.share === "function");
    if (autoImprimir) {
      const t = window.setTimeout(() => window.print(), 300);
      return () => window.clearTimeout(t);
    }
  }, [autoImprimir]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      toast.success("Recibo copiado. É só colar na conversa.");
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto e copie manualmente.");
    }
  }

  async function compartilhar() {
    try {
      await navigator.share({ title: titulo, text: texto });
    } catch (e) {
      if ((e as DOMException)?.name !== "AbortError") toast.error("Não foi possível compartilhar agora.");
    }
  }

  const whatsapp = linkWhatsApp(telefoneCliente, texto) ?? `https://wa.me/?text=${encodeURIComponent(texto)}`;

  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-center print:hidden" data-nao-imprimir>
      <Button icone={<Printer />} onClick={() => window.print()} className="col-span-2 sm:col-auto">
        Imprimir
      </Button>
      <a
        href={whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        title={linkWhatsApp(telefoneCliente) ? "Abre a conversa com o cliente desta venda" : "Escolha o contato no WhatsApp"}
        className={classesBotao({ variante: "secundario" })}
      >
        <MessageCircle aria-hidden />
        WhatsApp
      </a>
      <Button variante="secundario" icone={copiado ? <Check /> : <Copy />} onClick={copiar}>
        {copiado ? "Copiado" : "Copiar texto"}
      </Button>
      {podeCompartilhar && (
        <Button variante="secundario" icone={<Share2 />} onClick={compartilhar} className="col-span-2 sm:col-auto">
          Compartilhar
        </Button>
      )}
    </div>
  );
}
