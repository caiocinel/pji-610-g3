"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { IconButton, toast } from "@/components/ui";

/** Botão pequeno para copiar um texto (telefone, e-mail) com confirmação. */
export function CopiarBotao({ texto, rotulo }: { texto: string; rotulo: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      toast.success("Copiado!");
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto e copie manualmente.");
    }
  }

  return (
    <IconButton
      rotulo={copiado ? "Copiado" : rotulo}
      tamanho="sm"
      icone={copiado ? <Check className="text-salvia" /> : <Copy />}
      onClick={copiar}
    />
  );
}
