import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  AtSign,
  CalendarClock,
  Heart,
  Mail,
  MessageCircle,
  Package,
  Pencil,
  Phone,
  Receipt,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  UserRoundX,
  Wallet,
} from "lucide-react";
import {
  Aviso,
  Avatar,
  Badge,
  ButtonLink,
  Card,
  CardFooter,
  CardHeader,
  ConfirmDialog,
  DataTable,
  EmptyState,
  EstoqueBadge,
  IconLink,
  ListaDetalhes,
  Pagination,
  PageHeader,
  ProgressBar,
  StatCard,
  StatGrid,
  classesBotao,
  paginaAtual,
} from "@/components/ui";
import {
  DIAS_SUMIDO,
  aromasFavoritosCliente,
  buscarCliente,
  historicoComprasCliente,
  produtosFavoritosCliente,
} from "@/lib/consultas/clientes";
import { ROTULO_CANAL, ROTULO_FORMA_PAGAMENTO, rotulo } from "@/lib/dominio";
import { desativarCliente, reativarCliente } from "@/lib/dominio/acoes/clientes";
import { getConfiguracoes } from "@/lib/dominio/configuracoes";
import {
  formatBRL,
  formatDate,
  formatDateTime,
  formatInt,
  formatRelative,
  formatTelefone,
  linkInstagram,
  linkWhatsApp,
  plural,
} from "@/lib/format";
import { CopiarBotao } from "../_componentes/copiar-botao";
import { StatusVendaBadge } from "../../vendas/_components/rotulos";
import { requireAuth } from "@/lib/auth";

const DIA_MS = 24 * 60 * 60 * 1000;

export async function generateMetadata({ params }: PageProps<"/clientes/[id]">): Promise<Metadata> {
  await requireAuth();
  const { id } = await params;
  const cliente = await buscarCliente(Number(id));
  return { title: cliente ? cliente.nome : "Cliente não encontrado" };
}

function NaoInformado({ children = "Não informado" }: { children?: string }) {
  return <span className="text-suave italic">{children}</span>;
}

