import type { Metadata } from "next";
import { MessageCircle, Repeat, UserPlus, Users, UserRoundSearch, Receipt, Moon } from "lucide-react";
import {
  Avatar,
  Badge,
  ButtonLink,
  Card,
  DataTable,
  EmptyState,
  FilterBar,
  PageHeader,
  Pagination,
  SearchInput,
  SegmentedLinks,
  Select,
  StatCard,
  StatGrid,
  classesBotao,
  montarHref,
  paginaAtual,
  param,
} from "@/components/ui";
import {
  DIAS_SUMIDO,
  FILTROS_CLIENTES,
  ORDENACOES_CLIENTES,
  ROTULO_FILTRO_CLIENTES,
  ROTULO_ORDENACAO_CLIENTES,
  listarClientes,
  resumoClientes,
  type ClienteLista,
  type FiltroClientes,
  type OrdenacaoClientes,
} from "@/lib/consultas/clientes";
import { formatBRL, formatDate, formatInt, formatPercent, formatRelative, formatTelefone, linkWhatsApp } from "@/lib/format";
import { hojeSP, inicioDoDiaSP } from "@/lib/periodo";
import { requireAuth } from "@/lib/auth";

export const metadata: Metadata = { title: "Clientes" };

function escolher<T extends string>(valor: string | undefined, opcoes: readonly T[], padrao: T): T {
  return opcoes.includes(valor as T) ? (valor as T) : padrao;
}

function contato(c: ClienteLista) {
  if (c.telefone) return formatTelefone(c.telefone);
  if (c.instagram) return `@${c.instagram}`;
  if (c.email) return c.email;
  return <span className="italic">Sem contato</span>;
}

