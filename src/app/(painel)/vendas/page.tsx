import type { Metadata } from "next";
import { HandCoins, Package, Printer, Receipt, ReceiptText, ShoppingBag, TrendingUp, Wallet } from "lucide-react";
import {
  Aviso,
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
  ProgressBar,
  SearchInput,
  Select,
  StatCard,
  StatGrid,
  montarHref,
  paginaAtual,
  paraURLSearchParams,
  param,
  type FiltroAtivo,
} from "@/components/ui";
import { listarClientesFiltro, listarVendas, lerFiltrosVendas, type VendaLista } from "@/lib/consultas/vendas";
import {
  CANAIS,
  FORMAS_PAGAMENTO,
  ROTULO_CANAL,
  ROTULO_FORMA_PAGAMENTO,
  ROTULO_STATUS_VENDA,
  opcoes,
} from "@/lib/dominio";
import { formatBRL, formatDateTime, formatInt, formatPercent, formatRelative, plural } from "@/lib/format";
import { MenuExportar } from "./_components/menu-exportar";
import { FormaPagamentoTexto, StatusVendaBadge, iconeForma } from "./_components/rotulos";
import { requireAuth } from "@/lib/auth";

export const metadata: Metadata = { title: "Vendas" };

const CAMINHO = "/vendas";

