import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeftRight,
  Boxes,
  ClipboardList,
  HandCoins,
  History,
  PackageMinus,
  PackagePlus,
  Pencil,
  Receipt,
  ShoppingBag,
  Tag,
  TrendingUp,
  Undo2,
  CalendarClock,
} from "lucide-react";
import {
  Aviso,
  Badge,
  ButtonLink,
  Card,
  CardFooter,
  CardHeader,
  EmptyState,
  EstoqueBadge,
  EstoqueProgress,
  ListaDetalhes,
  PageHeader,
  StatCard,
  StatGrid,
  cn,
} from "@/components/ui";
import {
  buscarProduto,
  indicadoresProduto,
  movimentacoesProduto,
  vendasPorMes,
  vendasRecentesProduto,
  type VendasMes,
} from "@/lib/consultas/produtos";
import { ROTULO_MOTIVO, calcularMargem, rotulo, type MovimentacaoEstoque } from "@/lib/dominio";
import { formatBRL, formatDate, formatDateTime, formatInt, formatPercent, formatRelative, plural } from "@/lib/format";
import { AtivacaoProduto } from "../_components/ativacao-produto";
import { DuplicarProduto } from "../_components/duplicar-produto";
import { CLASSE_TEXTO_MARGEM, tomMargem } from "../_components/margem";
import { requireAuth } from "@/lib/auth";

export async function generateMetadata({ params }: PageProps<"/produtos/[id]">): Promise<Metadata> {
  await requireAuth();
  const produto = await buscarProduto(Number((await params).id));
  return { title: produto?.nome ?? "Vela não encontrada" };
}

