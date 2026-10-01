import Link from "next/link";
import {
  ChartColumn,
  ChartLine,
  ChevronRight,
  HandCoins,
  PackageCheck,
  PackagePlus,
  Plus,
  Receipt,
  ShoppingBag,
  Sparkles,
  Trophy,
  TriangleAlert,
  UserPlus,
  Wallet,
} from "lucide-react";
import {
  Aviso,
  ButtonLink,
  Card,
  CardFooter,
  CardHeader,
  EmptyState,
  EstoqueBadge,
  IconLink,
  PageHeader,
  StatCard,
  StatGrid,
  calcularVariacao,
} from "@/components/ui";
import { BarrasHorizontais, Figura, GraficoFaturamento, resumoSerieDiaria, serieComparada, tabelaSerieDiaria } from "@/components/graficos";
import {
  alertasEstoque,
  existeVenda,
  faturamentoPorDia,
  rankingProdutos,
  resumoVendas,
  ultimasVendas,
} from "@/lib/consultas/relatorios";
import { ROTULO_FORMA_PAGAMENTO } from "@/lib/dominio";
import { getConfiguracoes } from "@/lib/dominio/configuracoes";
import { TIMEZONE, formatBRL, formatDateLong, formatInt, formatPercent, formatRelative, formatWeekday, plural } from "@/lib/format";
import { dataBR, parsePeriodo } from "@/lib/periodo";
import { iconeForma } from "./relatorios/_componentes/icones";
import { AvisoSemCusto, propsCartaoLucro } from "./relatorios/_componentes/sem-custo";
import { requireAuth } from "@/lib/auth";

export const metadata = { title: "Início" };

const horaSP = new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE, hour: "numeric", hourCycle: "h23" });

/** Vários produtos têm o mesmo nome e só mudam no aroma: "Vela Pote 200g · Lavanda" ou "Vela Pote 200g (Lavanda)". */
function nomeComAroma(p: { nome: string; aroma?: string | null }, parenteses = false) {
  const aroma = p.aroma?.trim();
  if (!aroma) return p.nome;
  return parenteses ? `${p.nome} (${aroma})` : `${p.nome} · ${aroma}`;
}

