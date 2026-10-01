import type { Metadata } from "next";
import Link from "next/link";
import { Download, History, PackagePlus } from "lucide-react";
import {
  ButtonLink,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  FilterBar,
  FiltrosAtivos,
  PageHeader,
  Pagination,
  PeriodoSelect,
  SearchInput,
  Select,
  cn,
  montarHref,
  type FiltroAtivo,
} from "@/components/ui";
import {
  GRUPOS_MOTIVO,
  ROTULO_GRUPO_MOTIVO,
  lerFiltrosMovimentacoes,
  listarMovimentacoes,
  produtosComMovimentacao,
  type GrupoMotivo,
} from "@/lib/consultas/estoque";
import {
  MOTIVOS_MOVIMENTACAO,
  ROTULO_MOTIVO,
  ROTULO_TIPO_MOVIMENTACAO,
  TIPOS_MOVIMENTACAO,
} from "@/lib/dominio";
import { formatDate, formatInt, formatTime } from "@/lib/format";
import { AbasEstoque } from "../_components/abas-estoque";
import { BadgeMotivo, LinkVenda, QuantidadeMov } from "../_components/movimentacao-visual";
import { requireAuth } from "@/lib/auth";

export const metadata: Metadata = { title: "Movimentações de estoque" };

const CAMINHO = "/estoque/movimentacoes";