export default async function ProdutoPage({ params }: PageProps<"/produtos/[id]">) {
  await requireAuth();
  const id = Number((await params).id);
  const produto = await buscarProduto(id);
  if (!produto) notFound();

  const [ind, meses, movs, vendas] = await Promise.all([
    indicadoresProduto(id),
    vendasPorMes(id, 6),
    movimentacoesProduto(id, 12),
    vendasRecentesProduto(id, 6),
  ]);
  const { lucro, margem } = calcularMargem(produto.preco, produto.custo);
  // Itens vendidos sem custo informado ficam fora do lucro (senão o lucro sairia inflado).
  const margemReal = ind.lucro != null && ind.receita_com_custo > 0 ? ind.lucro / ind.receita_com_custo : null;
  const fracaoSemCusto = ind.receita > 0 ? ind.receita_sem_custo / ind.receita : 0;

  return (
    <>
      <PageHeader
        breadcrumb={[{ rotulo: "Produtos", href: "/produtos" }, { rotulo: produto.nome }]}
        titulo={produto.nome}
        badges={
          produto.ativo ? (
            <EstoqueBadge estoque={produto.estoque} minimo={produto.estoque_minimo} />
          ) : (
            <Badge tom="neutro">Desativada</Badge>
          )
        }
        descricao={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{produto.aroma}</span>
            {produto.categoria_nome && (
              <>
                <span aria-hidden>·</span>
                <Link href={`/produtos?categoria=${produto.categoria_id}`} className="inline-flex items-center gap-1 hover:text-tinta hover:underline">
                  <Tag aria-hidden className="size-3.5" />
                  {produto.categoria_nome}
                </Link>
              </>
            )}
            {produto.sku && (
              <>
                <span aria-hidden>·</span>
                <span className="font-mono text-xs">{produto.sku}</span>
              </>
            )}
          </span>
        }
        acoes={
          <>
            <DuplicarProduto id={produto.id} />
            <ButtonLink href={`/produtos/${produto.id}/editar`} icone={<Pencil />}>
              Editar
            </ButtonLink>
          </>
        }
      />

      {!produto.ativo && (
        <Aviso
          tipo="atencao"
          titulo="Esta vela está desativada"
          className="mb-6"
          acao={<AtivacaoProduto id={produto.id} nome={produto.nome} ativo={false} />}
        >
          Ela não aparece nas listas nem na tela de venda. O histórico abaixo continua disponível.
        </Aviso>
      )}

      <div className="space-y-6">
        <StatGrid>
          <StatCard
            rotulo="Unidades vendidas"
            valor={formatInt(ind.unidades)}
            icone={<ShoppingBag />}
            detalhe={ind.unidades ? `${formatInt(ind.unidades_30d)} nos últimos 30 dias` : "Ainda sem vendas"}
          />
          <StatCard
            rotulo="Receita"
            valor={formatBRL(ind.receita)}
            icone={<TrendingUp />}
            detalhe={ind.vendas ? `em ${plural(ind.vendas, "venda")}, já com descontos` : "—"}
          />
          <StatCard
            rotulo="Lucro bruto"
            valor={ind.lucro == null ? "—" : formatBRL(ind.lucro)}
            icone={<HandCoins />}
            destaque={ind.lucro == null ? undefined : ind.lucro < 0 ? "alerta" : ind.lucro > 0 ? "salvia" : undefined}
            detalhe={
              ind.lucro == null && ind.vendas
                ? "Vendas sem custo informado"
                : [
                    margemReal !== null ? `Margem real de ${formatPercent(margemReal)}` : "—",
                    fracaoSemCusto > 0.005 ? `${formatPercent(fracaoSemCusto)} da receita sem custo` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
            }
          />
          <StatCard
            rotulo="Última venda"
            valor={ind.ultima_venda ? formatRelative(ind.ultima_venda) : "—"}
            icone={<CalendarClock />}
            detalhe={ind.ultima_venda ? formatDateTime(ind.ultima_venda) : "Nenhuma venda registrada"}
          />
        </StatGrid>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="min-w-0 space-y-6 lg:col-span-2">
            <Card as="section">
              <CardHeader
                titulo="Vendas por mês"
                descricao="Unidades vendidas nos últimos 6 meses (sem vendas canceladas)."
                icone={<TrendingUp />}
              />
              <GraficoMeses meses={meses} />
            </Card>

            <Card as="section" padding="none">
              <CardHeader
                inset
                titulo="Movimentações de estoque"
                descricao={movs.total ? `${plural(movs.total, "registro")} no total` : undefined}
                icone={<History />}
                acoes={
                  movs.total > movs.itens.length ? (
                    <ButtonLink
                      href={`/estoque/movimentacoes?produto=${produto.id}`}
                      variante="fantasma"
                      tamanho="sm"
                      icone={<ArrowLeftRight />}
                    >
                      Ver todas
                    </ButtonLink>
                  ) : undefined
                }
              />
              {movs.itens.length ? (
                <ol className="space-y-4 px-4 pt-2 pb-5 sm:px-5" aria-label="Linha do tempo de estoque">
                  {movs.itens.map((m, i) => (
                    <ItemLinhaTempo key={m.id} m={m} ultimo={i === movs.itens.length - 1} />
                  ))}
                </ol>
              ) : (
                <EmptyState
                  compacto
                  icone={<Boxes />}
                  titulo="Nenhuma movimentação ainda"
                  descricao="Entradas, vendas e ajustes desta vela aparecem aqui."
                />
              )}
            </Card>

            <Card as="section" padding="none">
              <CardHeader inset titulo="Vendas recentes" icone={<Receipt />} />
              {vendas.length ? (
                <ul className="divide-y divide-linha border-t border-linha">
                  {vendas.map((v) => (
                    <li key={v.venda_id} className="min-w-0">
                      <Link
                        href={`/vendas/${v.venda_id}`}
                        className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-areia/50 sm:px-5"
                      >
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 font-medium text-tinta">
                            Venda #{v.venda_id}
                            {v.status === "cancelada" && <Badge tom="alerta">Cancelada</Badge>}
                          </p>
                          <p className="truncate text-xs text-suave">
                            {formatDateTime(v.data)}
                            {v.cliente_nome ? ` · ${v.cliente_nome}` : ""}
                          </p>
                        </div>
                        <div className="tabular shrink-0 text-right">
                          <p className={cn("font-semibold", v.status === "cancelada" ? "text-suave line-through" : "text-tinta")}>
                            {formatBRL(v.subtotal)}
                          </p>
                          <p className="text-xs text-suave">
                            {v.quantidade} × {formatBRL(v.preco_unitario)}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  compacto
                  icone={<ShoppingBag />}
                  titulo="Ainda não foi vendida"
                  descricao="Quando esta vela entrar numa venda, ela aparece aqui."
                />
              )}
            </Card>
          </div>

          <div className="min-w-0 space-y-6">
            <Card as="section">
              <CardHeader titulo="Estoque" icone={<Boxes />} />
              <p className="tabular font-serif text-3xl font-semibold text-tinta">
                {formatInt(produto.estoque)} <span className="text-base font-normal text-suave">un.</span>
              </p>
              <EstoqueProgress
                estoque={produto.estoque}
                minimo={produto.estoque_minimo}
                semTexto
                className="mt-3"
              />
              <p className="mt-1.5 text-xs text-suave">Alerta quando chegar a {plural(produto.estoque_minimo, "unidade")}.</p>
              <ListaDetalhes
                className="mt-4"
                itens={[
                  { rotulo: "Valor a preço de venda", valor: formatBRL(produto.estoque * produto.preco) },
                  { rotulo: "Valor a custo", valor: formatBRL(produto.estoque * produto.custo) },
                ]}
              />
              {produto.ativo && (
                <CardFooter className="flex-col items-stretch sm:flex-row">
                  <ButtonLink href={`/estoque?produto=${produto.id}`} icone={<PackagePlus />} variante="secundario" larguraTotal>
                    Dar entrada
                  </ButtonLink>
                </CardFooter>
              )}
            </Card>

            <Card as="section">
              <CardHeader titulo="Preço e margem" icone={<HandCoins />} />
              <ListaDetalhes
                itens={[
                  { rotulo: "Preço de venda", valor: <span className="tabular font-semibold">{formatBRL(produto.preco)}</span> },
                  {
                    rotulo: "Custo",
                    valor: produto.custo > 0 ? <span className="tabular">{formatBRL(produto.custo)}</span> : <span className="text-suave">Não informado</span>,
                  },
                  {
                    rotulo: "Lucro por vela",
                    valor: <span className={cn("tabular font-semibold", CLASSE_TEXTO_MARGEM[tomMargem(margem)])}>{formatBRL(lucro)}</span>,
                  },
                  {
                    rotulo: "Margem",
                    valor: <span className={cn("tabular font-semibold", CLASSE_TEXTO_MARGEM[tomMargem(margem)])}>{formatPercent(margem)}</span>,
                  },
                ]}
              />
            </Card>

            <Card as="section">
              <CardHeader titulo="Detalhes" icone={<ClipboardList />} />
              <ListaDetalhes
                colunas={1}
                itens={[
                  ...(produto.descricao ? [{ rotulo: "Descrição", valor: <span className="whitespace-pre-line">{produto.descricao}</span> }] : []),
                  {
                    rotulo: "Categoria",
                    valor: produto.categoria_nome ? (
                      <Link href={`/produtos?categoria=${produto.categoria_id}`} className="link">
                        {produto.categoria_nome}
                      </Link>
                    ) : (
                      <span className="text-suave">Sem categoria</span>
                    ),
                  },
                  { rotulo: "Código (SKU)", valor: produto.sku ? <span className="font-mono">{produto.sku}</span> : "—" },
                  { rotulo: "Peso", valor: produto.peso_g ? `${formatInt(produto.peso_g)} g` : "—" },
                  { rotulo: "Tempo de queima", valor: produto.tempo_queima_h ? plural(produto.tempo_queima_h, "hora") : "—" },
                  { rotulo: "Cadastrada em", valor: formatDate(produto.criado_em) },
                  { rotulo: "Última alteração", valor: formatDateTime(produto.atualizado_em) },
                ]}
              />
              {produto.ativo && (
                <CardFooter>
                  <AtivacaoProduto id={produto.id} nome={produto.nome} ativo variante="fantasma" />
                </CardFooter>
              )}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

/** Barras simples (CSS) com as unidades vendidas por mês. */
function GraficoMeses({ meses }: { meses: VendasMes[] }) {
  const max = Math.max(...meses.map((m) => m.unidades), 1);
  const total = meses.reduce((s, m) => s + m.unidades, 0);
  if (!total) {
    return <p className="text-sm text-suave">Nenhuma unidade vendida nos últimos 6 meses.</p>;
  }
  return (
    <ol className="flex h-40 items-end gap-2 sm:gap-4" aria-label="Unidades vendidas por mês">
      {meses.map((m, i) => {
        const atual = i === meses.length - 1;
        return (
          <li key={m.mes} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
            <span className="tabular text-xs font-semibold text-tinta">{m.unidades || ""}</span>
            <div
              className={cn("w-full max-w-12 rounded-t-md", !m.unidades ? "bg-linha" : atual ? "bg-chama" : "bg-chama/45")}
              style={{ height: `${Math.max((m.unidades / max) * 100, m.unidades ? 6 : 2)}%` }}
              aria-hidden
            />
            <span className={cn("text-xs capitalize", atual ? "font-semibold text-tinta" : "text-suave")}>
              {m.rotulo}
              <span className="sr-only">: {plural(m.unidades, "unidade")}{atual ? " (mês atual)" : ""}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function iconeMovimentacao(m: MovimentacaoEstoque) {
  if (m.motivo === "venda") return <ShoppingBag aria-hidden className="size-4" />;
  if (m.motivo === "cancelamento_venda") return <Undo2 aria-hidden className="size-4" />;
  if (m.motivo === "ajuste_inventario") return <ClipboardList aria-hidden className="size-4" />;
  return m.tipo === "entrada" ? <PackagePlus aria-hidden className="size-4" /> : <PackageMinus aria-hidden className="size-4" />;
}

function ItemLinhaTempo({ m, ultimo }: { m: MovimentacaoEstoque; ultimo: boolean }) {
  const entrada = m.tipo === "entrada";
  const ajuste = m.motivo === "ajuste_inventario";
  const cor = ajuste ? "bg-info-clara text-info" : entrada ? "bg-salvia-clara text-salvia" : "bg-alerta-clara text-alerta";
  const motivo = rotulo(ROTULO_MOTIVO, m.motivo);
  const observacao = m.observacao && m.observacao !== motivo && !(m.venda_id && m.observacao === `Venda #${m.venda_id}`) ? m.observacao : null;

  return (
    <li className="relative flex gap-3">
      {!ultimo && <span aria-hidden className="absolute top-9 bottom-[-1rem] left-4 w-px bg-linha" />}
      <span className={cn("relative flex size-8 shrink-0 items-center justify-center rounded-full", cor)}>{iconeMovimentacao(m)}</span>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <p className="text-sm text-tinta">
            <span className={cn("tabular font-semibold", entrada ? "text-salvia" : "text-alerta")}>
              {entrada ? "+" : "−"}
              {formatInt(m.quantidade)} un.
            </span>{" "}
            <span className="font-medium">{motivo}</span>
            {m.venda_id && (
              <>
                {" · "}
                <Link href={`/vendas/${m.venda_id}`} className="link">
                  Venda #{m.venda_id}
                </Link>
              </>
            )}
          </p>
          <time dateTime={new Date(m.criado_em).toISOString()} title={formatDateTime(m.criado_em)} className="text-xs text-suave">
            {formatRelative(m.criado_em)}
          </time>
        </div>
        {observacao && <p className="mt-0.5 text-xs break-words text-suave">{observacao}</p>}
        {m.saldo_apos !== null && <p className="tabular mt-0.5 text-xs text-suave">Ficou com {plural(m.saldo_apos, "unidade")}</p>}
      </div>
    </li>
  );
}
