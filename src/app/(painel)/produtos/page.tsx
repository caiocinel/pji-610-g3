import type { Metadata } from "next";
import { Archive, Package, PackageCheck, PackageX, Pencil, Plus, Tags, TriangleAlert } from "lucide-react";
import {
  Badge,
  ButtonLink,
  Card,
  DataTable,
  EmptyState,
  EstoqueBadge,
  FilterBar,
  FiltrosAtivos,
  IconLink,
  PageHeader,
  Pagination,
  SearchInput,
  SegmentedLinks,
  Select,
  cn,
  montarHref,
  paginaAtual,
  param,
  type Coluna,
  type FiltroAtivo,
} from "@/components/ui";
import {
  ORDENACOES_PRODUTO,
  ROTULO_ORDENACAO_PRODUTO,
  lerOrdenacao,
  lerSituacao,
  listarCategorias,
  paginaProdutos,
  type ProdutoLista,
  type StatusProduto,
} from "@/lib/consultas/produtos";
import { ROTULO_SITUACAO_ESTOQUE, calcularMargem } from "@/lib/dominio";
import { formatBRL, formatInt, formatPercent, plural } from "@/lib/format";
import { CLASSE_TEXTO_MARGEM, tomMargem } from "./_components/margem";
import { requireAuth } from "@/lib/auth";

export const metadata: Metadata = { title: "Produtos" };

const CAMINHO = "/produtos";

