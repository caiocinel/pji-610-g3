import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { buscarProduto, listarCategorias } from "@/lib/consultas/produtos";
import { getConfiguracoes } from "@/lib/dominio/configuracoes";
import { AtivacaoProduto } from "../../_components/ativacao-produto";
import { ProdutoForm } from "../../_components/produto-form";
import { requireAuth } from "@/lib/auth";

export async function generateMetadata({ params }: PageProps<"/produtos/[id]/editar">): Promise<Metadata> {
  await requireAuth();
  const produto = await buscarProduto(Number((await params).id));
  return { title: produto ? `Editar ${produto.nome}` : "Vela não encontrada" };
}

export default async function EditarProdutoPage({ params }: PageProps<"/produtos/[id]/editar">) {
  await requireAuth();
  const { id } = await params;
  const [produto, categorias, config] = await Promise.all([
    buscarProduto(Number(id)),
    listarCategorias(),
    getConfiguracoes(),
  ]);
  if (!produto) notFound();

  return (
    <>
      <PageHeader
        breadcrumb={[
          { rotulo: "Produtos", href: "/produtos" },
          { rotulo: produto.nome, href: `/produtos/${produto.id}` },
          { rotulo: "Editar" },
        ]}
        titulo="Editar vela"
        descricao={produto.nome}
        badges={!produto.ativo && <Badge tom="neutro">Desativada</Badge>}
      />
      <ProdutoForm produto={produto} categorias={categorias} estoqueMinimoPadrao={config.estoque_minimo_padrao} />

      <Card as="section" className="mt-10 max-w-3xl border-alerta/25">
        <CardHeader
          titulo={produto.ativo ? "Desativar vela" : "Vela desativada"}
          descricao={
            produto.ativo
              ? "Use quando parar de fabricar esta vela. Ela some das listas e da tela de venda, mas as vendas e o histórico continuam guardados."
              : "Ela não aparece nas listas nem na tela de venda. Reative para voltar a vender."
          }
        />
        <AtivacaoProduto id={produto.id} nome={produto.nome} ativo={produto.ativo} />
      </Card>
    </>
  );
}
