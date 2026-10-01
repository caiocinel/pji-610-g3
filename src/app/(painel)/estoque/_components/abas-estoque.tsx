import { Boxes, History, Layers } from "lucide-react";
import { TabsLinks } from "@/components/ui";

/** Navegação entre as telas de estoque. */
export function AbasEstoque({ ativa }: { ativa: "visao" | "movimentacoes" | "lote" }) {
  return (
    <TabsLinks
      rotulo="Seções do estoque"
      className="mb-6"
      itens={[
        { rotulo: "Visão geral", href: "/estoque", ativo: ativa === "visao", icone: <Boxes aria-hidden /> },
        { rotulo: "Movimentações", href: "/estoque/movimentacoes", ativo: ativa === "movimentacoes", icone: <History aria-hidden /> },
        { rotulo: "Entrada em lote", href: "/estoque/lote", ativo: ativa === "lote", icone: <Layers aria-hidden /> },
      ]}
    />
  );
}