export default async function ProdutosPage({ searchParams }: PageProps<"/produtos">) {
  await requireAuth();
  const sp = await searchParams;
  const q = (param(sp, "q") ?? "").trim().slice(0, 100);
  const categoria = param(sp, "categoria") ?? "";
  const situacao = lerSituacao(param(sp, "situacao"));
  const status: StatusProduto = param(sp, "status") === "inativos" ? "inativos" : "ativos";
  const ordenar = lerOrdenacao(param(sp, "ordenar"));

  const categorias = await listarCategorias();
  // Categoria inexistente (ex.: link antigo de uma categoria excluída) é ignorada.
  const categoriaValida = categoria === "sem" || categorias.some((c) => String(c.id) === categoria) ? categoria : "";
  const { itens, contagem, total, totalPaginas, pagina, porPagina } = await paginaProdutos({
    q,
    categoria: categoriaValida,
    situacao,
    status,
    ordenar,
    pagina: paginaAtual(sp),
    porPagina: 20,
  });

  const nomeCategoria =
    categoriaValida === "sem" ? "Sem categoria" : categorias.find((c) => String(c.id) === categoriaValida)?.nome;
  const inativos = status === "inativos";
  const filtrando = Boolean(q || categoriaValida || situacao || inativos);
  const semNenhumProduto = contagem.ativos + contagem.inativos === 0 && !q && !categoriaValida;

  const chips: FiltroAtivo[] = [];
  const remover = (chave: string) => montarHref(CAMINHO, sp, { [chave]: null, pagina: null });
  if (q) chips.push({ rotulo: `Busca: “${q}”`, hrefRemover: remover("q") });
  if (nomeCategoria) chips.push({ rotulo: nomeCategoria, hrefRemover: remover("categoria") });
  if (situacao) chips.push({ rotulo: ROTULO_SITUACAO_ESTOQUE[situacao], hrefRemover: remover("situacao") });
  if (inativos) chips.push({ rotulo: "Desativadas", hrefRemover: remover("status") });

  const linkSituacao = (s: string | null) => montarHref(CAMINHO, sp, { situacao: s, pagina: null });

  const colunas: Coluna<ProdutoLista>[] = [
    {
      id: "nome",
      cabecalho: "Vela",
      mobile: "titulo",
      celula: (p) => (
        <span className="block min-w-0">
          <span className="block truncate">{p.nome}</span>
          {p.sku && <span className="block font-mono text-xs font-normal text-suave">{p.sku}</span>}
        </span>
      ),
    },
    {
      id: "aroma",
      cabecalho: "Aroma",
      mobile: "subtitulo",
      celula: (p) => (
        <span>
          {p.aroma}
          {p.categoria_nome && <span className="text-suave md:hidden"> · {p.categoria_nome}</span>}
        </span>
      ),
    },
    {
      id: "categoria",
      cabecalho: "Categoria",
      classe: "hidden xl:table-cell",
      mobile: "oculto",
      celula: (p) => p.categoria_nome ?? <span className="text-suave">—</span>,
    },
    {
      id: "preco",
      cabecalho: "Preço",
      alinhar: "direita",
      mobile: "valor",
      celula: (p) => formatBRL(p.preco),
    },
    {
      id: "margem",
      cabecalho: "Margem",
      alinhar: "direita",
      classe: "hidden lg:table-cell",
      celula: (p) => {
        const { margem } = calcularMargem(p.preco, p.custo);
        if (p.custo <= 0) return <span className="text-suave" title="Custo não informado">—</span>;
        return <span className={cn("font-medium", CLASSE_TEXTO_MARGEM[tomMargem(margem)])}>{formatPercent(margem)}</span>;
      },
    },
    {
      id: "estoque",
      cabecalho: "Estoque",
      alinhar: "direita",
      celula: (p) => `${formatInt(p.estoque)} un.`,
    },
    {
      id: "vendidos",
      cabecalho: "Vendidas",
      alinhar: "direita",
      classe: "hidden lg:table-cell",
      celula: (p) => formatInt(p.vendidos),
    },
    {
      id: "situacao",
      cabecalho: "Situação",
      mobile: "badge",
      celula: (p) =>
        p.ativo ? <EstoqueBadge estoque={p.estoque} minimo={p.estoque_minimo} /> : <Badge tom="neutro">Desativada</Badge>,
    },
    {
      id: "acoes",
      cabecalho: <span className="sr-only">Ações</span>,
      alinhar: "direita",
      classe: "w-12",
      mobile: "oculto",
      celula: (p) => <IconLink href={`/produtos/${p.id}/editar`} rotulo={`Editar ${p.nome}`} icone={<Pencil />} tamanho="sm" />,
    },
  ];

  return (
    <>
      <PageHeader
        titulo="Produtos"
        descricao="Suas velas, preços, margens e estoque."
        acoes={
          <>
            <ButtonLink href="/produtos/categorias" variante="secundario" icone={<Tags />}>
              Categorias
            </ButtonLink>
            <ButtonLink
              href={categoriaValida && categoriaValida !== "sem" ? `/produtos/novo?categoria=${categoriaValida}` : "/produtos/novo"}
              icone={<Plus />}
            >
              Nova vela
            </ButtonLink>
          </>
        }
      />

      {semNenhumProduto ? (
        <Card>
          <EmptyState
            icone={<Package />}
            titulo="Nenhuma vela cadastrada"
            descricao="Cadastre sua primeira vela para controlar estoque e começar a vender."
            acao={
              <ButtonLink href="/produtos/novo" icone={<Plus />}>
                Cadastrar vela
              </ButtonLink>
            }
          />
        </Card>
      ) : (
        <>
          <FilterBar
            caminho={CAMINHO}
            manter={{ situacao }}
            totalAtivos={(categoriaValida ? 1 : 0) + (inativos ? 1 : 0) + (ordenar !== "nome" ? 1 : 0)}
            limparHref={CAMINHO}
            busca={<SearchInput defaultValue={q} placeholder="Buscar por nome, aroma ou SKU…" rotulo="Buscar velas" />}
          >
            <Select
              name="categoria"
              label="Categoria"
              placeholder="Todas"
              defaultValue={categoriaValida}
              opcoes={[...categorias.map((c) => ({ valor: c.id, rotulo: c.nome })), { valor: "sem", rotulo: "Sem categoria" }]}
            />
            <Select
              name="ordenar"
              label="Ordenar por"
              defaultValue={ordenar}
              opcoes={ORDENACOES_PRODUTO.map((o) => ({ valor: o, rotulo: ROTULO_ORDENACAO_PRODUTO[o] }))}
            />
            <Select
              name="status"
              label="Mostrar"
              defaultValue={status}
              opcoes={[
                { valor: "ativos", rotulo: `Velas ativas (${contagem.ativos})` },
                { valor: "inativos", rotulo: `Desativadas (${contagem.inativos})` },
              ]}
            />
          </FilterBar>

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SegmentedLinks
              rotulo="Filtrar por situação do estoque"
              itens={[
                { rotulo: "Todas", href: linkSituacao(null), ativo: !situacao, contagem: contagem.total, icone: <Package aria-hidden /> },
                {
                  rotulo: "Estoque baixo",
                  href: linkSituacao("baixo"),
                  ativo: situacao === "baixo",
                  contagem: contagem.baixo,
                  icone: <TriangleAlert aria-hidden />,
                },
                {
                  rotulo: "Esgotadas",
                  href: linkSituacao("esgotado"),
                  ativo: situacao === "esgotado",
                  contagem: contagem.esgotado,
                  icone: <PackageX aria-hidden />,
                },
                {
                  rotulo: "Disponíveis",
                  href: linkSituacao("ok"),
                  ativo: situacao === "ok",
                  contagem: contagem.ok,
                  icone: <PackageCheck aria-hidden />,
                },
              ]}
            />
            <p className="text-sm text-suave" aria-live="polite">
              {plural(total, inativos ? "vela desativada" : "vela", inativos ? "velas desativadas" : "velas")}
              {ordenar !== "nome" && <> · {ROTULO_ORDENACAO_PRODUTO[ordenar].toLowerCase()}</>}
            </p>
          </div>

          <FiltrosAtivos itens={chips} limparHref={CAMINHO} />

          <Card padding="none">
            <DataTable
              rotulo="Lista de velas"
              linhas={itens}
              chave={(p) => p.id}
              hrefLinha={(p) => `/produtos/${p.id}`}
              colunas={colunas}
              classeLinha={(p) => (p.ativo ? undefined : "opacity-75")}
              vazio={
                filtrando ? (
                  <EmptyState
                    compacto
                    icone={inativos ? <Archive /> : <Package />}
                    titulo={inativos && !q && !categoriaValida && !situacao ? "Nenhuma vela desativada" : "Nada encontrado"}
                    descricao={
                      inativos && !q && !categoriaValida && !situacao
                        ? "Velas que você desativar aparecem aqui para reativar depois."
                        : "Tente outra busca ou limpe os filtros."
                    }
                    acao={
                      <ButtonLink href={CAMINHO} variante="secundario">
                        Limpar filtros
                      </ButtonLink>
                    }
                  />
                ) : (
                  <EmptyState
                    compacto
                    icone={<Package />}
                    titulo="Nenhuma vela ativa"
                    descricao="Todas as velas estão desativadas."
                    acao={
                      <ButtonLink href={montarHref(CAMINHO, sp, { status: "inativos" })} variante="secundario">
                        Ver desativadas
                      </ButtonLink>
                    }
                  />
                )
              }
            />
          </Card>

          <Pagination
            className="mt-4"
            pagina={pagina}
            totalPaginas={totalPaginas}
            totalItens={total}
            porPagina={porPagina}
            caminho={CAMINHO}
            searchParams={sp}
          />
        </>
      )}
    </>
  );
}
