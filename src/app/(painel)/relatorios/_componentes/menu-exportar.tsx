"use client";

import { CalendarDays, ChartBar, ChartPie, Download, ListOrdered, PackageX, Sparkles, Store, Tags, Users, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { Dropdown, toast, type ItemMenu } from "@/components/ui";
import { TIPOS_EXPORTACAO, type TipoExportacao } from "./exportacao";

const ICONES: Record<TipoExportacao, ReactNode> = {
  resumo: <ChartBar />,
  diario: <CalendarDays />,
  produtos: <ListOrdered />,
  clientes: <Users />,
  categorias: <Tags />,
  aromas: <Sparkles />,
  pagamentos: <Wallet />,
  canais: <Store />,
  semana: <ChartPie />,
  parados: <PackageX />,
};

/**
 * Menu "Exportar CSV" dos relatórios. `params` = parâmetros do período atual (periodo/de/ate).
 * Download por navegação direta: o Route Handler responde com anexo e a página não sai do lugar.
 */
export function MenuExportar({ params, desabilitado }: { params: Record<string, string>; desabilitado?: boolean }) {
  function baixar(tipo: TipoExportacao) {
    const sp = new URLSearchParams({ ...params, tipo });
    // Âncora temporária com `download`: o navegador baixa o arquivo sem sair da página.
    const a = document.createElement("a");
    a.href = `/api/export/relatorios?${sp}`;
    a.download = "";
    document.body.append(a);
    a.click();
    a.remove();
    toast.info("Preparando a planilha…", { description: "O download começa em instantes." });
  }

  const itens: ItemMenu[] = TIPOS_EXPORTACAO.flatMap(({ tipo, rotulo }, i) => {
    const item: ItemMenu = { rotulo, icone: ICONES[tipo], onSelect: () => baixar(tipo), desabilitado };
    // Separa o resumo geral das planilhas detalhadas.
    return i === 1 ? [{ separador: true } as const, item] : [item];
  });

  return <Dropdown gatilho={{ rotulo: "Exportar CSV", icone: <Download />, variante: "secundario" }} itens={itens} />;
}
