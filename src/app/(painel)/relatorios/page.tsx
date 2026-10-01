import Link from "next/link";
import {
  CalendarDays,
  ChartColumn,
  ChartLine,
  Download,
  HandCoins,
  ListOrdered,
  Package,
  PackageCheck,
  PackageX,
  Percent,
  Receipt,
  ShoppingBag,
  Sparkles,
  Store,
  Tags,
  TicketPercent,
  Users,
  Wallet,
} from "lucide-react";
import {
  Avatar,
  ButtonLink,
  Card,
  CardFooter,
  CardHeader,
  DataTable,
  EmptyState,
  PageHeader,
  PeriodoSelect,
  SegmentedLinks,
  StatCard,
  StatGrid,
  calcularVariacao,
  classesBotao,
  montarHref,
  param,
} from "@/components/ui";
import {
  BarrasHorizontais,
  Figura,
  GraficoColunas,
  GraficoFaturamento,
  colunasDiaSemana,
  resumoDiaSemana,
  resumoSerieDiaria,
  serieComparada,
  tabelaDiaSemana,
  tabelaSerieDiaria,
  type ItemBarra,
} from "@/components/graficos";
import {
  agrupamentoPara,
  faturamentoPorDia,
  porAroma,
  porCanal,
  porCategoria,
  porDiaSemana,
  porFormaPagamento,
  produtosParados,
  rankingClientes,
  rankingProdutos,
  resumoVendas,
  vendasSemCliente,
  type FatiaItens,
  type ProdutoRanking,
} from "@/lib/consultas/relatorios";
import { ROTULO_CANAL, ROTULO_FORMA_PAGAMENTO } from "@/lib/dominio";
import { formatBRL, formatDate, formatInt, formatNumber, formatPercent, formatRelative, formatTime, plural } from "@/lib/format";
import { inicioDoDiaSP, parsePeriodo, somarDias } from "@/lib/periodo";
import { iconeCanal, iconeForma } from "./_componentes/icones";
import { MenuExportar } from "./_componentes/menu-exportar";
import { AvisoSemCusto, lucroComparavel, propsCartaoLucro, textoLucro } from "./_componentes/sem-custo";
import type { TipoExportacao } from "./_componentes/exportacao";
import { requireAuth } from "@/lib/auth";

export const metadata = { title: "Relatórios" };

type SP = Record<string, string | string[] | undefined>;

const ORDENS = {
  receita: { rotulo: "Faturamento", chave: (p: ProdutoRanking) => p.faturamento },
  quantidade: { rotulo: "Quantidade", chave: (p: ProdutoRanking) => p.unidades },
  lucro: { rotulo: "Lucro", chave: (p: ProdutoRanking) => p.lucro ?? Number.NEGATIVE_INFINITY },
} as const;
type Ordem = keyof typeof ORDENS;

const LIMITE_RANKING = 10;

/** Texto da parte do total: "34%". */
function pctDe(v: number, total: number) {
  return total > 0 ? formatPercent(v / total, { casas: 0 }) : "—";
}

function textoIntervalo(i: { de: string; ate: string }) {
  return i.de === i.ate ? formatDate(i.de) : `${formatDate(i.de)} a ${formatDate(i.ate)}`;
}

/** Link de download de CSV (âncora comum: o navegador baixa sem sair da página). */
function LinkCSV({ tipo, params, rotulo }: { tipo: TipoExportacao; params: Record<string, string>; rotulo: string }) {
  return (
    <a
      href={`/api/export/relatorios?${new URLSearchParams({ ...params, tipo })}`}
      download
      className={classesBotao({ variante: "fantasma", tamanho: "sm" })}
      title={`Baixar ${rotulo.toLowerCase()} em CSV`}
    >
      <Download aria-hidden />
      CSV<span className="sr-only">: {rotulo}</span>
    </a>
  );
}

