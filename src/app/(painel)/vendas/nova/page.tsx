import type { Metadata } from "next";
import { PackagePlus, Plus, ShoppingBag } from "lucide-react";
import { Aviso, ButtonLink, Card, EmptyState, PageHeader, param } from "@/components/ui";
import { getConfiguracoes } from "@/lib/dominio/configuracoes";
import { listarClientesPDV, listarProdutosPDV } from "./consultas";
import { PDV } from "./pdv";
import { requireAuth } from "@/lib/auth";

export const metadata: Metadata = { title: "Nova venda" };

function idParam(valor: string | undefined) {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export default async function NovaVendaPage({ searchParams }: PageProps<"/vendas/nova">) {
  await requireAuth();
  const sp = await searchParams;
  const [produtos, clientes, config] = await Promise.all([listarProdutosPDV(), listarClientesPDV(), getConfiguracoes()]);
  const todosEsgotados = produtos.length > 0 && produtos.every((p) => p.estoque <= 0);

  return (
    <>
      <PageHeader
        titulo="Nova venda"
        descricao="Toque nas velas para montar o carrinho e finalize em seguida."
      />

      {produtos.length === 0 ? (
        <Card>
          <EmptyState
            icone={<ShoppingBag aria-hidden />}
            titulo="Nenhuma vela para vender ainda"
            descricao="Cadastre suas velas com preço e estoque para começar a registrar vendas."
            acao={
              <ButtonLink href="/produtos/novo" icone={<Plus />}>
                Cadastrar vela
              </ButtonLink>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {todosEsgotados && (
            <Aviso
              tipo="atencao"
              titulo="Todas as velas estão esgotadas"
              acao={
                <ButtonLink href="/estoque" tamanho="sm" variante="secundario" icone={<PackagePlus />}>
                  Dar entrada
                </ButtonLink>
              }
            >
              Registre a produção no estoque para poder vender.
            </Aviso>
          )}
          <PDV
            produtos={produtos}
            clientes={clientes}
            lojaNome={config.loja_nome}
            clienteInicialId={idParam(param(sp, "cliente"))}
            produtoInicialId={idParam(param(sp, "produto"))}
          />
        </div>
      )}
    </>
  );
}