export default async function ClientePage({ params, searchParams }: PageProps<"/clientes/[id]">) {
  await requireAuth();
  const [{ id: idTexto }, sp] = await Promise.all([params, searchParams]);
  const id = Number(idTexto);
  const cliente = await buscarCliente(id);
  if (!cliente) notFound();

  const paginaPedida = paginaAtual(sp);
  const [historico, aromas, favoritos, config] = await Promise.all([
    historicoComprasCliente(id, paginaPedida),
    aromasFavoritosCliente(id),
    produtosFavoritosCliente(id),
    getConfiguracoes(),
  ]);

  const primeiroNome = cliente.nome.trim().split(/\s+/)[0];
  const whatsapp = linkWhatsApp(
    cliente.telefone,
    `Olá, ${primeiroNome}! Tudo bem? Aqui é da ${config.loja_nome}.`,
  );
  const instagram = linkInstagram(cliente.instagram);
  const ticket = cliente.compras > 0 ? cliente.total_gasto / cliente.compras : 0;
  const diasSemComprar = cliente.dias_sem_comprar;
  const sumido = diasSemComprar !== null && diasSemComprar > DIAS_SUMIDO;
  const intervaloMedio =
    cliente.compras >= 2 && cliente.primeira_compra && cliente.ultima_compra
      ? Math.round(
          (new Date(cliente.ultima_compra).getTime() - new Date(cliente.primeira_compra).getTime()) /
            DIA_MS /
            (cliente.compras - 1),
        )
      : null;
  const maxAroma = aromas[0]?.unidades ?? 0;
  const novaVendaHref = `/vendas/nova?cliente=${cliente.id}`;

  return (
    <>
      <PageHeader
        breadcrumb={[{ rotulo: "Clientes", href: "/clientes" }, { rotulo: cliente.nome }]}
        titulo={
          <span className="flex min-w-0 items-center gap-3">
            <Avatar nome={cliente.nome} tamanho="lg" />
            <span className="min-w-0 break-words">{cliente.nome}</span>
          </span>
        }
        badges={
          <span className="flex flex-wrap gap-1.5">
            {!cliente.ativo && <Badge icone={<UserRoundX />}>Desativado</Badge>}
            {cliente.ativo && cliente.compras >= 2 && (
              <Badge tom="salvia" icone={<Heart />}>
                Recorrente
              </Badge>
            )}
            {cliente.ativo && sumido && <Badge tom="mel">Sumido há {diasSemComprar} dias</Badge>}
          </span>
        }
        descricao={`Cliente desde ${formatDate(cliente.criado_em)}`}
        acoes={
          <>
            {cliente.ativo && (
              <ButtonLink href={novaVendaHref} icone={<ShoppingBag />}>
                Nova venda
              </ButtonLink>
            )}
            {whatsapp && (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className={classesBotao({ variante: "secundario" })}
              >
                <MessageCircle aria-hidden />
                WhatsApp
              </a>
            )}
            <ButtonLink href={`/clientes/${cliente.id}/editar`} variante="secundario" icone={<Pencil />}>
              Editar
            </ButtonLink>
          </>
        }
      />

      <div className="space-y-6">
        {!cliente.ativo && (
          <Aviso
            tipo="info"
            titulo="Cliente desativado"
            acao={
              <ConfirmDialog
                gatilho={{ rotulo: "Reativar", icone: <RotateCcw />, tamanho: "sm" }}
                titulo={`Reativar ${cliente.nome}?`}
                descricao="O cliente volta a aparecer na lista, nas buscas e na nova venda."
                confirmar="Reativar"
                confirmando="Reativando…"
                acao={reativarCliente}
                campos={{ id: cliente.id }}
              />
            }
          >
            Não aparece nas buscas nem na nova venda. O histórico de compras continua guardado.
          </Aviso>
        )}

        {cliente.ativo && sumido && whatsapp && (
          <Aviso
            tipo="atencao"
            titulo={`${primeiroNome} não compra há ${diasSemComprar} dias`}
            acao={
              <a
                href={linkWhatsApp(
                  cliente.telefone,
                  `Olá, ${primeiroNome}! Tudo bem? Aqui é da ${config.loja_nome}. Sentimos sua falta! ${
                    aromas[0] ? `Temos velas de ${aromas[0].aroma.toLowerCase()} esperando por você. ` : ""
                  }Quer ver as novidades?`,
                )!}
                target="_blank"
                rel="noopener noreferrer"
                className={classesBotao({ variante: "secundario", tamanho: "sm" })}
              >
                <MessageCircle aria-hidden />
                Mandar mensagem
              </a>
            }
          >
            Uma mensagem carinhosa pode trazer de volta.
          </Aviso>
        )}

        <StatGrid>
          <StatCard
            rotulo="Total gasto"
            valor={formatBRL(cliente.total_gasto)}
            destaque={cliente.total_gasto > 0 ? "chama" : undefined}
            icone={<Wallet />}
            detalhe={cliente.compras > 0 ? `em ${plural(cliente.compras, "compra")}` : "Nenhuma compra ainda"}
          />
          <StatCard
            rotulo="Ticket médio"
            valor={cliente.compras > 0 ? formatBRL(ticket) : "—"}
            icone={<Receipt />}
            detalhe={cliente.unidades > 0 ? `${plural(cliente.unidades, "vela")} no total` : undefined}
          />
          <StatCard
            rotulo="Última compra"
            valor={cliente.ultima_compra ? formatRelative(cliente.ultima_compra) : "—"}
            icone={<CalendarClock />}
            detalhe={cliente.ultima_compra ? formatDate(cliente.ultima_compra) : "Nunca comprou"}
          />
          <StatCard
            rotulo="Frequência"
            valor={intervaloMedio !== null ? `${formatInt(Math.max(1, intervaloMedio))} dias` : "—"}
            icone={<RotateCcw />}
            detalhe={
              intervaloMedio !== null
                ? "em média entre compras"
                : cliente.primeira_compra
                  ? `1ª compra em ${formatDate(cliente.primeira_compra)}`
                  : "Aparece a partir da 2ª compra"
            }
          />
        </StatGrid>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card padding="none">
              <CardHeader
                inset
                titulo="Histórico de compras"
                icone={<Receipt />}
                descricao={
                  cliente.canceladas > 0
                    ? `Inclui ${plural(cliente.canceladas, "venda cancelada", "vendas canceladas")}, ${cliente.canceladas === 1 ? "que não conta" : "que não contam"} nos totais.`
                    : undefined
                }
              />
              <DataTable
                rotulo={`Compras de ${cliente.nome}`}
                linhas={historico.itens}
                chave={(v) => v.id}
                hrefLinha={(v) => `/vendas/${v.id}`}
                classeLinha={(v) => (v.status === "cancelada" ? "opacity-70" : undefined)}
                colunas={[
                  { id: "venda", cabecalho: "Venda", mobile: "titulo", celula: (v) => `#${v.id}` },
                  {
                    id: "data",
                    cabecalho: "Data",
                    mobile: "subtitulo",
                    classe: "whitespace-nowrap",
                    celula: (v) => formatDateTime(v.data),
                  },
                  {
                    id: "itens",
                    cabecalho: "Itens",
                    classe: "max-w-64",
                    celula: (v) => (
                      <span className="line-clamp-2 text-suave" title={v.resumo}>
                        {v.resumo || "—"}
                      </span>
                    ),
                  },
                  {
                    id: "pagamento",
                    cabecalho: "Pagamento",
                    classe: "hidden lg:table-cell whitespace-nowrap",
                    celula: (v) => rotulo(ROTULO_FORMA_PAGAMENTO, v.forma_pagamento),
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
                    celula: (v) => (
                      <span className={v.status === "cancelada" ? "text-suave line-through" : undefined}>
                        {formatBRL(v.total)}
                      </span>
                    ),
                  },
                ]}
                vazio={
                  <EmptyState
                    compacto
                    icone={<ShoppingBag />}
                    titulo="Nenhuma compra ainda"
                    descricao={
                      cliente.ativo
                        ? "Quando registrar uma venda para este cliente, ela aparece aqui."
                        : "Este cliente não tem compras registradas."
                    }
                    acao={
                      cliente.ativo ? (
                        <ButtonLink href={novaVendaHref} variante="secundario" icone={<ShoppingBag />}>
                          Registrar venda
                        </ButtonLink>
                      ) : undefined
                    }
                  />
                }
              />
              {historico.total > 0 && (
                <CardFooter inset>
                  <Pagination
                    className="w-full"
                    pagina={historico.pagina}
                    totalPaginas={historico.totalPaginas}
                    totalItens={historico.total}
                    porPagina={historico.porPagina}
                    caminho={`/clientes/${cliente.id}`}
                    searchParams={sp}
                  />
                </CardFooter>
              )}
            </Card>

            {favoritos.length > 0 && (
              <Card padding="none">
                <CardHeader
                  inset
                  titulo="Velas que mais leva"
                  descricao="Bom para sugerir uma recompra quando o estoque chegar."
                  icone={<Package />}
                />
                <ul className="divide-y divide-linha border-t border-linha">
                  {favoritos.map((p) => (
                    <li key={p.produto_id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-tinta">{p.nome}</p>
                        <p className="truncate text-xs text-suave">
                          {[p.aroma, `última em ${formatDate(p.ultima_compra)}`].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="tabular text-sm font-semibold text-tinta">{plural(p.unidades, "un.", "un.")}</span>
                        {p.ativo ? (
                          <EstoqueBadge estoque={p.estoque} minimo={p.estoque_minimo} />
                        ) : (
                          <Badge>Fora de linha</Badge>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader
                titulo="Contato"
                icone={<Phone />}
                acoes={<IconLink href={`/clientes/${cliente.id}/editar`} rotulo="Editar contato" icone={<Pencil />} />}
              />
              <ListaDetalhes
                colunas={1}
                itens={[
                  {
                    rotulo: "Telefone",
                    valor: cliente.telefone ? (
                      <span className="flex flex-wrap items-center gap-1">
                        <a href={`tel:+55${cliente.telefone}`} className="link tabular">
                          {formatTelefone(cliente.telefone)}
                        </a>
                        <CopiarBotao texto={formatTelefone(cliente.telefone)} rotulo="Copiar telefone" />
                        {whatsapp && (
                          <a
                            href={whatsapp}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Abrir conversa no WhatsApp"
                            title="Abrir conversa no WhatsApp"
                            className={classesBotao({ variante: "fantasma", tamanho: "sm", somenteIcone: true })}
                          >
                            <MessageCircle aria-hidden />
                          </a>
                        )}
                      </span>
                    ) : (
                      <NaoInformado />
                    ),
                  },
                  {
                    rotulo: "E-mail",
                    valor: cliente.email ? (
                      <span className="flex min-w-0 items-center gap-1">
                        <Mail aria-hidden className="size-4 shrink-0 text-suave" />
                        <a href={`mailto:${cliente.email}`} className="link truncate">
                          {cliente.email}
                        </a>
                      </span>
                    ) : (
                      <NaoInformado />
                    ),
                  },
                  {
                    rotulo: "Instagram",
                    valor: instagram ? (
                      <span className="flex min-w-0 items-center gap-1">
                        <AtSign aria-hidden className="size-4 shrink-0 text-suave" />
                        <a href={instagram} target="_blank" rel="noopener noreferrer" className="link truncate">
                          {cliente.instagram}
                        </a>
                      </span>
                    ) : (
                      <NaoInformado />
                    ),
                  },
                  {
                    rotulo: "Observações",
                    valor: cliente.observacoes ? (
                      <span className="whitespace-pre-line">{cliente.observacoes}</span>
                    ) : (
                      <NaoInformado>Nenhuma anotação</NaoInformado>
                    ),
                  },
                ]}
              />
            </Card>

            <Card>
              <CardHeader titulo="Aromas favoritos" icone={<Sparkles />} />
              {aromas.length === 0 ? (
                <p className="text-sm text-suave">Os aromas preferidos aparecem depois da primeira compra.</p>
              ) : (
                <ol className="space-y-3.5">
                  {aromas.map((a, i) => (
                    <li key={a.aroma}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate font-medium text-tinta">
                          {i === 0 && <span className="sr-only">Favorito: </span>}
                          {a.aroma}
                        </span>
                        <span className="tabular shrink-0 text-xs text-suave">
                          {plural(a.unidades, "un.", "un.")} · {formatBRL(a.valor)}
                        </span>
                      </div>
                      <ProgressBar
                        valor={a.unidades}
                        max={maxAroma}
                        tom={i === 0 ? "chama" : "mel"}
                        rotulo={`${a.aroma}: ${a.unidades} unidades`}
                      />
                    </li>
                  ))}
                </ol>
              )}
            </Card>

            <Card>
              <CardHeader titulo="Como costuma comprar" icone={<Wallet />} />
              <ListaDetalhes
                colunas={1}
                itens={[
                  {
                    rotulo: "Forma de pagamento",
                    valor: cliente.forma_preferida ? (
                      rotulo(ROTULO_FORMA_PAGAMENTO, cliente.forma_preferida)
                    ) : (
                      <NaoInformado>—</NaoInformado>
                    ),
                  },
                  {
                    rotulo: "Canal",
                    valor: cliente.canal_preferido ? rotulo(ROTULO_CANAL, cliente.canal_preferido) : <NaoInformado>—</NaoInformado>,
                  },
                  {
                    rotulo: "Descontos recebidos",
                    valor: <span className="tabular">{formatBRL(cliente.total_descontos)}</span>,
                  },
                  {
                    rotulo: "Primeira compra",
                    valor: cliente.primeira_compra ? formatDate(cliente.primeira_compra) : <NaoInformado>—</NaoInformado>,
                  },
                ]}
              />
            </Card>

            {cliente.ativo && (
              <Card className="border-alerta/20">
                <CardHeader
                  titulo="Desativar cliente"
                  descricao="Some da lista, das buscas e da nova venda. As compras continuam nos relatórios e dá para reativar depois."
                />
                <ConfirmDialog
                  gatilho={{ rotulo: "Desativar cliente", variante: "perigo", icone: <UserRoundX />, larguraTotal: true }}
                  titulo={`Desativar ${cliente.nome}?`}
                  descricao="O histórico de compras é mantido. Você pode reativar quando quiser."
                  tom="perigo"
                  confirmar="Desativar"
                  confirmando="Desativando…"
                  cancelar="Voltar"
                  acao={desativarCliente}
                  campos={{ id: cliente.id }}
                />
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