function barrasItens(linhas: FatiaItens[], total: number): ItemBarra[] {
  return linhas.map((l) => ({
    chave: l.chave,
    rotulo: l.rotulo,
    valor: l.faturamento,
    valorTexto: formatBRL(l.faturamento),
    detalhe: `${pctDe(l.faturamento, total)} · ${plural(l.unidades, "unidade")}${l.lucro == null ? "" : ` · lucro ${formatBRL(l.lucro)}`}`,
  }));
}

export default async function RelatoriosPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAuth();
  const sp = await searchParams;
  const periodo = parsePeriodo(sp, { padrao: "30d" });
  const ordemParam = param(sp, "ordem");
  const ordem: Ordem = ordemParam && ordemParam in ORDENS ? (ordemParam as Ordem) : "receita";
  const todosProdutos = param(sp, "produtos") === "todos";
  const todosParados = param(sp, "parados") === "todos";
  // Períodos longos: série por semana ou por mês (ponto diário não se lê e pesa no celular).
  const agrupamento = agrupamentoPara(periodo.dias);

  const [atual, anterior, dias, diasAnteriores, formas, canais, categorias, aromas, semana, produtos, clientes, semCliente, parados] =
    await Promise.all([
      resumoVendas(periodo),
      resumoVendas(periodo.anterior),
      faturamentoPorDia(periodo, agrupamento),
      faturamentoPorDia(periodo.anterior, agrupamento),
      porFormaPagamento(periodo),
      porCanal(periodo),
      porCategoria(periodo),
      porAroma(periodo),
      porDiaSemana(periodo),
      rankingProdutos(periodo),
      rankingClientes(periodo, LIMITE_RANKING),
      vendasSemCliente(periodo),
      produtosParados(periodo),
    ]);

  const params = periodo.params;
  // Período em andamento: o anterior é cortado na mesma hora de agora (ver periodoAnterior). Avisa,
  // senão parece que o sistema "perdeu" as vendas do resto do dia anterior.
  const cortado = periodo.anterior.fim.getTime() < inicioDoDiaSP(somarDias(periodo.anterior.ate, 1)).getTime();
  const comparacao = `${textoIntervalo(periodo.anterior)}${cortado ? ` até as ${formatTime(periodo.anterior.fim)}` : ""}`;
  const ref = `vs. ${comparacao}`;
  const fat = atual.faturamento;
  const semVendas = atual.vendas === 0;

  const produtosOrdenados = [...produtos].sort((a, b) => ORDENS[ordem].chave(b) - ORDENS[ordem].chave(a));
  const produtosVisiveis = todosProdutos ? produtosOrdenados : produtosOrdenados.slice(0, LIMITE_RANKING);
  const paradosVisiveis = todosParados ? parados : parados.slice(0, LIMITE_RANKING);
  const valorParado = parados.reduce((s, p) => s + p.valor_venda, 0);
  const custoParado = parados.reduce((s, p) => s + p.valor_custo, 0);

  // Diferença de margem em pontos percentuais (comparar % relativos de margem confunde).
  // Só compara quando os dois períodos têm custo para (quase) todas as vendas.
  const difMargem =
    atual.margem != null && anterior.margem != null && lucroComparavel(atual, anterior)
      ? (atual.margem - anterior.margem) * 100
      : null;
  const tituloSerie = agrupamento === "mes" ? "Faturamento por mês" : agrupamento === "semana" ? "Faturamento por semana" : "Faturamento por dia";
  const melhorCanal = canais[0];
  const melhorForma = formas[0];

  return (
    <>
      <PageHeader
        titulo="Relatórios"
        descricao="Como as vendas foram no período escolhido. Vendas canceladas não entram nas contas."
        acoes={<MenuExportar params={params} desabilitado={semVendas && parados.length === 0} />}
      />

      <Card padding="sm" className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <PeriodoSelect periodo={periodo} caminho="/relatorios" searchParams={sp} />
        <div className="text-sm sm:text-right">
          <p className="font-medium text-tinta">
            {periodo.rotulo}
            {periodo.atalho !== "personalizado" && periodo.rotulo !== periodo.intervalo && (
              <span className="font-normal text-suave"> · {periodo.intervalo}</span>
            )}
          </p>
          <p className="text-xs text-suave">
            {plural(periodo.dias, "dia")}, comparado com {comparacao}
          </p>
        </div>
      </Card>

      <div className="space-y-6">
        <section aria-label="Indicadores do período" className="space-y-3 sm:space-y-4">
          <StatGrid>
            <StatCard
              rotulo="Faturamento"
              valor={formatBRL(fat)}
              icone={<Wallet />}
              destaque="chama"
              variacao={calcularVariacao(fat, anterior.faturamento)}
              referencia={ref}
            />
            <StatCard rotulo="Lucro bruto" icone={<HandCoins />} {...propsCartaoLucro(atual, anterior, ref)} />
            <StatCard
              rotulo="Margem média"
              valor={formatPercent(atual.margem)}
              icone={<Percent />}
              detalhe={
                difMargem == null
                  ? semVendas
                    ? "Sem vendas no período"
                    : atual.margem == null
                      ? "Sem custo informado nas vendas"
                      : "Sem base para comparar"
                  : `${difMargem >= 0.05 ? "▲" : difMargem <= -0.05 ? "▼" : "="} ${formatNumber(Math.abs(difMargem), 1)} p.p. ${ref} (${formatPercent(anterior.margem)})`
              }
            />
            <StatCard
              rotulo="Ticket médio"
              valor={formatBRL(atual.ticket)}
              icone={<ShoppingBag />}
              variacao={calcularVariacao(atual.ticket, anterior.ticket)}
              referencia={ref}
            />
          </StatGrid>
          <StatGrid>
            <StatCard
              rotulo="Vendas"
              valor={formatInt(atual.vendas)}
              icone={<Receipt />}
              variacao={calcularVariacao(atual.vendas, anterior.vendas)}
              referencia={ref}
              href={montarHref("/vendas", params, { status: "concluida" })}
            />
            <StatCard
              rotulo="Unidades vendidas"
              valor={formatInt(atual.unidades)}
              icone={<Package />}
              variacao={calcularVariacao(atual.unidades, anterior.unidades)}
              referencia={ref}
            />
            <StatCard
              rotulo="Descontos dados"
              valor={formatBRL(atual.descontos)}
              icone={<TicketPercent />}
              variacao={calcularVariacao(atual.descontos, anterior.descontos)}
              referencia={ref}
              positivoEhBom={false}
            />
            <StatCard
              rotulo="Clientes atendidos"
              valor={formatInt(atual.clientes)}
              icone={<Users />}
              variacao={calcularVariacao(atual.clientes, anterior.clientes)}
              referencia={ref}
            />
          </StatGrid>
          <AvisoSemCusto resumo={atual} />
        </section>

        {semVendas ? (
          <Card>
            <EmptyState
              icone={<ChartColumn />}
              titulo="Nenhuma venda neste período"
              descricao={
                anterior.vendas > 0
                  ? `No período anterior (${comparacao}) foram ${plural(anterior.vendas, "venda")}. Experimente um período maior.`
                  : "Escolha outro período ou registre uma venda para ver os gráficos."
              }
              acao={
                <>
                  <ButtonLink href="/relatorios?periodo=30d" variante="secundario" icone={<CalendarDays />}>
                    Últimos 30 dias
                  </ButtonLink>
                  <ButtonLink href="/relatorios?periodo=ano" variante="secundario" icone={<CalendarDays />}>
                    Este ano
                  </ButtonLink>
                </>
              }
            />
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader
                titulo={tituloSerie}
                descricao={
                  agrupamento === "dia"
                    ? `Linha clara: ${comparacao}, para comparar.`
                    : `Período longo: cada ponto soma ${agrupamento === "mes" ? "um mês" : "uma semana"}. Linha clara: ${comparacao}.`
                }
                icone={<ChartLine />}
                acoes={<LinkCSV tipo="diario" params={params} rotulo="Faturamento por dia" />}
              />
              {periodo.dias > 1 ? (
                <Figura
                  rotulo={tituloSerie}
                  resumo={resumoSerieDiaria(dias, agrupamento)}
                  tabela={tabelaSerieDiaria(dias, agrupamento)}
                >
                  <GraficoFaturamento
                    dados={serieComparada(dias, diasAnteriores)}
                    rotuloSerie="Período escolhido"
                    rotuloAnterior="Período anterior"
                    altura={280}
                    agrupamento={agrupamento}
                  />
                </Figura>
              ) : (
                <p className="text-sm text-suave">
                  Período de um dia só: {formatBRL(fat)} em {plural(atual.vendas, "venda")}. Escolha mais dias para ver a evolução.
                </p>
              )}
            </Card>

            <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
              <Card>
                <CardHeader
                  titulo="Formas de pagamento"
                  descricao={melhorForma && `${ROTULO_FORMA_PAGAMENTO[melhorForma.chave]} lidera com ${pctDe(melhorForma.faturamento, fat)} do faturamento.`}
                  icone={<Wallet />}
                  acoes={<LinkCSV tipo="pagamentos" params={params} rotulo="Formas de pagamento" />}
                />
                <BarrasHorizontais
                  rotulo="Faturamento por forma de pagamento"
                  itens={formas.map((f) => ({
                    chave: f.chave,
                    rotulo: ROTULO_FORMA_PAGAMENTO[f.chave] ?? f.chave,
                    icone: iconeForma(f.chave),
                    valor: f.faturamento,
                    valorTexto: formatBRL(f.faturamento),
                    detalhe: `${pctDe(f.faturamento, fat)} · ${plural(f.vendas, "venda")}`,
                    href: montarHref("/vendas", params, { forma: f.chave, status: "concluida" }),
                  }))}
                />
              </Card>

              <Card>
                <CardHeader
                  titulo="Canais de venda"
                  descricao={melhorCanal && `${ROTULO_CANAL[melhorCanal.chave]} trouxe ${pctDe(melhorCanal.faturamento, fat)} do faturamento.`}
                  icone={<Store />}
                  acoes={<LinkCSV tipo="canais" params={params} rotulo="Canais de venda" />}
                />
                <BarrasHorizontais
                  rotulo="Faturamento por canal"
                  itens={canais.map((c) => ({
                    chave: c.chave,
                    rotulo: ROTULO_CANAL[c.chave] ?? c.chave,
                    icone: iconeCanal(c.chave),
                    valor: c.faturamento,
                    valorTexto: formatBRL(c.faturamento),
                    detalhe: `${pctDe(c.faturamento, fat)} · ${plural(c.vendas, "venda")} · ticket ${formatBRL(c.vendas ? c.faturamento / c.vendas : 0)}`,
                    href: montarHref("/vendas", params, { canal: c.chave, status: "concluida" }),
                  }))}
                />
              </Card>

              <Card>
                <CardHeader
                  titulo="Dia da semana"
                  descricao={periodo.dias < 7 ? "Com menos de 7 dias, alguns dias da semana ficam de fora." : "Em que dias a loja vende mais."}
                  icone={<CalendarDays />}
                  acoes={<LinkCSV tipo="semana" params={params} rotulo="Dias da semana" />}
                />
                <Figura rotulo="Faturamento por dia da semana" resumo={resumoDiaSemana(semana)} tabela={tabelaDiaSemana(semana)}>
                  <GraficoColunas dados={colunasDiaSemana(semana)} rotuloSerie="Faturamento" destacarMaior />
                </Figura>
              </Card>

              <Card>
                <CardHeader
                  titulo="Categorias"
                  descricao="Faturamento já descontado dos descontos dados nas vendas."
                  icone={<Tags />}
                  acoes={<LinkCSV tipo="categorias" params={params} rotulo="Vendas por categoria" />}
                />
                <BarrasHorizontais rotulo="Faturamento por categoria" itens={barrasItens(categorias, fat)} />
              </Card>
            </div>

            <Card padding="none" id="produtos" className="scroll-mt-24">
              <CardHeader
                inset
                titulo="Ranking de produtos"
                descricao={`${plural(produtos.length, "vela vendida", "velas diferentes vendidas")} no período.`}
                icone={<ListOrdered />}
                acoes={<LinkCSV tipo="produtos" params={params} rotulo="Ranking de produtos" />}
              />
              <div className="px-4 pb-3 sm:px-5">
                <SegmentedLinks
                  rotulo="Ordenar ranking por"
                  tamanho="sm"
                  itens={(Object.keys(ORDENS) as Ordem[]).map((o) => ({
                    rotulo: ORDENS[o].rotulo,
                    href: `${montarHref("/relatorios", sp, { ordem: o === "receita" ? null : o })}#produtos`,
                    ativo: o === ordem,
                  }))}
                />
              </div>
              <DataTable
                rotulo="Ranking de produtos"
                linhas={produtosVisiveis}
                chave={(p) => p.produto_id}
                hrefLinha={(p) => `/produtos/${p.produto_id}`}
                colunas={[
                  {
                    id: "nome",
                    cabecalho: "Vela",
                    mobile: "titulo",
                    celula: (p) => `${produtosOrdenados.indexOf(p) + 1}º · ${p.nome}`,
                  },
                  { id: "aroma", cabecalho: "Aroma", mobile: "subtitulo", classe: "hidden lg:table-cell", celula: (p) => p.aroma || "—" },
                  { id: "unidades", cabecalho: "Unidades", alinhar: "direita", celula: (p) => formatInt(p.unidades) },
                  {
                    id: "faturamento",
                    cabecalho: "Faturamento",
                    alinhar: "direita",
                    mobile: ordem === "receita" ? "valor" : "detalhe",
                    celula: (p) => formatBRL(p.faturamento),
                  },
                  {
                    id: "lucro",
                    cabecalho: "Lucro",
                    alinhar: "direita",
                    mobile: ordem === "lucro" ? "valor" : "detalhe",
                    celula: (p) => textoLucro(p.lucro),
                  },
                  {
                    id: "margem",
                    cabecalho: "Margem",
                    alinhar: "direita",
                    classe: "hidden sm:table-cell",
                    celula: (p) => formatPercent(p.margem),
                  },
                  {
                    id: "parte",
                    cabecalho: "% do total",
                    alinhar: "direita",
                    classe: "hidden md:table-cell",
                    celula: (p) => pctDe(p.faturamento, fat),
                  },
                ]}
              />
              {produtos.length > LIMITE_RANKING && (
                <CardFooter inset>
                  <span className="text-sm text-suave">
                    {todosProdutos
                      ? `Mostrando as ${formatInt(produtos.length)} velas.`
                      : `Mostrando ${LIMITE_RANKING} de ${formatInt(produtos.length)} velas.`}
                  </span>
                  <Link
                    href={`${montarHref("/relatorios", sp, { produtos: todosProdutos ? null : "todos" })}#produtos`}
                    scroll={false}
                    className="link text-sm"
                  >
                    {todosProdutos ? "Mostrar só as 10 primeiras" : "Ver todas"}
                  </Link>
                </CardFooter>
              )}
            </Card>

            <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
              <Card>
                <CardHeader
                  titulo="Aromas"
                  descricao="Quais perfumes a clientela prefere."
                  icone={<Sparkles />}
                  acoes={<LinkCSV tipo="aromas" params={params} rotulo="Vendas por aroma" />}
                />
                <BarrasHorizontais
                  rotulo="Faturamento por aroma"
                  itens={barrasItens(aromas, fat)}
                  limite={8}
                  outrosTexto={(valor, n) => ({ valorTexto: formatBRL(valor), detalhe: `${pctDe(valor, fat)} · ${plural(n, "aroma")}` })}
                />
              </Card>

              <Card>
                <CardHeader
                  titulo="Melhores clientes"
                  descricao={
                    semCliente.vendas > 0
                      ? `${plural(semCliente.vendas, "venda")} (${formatBRL(semCliente.faturamento)}) sem cliente identificado.`
                      : "Todas as vendas tiveram cliente identificado."
                  }
                  icone={<Users />}
                  acoes={<LinkCSV tipo="clientes" params={params} rotulo="Ranking de clientes" />}
                />
                {clientes.length > 0 ? (
                  <ol className="-mx-2 -my-1" aria-label="Clientes que mais compraram">
                    {clientes.map((c, i) => (
                      <li key={c.cliente_id}>
                        <Link
                          href={`/clientes/${c.cliente_id}`}
                          className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-areia/60"
                        >
                          <span className="tabular w-5 shrink-0 text-right text-xs text-suave">{i + 1}º</span>
                          <Avatar nome={c.nome} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-tinta">{c.nome}</span>
                            <span className="block truncate text-xs text-suave">
                              {plural(c.compras, "compra")} · última {formatRelative(c.ultima_compra)}
                            </span>
                          </span>
                          <span className="tabular shrink-0 text-sm font-semibold text-tinta">{formatBRL(c.faturamento)}</span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <EmptyState
                    compacto
                    icone={<Users />}
                    titulo="Nenhuma venda com cliente"
                    descricao="Escolha o cliente na hora da venda para saber quem mais compra."
                  />
                )}
              </Card>
            </div>
          </>
        )}

        <Card padding="none" id="parados" className="scroll-mt-24">
          <CardHeader
            inset
            titulo="Produtos parados"
            descricao={
              parados.length > 0
                ? `${plural(parados.length, "vela ativa", "velas ativas")} sem venda no período · ${formatBRL(valorParado)} em estoque a preço de venda (${formatBRL(custoParado)} a custo).`
                : "Velas ativas sem nenhuma venda no período."
            }
            icone={<PackageX />}
            acoes={parados.length > 0 && <LinkCSV tipo="parados" params={params} rotulo="Produtos parados" />}
          />
          <DataTable
            rotulo="Produtos sem venda no período"
            linhas={paradosVisiveis}
            chave={(p) => p.id}
            hrefLinha={(p) => `/produtos/${p.id}`}
            colunas={[
              { id: "nome", cabecalho: "Vela", mobile: "titulo", celula: (p) => p.nome },
              { id: "aroma", cabecalho: "Aroma", mobile: "subtitulo", celula: (p) => p.aroma || "—" },
              { id: "categoria", cabecalho: "Categoria", classe: "hidden lg:table-cell", celula: (p) => p.categoria ?? "Sem categoria" },
              { id: "estoque", cabecalho: "Estoque", alinhar: "direita", celula: (p) => `${formatInt(p.estoque)} un.` },
              {
                id: "valor",
                cabecalho: "Valor parado",
                alinhar: "direita",
                mobile: "valor",
                celula: (p) => formatBRL(p.valor_venda),
              },
              {
                id: "ultima",
                cabecalho: "Última venda",
                alinhar: "direita",
                celula: (p) => (p.ultima_venda ? formatRelative(p.ultima_venda) : "Nunca vendida"),
              },
            ]}
            vazio={
              <EmptyState
                compacto
                icone={<PackageCheck />}
                titulo="Todas as velas venderam"
                descricao="Nenhuma vela ativa ficou sem venda neste período."
              />
            }
          />
          {parados.length > LIMITE_RANKING && (
            <CardFooter inset>
              <span className="text-sm text-suave">
                {todosParados ? `Mostrando as ${formatInt(parados.length)} velas.` : `Mostrando ${LIMITE_RANKING} de ${formatInt(parados.length)} velas.`}
              </span>
              <Link
                href={`${montarHref("/relatorios", sp, { parados: todosParados ? null : "todos" })}#parados`}
                scroll={false}
                className="link text-sm"
              >
                {todosParados ? "Mostrar menos" : "Ver todas"}
              </Link>
            </CardFooter>
          )}
        </Card>

        <p className="text-xs text-suave">
          Faturamento = total das vendas concluídas, já com desconto. Lucro bruto = faturamento − custo das velas no momento
          da venda, contando só as vendas com custo informado (vendas antigas e velas sem custo cadastrado ficam de fora do
          lucro e da margem). Valores por produto, categoria e aroma dividem o desconto de cada venda entre os itens.
        </p>
      </div>
    </>
  );
}
