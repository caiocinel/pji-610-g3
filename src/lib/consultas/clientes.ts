import "server-only";
import { cache } from "react";
import { query, queryOne } from "@/lib/db";
import { normalizarTelefone, type Canal, type Cliente, type FormaPagamento, type StatusVenda } from "@/lib/dominio";
import { parsePeriodo } from "@/lib/periodo";

// Consultas de leitura da área de Clientes. Vendas canceladas nunca entram em totais,
// "última compra", favoritos etc.; o histórico do cliente mostra as canceladas com selo.

/** Dias sem comprar para o cliente ser considerado "sumido" (vale chamar no WhatsApp). */
export const DIAS_SUMIDO = 60;

/** Maior id que cabe em INTEGER no Postgres: acima disso a consulta falharia (500) em vez de "não encontrado". */
const ID_MAXIMO = 2_147_483_647;

function idValido(id: number): boolean {
  return Number.isInteger(id) && id > 0 && id <= ID_MAXIMO;
}

/** Limita a página pedida ao intervalo existente (1..totalPaginas), como nas outras listas. */
function limitarPagina(pagina: number, total: number, porPagina: number) {
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const efetiva = Number.isSafeInteger(pagina) ? Math.min(Math.max(1, pagina), totalPaginas) : 1;
  return { pagina: efetiva, totalPaginas, offset: (efetiva - 1) * porPagina };
}

/**
 * Dias civis (em SP) desde a última compra: comprou ontem = 1, mesmo que há 10 horas.
 * Mesma regra na lista, no contador e na ficha do cliente; "sumido" = mais de DIAS_SUMIDO.
 */
const diasSemComprarSQL = (coluna: string) =>
  `((now() AT TIME ZONE 'America/Sao_Paulo')::date - (${coluna} AT TIME ZONE 'America/Sao_Paulo')::date)`;

export const FILTROS_CLIENTES = ["ativos", "recorrentes", "sumidos", "sem_compras", "desativados"] as const;
export type FiltroClientes = (typeof FILTROS_CLIENTES)[number];
export const ROTULO_FILTRO_CLIENTES: Record<FiltroClientes, string> = {
  ativos: "Todos",
  recorrentes: "Recorrentes",
  sumidos: "Sumidos",
  sem_compras: "Sem compras",
  desativados: "Desativados",
};

export const ORDENACOES_CLIENTES = ["nome", "gasto", "compras", "recente", "novos"] as const;
export type OrdenacaoClientes = (typeof ORDENACOES_CLIENTES)[number];
export const ROTULO_ORDENACAO_CLIENTES: Record<OrdenacaoClientes, string> = {
  nome: "Nome (A–Z)",
  gasto: "Quem mais gastou",
  compras: "Mais compras",
  recente: "Compra mais recente",
  novos: "Cadastro mais novo",
};

export const POR_PAGINA_CLIENTES = 20;
export const POR_PAGINA_HISTORICO = 10;

export type ClienteLista = Pick<Cliente, "id" | "nome" | "telefone" | "email" | "instagram" | "ativo" | "criado_em"> & {
  compras: number;
  total_gasto: number;
  ultima_compra: Date | null;
};

// Estatísticas por cliente (só vendas concluídas).
const CTE_STATS = `
  stats AS (
    SELECT cliente_id, count(*) AS compras, sum(total) AS total_gasto, max(data) AS ultima_compra
    FROM vendas
    WHERE status = 'concluida' AND cliente_id IS NOT NULL
    GROUP BY cliente_id
  )`;

const ORDEM: Record<OrdenacaoClientes, string> = {
  nome: "lower(c.nome), c.id",
  gasto: "coalesce(s.total_gasto, 0) DESC, lower(c.nome), c.id",
  compras: "coalesce(s.compras, 0) DESC, lower(c.nome), c.id",
  recente: "s.ultima_compra DESC NULLS LAST, lower(c.nome), c.id",
  novos: "c.criado_em DESC, c.id DESC",
};

