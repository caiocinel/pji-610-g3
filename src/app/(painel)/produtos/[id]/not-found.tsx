import { PackageX, Plus } from "lucide-react";
import { ButtonLink, Card, EmptyState } from "@/components/ui";

export default function ProdutoNaoEncontrado() {
  return (
    <Card className="mx-auto max-w-xl">
      <EmptyState
        icone={<PackageX />}
        titulo="Vela não encontrada"
        descricao="Ela pode ter sido removida ou o link está incorreto."
        acao={
          <>
            <ButtonLink href="/produtos" variante="secundario">
              Ver todas as velas
            </ButtonLink>
            <ButtonLink href="/produtos/novo" icone={<Plus />}>
              Cadastrar vela
            </ButtonLink>
          </>
        }
      />
    </Card>
  );
}
