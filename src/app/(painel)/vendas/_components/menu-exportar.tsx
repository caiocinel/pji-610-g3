"use client";

import { Download, ListOrdered, Receipt } from "lucide-react";
import { Dropdown, toast } from "@/components/ui";

/**
 * Exportação do histórico (respeita os filtros atuais). `query` = searchParams atuais serializados.
 * Download por link com `download`: o Route Handler responde com anexo, a página não sai do lugar.
 */
export function MenuExportar({ query, desabilitado }: { query: string; desabilitado?: boolean }) {
  function baixar(formato: "vendas" | "itens") {
    const sp = new URLSearchParams(query);
    sp.delete("pagina");
    if (formato === "itens") sp.set("formato", "itens");
    else sp.delete("formato");
    const a = document.createElement("a");
    a.href = `/api/export/vendas?${sp}`;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.info("Preparando o arquivo…", { description: "O download começa em instantes." });
  }

  return (
    <Dropdown
      gatilho={{ rotulo: "Exportar", icone: <Download />, variante: "secundario" }}
      itens={[
        {
          rotulo: "Vendas (uma linha por venda)",
          icone: <Receipt />,
          onSelect: () => baixar("vendas"),
          desabilitado,
        },
        {
          rotulo: "Itens vendidos (uma linha por vela)",
          icone: <ListOrdered />,
          onSelect: () => baixar("itens"),
          desabilitado,
        },
      ]}
    />
  );
}
