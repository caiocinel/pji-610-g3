import { ArchiveRestore, Archive } from "lucide-react";
import { ConfirmDialog, type VarianteBotao } from "@/components/ui";
import { desativarProduto, reativarProduto } from "@/lib/dominio/acoes/produtos";

/** Botão + confirmação para desativar/reativar uma vela (funciona em Server Components). */
export function AtivacaoProduto({
  id,
  nome,
  ativo,
  variante,
  larguraTotal,
}: {
  id: number;
  nome: string;
  ativo: boolean;
  variante?: VarianteBotao;
  larguraTotal?: boolean;
}) {
  if (ativo) {
    return (
      <ConfirmDialog
        gatilho={{ rotulo: "Desativar vela", variante: variante ?? "perigo", icone: <Archive />, larguraTotal }}
        titulo={`Desativar “${nome}”?`}
        descricao="Ela some das listas e da tela de venda. As vendas e o histórico de estoque continuam guardados, e você pode reativar quando quiser."
        tom="perigo"
        confirmar="Desativar"
        confirmando="Desativando…"
        cancelar="Voltar"
        acao={desativarProduto}
        campos={{ id }}
      />
    );
  }
  return (
    <ConfirmDialog
      gatilho={{ rotulo: "Reativar vela", variante: variante ?? "secundario", icone: <ArchiveRestore />, larguraTotal }}
      titulo={`Reativar “${nome}”?`}
      descricao="Ela volta a aparecer nas listas e na tela de venda."
      confirmar="Reativar"
      confirmando="Reativando…"
      acao={reativarProduto}
      campos={{ id }}
    />
  );
}
