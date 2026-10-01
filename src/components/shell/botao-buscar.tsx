"use client";

import { Search } from "lucide-react";
import { usePaleta } from "@/components/command-palette";
import { Button, type VarianteBotao } from "@/components/ui";

/** Botão que abre a paleta de busca (Ctrl/Cmd+K). Só funciona dentro do painel. */
export function BotaoBuscar({ variante = "secundario", children = "Buscar" }: { variante?: VarianteBotao; children?: string }) {
  const { abrir } = usePaleta();
  return (
    <Button variante={variante} icone={<Search />} onClick={abrir} aria-keyshortcuts="Control+K Meta+K">
      {children}
    </Button>
  );
}