function saudacao(agora: Date) {
  const h = Number(horaSP.format(agora));
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function DashboardPage() {
  await requireAuth();
  const agora = new Date();
  const mes = parsePeriodo({ periodo: "mes" }, { agora });
  const trinta = parsePeriodo({ periodo: "30d" }, { agora });
  const hoje = parsePeriodo({ periodo: "hoje" }, { agora });

  const [config, resumoMes, resumoAnterior, resumoHoje, dias, diasAnteriores, produtosMes, produtos30, alertas, recentes, temVenda] =
    await Promise.all([
      getConfiguracoes(),
      resumoVendas(mes),
      resumoVendas(mes.anterior),
      resumoVendas(hoje),
      faturamentoPorDia(trinta),
      faturamentoPorDia(trinta.anterior),
      rankingProdutos(mes),
      rankingProdutos(trinta),
      alertasEstoque(6),
      ultimasVendas(6),
      existeVenda(),
    ]);

  const total30 = dias.reduce((s, d) => s + d.faturamento, 0);
  const totalAnterior30 = diasAnteriores.reduce((s, d) => s + d.faturamento, 0);
  // Começo de mês sem vendas ainda: o top 5 usa os últimos 30 dias para não ficar vazio.
  const topDoMes = produtosMes.length > 0;
  const top = (topDoMes ? produtosMes : produtos30).slice(0, 5);
  const totalAlertas = alertas.esgotados + alertas.baixos;
  const refMes = `vs. ${dataBR(mes.anterior.de).slice(0, 5)} a ${dataBR(mes.anterior.ate).slice(0, 5)}`;
  const dataHoje = `${formatWeekday(agora)}, ${formatDateLong(agora)}`;

  return (
    <>
      <PageHeader
        titulo={`${saudacao(agora)}!`}
        descricao={
          resumoHoje.vendas > 0 ? (
            <>
              Hoje a {config.loja_nome} já vendeu{" "}
              <Link href="/vendas?periodo=hoje" className="link font-semibold">
                {formatBRL(resumoHoje.faturamento)} em {plural(resumoHoje.vendas, "venda")}
              </Link>
              .
            </>
          ) : (
            "Nenhuma venda registrada hoje ainda. Bom trabalho no ateliê!"
          )
        }
        acoes={
          <>
            <ButtonLink href="/relatorios" variante="secundario" icone={<ChartColumn />}>
              Relatórios
            </ButtonLink>
            <ButtonLink href="/vendas/nova" icone={<ShoppingBag />}>
              Nova venda
            </ButtonLink>
          </>
        }
      >
        <p className="mt-1 text-xs text-suave first-letter:uppercase">{dataHoje}</p>
      </PageHeader>

      <div className="space-y-6">
        {!temVenda && (
          <Aviso
            tipo="info"
            titulo="Bem-vinda! Seus números aparecem aqui."
            acao={
              <ButtonLink href="/vendas/nova" tamanho="sm" icone={<ShoppingBag />}>
                Registrar venda
              </ButtonLink>
            }
          >
            Assim que a primeira venda for registrada, o painel mostra faturamento, lucro e as velas que mais saem.
          </Aviso>
        )}

        <section aria-labelledby="titulo-mes">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="titulo-mes" className="font-serif text-xl font-semibold text-tinta">
                {mes.rotulo}
              </h2>
              <p className="mt-0.5 text-sm text-suave">
                Até agora, comparado com o mesmo trecho do mês anterior, até a mesma hora ({mes.anterior.de === mes.anterior.ate ? dataBR(mes.anterior.de) : `${dataBR(mes.anterior.de)} a ${dataBR(mes.anterior.ate)}`}).
              </p>
            </div>
            <Link href="/relatorios?periodo=mes" className="link text-sm">
              Ver relatório do mês
            </Link>
          </div>
          <StatGrid>
            <StatCard
              rotulo="Faturamento"
              valor={formatBRL(resumoMes.faturamento)}
              icone={<Wallet />}
              destaque="chama"
              variacao={calcularVariacao(resumoMes.faturamento, resumoAnterior.faturamento)}
              referencia={refMes}
              href="/relatorios?periodo=mes"
            />
            <StatCard
              rotulo="Vendas"
              valor={formatInt(resumoMes.vendas)}
              icone={<Receipt />}
              variacao={calcularVariacao(resumoMes.vendas, resumoAnterior.vendas)}
              referencia={refMes}
              href="/vendas?periodo=mes"
            />
            <StatCard
              rotulo="Ticket médio"
              valor={formatBRL(resumoMes.ticket)}
              icone={<ShoppingBag />}
              variacao={calcularVariacao(resumoMes.ticket, resumoAnterior.ticket)}
              referencia={refMes}
              href="/relatorios?periodo=mes"
            />
            <StatCard
              rotulo="Lucro bruto"
              icone={<HandCoins />}
              {...propsCartaoLucro(resumoMes, resumoAnterior, refMes)}
              href="/relatorios?periodo=mes"
            />
          </StatGrid>
          <AvisoSemCusto resumo={resumoMes} className="mt-3" />
        </section>

        <Card>
          <CardHeader
            titulo="Faturamento dos últimos 30 dias"
            descricao={
              <>
                <span className="tabular font-semibold text-tinta">{formatBRL(total30)}</span>
                {" · "}
                {totalAnterior30 > 0
                  ? `${formatPercent(((total30 - totalAnterior30) / totalAnterior30), { sinal: true })} em relação aos 30 dias anteriores (${formatBRL(totalAnterior30)})`
                  : "sem vendas nos 30 dias anteriores para comparar"}
              </>
            }
            icone={<ChartLine />}
            acoes={
              <Link href="/relatorios?periodo=30d" className="link text-sm">
                Detalhes
              </Link>
            }
          />
          {total30 > 0 || totalAnterior30 > 0 ? (
            <Figura
              rotulo="Faturamento por dia nos últimos 30 dias"
              resumo={resumoSerieDiaria(dias)}
              tabela={tabelaSerieDiaria(dias)}
            >
              <GraficoFaturamento
                dados={serieComparada(dias, diasAnteriores)}
                rotuloSerie="Últimos 30 dias"
                rotuloAnterior="30 dias anteriores"
              />
            </Figura>
          ) : (
            <EmptyState
              compacto
              icone={<ChartLine />}
              titulo="Ainda sem vendas nos últimos 30 dias"
              descricao="O gráfico aparece assim que você registrar vendas."
              acao={
                <ButtonLink href="/vendas/nova" tamanho="sm" icone={<ShoppingBag />}>
                  Nova venda
                </ButtonLink>
              }
            />
          )}
        </Card>

        <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
          <Card>
            <CardHeader
              titulo="Mais vendidas"
              descricao={topDoMes ? `Por faturamento em ${mes.rotulo.toLowerCase()}` : "Últimos 30 dias (ainda sem vendas este mês)"}
              icone={<Trophy />}
            />
            {top.length > 0 ? (
              <BarrasHorizontais
                rotulo="Velas mais vendidas"
                itens={top.map((p) => ({
                  chave: p.produto_id,
                  rotulo: nomeComAroma(p),
                  valor: p.faturamento,
                  valorTexto: formatBRL(p.faturamento),
                  detalhe: `${plural(p.unidades, "unidade")}${p.lucro == null ? "" : ` · lucro ${formatBRL(p.lucro)}`}`,
                  href: `/produtos/${p.produto_id}`,
                }))}
              />
            ) : (
              <EmptyState compacto icone={<Sparkles />} titulo="Nada vendido ainda" descricao="As velas campeãs aparecem aqui." />
            )}
            <CardFooter>
              <Link href={`/relatorios?periodo=${topDoMes ? "mes" : "30d"}#produtos`} className="link text-sm">
                Ver ranking completo
              </Link>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader
              titulo="Estoque"
              descricao={
                totalAlertas > 0
                  ? [
                      alertas.esgotados > 0 && plural(alertas.esgotados, "esgotada"),
                      alertas.baixos > 0 && `${formatInt(alertas.baixos)} com estoque baixo`,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : "Tudo acima do mínimo"
              }
              icone={totalAlertas > 0 ? <TriangleAlert /> : <PackageCheck />}
            />
            {alertas.itens.length > 0 ? (
              <ul className="-my-2 divide-y divide-linha" aria-label="Velas com estoque baixo ou esgotado">
                {alertas.itens.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <Link href={`/produtos/${p.id}`} className="block truncate text-sm font-medium text-tinta hover:underline">
                        {p.nome}
                      </Link>
                      {p.aroma?.trim() && <p className="truncate text-xs text-suave">{p.aroma.trim()}</p>}
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-suave">
                        <EstoqueBadge estoque={p.estoque} minimo={p.estoque_minimo} />
                        <span className="tabular">
                          {formatInt(p.estoque)} un. · mín. {formatInt(p.estoque_minimo)}
                        </span>
                      </div>
                    </div>
                    <IconLink
                      href={`/estoque?produto=${p.id}&acao=entrada`}
                      rotulo={`Dar entrada em ${nomeComAroma(p, true)}`}
                      icone={<PackagePlus />}
                      variante="secundario"
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                compacto
                icone={<PackageCheck />}
                titulo="Estoque em dia"
                descricao="Nenhuma vela abaixo do estoque mínimo."
              />
            )}
            <CardFooter>
              <Link href="/estoque" className="link text-sm">
                Ver estoque
              </Link>
              {totalAlertas > alertas.itens.length && (
                <span className="text-xs text-suave">+{formatInt(totalAlertas - alertas.itens.length)} no estoque</span>
              )}
            </CardFooter>
          </Card>

          <Card>
            <CardHeader titulo="Últimas vendas" icone={<Receipt />} />
            {recentes.length > 0 ? (
              <ul className="-mx-2 -my-1" aria-label="Últimas vendas">
                {recentes.map((v) => (
                  <li key={v.id}>
                    <Link
                      href={`/vendas/${v.id}`}
                      className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-areia/60"
                    >
                      <span
                        aria-hidden
                        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-areia text-suave [&_svg]:size-4"
                      >
                        {iconeForma(v.forma_pagamento)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-tinta">
                          {v.cliente_nome ?? `Venda #${v.id}`}
                        </span>
                        <span className="block truncate text-xs text-suave">
                          {formatRelative(v.data)} · {ROTULO_FORMA_PAGAMENTO[v.forma_pagamento]} · {v.itens}
                        </span>
                      </span>
                      <span className="tabular shrink-0 text-sm font-semibold text-tinta">{formatBRL(v.total)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                compacto
                icone={<Receipt />}
                titulo="Nenhuma venda ainda"
                acao={
                  <ButtonLink href="/vendas/nova" tamanho="sm" icone={<ShoppingBag />}>
                    Registrar venda
                  </ButtonLink>
                }
              />
            )}
            <CardFooter>
              <Link href="/vendas" className="link text-sm">
                Ver histórico
              </Link>
            </CardFooter>
          </Card>
        </div>

        <section aria-labelledby="titulo-atalhos">
          <h2 id="titulo-atalhos" className="mb-3 font-serif text-xl font-semibold text-tinta">
            Atalhos
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {[
              { href: "/vendas/nova", rotulo: "Nova venda", dica: "Registrar uma venda", icone: <ShoppingBag aria-hidden /> },
              { href: "/estoque?acao=entrada", rotulo: "Dar entrada", dica: "Velas que ficaram prontas", icone: <PackagePlus aria-hidden /> },
              { href: "/produtos/novo", rotulo: "Nova vela", dica: "Cadastrar produto", icone: <Plus aria-hidden /> },
              { href: "/clientes/novo", rotulo: "Novo cliente", dica: "Cadastrar cliente", icone: <UserPlus aria-hidden /> },
            ].map((a) => (
              <li key={a.href}>
                <Link
                  href={a.href}
                  className="cartao flex h-full items-center gap-3 p-3.5 transition hover:border-linha-forte hover:shadow-elevado sm:p-4"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-chama-clara text-chama-escura [&_svg]:size-5">
                    {a.icone}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-tinta">{a.rotulo}</span>
                    <span className="block truncate text-xs text-suave">{a.dica}</span>
                  </span>
                  <ChevronRight aria-hidden className="hidden size-4 shrink-0 text-suave sm:block" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

      </div>
    </>
  );
}
