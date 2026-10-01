import type { Metadata } from "next";
import { PageHeader, param } from "@/components/ui";
import { buscarProduto, listarCategorias } from "@/lib/consultas/produtos";
import { getConfiguracoes } from "@/lib/dominio/configuracoes";
import { ProdutoForm } from "../_components/produto-form";
import { requireAuth } from "@/lib/auth";

export const metadata: Metadata = { title: "Nova vela" };

export default async function NovoProdutoPage({ searchParams }: PageProps<"/produtos/novo">) {
  await requireAuth();
  const sp = await searchParams;
  // "Duplicar": /produtos/novo?de=12 pré-preenche com a vela 12, sem gravar nada até Cadastrar.
  const de = Number(param(sp, "de"));
  const [categorias, config, modelo] = await Promise.all([
    listarCategorias(),
    getConfiguracoes(),
    Number.isInteger(de) && de > 0 ? buscarProduto(de) : null,
  ]);
  const cat = Number(param(sp, "categoria"));
  const categoriaInicial = categorias.some((c) => c.id === cat) ? cat : null;

  return (
    <>
      <PageHeader
        breadcrumb={
          modelo
            ? [
                { rotulo: "Produtos", href: "/produtos" },
                { rotulo: modelo.nome, href: `/produtos/${modelo.id}` },
                { rotulo: "Duplicar" },
              ]
            : [{ rotulo: "Produtos", href: "/produtos" }, { rotulo: "Nova vela" }]
        }
        titulo={modelo ? "Duplicar vela" : "Nova vela"}
        descricao={
          modelo
            ? `Os dados de "${modelo.nome}" já estão preenchidos. Ajuste o nome e o que mudar: a nova vela só é criada quando você clicar em Cadastrar.`
            : "Preencha o essencial: nome, aroma e preço. O resto pode ficar para depois."
        }
      />
      <ProdutoForm
        key={modelo?.id ?? "novo"}
        categorias={categorias}
        estoqueMinimoPadrao={config.estoque_minimo_padrao}
        categoriaInicial={categoriaInicial}
        modelo={modelo ?? undefined}
      />
    </>
  );
}
