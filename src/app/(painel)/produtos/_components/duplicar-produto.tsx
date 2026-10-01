import { Copy } from "lucide-react";
import { ButtonLink, type VarianteBotao } from "@/components/ui";

/**
 * Abre o cadastro pré-preenchido com os dados desta vela (sem SKU e com estoque zerado).
 * Nada é gravado até a usuária clicar em Cadastrar: desistir não deixa cópia órfã.
 */
export function DuplicarProduto({ id, variante = "secundario" }: { id: number; variante?: VarianteBotao }) {
  return (
    <ButtonLink
      href={`/produtos/novo?de=${id}`}
      variante={variante}
      icone={<Copy />}
      title="Abre o cadastro de uma nova vela com estes dados para você ajustar"
    >
      Duplicar
    </ButtonLink>
  );
}
