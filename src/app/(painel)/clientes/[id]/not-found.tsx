import { UserRoundX, Users } from "lucide-react";
import { ButtonLink, Card, EmptyState } from "@/components/ui";

export default function ClienteNaoEncontrado() {
  return (
    <Card>
      <EmptyState
        icone={<UserRoundX />}
        titulo="Cliente não encontrado"
        descricao="Esse cadastro não existe ou o link está incorreto."
        acao={
          <ButtonLink href="/clientes" icone={<Users />}>
            Ver clientes
          </ButtonLink>
        }
      />
    </Card>
  );
}