function condicoesFiltro(filtro: FiltroClientes): string {
  switch (filtro) {
    case "desativados":
      return "NOT c.ativo";
    case "recorrentes":
      return "c.ativo AND coalesce(s.compras, 0) >= 2";
    case "sumidos":
      return `c.ativo AND ${diasSemComprarSQL("s.ultima_compra")} > ${DIAS_SUMIDO}`;
    case "sem_compras":
      return "c.ativo AND s.cliente_id IS NULL";
    default:
      return "c.ativo";
  }
}

/** Busca por nome, e-mail, Instagram e telefone (também só pelos dígitos). */
function condicaoBusca(q: string, params: unknown[]): string | null {
  const termo = q.trim();
  if (!termo) return null;
  params.push(termo);
  const n = params.length;
  const partes = [
    `c.nome ILIKE '%' || $${n} || '%'`,
    `c.email ILIKE '%' || $${n} || '%'`,
    `c.instagram ILIKE '%' || ltrim($${n}, '@') || '%'`,
  ];
  const digitos = termo.replace(/\D/g, "");
  if (digitos.length >= 2) {
    params.push(digitos);
    partes.push(`c.telefone LIKE '%' || $${params.length} || '%'`);
  }
  return `(${partes.join(" OR ")})`;
}

export async function listarClientes({
  q = "",
  filtro = "ativos",
  ordenar = "nome",
  pagina = 1,
  porPagina = POR_PAGINA_CLIENTES,
}: {
  q?: string;
  filtro?: FiltroClientes;
  ordenar?: OrdenacaoClientes;
  pagina?: number;
  porPagina?: number;
}) {
  const params: unknown[] = [];
  const where = [condicoesFiltro(filtro)];
  const busca = condicaoBusca(q, params);
  if (busca) where.push(busca);
  const base = `WITH ${CTE_STATS}
    SELECT %COLUNAS%
    FROM clientes c LEFT JOIN stats s ON s.cliente_id = c.id
    WHERE ${where.join(" AND ")}`;

  // Conta antes para limitar a página: depois de reativar/atender clientes, a página 3 de "Sumidos"
  // pode deixar de existir; mostramos a última em vez de uma lista vazia.
  const contagem = await queryOne<{ total: number }>(base.replace("%COLUNAS%", "count(*) AS total"), params);
  const total = contagem?.total ?? 0;
  const pag = limitarPagina(pagina, total, porPagina);
  const itens =
    total === 0
      ? []
      : await query<ClienteLista>(
          `${base.replace(
            "%COLUNAS%",
            `c.id, c.nome, c.telefone, c.email, c.instagram, c.ativo, c.criado_em,
             coalesce(s.compras, 0) AS compras, coalesce(s.total_gasto, 0) AS total_gasto, s.ultima_compra`,
          )}
          ORDER BY ${ORDEM[ordenar]}
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, porPagina, pag.offset],
        );
  return { itens, total, pagina: pag.pagina, totalPaginas: pag.totalPaginas, porPagina };
}

export type ResumoClientes = {
  ativos: number;
  desativados: number;
  novos_mes: number;
  recorrentes: number;
  sumidos: number;
  sem_compras: number;
  /** Faturamento dos últimos 30 dias (todas as vendas concluídas). */
  faturamento_30d: number;
  /** Parte desse faturamento vinda de vendas com cliente identificado. */
  faturamento_identificado_30d: number;
};

/** Indicadores do topo da lista. `inicioMes` = início do mês corrente em SP. */
export async function resumoClientes(inicioMes: Date): Promise<ResumoClientes> {
  const trinta = parsePeriodo({ periodo: "30d" });
  const linha = await queryOne<ResumoClientes>(
    `WITH ${CTE_STATS},
     base AS (SELECT c.ativo, c.criado_em, s.compras, s.ultima_compra FROM clientes c LEFT JOIN stats s ON s.cliente_id = c.id),
     fat AS (
       SELECT coalesce(sum(total), 0) AS faturamento_30d,
              coalesce(sum(total) FILTER (WHERE cliente_id IS NOT NULL), 0) AS faturamento_identificado_30d
       FROM vendas WHERE status = 'concluida' AND data >= $2 AND data < $3
     )
     SELECT
       count(*) FILTER (WHERE ativo) AS ativos,
       count(*) FILTER (WHERE NOT ativo) AS desativados,
       count(*) FILTER (WHERE ativo AND criado_em >= $1) AS novos_mes,
       count(*) FILTER (WHERE ativo AND coalesce(compras, 0) >= 2) AS recorrentes,
       count(*) FILTER (WHERE ativo AND ${diasSemComprarSQL("ultima_compra")} > ${DIAS_SUMIDO}) AS sumidos,
       count(*) FILTER (WHERE ativo AND compras IS NULL) AS sem_compras,
       (SELECT faturamento_30d FROM fat) AS faturamento_30d,
       (SELECT faturamento_identificado_30d FROM fat) AS faturamento_identificado_30d
     FROM base`,
    // Mesmos "30 dias" de relatórios/vendas (dias civis em SP), para os números baterem.
    [inicioMes, trinta.inicio, trinta.fim],
  );
  return (
    linha ?? {
      ativos: 0,
      desativados: 0,
      novos_mes: 0,
      recorrentes: 0,
      sumidos: 0,
      sem_compras: 0,
      faturamento_30d: 0,
      faturamento_identificado_30d: 0,
    }
  );
}

export type ClienteDetalhe = Cliente & {
  compras: number;
  canceladas: number;
  total_gasto: number;
  total_descontos: number;
  unidades: number;
  primeira_compra: Date | null;
  ultima_compra: Date | null;
  /** Dias civis (SP) desde a última compra concluída (null se nunca comprou). Sumido: > DIAS_SUMIDO. */
  dias_sem_comprar: number | null;
  forma_preferida: FormaPagamento | null;
  canal_preferido: Canal | null;
};

/** Ficha do cliente com indicadores (deduplicada por requisição: metadata + página). */
export const buscarCliente = cache(async (id: number): Promise<ClienteDetalhe | null> => {
  if (!idValido(id)) return null;
  return queryOne<ClienteDetalhe>(
    `SELECT c.*,
       coalesce(s.compras, 0) AS compras,
       (SELECT count(*) FROM vendas WHERE cliente_id = c.id AND status = 'cancelada') AS canceladas,
       coalesce(s.total_gasto, 0) AS total_gasto,
       coalesce(s.total_descontos, 0) AS total_descontos,
       coalesce((SELECT sum(i.quantidade) FROM itens_venda i
                 JOIN vendas v ON v.id = i.venda_id AND v.status = 'concluida'
                 WHERE v.cliente_id = c.id), 0) AS unidades,
       s.primeira_compra, s.ultima_compra,
       ${diasSemComprarSQL("s.ultima_compra")} AS dias_sem_comprar,
       (SELECT forma_pagamento FROM vendas WHERE cliente_id = c.id AND status = 'concluida'
         GROUP BY forma_pagamento ORDER BY count(*) DESC, max(data) DESC LIMIT 1) AS forma_preferida,
       (SELECT canal FROM vendas WHERE cliente_id = c.id AND status = 'concluida'
         GROUP BY canal ORDER BY count(*) DESC, max(data) DESC LIMIT 1) AS canal_preferido
     FROM clientes c
     LEFT JOIN (
       SELECT cliente_id, count(*) AS compras, sum(total) AS total_gasto, sum(desconto) AS total_descontos,
              min(data) AS primeira_compra, max(data) AS ultima_compra
       FROM vendas WHERE status = 'concluida' AND cliente_id = $1 GROUP BY cliente_id
     ) s ON s.cliente_id = c.id
     WHERE c.id = $1`,
    [id],
  );
});

export type CompraCliente = {
  id: number;
  data: Date;
  total: number;
  desconto: number;
  forma_pagamento: FormaPagamento;
  canal: Canal;
  status: StatusVenda;
  unidades: number;
  /** "Vela Lavanda ×2, Vela Baunilha" */
  resumo: string;
};

/** Histórico de compras (inclui canceladas, para a usuária reconhecer a venda). */
export async function historicoComprasCliente(clienteId: number, pagina = 1, porPagina = POR_PAGINA_HISTORICO) {
  if (!idValido(clienteId)) return { itens: [] as CompraCliente[], total: 0, pagina: 1, totalPaginas: 1, porPagina };
  const contagem = await queryOne<{ total: number }>(`SELECT count(*) AS total FROM vendas WHERE cliente_id = $1`, [
    clienteId,
  ]);
  const total = contagem?.total ?? 0;
  const pag = limitarPagina(pagina, total, porPagina);
  if (total === 0) return { itens: [] as CompraCliente[], total, pagina: pag.pagina, totalPaginas: pag.totalPaginas, porPagina };
  const itens = await query<CompraCliente>(
    `SELECT v.id, v.data, v.total, v.desconto, v.forma_pagamento, v.canal, v.status,
       coalesce(it.unidades, 0) AS unidades, coalesce(it.resumo, '') AS resumo
     FROM vendas v
     LEFT JOIN LATERAL (
       SELECT sum(i.quantidade) AS unidades,
              string_agg(i.produto_nome || CASE WHEN i.quantidade > 1 THEN ' ×' || i.quantidade ELSE '' END,
                         ', ' ORDER BY i.id) AS resumo
       FROM itens_venda i WHERE i.venda_id = v.id
     ) it ON true
     WHERE v.cliente_id = $1
     ORDER BY v.data DESC, v.id DESC
     LIMIT $2 OFFSET $3`,
    [clienteId, porPagina, pag.offset],
  );
  return { itens, total, pagina: pag.pagina, totalPaginas: pag.totalPaginas, porPagina };
}

export type AromaFavorito = { aroma: string; unidades: number; valor: number; compras: number };

/** Aromas que o cliente mais leva (por unidades), considerando só vendas concluídas. */
export async function aromasFavoritosCliente(clienteId: number, limite = 5): Promise<AromaFavorito[]> {
  if (!idValido(clienteId)) return [];
  return query<AromaFavorito>(
    `SELECT coalesce(nullif(btrim(p.aroma), ''), 'Sem aroma') AS aroma,
       sum(i.quantidade) AS unidades, sum(i.subtotal) AS valor, count(DISTINCT v.id) AS compras
     FROM itens_venda i
     JOIN vendas v ON v.id = i.venda_id AND v.status = 'concluida'
     LEFT JOIN produtos p ON p.id = i.produto_id
     WHERE v.cliente_id = $1
     GROUP BY 1
     ORDER BY unidades DESC, valor DESC, aroma
     LIMIT $2`,
    [clienteId, limite],
  );
}

export type ProdutoFavorito = {
  produto_id: number;
  nome: string;
  aroma: string | null;
  unidades: number;
  valor: number;
  ultima_compra: Date;
  /** Situação atual do produto, para saber se dá para oferecer de novo. */
  ativo: boolean;
  estoque: number;
  estoque_minimo: number;
  preco: number | null;
};

export async function produtosFavoritosCliente(clienteId: number, limite = 5): Promise<ProdutoFavorito[]> {
  if (!idValido(clienteId)) return [];
  return query<ProdutoFavorito>(
    `SELECT i.produto_id,
       coalesce(p.nome, max(i.produto_nome)) AS nome, p.aroma,
       sum(i.quantidade) AS unidades, sum(i.subtotal) AS valor, max(v.data) AS ultima_compra,
       coalesce(p.ativo, false) AS ativo, coalesce(p.estoque, 0) AS estoque,
       coalesce(p.estoque_minimo, 0) AS estoque_minimo, p.preco
     FROM itens_venda i
     JOIN vendas v ON v.id = i.venda_id AND v.status = 'concluida'
     LEFT JOIN produtos p ON p.id = i.produto_id
     WHERE v.cliente_id = $1
     GROUP BY i.produto_id, p.id
     ORDER BY unidades DESC, ultima_compra DESC
     LIMIT $2`,
    [clienteId, limite],
  );
}

/** Outro cliente com o mesmo telefone (só dígitos), para avisar sobre cadastro repetido. */
export async function clienteComTelefone(
  telefone: string,
  ignorarId?: number,
): Promise<{ id: number; nome: string; ativo: boolean } | null> {
  const digitos = normalizarTelefone(telefone);
  if (digitos.length < 10) return null;
  return queryOne<{ id: number; nome: string; ativo: boolean }>(
    `SELECT id, nome, ativo FROM clientes
     WHERE telefone = $1 AND ($2::int IS NULL OR id <> $2)
     ORDER BY ativo DESC, id LIMIT 1`,
    [digitos, ignorarId ?? null],
  );
}
