import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  HandCoins,
  History,
  Mail,
  MessageCircle,
  Package,
  Printer,
  ReceiptText,
  ShoppingBag,
  UserRound,
  Wallet,
} from "lucide-react";
import {
  Aviso,
  Avatar,
  ButtonLink,
  Card,
  CardFooter,
  CardHeader,
  ConfirmDialog,
  DataTable,
  IconLink,
  ListaDetalhes,
  PageHeader,
  StatCard,
  StatGrid,
  classesBotao,
} from "@/components/ui";
import { obterVenda, type ItemVendaDetalhe } from "@/lib/consultas/vendas";
import { cancelarVenda } from "@/lib/dominio/acoes/vendas";
import { formatBRL, formatDateLong, formatDateTime, formatPercent, formatRelative, formatTelefone, formatTime, linkWhatsApp, plural } from "@/lib/format";
import { MotivoCancelamento } from "../_components/motivo-cancelamento";
import { CanalTexto, FormaPagamentoTexto, StatusVendaBadge } from "../_components/rotulos";
import { requireAuth } from "@/lib/auth";

export async function generateMetadata({ params }: PageProps<"/vendas/[id]">): Promise<Metadata> {
  await requireAuth();
  const { id } = await params;
  if (!/^\d+$/.test(id)) return { title: "Venda não encontrada" };
  const v = await obterVenda(Number(id));
  return { title: v ? `Venda #${v.id}` : "Venda não encontrada" };
}

