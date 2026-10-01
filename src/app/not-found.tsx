import { House, MapPinOff, ShoppingBag } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { PaginaAvulsa } from "@/components/shell/pagina-avulsa";

export const metadata = { title: "Página não encontrada" };

/** Endereço que não existe no sistema. */
export default function NaoEncontrado() {
  return (
    <PaginaAvulsa
      icone={<MapPinOff aria-hidden />}
      titulo="Página não encontrada"
      descricao="Este endereço não existe ou mudou de lugar. Confira o link ou volte para o início."
      acoes={
        <>
          <ButtonLink href="/vendas/nova" variante="secundario" icone={<ShoppingBag />}>
            Nova venda
          </ButtonLink>
          <ButtonLink href="/" icone={<House />}>
            Ir para o início
          </ButtonLink>
        </>
      }
      rodape="Erro 404"
    />
  );
}
