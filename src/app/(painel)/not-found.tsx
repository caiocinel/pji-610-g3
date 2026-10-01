import { House, SearchX } from "lucide-react";
import { ButtonLink, Card, EmptyState } from "@/components/ui";
import { BotaoBuscar } from "@/components/shell/botao-buscar";

export const metadata = { title: "Não encontrado" };

/** Registro inexistente (notFound() numa página do painel): o menu continua à mão. */
export default function NaoEncontradoPainel() {
  return (
    <Card className="mx-auto mt-4 max-w-xl sm:mt-10">
      <EmptyState
        icone={<SearchX />}
        titulo="Não encontramos o que você procurava"
        descricao="O registro pode ter sido removido ou o link está incompleto. Tente buscar pelo nome, aroma ou número da venda."
        acao={
          <>
            <ButtonLink href="/" variante="secundario" icone={<House />}>
              Ir para o início
            </ButtonLink>
            <BotaoBuscar variante="primario">Buscar</BotaoBuscar>
          </>
        }
      />
    </Card>
  );
}