export default async function VendaPage({ params }: PageProps<"/vendas/[id]">) {
  await requireAuth();
  const { id } = await params;
  const v = /^\d+$/.test(id) ? await obterVenda(Number(id)) : null;
  if (!v) notFound();

  const cancelada = v.status === "cancelada";
  const whatsapp = v.cliente ? linkWhatsApp(v.cliente.telefone) : null;

  return (
    <>
      <PageHeader
        breadcrumb={[{ rotulo: "Vendas", href: "/vendas" }, { rotulo: `Venda #${v.id}` }]}
        titulo={`Venda #${v.id}`}
        badges={<StatusVendaBadge status={v.status} tamanho="md" />}
        descricao={
          <>
            {formatDateLong(v.data)}, às {formatTime(v.data)}{" "}
            <span className="text-suave">· {formatRelative(v.data)}</span>
          </>
        }
        acoes={
          <>
            <ButtonLink href={`/recibo/${v.id}`} variante={cancelada ? "secundario" : "primario"} icone={<Printer />}>
              Recibo
            </ButtonLink>
            {!cancelada && (
              <ConfirmDialog
                gatilho={{ rotulo: "Cancelar venda", variante: "perigo", icone: <Ban /> }}
                titulo={`Cancelar a venda #${v.id}?`}
                descricao={
                  <>
                    {plural(v.unidades, "unidade")} volta{v.unidades === 1 ? "" : "m"} para o estoque e{" "}
                    {formatBRL(v.total)} deixa de contar no faturamento e nos relatórios. Não dá para desfazer.
                  </>
                }
                tom="perigo"
                confirmar="Cancelar venda"
                confirmando="Cancelando…"
                cancelar="Voltar"
                acao={cancelarVenda}
                campos={{ id: v.id }}
              >
                <MotivoCancelamento />
              </ConfirmDialog>
            )}
          </>
        }
      />

      {cancelada && (
        <Aviso tipo="erro" titulo="Esta venda foi cancelada" className="mb-6">
          {v.cancelada_em && <>Cancelada em {formatDateTime(v.cancelada_em)}. </>}
          {v.motivo_cancelamento && (
            <>
              Motivo: <strong className="font-semibold">{v.motivo_cancelamento}</strong>.{" "}
            </>
          )}
          Os itens voltaram ao estoque e ela não entra em nenhum total.
        </Aviso>
      )}

      <StatGrid className="mb-6">
        <StatCard
          rotulo="Total"
          valor={<span className={cancelada ? "text-suave line-through decoration-2" : undefined}>{formatBRL(v.total)}</span>}
          icone={<ReceiptText />}
          destaque={cancelada ? undefined : "chama"}
          detalhe={v.desconto > 0 ? `com ${formatBRL(v.desconto)} de desconto` : "sem desconto"}
        />
        <StatCard rotulo="Itens" valor={plural(v.unidades, "unidade")} icone={<Package />} detalhe={plural(v.itens.length, "produto")} />
        <StatCard
          rotulo="Custo"
          valor={<span className={cancelada ? "text-suave line-through decoration-2" : undefined}>{formatBRL(v.custo)}</span>}
          icone={<Wallet />}
          detalhe={cancelada ? "não conta (cancelada)" : "custo de produção"}
        />
        <StatCard
          rotulo="Lucro bruto"
          valor={<span className={cancelada ? "text-suave line-through decoration-2" : undefined}>{formatBRL(v.lucro)}</span>}
          icone={<HandCoins />}
          destaque={cancelada ? undefined : v.lucro >= 0 ? "salvia" : "alerta"}
          detalhe={cancelada ? "não conta (cancelada)" : v.margem != null ? `margem de ${formatPercent(v.margem)}` : undefined}
        />
      </StatGrid>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card padding="none">
            <CardHeader inset titulo="Itens da venda" descricao="Preço e custo registrados no momento da venda." icone={<ShoppingBag />} />
            <DataTable<ItemVendaDetalhe>
              rotulo={`Itens da venda #${v.id}`}
              linhas={v.itens}
              chave={(i) => i.id}
              hrefLinha={(i) => `/produtos/${i.produto_id}`}
              colunas={[
                {
                  id: "produto",
                  cabecalho: "Vela",
                  mobile: "titulo",
                  celula: (i) => i.produto_nome,
                },
                {
                  id: "aroma",
                  cabecalho: "Aroma",
                  mobile: "subtitulo",
                  classe: "hidden lg:table-cell text-suave",
                  celula: (i) => (
                    <>
                      {i.aroma ?? "—"}
                      {i.produto_ativo === false && <span className="text-xs"> · desativada</span>}
                    </>
                  ),
                },
                { id: "qtd", cabecalho: "Qtd.", alinhar: "direita", celula: (i) => `${i.quantidade} un.` },
                { id: "preco", cabecalho: "Preço un.", alinhar: "direita", celula: (i) => formatBRL(i.preco_unitario) },
                {
                  id: "custo",
                  cabecalho: "Custo",
                  alinhar: "direita",
                  classe: "hidden xl:table-cell text-suave",
                  celula: (i) => formatBRL(i.custo_total),
                },
                {
                  id: "lucro",
                  cabecalho: "Lucro",
                  alinhar: "direita",
                  classe: "hidden sm:table-cell",
                  celula: (i) => <span className={i.lucro < 0 ? "text-alerta" : undefined}>{formatBRL(i.lucro)}</span>,
                },
                { id: "subtotal", cabecalho: "Subtotal", alinhar: "direita", mobile: "valor", celula: (i) => formatBRL(i.subtotal) },
              ]}
            />
            <CardFooter inset className="block">
              <dl className="ml-auto max-w-xs space-y-1 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-suave">Subtotal</dt>
                  <dd className="tabular">{formatBRL(v.subtotal)}</dd>
                </div>
                {v.desconto > 0 && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-suave">
                      Desconto{" "}
                      <span className="text-xs">({formatPercent(v.subtotal > 0 ? v.desconto / v.subtotal : null)})</span>
                    </dt>
                    <dd className="tabular text-alerta">− {formatBRL(v.desconto)}</dd>
                  </div>
                )}
                <div className="flex items-baseline justify-between gap-4 border-t border-linha pt-1.5">
                  <dt className="font-semibold">Total</dt>
                  <dd className={`tabular font-serif text-xl font-semibold ${cancelada ? "text-suave line-through" : "text-tinta"}`}>
                    {formatBRL(v.total)}
                  </dd>
                </div>
              </dl>
            </CardFooter>
          </Card>

          {v.observacao && (
            <Card>
              <CardHeader titulo="Observação" />
              <p className="text-sm break-words whitespace-pre-line text-tinta">{v.observacao}</p>
            </Card>
          )}
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader titulo="Pagamento" icone={<Wallet />} />
            <ListaDetalhes
              colunas={1}
              itens={[
                { rotulo: "Forma de pagamento", valor: <FormaPagamentoTexto forma={v.forma_pagamento} /> },
                { rotulo: "Canal da venda", valor: <CanalTexto canal={v.canal} /> },
                ...(v.forma_pagamento === "dinheiro" && v.valor_recebido != null
                  ? [
                      {
                        rotulo: "Recebido / troco",
                        valor: (
                          <span className="tabular">
                            {formatBRL(v.valor_recebido)} · troco {formatBRL(v.troco ?? 0)}
                          </span>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          </Card>

          <Card>
            <CardHeader titulo="Cliente" icone={<UserRound />} />
            {v.cliente ? (
              <div className="space-y-4">
                <Link href={`/clientes/${v.cliente.id}`} className="group flex items-center gap-3 rounded-lg">
                  <Avatar nome={v.cliente.nome} />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-tinta group-hover:text-chama-escura group-hover:underline">
                      {v.cliente.nome}
                    </p>
                    <p className="text-xs text-suave">
                      {plural(v.cliente.compras, "compra")} no total
                      {!v.cliente.ativo && " · desativado"}
                    </p>
                  </div>
                </Link>
                {(v.cliente.telefone || v.cliente.email) && (
                  <ul className="space-y-1.5 text-sm text-tinta">
                    {v.cliente.telefone && <li className="tabular">{formatTelefone(v.cliente.telefone)}</li>}
                    {v.cliente.email && (
                      <li className="flex min-w-0 items-center gap-1.5">
                        <Mail aria-hidden className="size-4 shrink-0 text-suave" />
                        <a href={`mailto:${v.cliente.email}`} className="link truncate">
                          {v.cliente.email}
                        </a>
                      </li>
                    )}
                  </ul>
                )}
                {whatsapp && (
                  <a
                    href={whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={classesBotao({ variante: "secundario", larguraTotal: true })}
                  >
                    <MessageCircle aria-hidden />
                    Conversar no WhatsApp
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm text-suave">Venda sem cliente identificado.</p>
            )}
          </Card>

          <Card>
            <CardHeader titulo="Histórico" icone={<History />} />
            <ol className="space-y-4">
              <li className="flex gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-salvia-clara text-salvia">
                  <CircleCheck aria-hidden className="size-4" />
                </span>
                <div className="min-w-0 text-sm">
                  <p className="font-medium text-tinta">Venda registrada</p>
                  <p className="text-xs text-suave">{formatDateTime(v.data)}</p>
                  <p className="text-xs text-suave">{plural(v.unidades, "unidade")} {v.unidades === 1 ? "saiu" : "saíram"} do estoque.</p>
                </div>
              </li>
              {cancelada && (
                <li className="flex gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-alerta-clara text-alerta">
                    <Ban aria-hidden className="size-4" />
                  </span>
                  <div className="min-w-0 text-sm">
                    <p className="font-medium text-tinta">Venda cancelada</p>
                    {v.cancelada_em && <p className="text-xs text-suave">{formatDateTime(v.cancelada_em)}</p>}
                    {v.motivo_cancelamento && <p className="break-words text-xs text-suave">Motivo: {v.motivo_cancelamento}</p>}
                    <p className="text-xs text-suave">{plural(v.unidades, "unidade")} {v.unidades === 1 ? "voltou" : "voltaram"} ao estoque.</p>
                  </div>
                </li>
              )}
            </ol>
          </Card>
        </div>
      </div>

      <nav aria-label="Outras vendas" className="mt-8 flex items-center justify-between gap-2 print:hidden">
        {v.anterior ? (
          <ButtonLink href={`/vendas/${v.anterior}`} variante="fantasma" icone={<ChevronLeft />}>
            <span className="hidden sm:inline">Venda anterior</span> #{v.anterior}
          </ButtonLink>
        ) : (
          <span />
        )}
        <IconLink href="/vendas" rotulo="Voltar ao histórico" icone={<ReceiptText />} />
        {v.proxima ? (
          <ButtonLink href={`/vendas/${v.proxima}`} variante="fantasma" iconeDireita={<ChevronRight />}>
            <span className="hidden sm:inline">Próxima venda</span> #{v.proxima}
          </ButtonLink>
        ) : (
          <span />
        )}
      </nav>
    </>
  );
}
