import type { Metadata } from "next";
import Link from "next/link";
import {
  Boxes,
  ChevronRight,
  Download,
  HandCoins,
  History,
  PackagePlus,
  PackageX,
  Plus,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import {
  ButtonLink,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  EstoqueBadge,
  EstoqueProgress,
  FilterBar,
  PageHeader,
  Pagination,
  SearchInput,
  SegmentedLinks,
  Select,
  StatCard,
  StatGrid,
  montarHref,
  param,
} from "@/components/ui";
import {
  ORDENACOES_ESTOQUE,
  ROTULO_ORDENACAO_ESTOQUE,
  categoriasDoEstoque,
  lerFiltrosPosicao,
  listarPosicaoEstoque,
  produtosMovimentaveis,
  resumoEstoque,
  ultimasMovimentacoes,
  type FiltroSituacao,
} from "@/lib/consultas/estoque";
import { formatBRL, formatDateTime, formatInt, formatRelative, plural } from "@/lib/format";
import { AbasEstoque } from "./_components/abas-estoque";
import { AcoesProdutoEstoque, BotaoMovimentar, MovimentacaoProvider, type AbaMovimentacao } from "./_components/movimentacao";
import { BadgeMotivo, IconeMovimentacao, QuantidadeMov } from "./_components/movimentacao-visual";
import { requireAuth } from "@/lib/auth";

export const metadata: Metadata = { title: "Estoque" };

const ABAS: AbaMovimentacao[] = ["entrada", "saida", "inventario"];

export default async function EstoquePage({ searchParams }: PageProps<"/estoque">) {
  await requireAuth();
  const sp = await searchParams;
  const f = lerFiltrosPosicao(sp);

  // ?produto=ID (e opcionalmente &acao=saida|inventario) abre o diálogo já com a vela escolhida.
  const produtoUrl = Number(param(sp, "produto"));
  const acaoUrl = param(sp, "acao");
  const abaUrl = ABAS.includes(acaoUrl as AbaMovimentacao) ? (acaoUrl as AbaMovimentacao) : null;
  const inicial =
    Number.isInteger(produtoUrl) && produtoUrl > 0
      ? { produtoId: produtoUrl, aba: abaUrl ?? "entrada" }
      : abaUrl
        ? { produtoId: null, aba: abaUrl }
        : null;

  const [resumo, lista, categorias, produtos, recentes] = await Promise.all([
    resumoEstoque(),
    listarPosicaoEstoque(f),
    categoriasDoEstoque(),
    produtosMovimentaveis(),
    ultimasMovimentacoes(8),
  ]);

  // Parâmetros da lista, sem os que só abrem o diálogo (e o ?filtro=baixo legado da v1).
  const spLista = Object.fromEntries(Object.entries(sp).filter(([k]) => !["produto", "acao", "filtro"].includes(k)));
  if (f.situacao) spLista.situacao = f.situacao;
  const base = montarHref("/estoque", spLista);
  const hrefSituacao = (s: FiltroSituacao | null) => montarHref("/estoque", spLista, { situacao: s, pagina: null });
  const filtrosCsv = { q: f.q, categoria: f.categoria, situacao: f.situacao, ordenar: f.ordenar };
  const atencao = resumo.esgotados + resumo.baixos;
  const filtrando = !!(f.q || f.categoria || f.situacao);
  const lucroPotencial = resumo.valor_preco - resumo.valor_custo;

  return (
    <MovimentacaoProvider produtos={produtos} inicial={inicial} limparUrl={base}>
      <PageHeader
        titulo="Estoque"
        descricao="Quanto você tem de cada vela, quanto isso vale e o que precisa repor."
        acoes={
          <>
            <ButtonLink
              href={montarHref("/api/export/estoque", filtrosCsv)}
              prefetch={false}
              variante="secundario"
              icone={<Download />}
            >
              Exportar CSV
            </ButtonLink>
            <BotaoMovimentar icone={<PackagePlus />}>Dar entrada</BotaoMovimentar>
          </>
        }
      />
      <AbasEstoque ativa="visao" />

      {resumo.produtos === 0 ? (
        <Card>
          <EmptyState
            icone={<Boxes />}
            titulo="Nenhuma vela ativa ainda"
            descricao="Cadastre suas velas para acompanhar o estoque, registrar produções e saber quanto vale o que está na prateleira."
            acao={
              <ButtonLink href="/produtos/novo" icone={<Plus />}>
                Cadastrar vela
              </ButtonLink>
            }
          />
        </Card>
      ) : (
        <div className="space-y-6">
          <StatGrid>
            <StatCard
              rotulo="Unidades em estoque"
              valor={formatInt(resumo.unidades)}
              detalhe={`em ${plural(resumo.produtos, "vela ativa", "velas ativas")}`}
              icone={<Boxes />}
            />
            <StatCard
              rotulo="Valor a custo"
              valor={formatBRL(resumo.valor_custo)}
              detalhe={
                resumo.valor_custo === 0 && resumo.unidades > 0
                  ? "Cadastre o custo das velas para ver"
                  : "O que custou produzir o que está guardado"
              }
              icone={<Wallet />}
            />
            <StatCard
              rotulo="Valor de venda"
              valor={formatBRL(resumo.valor_preco)}
              detalhe={`Lucro possível: ${formatBRL(lucroPotencial)}`}
              destaque="salvia"
              icone={<HandCoins />}
            />
            <StatCard
              rotulo="Precisam de atenção"
              valor={formatInt(atencao)}
              destaque={atencao > 0 ? "alerta" : undefined}
              detalhe={
                atencao > 0
                  ? `${plural(resumo.esgotados, "esgotada", "esgotadas")} · ${resumo.baixos} com pouco estoque`
                  : "Tudo abastecido"
              }
              icone={<TriangleAlert />}
              href={atencao > 0 ? hrefSituacao("atencao") : undefined}
            />
          </StatGrid>

          <section aria-labelledby="titulo-posicao">
            <h2 id="titulo-posicao" className="sr-only">
              Estoque por vela
            </h2>
            <SegmentedLinks
              className="mb-4"
              rotulo="Filtrar por situação"
              itens={[
                { rotulo: "Todas", href: hrefSituacao(null), ativo: !f.situacao, contagem: lista.contagem.todos },
                {
                  rotulo: "Precisam de atenção",
                  href: hrefSituacao("atencao"),
                  ativo: f.situacao === "atencao",
                  contagem: lista.contagem.esgotado + lista.contagem.baixo,
                  icone: <TriangleAlert aria-hidden />,
                },
                {
                  rotulo: "Esgotadas",
                  href: hrefSituacao("esgotado"),
                  ativo: f.situacao === "esgotado",
                  contagem: lista.contagem.esgotado,
                  icone: <PackageX aria-hidden />,
                },
                { rotulo: "Pouco estoque", href: hrefSituacao("baixo"), ativo: f.situacao === "baixo", contagem: lista.contagem.baixo },
                { rotulo: "Abastecidas", href: hrefSituacao("ok"), ativo: f.situacao === "ok", contagem: lista.contagem.ok },
              ]}
            />

            <FilterBar
              caminho="/estoque"
              manter={{ situacao: f.situacao }}
              totalAtivos={(f.categoria ? 1 : 0) + (f.ordenar !== "situacao" ? 1 : 0)}
              limparHref={montarHref("/estoque", { situacao: f.situacao })}
              busca={<SearchInput defaultValue={f.q} placeholder="Buscar por nome, aroma ou código…" rotulo="Buscar vela" />}
            >
              <Select
                name="categoria"
                label="Categoria"
                placeholder="Todas"
                defaultValue={f.categoria}
                opcoes={[
                  ...categorias.map((c) => ({ valor: c.id, rotulo: `${c.nome} (${c.produtos})` })),
                  { valor: "sem", rotulo: "Sem categoria" },
                ]}
              />
              <Select
                name="ordenar"
                label="Ordenar por"
                defaultValue={f.ordenar}
                opcoes={ORDENACOES_ESTOQUE.map((o) => ({ valor: o, rotulo: ROTULO_ORDENACAO_ESTOQUE[o] }))}
              />
            </FilterBar>

            <Card padding="none">
              <DataTable
                rotulo="Estoque por vela"
                linhas={lista.itens}
                chave={(p) => p.id}
                hrefLinha={(p) => `/produtos/${p.id}`}
                classeLinha={(p) => (p.situacao === "esgotado" ? "bg-alerta-clara/25" : undefined)}
                colunas={[
                  { id: "nome", cabecalho: "Vela", mobile: "titulo", celula: (p) => p.nome },
                  {
                    id: "aroma",
                    cabecalho: "Aroma",
                    mobile: "subtitulo",
                    classe: "hidden lg:table-cell",
                    celula: (p) => (
                      <span className="text-suave">
                        {p.aroma}
                        {p.categoria_nome && <span className="text-suave"> · {p.categoria_nome}</span>}
                      </span>
                    ),
                  },
                  {
                    id: "qtd",
                    cabecalho: "Estoque",
                    mobile: "valor",
                    alinhar: "direita",
                    classe: "hidden",
                    celula: (p) => `${formatInt(p.estoque)} un.`,
                  },
                  {
                    id: "situacao",
                    cabecalho: "Situação",
                    mobile: "badge",
                    celula: (p) => <EstoqueBadge estoque={p.estoque} minimo={p.estoque_minimo} />,
                  },
                  {
                    id: "nivel",
                    cabecalho: "Nível",
                    mobile: "oculto",
                    classe: "w-44",
                    celula: (p) => <EstoqueProgress estoque={p.estoque} minimo={p.estoque_minimo} />,
                  },
                  {
                    id: "minimo",
                    cabecalho: "Mínimo",
                    classe: "hidden",
                    celula: (p) => `${formatInt(p.estoque_minimo)} un.`,
                  },
                  {
                    id: "valor",
                    cabecalho: "Valor a custo",
                    rotuloMobile: "Valor a custo",
                    alinhar: "direita",
                    celula: (p) => formatBRL(p.valor_custo),
                  },
                  {
                    id: "ultima",
                    cabecalho: "Última movimentação",
                    mobile: "oculto",
                    classe: "hidden xl:table-cell text-suave",
                    celula: (p) =>
                      p.ultima_movimentacao ? (
                        <time dateTime={p.ultima_movimentacao.toISOString()} title={formatDateTime(p.ultima_movimentacao)}>
                          {formatRelative(p.ultima_movimentacao)}
                        </time>
                      ) : (
                        "—"
                      ),
                  },
                  {
                    id: "acoes",
                    cabecalho: <span className="sr-only">Ações</span>,
                    mobile: "acoes",
                    alinhar: "direita",
                    celula: (p) => <AcoesProdutoEstoque produtoId={p.id} nome={p.nome} />,
                  },
                ]}
                vazio={
                  filtrando ? (
                    <EmptyState
                      compacto
                      icone={<Boxes />}
                      titulo={f.situacao && !f.q && !f.categoria ? "Nenhuma vela nessa situação" : "Nada encontrado"}
                      descricao={
                        f.situacao === "atencao" || f.situacao === "esgotado" || f.situacao === "baixo"
                          ? "Ótimo sinal: nenhuma vela precisa de reposição por aqui."
                          : "Tente outra busca ou limpe os filtros."
                      }
                      acao={
                        <ButtonLink href="/estoque" variante="secundario">
                          Ver todas
                        </ButtonLink>
                      }
                    />
                  ) : (
                    <EmptyState compacto icone={<Boxes />} titulo="Nenhuma vela para mostrar" />
                  )
                }
              />
            </Card>
            <Pagination
              className="mt-4"
              pagina={lista.pagina}
              totalPaginas={lista.totalPaginas}
              totalItens={lista.total}
              porPagina={lista.porPagina}
              caminho="/estoque"
              searchParams={spLista}
            />
          </section>

          <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
            <Card>
              <CardHeader titulo="Últimos 30 dias" descricao="Produção e perdas registradas." />
              {/* Cada número leva à lista com exatamente o mesmo filtro (motivos, tipo e período). */}
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/estoque/movimentacoes?motivo=producao_compra&tipo=entrada&periodo=30d"
                  className="group rounded-lg bg-salvia-clara p-3 transition hover:ring-2 hover:ring-salvia/30 focus-visible:ring-2 focus-visible:ring-salvia"
                  aria-label={`Produzidas ou compradas nos últimos 30 dias: ${formatInt(resumo.entradas_30d)} unidades. Ver movimentações`}
                >
                  <span className="flex items-center justify-between gap-1 text-xs font-medium text-salvia">
                    Produzidas / compradas
                    <ChevronRight aria-hidden className="size-4 shrink-0 opacity-60 transition group-hover:translate-x-0.5" />
                  </span>
                  <span className="tabular mt-1 block font-serif text-2xl font-semibold text-salvia">
                    +{formatInt(resumo.entradas_30d)}
                  </span>
                </Link>
                <Link
                  href="/estoque/movimentacoes?motivo=perdas&tipo=saida&periodo=30d"
                  className="group rounded-lg bg-alerta-clara p-3 transition hover:ring-2 hover:ring-alerta/30 focus-visible:ring-2 focus-visible:ring-alerta"
                  aria-label={`Perdas e avarias nos últimos 30 dias: ${formatInt(resumo.perdas_30d)} unidades. Ver movimentações`}
                >
                  <span className="flex items-center justify-between gap-1 text-xs font-medium text-alerta">
                    Perdas e avarias
                    <ChevronRight aria-hidden className="size-4 shrink-0 opacity-60 transition group-hover:translate-x-0.5" />
                  </span>
                  <span className="tabular mt-1 block font-serif text-2xl font-semibold text-alerta">
                    −{formatInt(resumo.perdas_30d)}
                  </span>
                  {resumo.perdas_30d_valor > 0 && (
                    <span className="tabular block text-xs text-alerta">{formatBRL(resumo.perdas_30d_valor)} a custo</span>
                  )}
                </Link>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <ButtonLink href="/estoque/lote" variante="secundario" tamanho="sm" icone={<PackagePlus />}>
                  Entrada em lote
                </ButtonLink>
                <ButtonLink
                  href="/estoque/movimentacoes?motivo=manuais&periodo=30d"
                  variante="fantasma"
                  tamanho="sm"
                  iconeDireita={<ChevronRight />}
                >
                  Ver tudo, menos vendas
                </ButtonLink>
              </div>
            </Card>

            <Card padding="none" className="lg:col-span-2">
              <CardHeader
                inset
                divisoria
                titulo="Movimentações recentes"
                icone={<History />}
                acoes={
                  <ButtonLink href="/estoque/movimentacoes" variante="fantasma" tamanho="sm" iconeDireita={<ChevronRight />}>
                    Ver todas
                  </ButtonLink>
                }
              />
              {recentes.length === 0 ? (
                <EmptyState compacto icone={<History />} titulo="Nenhuma movimentação ainda" />
              ) : (
                <ul className="divide-y divide-linha">
                  {recentes.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                      <IconeMovimentacao mov={m} />
                      <div className="min-w-0 flex-1">
                        <Link href={`/estoque/movimentacoes?produto=${m.produto_id}`} className="block truncate text-sm font-medium hover:underline">
                          {m.produto_nome} <span className="font-normal text-suave">— {m.produto_aroma}</span>
                        </Link>
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-suave">
                          <BadgeMotivo mov={m} />
                          <time dateTime={m.criado_em.toISOString()} title={formatDateTime(m.criado_em)}>
                            {formatRelative(m.criado_em)}
                          </time>
                        </p>
                      </div>
                      <div className="text-right">
                        <QuantidadeMov mov={m} />
                        {m.saldo_apos !== null && <p className="tabular text-xs text-suave">saldo {formatInt(m.saldo_apos)}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </MovimentacaoProvider>
  );
}