export default async function MovimentacoesPage({ searchParams }: PageProps<"/estoque/movimentacoes">) {
  await requireAuth();
  const sp = await searchParams;
  const f = lerFiltrosMovimentacoes(sp);
  const [lista, produtos] = await Promise.all([listarMovimentacoes(f), produtosComMovimentacao()]);

  // Parâmetros normalizados (o que a tela entendeu), usados nos links, chips e no CSV.
  const atuais: Record<string, string> = {
    ...(f.q ? { q: f.q } : {}),
    ...(f.produto ? { produto: String(f.produto) } : {}),
    ...(f.tipo ? { tipo: f.tipo } : {}),
    ...(f.motivo ? { motivo: f.motivo } : {}),
    ...(f.periodo ? f.periodo.params : {}),
  };
  const sem = (...chaves: string[]) =>
    montarHref(CAMINHO, Object.fromEntries(Object.entries(atuais).filter(([k]) => !chaves.includes(k))));

  const produtoSel = f.produto ? produtos.find((p) => p.id === f.produto) : undefined;
  const chips: FiltroAtivo[] = [];
  if (f.produto) chips.push({ rotulo: produtoSel ? `${produtoSel.nome} — ${produtoSel.aroma}` : `Produto #${f.produto}`, hrefRemover: sem("produto") });
  if (f.tipo) chips.push({ rotulo: ROTULO_TIPO_MOVIMENTACAO[f.tipo], hrefRemover: sem("tipo") });
  if (f.motivo)
    chips.push({
      rotulo: Object.hasOwn(GRUPOS_MOTIVO, f.motivo) ? ROTULO_GRUPO_MOTIVO[f.motivo as GrupoMotivo] : ROTULO_MOTIVO[f.motivo as keyof typeof ROTULO_MOTIVO],
      hrefRemover: sem("motivo"),
    });
  if (f.periodo) chips.push({ rotulo: f.periodo.rotulo, hrefRemover: sem("periodo", "de", "ate") });

  const filtrosAtivos = (f.produto ? 1 : 0) + (f.tipo ? 1 : 0) + (f.motivo ? 1 : 0) + (f.periodo ? 1 : 0);
  const filtrando = filtrosAtivos > 0 || !!f.q;
  const saldo = lista.entradas - lista.saidas;

  return (
    <>
      <PageHeader
        titulo="Movimentações"
        descricao="Tudo o que entrou e saiu do estoque: produções, vendas, perdas e contagens."
        breadcrumb={[{ rotulo: "Estoque", href: "/estoque" }, { rotulo: "Movimentações" }]}
        acoes={
          <>
            <ButtonLink
              href={montarHref("/api/export/estoque", { ...atuais, relatorio: "movimentacoes" })}
              prefetch={false}
              variante="secundario"
              icone={<Download />}
              desabilitado={lista.total === 0}
            >
              Exportar CSV
            </ButtonLink>
            <ButtonLink href={f.produto ? `/estoque?produto=${f.produto}` : "/estoque?acao=entrada"} icone={<PackagePlus />}>
              Dar entrada
            </ButtonLink>
          </>
        }
      />
      <AbasEstoque ativa="movimentacoes" />

      <FilterBar
        caminho={CAMINHO}
        totalAtivos={filtrosAtivos}
        limparHref={CAMINHO}
        busca={<SearchInput defaultValue={f.q} placeholder="Buscar por vela, aroma ou observação…" rotulo="Buscar movimentação" />}
      >
        <Select
          name="produto"
          label="Vela"
          placeholder="Todas"
          defaultValue={f.produto ?? ""}
          opcoes={produtos.map((p) => ({ valor: p.id, rotulo: `${p.nome} — ${p.aroma}${p.ativo ? "" : " (desativada)"}` }))}
        />
        <Select
          name="tipo"
          label="Tipo"
          placeholder="Entradas e saídas"
          defaultValue={f.tipo}
          opcoes={TIPOS_MOVIMENTACAO.map((t) => ({ valor: t, rotulo: ROTULO_TIPO_MOVIMENTACAO[t] }))}
        />
        <Select
          name="motivo"
          label="Motivo"
          placeholder="Todos"
          defaultValue={f.motivo}
          opcoes={[
            ...(Object.keys(GRUPOS_MOTIVO) as GrupoMotivo[]).map((g) => ({ valor: g, rotulo: ROTULO_GRUPO_MOTIVO[g] })),
            ...MOTIVOS_MOVIMENTACAO.map((m) => ({ valor: m, rotulo: ROTULO_MOTIVO[m] })),
          ]}
        />
        {/* O histórico não tem período padrão: "Todo o período" tira o filtro. */}
        <PeriodoSelect modo="form" periodo={f.periodo} rotuloTodos="Todo o período" />
      </FilterBar>
      <FiltrosAtivos itens={chips} limparHref={CAMINHO} />

      <Card padding="none">
        {lista.total > 0 && (
          <CardHeader
            inset
            divisoria
            // O resumo fica no slot de ações (que não encolhe): no celular ele precisa poder quebrar linha.
            className="[&>div:last-child]:shrink"
            titulo={`${formatInt(lista.total)} ${lista.total === 1 ? "movimentação" : "movimentações"}`}
            descricao={f.periodo ? f.periodo.intervalo : "Todo o período"}
            acoes={
              <dl className="tabular flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <div className="flex gap-1.5">
                  <dt className="text-suave">Entraram</dt>
                  <dd className={cn("font-semibold", lista.entradas > 0 ? "text-salvia" : "text-tinta")}>
                    {lista.entradas > 0 ? "+" : ""}
                    {formatInt(lista.entradas)}
                  </dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="text-suave">Saíram</dt>
                  <dd className={cn("font-semibold", lista.saidas > 0 ? "text-alerta" : "text-tinta")}>
                    {lista.saidas > 0 ? "−" : ""}
                    {formatInt(lista.saidas)}
                  </dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="text-suave">Saldo</dt>
                  <dd className="font-semibold text-tinta">
                    {saldo > 0 ? "+" : saldo < 0 ? "−" : ""}
                    {formatInt(Math.abs(saldo))}
                  </dd>
                </div>
              </dl>
            }
          />
        )}
        <DataTable
          rotulo="Movimentações de estoque"
          linhas={lista.itens}
          chave={(m) => m.id}
          colunas={[
            {
              id: "data",
              cabecalho: "Quando",
              mobile: "detalhe",
              classe: "whitespace-nowrap",
              celula: (m) => (
                <time dateTime={m.criado_em.toISOString()}>
                  {formatDate(m.criado_em)} <span className="text-suave">{formatTime(m.criado_em)}</span>
                </time>
              ),
            },
            {
              id: "produto",
              cabecalho: "Vela",
              mobile: "titulo",
              celula: (m) => (
                <Link href={`/produtos/${m.produto_id}`} className="font-medium text-tinta hover:text-chama-escura hover:underline">
                  {m.produto_nome}
                  <span className="font-normal text-suave"> — {m.produto_aroma}</span>
                </Link>
              ),
            },
            { id: "motivo", cabecalho: "Motivo", mobile: "badge", celula: (m) => <BadgeMotivo mov={m} /> },
            {
              id: "quantidade",
              cabecalho: "Quantidade",
              mobile: "valor",
              alinhar: "direita",
              celula: (m) => <QuantidadeMov mov={m} />,
            },
            {
              id: "saldo",
              cabecalho: "Saldo depois",
              rotuloMobile: "Saldo depois",
              alinhar: "direita",
              celula: (m) => (m.saldo_apos === null ? <span className="text-suave">—</span> : `${formatInt(m.saldo_apos)} un.`),
            },
            {
              id: "obs",
              cabecalho: "Observação",
              classe: "max-w-72",
              celula: (m) =>
                m.venda_id ? (
                  <span className="flex flex-wrap gap-x-2">
                    <LinkVenda vendaId={m.venda_id} />
                    {m.observacao && !/venda #?\d+$/i.test(m.observacao) && <span className="text-suave">{m.observacao}</span>}
                  </span>
                ) : m.observacao ? (
                  <span className="line-clamp-2 text-suave" title={m.observacao}>
                    {m.observacao}
                  </span>
                ) : (
                  <span className="text-suave">—</span>
                ),
            },
          ]}
          vazio={
            filtrando ? (
              <EmptyState
                compacto
                icone={<History />}
                titulo="Nenhuma movimentação encontrada"
                descricao="Tente outro período ou limpe os filtros."
                acao={
                  <ButtonLink href={CAMINHO} variante="secundario">
                    Limpar filtros
                  </ButtonLink>
                }
              />
            ) : (
              <EmptyState
                icone={<History />}
                titulo="Nenhuma movimentação ainda"
                descricao="Quando você der entrada, vender ou ajustar o estoque, tudo aparece aqui."
                acao={
                  <ButtonLink href="/estoque?acao=entrada" icone={<PackagePlus />}>
                    Dar entrada
                  </ButtonLink>
                }
              />
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
        caminho={CAMINHO}
        searchParams={atuais}
      />
    </>
  );
}