export default async function VendasPage({ searchParams }: PageProps<"/vendas">) {
  await requireAuth();
  const sp = await searchParams;
  const filtros = lerFiltrosVendas(sp);
  const pagina = paginaAtual(sp);
  const [{ itens, resumo, porForma, totalPaginas, porPagina, pagina: paginaReal }, clientes] = await Promise.all([
    listarVendas(filtros, pagina),
    listarClientesFiltro(),
  ]);

  const { periodo } = filtros;
  const buscandoNumero = filtros.numero !== null;
  const nomeCliente = filtros.cliente ? clientes.find((c) => c.id === filtros.cliente)?.nome : undefined;
  const totalAtivos = [filtros.cliente, filtros.forma, filtros.canal, filtros.status].filter(Boolean).length;
  const filtrando = totalAtivos > 0 || !!filtros.q || param(sp, "periodo") !== undefined;
  const novaVenda = param(sp, "nova");

  const sem = (chave: string) => montarHref(CAMINHO, sp, { [chave]: null, pagina: null });
  const chips: FiltroAtivo[] = [];
  if (filtros.q) chips.push({ rotulo: `Busca: “${filtros.q}”`, hrefRemover: sem("q") });
  if (filtros.cliente) chips.push({ rotulo: `Cliente: ${nomeCliente ?? `#${filtros.cliente}`}`, hrefRemover: sem("cliente") });
  if (filtros.forma) chips.push({ rotulo: ROTULO_FORMA_PAGAMENTO[filtros.forma], hrefRemover: sem("forma") });
  if (filtros.canal) chips.push({ rotulo: ROTULO_CANAL[filtros.canal], hrefRemover: sem("canal") });
  if (filtros.status) chips.push({ rotulo: ROTULO_STATUS_VENDA[filtros.status], hrefRemover: sem("status") });

  const somenteCanceladas = filtros.status === "cancelada";
  const maiorForma = Math.max(1, ...porForma.map((f) => f.total));

  return (
    <>
      <PageHeader
        titulo="Vendas"
        descricao="Histórico de vendas, totais do período, recibos e cancelamentos."
        acoes={
          <>
            <MenuExportar query={paraURLSearchParams(sp).toString()} desabilitado={resumo.registros === 0} />
            <ButtonLink href="/vendas/nova" icone={<ShoppingBag />}>
              Nova venda
            </ButtonLink>
          </>
        }
      />

      {novaVenda && /^\d+$/.test(novaVenda) && (
        <Aviso
          tipo="ok"
          titulo={`Venda #${novaVenda} registrada`}
          className="mb-4"
          acao={
            <ButtonLink href={`/recibo/${novaVenda}`} variante="secundario" tamanho="sm" icone={<Printer />}>
              Ver recibo
            </ButtonLink>
          }
        >
          O estoque já foi atualizado.
        </Aviso>
      )}

      <FilterBar
        caminho={CAMINHO}
        totalAtivos={totalAtivos}
        limparHref={CAMINHO}
        busca={<SearchInput defaultValue={filtros.q} placeholder="Buscar por nº, cliente ou vela…" rotulo="Buscar vendas" />}
      >
        <PeriodoSelect modo="form" periodo={periodo} />
        <Select
          name="cliente"
          label="Cliente"
          placeholder="Todos os clientes"
          defaultValue={filtros.cliente ?? ""}
          opcoes={clientes.map((c) => ({ valor: c.id, rotulo: c.ativo ? c.nome : `${c.nome} (desativado)` }))}
        />
        <Select
          name="forma"
          label="Pagamento"
          placeholder="Todas as formas"
          defaultValue={filtros.forma ?? ""}
          opcoes={opcoes(FORMAS_PAGAMENTO, ROTULO_FORMA_PAGAMENTO)}
        />
        <Select
          name="canal"
          label="Canal"
          placeholder="Todos os canais"
          defaultValue={filtros.canal ?? ""}
          opcoes={opcoes(CANAIS, ROTULO_CANAL)}
        />
        <Select
          name="status"
          label="Situação"
          placeholder="Concluídas e canceladas"
          defaultValue={filtros.status ?? ""}
          opcoes={[
            { valor: "concluida", rotulo: "Só concluídas" },
            { valor: "cancelada", rotulo: "Só canceladas" },
          ]}
        />
      </FilterBar>

      <FiltrosAtivos itens={chips} limparHref={CAMINHO} />

      <p className="mb-4 flex flex-wrap items-center gap-x-2 text-sm text-suave">
        {buscandoNumero ? (
          <>Buscando a venda nº {filtros.numero} em todo o histórico (o período foi ignorado).</>
        ) : (
          <>
            <span className="font-medium text-tinta">{periodo.rotulo}</span>
            {periodo.rotulo !== periodo.intervalo && <span>· {periodo.intervalo}</span>}
          </>
        )}
      </p>

      {!somenteCanceladas && (
        <StatGrid className="mb-4">
          <StatCard rotulo="Faturamento" valor={formatBRL(resumo.faturamento)} icone={<Wallet />} destaque="chama"
            detalhe={resumo.descontos > 0 ? `${formatBRL(resumo.descontos)} em descontos` : "sem descontos"} />
          <StatCard rotulo="Vendas" valor={formatInt(resumo.vendas)} icone={<Receipt />}
            detalhe={plural(resumo.unidades, "unidade vendida", "unidades vendidas")} />
          <StatCard rotulo="Ticket médio" valor={formatBRL(resumo.ticketMedio)} icone={<TrendingUp />} detalhe="por venda" />
          <StatCard rotulo="Lucro bruto" valor={resumo.lucro == null ? "—" : formatBRL(resumo.lucro)} icone={<HandCoins />}
            destaque={resumo.lucro == null ? undefined : resumo.lucro < 0 ? "alerta" : "salvia"}
            detalhe={detalheLucro(resumo)} />
        </StatGrid>
      )}

      {resumo.canceladas > 0 && (
        <Aviso tipo={somenteCanceladas ? "info" : "atencao"} className="mb-4">
          {plural(resumo.canceladas, "venda cancelada", "vendas canceladas")} ({formatBRL(resumo.valorCancelado)})
          {somenteCanceladas
            ? " neste filtro. Canceladas não contam em nenhum total."
            : resumo.canceladas === 1
              ? " aparece riscada na lista, mas não entra nos totais acima."
              : " aparecem riscadas na lista, mas não entram nos totais acima."}
        </Aviso>
      )}

      {porForma.length > 1 && (
        <Card className="mb-4">
          <CardHeader titulo="Por forma de pagamento" descricao="Quanto entrou em cada forma (útil para conferir o caixa)." />
          <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {porForma.map((f) => (
              <li key={f.forma_pagamento} className="min-w-0">
                <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                  <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-tinta [&_svg]:size-4 [&_svg]:text-suave">
                    {iconeForma(f.forma_pagamento)}
                    {ROTULO_FORMA_PAGAMENTO[f.forma_pagamento]}
                    <span className="text-xs text-suave">· {plural(f.vendas, "venda")}</span>
                  </span>
                  <span className="tabular shrink-0 font-semibold text-tinta">{formatBRL(f.total)}</span>
                </div>
                <ProgressBar valor={f.total} max={maiorForma} tom="chama" rotulo={`${ROTULO_FORMA_PAGAMENTO[f.forma_pagamento]}: ${formatBRL(f.total)}`} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card padding="none">
        <DataTable<VendaLista>
          rotulo="Lista de vendas"
          linhas={itens}
          chave={(v) => v.id}
          hrefLinha={(v) => `/vendas/${v.id}`}
          classeLinha={(v) => (v.status === "cancelada" ? "bg-alerta-clara/25 text-suave" : undefined)}
          colunas={[
            {
              id: "numero",
              cabecalho: "Nº",
              mobile: "titulo",
              celula: (v) => (
                <span className={v.status === "cancelada" ? "line-through decoration-alerta" : undefined}>
                  Venda #{v.id}
                </span>
              ),
            },
            {
              id: "data",
              cabecalho: "Data",
              mobile: "subtitulo",
              classe: "whitespace-nowrap",
              celula: (v) => (
                <span title={formatRelative(v.data)}>{formatDateTime(v.data)}</span>
              ),
            },
            {
              id: "cliente",
              cabecalho: "Cliente",
              celula: (v) => v.cliente_nome ?? <span className="text-suave">—</span>,
            },
            {
              id: "itens",
              cabecalho: "Itens",
              classe: "hidden lg:table-cell max-w-64",
              rotuloMobile: "Itens",
              celula: (v) => (
                <span className="block truncate" title={v.produtos}>
                  <span className="tabular text-suave">{v.unidades} un. · </span>
                  {v.produtos || "—"}
                </span>
              ),
            },
            {
              id: "pagamento",
              cabecalho: "Pagamento",
              classe: "hidden md:table-cell",
              celula: (v) => <FormaPagamentoTexto forma={v.forma_pagamento} />,
            },
            {
              id: "canal",
              cabecalho: "Canal",
              classe: "hidden xl:table-cell",
              mobile: "oculto",
              celula: (v) => ROTULO_CANAL[v.canal],
            },
            {
              id: "status",
              cabecalho: "Situação",
              mobile: "badge",
              celula: (v) => <StatusVendaBadge status={v.status} />,
            },
            {
              id: "total",
              cabecalho: "Total",
              alinhar: "direita",
              mobile: "valor",
              celula: (v) =>
                v.status === "cancelada" ? (
                  <span className="text-suave line-through" title="Cancelada: não conta nos totais">
                    {formatBRL(v.total)}
                  </span>
                ) : (
                  <span className="font-semibold text-tinta">
                    {formatBRL(v.total)}
                    {v.desconto > 0 && (
                      <span className="block text-xs font-normal text-suave">−{formatBRL(v.desconto)} desc.</span>
                    )}
                  </span>
                ),
            },
          ]}
          vazio={
            filtrando ? (
              <EmptyState
                compacto
                icone={<ReceiptText />}
                titulo={buscandoNumero ? `Venda nº ${filtros.numero} não encontrada` : "Nenhuma venda encontrada"}
                descricao={
                  buscandoNumero
                    ? "Confira o número. Ele aparece no recibo e na tela da venda."
                    : "Tente outro período ou limpe os filtros."
                }
                acao={
                  <ButtonLink href={CAMINHO} variante="secundario">
                    Limpar filtros
                  </ButtonLink>
                }
              />
            ) : (
              <EmptyState
                icone={<Package />}
                titulo="Nenhuma venda nos últimos 30 dias"
                descricao="Quando você registrar uma venda, ela aparece aqui com o recibo pronto para enviar."
                acao={
                  <ButtonLink href="/vendas/nova" icone={<ShoppingBag />}>
                    Registrar venda
                  </ButtonLink>
                }
              />
            )
          }
        />
      </Card>

      <Pagination
        className="mt-4"
        pagina={paginaReal}
        totalPaginas={totalPaginas}
        totalItens={resumo.registros}
        porPagina={porPagina}
        caminho={CAMINHO}
        searchParams={sp}
      />
    </>
  );
}

/** Margem e, quando houver, a parte do faturamento sem custo informado (fora do lucro). */
function detalheLucro(r: { faturamento: number; receitaSemCusto: number; margem: number | null; lucro: number | null }) {
  const semCusto = r.faturamento > 0 ? r.receitaSemCusto / r.faturamento : 0;
  if (r.lucro == null) return r.faturamento > 0 ? "itens sem custo informado" : "—";
  const margem = r.margem != null ? `margem de ${formatPercent(r.margem)}` : "—";
  return semCusto > 0.005 ? `${margem} · ${formatPercent(semCusto)} sem custo` : margem;
}