export default async function ClientesPage({ searchParams }: PageProps<"/clientes">) {
  await requireAuth();
  const sp = await searchParams;
  const q = (param(sp, "q") ?? "").trim();
  const filtro = escolher<FiltroClientes>(param(sp, "filtro"), FILTROS_CLIENTES, "ativos");
  const ordenar = escolher<OrdenacaoClientes>(param(sp, "ordenar"), ORDENACOES_CLIENTES, "nome");
  const paginaPedida = paginaAtual(sp);

  const inicioMes = inicioDoDiaSP(`${hojeSP().slice(0, 8)}01`);
  const [resumo, lista] = await Promise.all([
    resumoClientes(inicioMes),
    listarClientes({ q, filtro, ordenar, pagina: paginaPedida }),
  ]);
  // Página efetiva (limitada ao total): a pedida pode não existir mais depois de mudanças na lista.
  const { itens, total, pagina, totalPaginas, porPagina } = lista;

  const contagens: Record<FiltroClientes, number> = {
    ativos: resumo.ativos,
    recorrentes: resumo.recorrentes,
    sumidos: resumo.sumidos,
    sem_compras: resumo.sem_compras,
    desativados: resumo.desativados,
  };
  const participacao =
    resumo.faturamento_30d > 0 ? resumo.faturamento_identificado_30d / resumo.faturamento_30d : null;
  const nenhumCliente = resumo.ativos + resumo.desativados === 0;
  const hrefFiltro = (f: FiltroClientes) => montarHref("/clientes", sp, { filtro: f === "ativos" ? null : f, pagina: null });

  // Busca sem resultado: oferece cadastrar já com o nome (ou telefone) digitado.
  const buscaEhTelefone = /^[\d\s()+-]+$/.test(q) && q.replace(/\D/g, "").length >= 4;
  const hrefCadastroBusca = montarHref("/clientes/novo", null, buscaEhTelefone ? { telefone: q } : { nome: q });

  const descricaoFiltro: Partial<Record<FiltroClientes, string>> = {
    recorrentes: "Clientes que já compraram 2 vezes ou mais.",
    sumidos: `Compraram antes, mas não voltam há mais de ${DIAS_SUMIDO} dias. Que tal mandar uma mensagem?`,
    sem_compras: "Cadastrados que ainda não têm nenhuma compra registrada.",
    desativados: "Não aparecem nas buscas nem na nova venda. O histórico continua guardado.",
  };

  return (
    <>
      <PageHeader
        titulo="Clientes"
        descricao="Quem compra com você, quanto gasta e do que mais gosta."
        acoes={
          <ButtonLink href="/clientes/novo" icone={<UserPlus />}>
            Novo cliente
          </ButtonLink>
        }
      />

      {nenhumCliente ? (
        <Card>
          <EmptyState
            icone={<Users />}
            titulo="Nenhum cliente cadastrado ainda"
            descricao="Cadastre seus clientes para saber quem compra mais, quais aromas preferem e chamar no WhatsApp com um toque."
            acao={
              <ButtonLink href="/clientes/novo" icone={<UserPlus />}>
                Cadastrar primeiro cliente
              </ButtonLink>
            }
          />
        </Card>
      ) : (
        <div className="space-y-6">
          <StatGrid>
            <StatCard
              rotulo="Clientes ativos"
              valor={formatInt(resumo.ativos)}
              icone={<Users />}
              detalhe={
                resumo.novos_mes > 0
                  ? `+${formatInt(resumo.novos_mes)} ${resumo.novos_mes === 1 ? "novo" : "novos"} este mês`
                  : "Nenhum novo este mês"
              }
            />
            <StatCard
              rotulo="Recorrentes"
              valor={formatInt(resumo.recorrentes)}
              icone={<Repeat />}
              destaque={resumo.recorrentes > 0 ? "salvia" : undefined}
              detalhe={
                resumo.ativos > 0
                  ? `${formatPercent(resumo.recorrentes / resumo.ativos, { casas: 0 })} compraram 2+ vezes`
                  : "Compraram 2+ vezes"
              }
              href={hrefFiltro("recorrentes")}
            />
            <StatCard
              rotulo="Sumidos"
              valor={formatInt(resumo.sumidos)}
              icone={<Moon />}
              detalhe={`Sem comprar há ${DIAS_SUMIDO}+ dias`}
              href={hrefFiltro("sumidos")}
            />
            <StatCard
              rotulo="Faturamento com cliente"
              valor={formatPercent(participacao, { casas: 0 })}
              icone={<Receipt />}
              detalhe={
                participacao === null
                  ? "Sem vendas nos últimos 30 dias"
                  : `${formatBRL(resumo.faturamento_identificado_30d)} de clientes identificados em 30 dias`
              }
            />
          </StatGrid>

          <div>
            <SegmentedLinks
              rotulo="Filtrar clientes"
              itens={FILTROS_CLIENTES.map((f) => ({
                rotulo: ROTULO_FILTRO_CLIENTES[f],
                href: hrefFiltro(f),
                ativo: filtro === f,
                contagem: contagens[f],
              }))}
            />
            {descricaoFiltro[filtro] && <p className="mt-2 text-sm text-suave">{descricaoFiltro[filtro]}</p>}
          </div>

          <div>
            <FilterBar
              caminho="/clientes"
              manter={{ filtro: filtro === "ativos" ? undefined : filtro }}
              limparHref={montarHref("/clientes", null, { filtro: filtro === "ativos" ? null : filtro })}
              totalAtivos={ordenar !== "nome" ? 1 : 0}
              busca={
                <SearchInput
                  defaultValue={q}
                  rotulo="Buscar cliente"
                  placeholder="Buscar por nome, telefone, e-mail ou @…"
                />
              }
            >
              <Select
                name="ordenar"
                label="Ordenar por"
                defaultValue={ordenar}
                opcoes={ORDENACOES_CLIENTES.map((o) => ({ valor: o, rotulo: ROTULO_ORDENACAO_CLIENTES[o] }))}
              />
            </FilterBar>

            <Card padding="none">
              <DataTable
                rotulo="Lista de clientes"
                linhas={itens}
                chave={(c) => c.id}
                hrefLinha={(c) => `/clientes/${c.id}`}
                colunas={[
                  {
                    id: "nome",
                    cabecalho: "Cliente",
                    mobile: "titulo",
                    celula: (c) => (
                      <span className="flex min-w-0 items-center gap-3">
                        <Avatar nome={c.nome} tamanho="sm" />
                        <span className="truncate">{c.nome}</span>
                        {!c.ativo && <Badge>Desativado</Badge>}
                      </span>
                    ),
                  },
                  { id: "contato", cabecalho: "Contato", mobile: "subtitulo", celula: (c) => contato(c), classe: "text-suave" },
                  {
                    id: "compras",
                    cabecalho: "Compras",
                    alinhar: "direita",
                    celula: (c) => formatInt(c.compras),
                  },
                  {
                    id: "gasto",
                    cabecalho: "Total gasto",
                    alinhar: "direita",
                    mobile: "valor",
                    celula: (c) => formatBRL(c.total_gasto),
                  },
                  {
                    id: "ultima",
                    cabecalho: "Última compra",
                    celula: (c) =>
                      c.ultima_compra ? (
                        <span title={formatDate(c.ultima_compra)}>{formatRelative(c.ultima_compra)}</span>
                      ) : (
                        <span className="text-suave">Nunca comprou</span>
                      ),
                  },
                  {
                    id: "acoes",
                    cabecalho: <span className="sr-only">Ações</span>,
                    alinhar: "direita",
                    mobile: "acoes",
                    classe: "w-14",
                    celula: (c) => {
                      const wa = c.ativo ? linkWhatsApp(c.telefone) : null;
                      return wa ? (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Abrir WhatsApp de ${c.nome}`}
                          title="Abrir WhatsApp"
                          className={classesBotao({ variante: "fantasma", tamanho: "sm", somenteIcone: true })}
                        >
                          <MessageCircle aria-hidden />
                        </a>
                      ) : null;
                    },
                  },
                ]}
                vazio={
                  q ? (
                    <EmptyState
                      compacto
                      icone={<UserRoundSearch />}
                      titulo={`Nenhum cliente encontrado para “${q}”`}
                      descricao="Confira a grafia, busque só pelo primeiro nome ou pelos últimos dígitos do telefone."
                      acao={
                        <ButtonLink
                          href={hrefCadastroBusca}
                          variante="secundario"
                          icone={<UserPlus />}
                        >
                          Cadastrar novo cliente
                        </ButtonLink>
                      }
                    />
                  ) : (
                    <EmptyState
                      compacto
                      icone={<Users />}
                      titulo="Nenhum cliente neste filtro"
                      descricao={
                        filtro === "sumidos"
                          ? "Ótimo sinal: todos os seus clientes compraram recentemente."
                          : "Escolha outro filtro para ver mais clientes."
                      }
                      acao={
                        <ButtonLink href="/clientes" variante="secundario">
                          Ver todos
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
              caminho="/clientes"
              searchParams={sp}
            />
          </div>
        </div>
      )}
    </>
  );
}
