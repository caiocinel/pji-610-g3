import "server-only";
import { query, queryOne } from "@/lib/db";
import {
  MOTIVOS_MOVIMENTACAO,
  SITUACOES_ESTOQUE,
  TIPOS_MOVIMENTACAO,
  type MotivoMovimentacao,
  type MovimentacaoEstoque,
  type SituacaoEstoque,
  type TipoMovimentacao,
} from "@/lib/dominio";
import { parsePeriodo, type Periodo } from "@/lib/periodo";

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

function lerParam(sp: Params, chave: string): string | undefined {
  if (sp instanceof URLSearchParams) return sp.get(chave) ?? undefined;
  const v = sp[chave];
  const s = Array.isArray(v) ? v[0] : v;
  return s?.trim() || undefined;
}

function inteiroPositivo(v: string | undefined): number | undefined {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

const SITUACAO_SQL = `CASE WHEN p.estoque <= 0 THEN 'esgotado' WHEN p.estoque <= p.estoque_minimo THEN 'baixo' ELSE 'ok' END`;

/* ---------------- Visão geral ---------------- */

export type ResumoEstoque = {
  produtos: number;
  unidades: number;
  valor_custo: number;
  valor_preco: number;
  esgotados: number;
  baixos: number;
  /** Unidades que entraram por produção/compra nos últimos 30 dias. */
  entradas_30d: number;
  /** Unidades perdidas (perda, avaria) nos últimos 30 dias e o valor a custo atual. */
  perdas_30d: number;
  perdas_30d_valor: number;
};

/** Totais do estoque (só produtos ativos). */
export async function resumoEstoque(): Promise<ResumoEstoque> {
  // Mesma janela de ?periodo=30d (dias civis em SP), para o card bater com a lista de "Ver detalhes".
  const trinta = parsePeriodo({ periodo: "30d" });
  const linha = await queryOne<ResumoEstoque>(
    `WITH tot AS (
       SELECT count(*)::int AS produtos,
              coalesce(sum(p.estoque), 0)::int AS unidades,
              coalesce(sum(p.estoque * p.custo), 0)::numeric(14,2) AS valor_custo,
              coalesce(sum(p.estoque * p.preco), 0)::numeric(14,2) AS valor_preco,
              count(*) FILTER (WHERE p.estoque <= 0)::int AS esgotados,
              count(*) FILTER (WHERE p.estoque > 0 AND p.estoque <= p.estoque_minimo)::int AS baixos
         FROM produtos p WHERE p.ativo
     ), mov AS (
       SELECT coalesce(sum(m.quantidade) FILTER (WHERE m.tipo = 'entrada' AND m.motivo IN ('producao','compra')), 0)::int AS entradas_30d,
              coalesce(sum(m.quantidade) FILTER (WHERE m.tipo = 'saida' AND m.motivo IN ('perda','avaria')), 0)::int AS perdas_30d,
              coalesce(sum(m.quantidade * p.custo) FILTER (WHERE m.tipo = 'saida' AND m.motivo IN ('perda','avaria')), 0)::numeric(14,2) AS perdas_30d_valor
         FROM movimentacoes_estoque m
         JOIN produtos p ON p.id = m.produto_id
        WHERE m.criado_em >= $1 AND m.criado_em < $2
     )
     SELECT * FROM tot, mov`,
    [trinta.inicio, trinta.fim],
  );
  return (
    linha ?? {
      produtos: 0,
      unidades: 0,
      valor_custo: 0,
      valor_preco: 0,
      esgotados: 0,
      baixos: 0,
      entradas_30d: 0,
      perdas_30d: 0,
      perdas_30d_valor: 0,
    }
  );
}

export const ORDENACOES_ESTOQUE = ["situacao", "nome", "menor", "maior", "valor"] as const;
export type OrdenacaoEstoque = (typeof ORDENACOES_ESTOQUE)[number];
export const ROTULO_ORDENACAO_ESTOQUE: Record<OrdenacaoEstoque, string> = {
  situacao: "Precisa de atenção primeiro",
  nome: "Nome (A–Z)",
  menor: "Menor estoque",
  maior: "Maior estoque",
  valor: "Maior valor parado",
};

/** "atencao" = baixo + esgotado. */
export type FiltroSituacao = SituacaoEstoque | "atencao";

export type FiltrosPosicao = {
  q: string;
  /** id da categoria, "sem" (sem categoria) ou "" (todas). */
  categoria: string;
  situacao: FiltroSituacao | "";
  ordenar: OrdenacaoEstoque;
  pagina: number;
};

export function lerFiltrosPosicao(sp: Params): FiltrosPosicao {
  // ?filtro=baixo é o link antigo (v1) do dashboard.
  const situacao = lerParam(sp, "situacao") ?? (lerParam(sp, "filtro") === "baixo" ? "atencao" : "");
  const ordenar = lerParam(sp, "ordenar") ?? "";
  const categoria = lerParam(sp, "categoria") ?? "";
  return {
    q: (lerParam(sp, "q") ?? "").slice(0, 100),
    categoria: categoria === "sem" || inteiroPositivo(categoria) ? categoria : "",
    situacao: ([...SITUACOES_ESTOQUE, "atencao"] as string[]).includes(situacao) ? (situacao as FiltroSituacao) : "",
    ordenar: (ORDENACOES_ESTOQUE as readonly string[]).includes(ordenar) ? (ordenar as OrdenacaoEstoque) : "situacao",
    pagina: inteiroPositivo(lerParam(sp, "pagina")) ?? 1,
  };
}

/** WHERE comum (sem a situação), para reaproveitar nas contagens por situação. */
function wherePosicao(f: Pick<FiltrosPosicao, "q" | "categoria">) {
  const conds = ["p.ativo"];
  const params: unknown[] = [];
  if (f.q) {
    params.push(f.q);
    conds.push(`(p.nome ILIKE '%' || $${params.length} || '%' OR p.aroma ILIKE '%' || $${params.length} || '%' OR p.sku ILIKE '%' || $${params.length} || '%')`);
  }
  if (f.categoria === "sem") conds.push("p.categoria_id IS NULL");
  else if (f.categoria) {
    params.push(Number(f.categoria));
    conds.push(`p.categoria_id = $${params.length}`);
  }
  return { conds, params };
}

function condSituacao(s: FiltrosPosicao["situacao"]): string | null {
  if (s === "atencao") return "p.estoque <= p.estoque_minimo";
  if (s) return `${SITUACAO_SQL} = '${s}'`; // valor já validado contra o enum
  return null;
}

// Todas terminam em p.id: sem desempate único, o OFFSET pode repetir/pular itens entre páginas.
const ORDEM_SQL: Record<OrdenacaoEstoque, string> = {
  situacao: `CASE WHEN p.estoque <= 0 THEN 0 WHEN p.estoque <= p.estoque_minimo THEN 1 ELSE 2 END, p.estoque - p.estoque_minimo, p.nome, p.aroma, p.id`,
  nome: "p.nome, p.aroma, p.id",
  menor: "p.estoque, p.nome, p.aroma, p.id",
  maior: "p.estoque DESC, p.nome, p.aroma, p.id",
  valor: "p.estoque * p.custo DESC, p.nome, p.aroma, p.id",
};

export type ItemPosicao = {
  id: number;
  nome: string;
  aroma: string;
  sku: string | null;
  categoria_nome: string | null;
  preco: number;
  custo: number;
  estoque: number;
  estoque_minimo: number;
  situacao: SituacaoEstoque;
  valor_custo: number;
  valor_preco: number;
  ultima_movimentacao: Date | null;
};

const SELECT_POSICAO = `
  SELECT p.id, p.nome, p.aroma, p.sku, c.nome AS categoria_nome, p.preco, p.custo, p.estoque, p.estoque_minimo,
         ${SITUACAO_SQL} AS situacao,
         (p.estoque * p.custo)::numeric(14,2) AS valor_custo,
         (p.estoque * p.preco)::numeric(14,2) AS valor_preco,
         (SELECT max(m.criado_em) FROM movimentacoes_estoque m WHERE m.produto_id = p.id) AS ultima_movimentacao
    FROM produtos p
    LEFT JOIN categorias c ON c.id = p.categoria_id`;

export const POR_PAGINA_POSICAO = 25;

export type ListaPosicao = {
  itens: ItemPosicao[];
  total: number;
  totalPaginas: number;
  porPagina: number;
  pagina: number;
  /** Quantos produtos em cada situação (respeitando busca e categoria). */
  contagem: Record<SituacaoEstoque | "todos", number>;
};

export async function listarPosicaoEstoque(f: FiltrosPosicao): Promise<ListaPosicao> {
  const { conds, params } = wherePosicao(f);
  const cs = condSituacao(f.situacao);
  const where = [...conds, ...(cs ? [cs] : [])].join(" AND ");

  const contagemP = queryOne<Record<SituacaoEstoque | "todos", number>>(
    `SELECT count(*)::int AS todos,
            count(*) FILTER (WHERE p.estoque <= 0)::int AS esgotado,
            count(*) FILTER (WHERE p.estoque > 0 AND p.estoque <= p.estoque_minimo)::int AS baixo,
            count(*) FILTER (WHERE p.estoque > p.estoque_minimo)::int AS ok
       FROM produtos p WHERE ${conds.join(" AND ")}`,
    params,
  );
  const totalP = queryOne<{ total: number }>(`SELECT count(*)::int AS total FROM produtos p WHERE ${where}`, params);
  const [contagem, totalLinha] = await Promise.all([contagemP, totalP]);
  const total = totalLinha?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA_POSICAO));
  const pagina = Math.min(f.pagina, totalPaginas);

  const itens = await query<ItemPosicao>(
    `${SELECT_POSICAO}
      WHERE ${where}
      ORDER BY ${ORDEM_SQL[f.ordenar]}
      LIMIT ${POR_PAGINA_POSICAO} OFFSET ${(pagina - 1) * POR_PAGINA_POSICAO}`,
    params,
  );
  return {
    itens,
    total,
    totalPaginas,
    porPagina: POR_PAGINA_POSICAO,
    pagina,
    contagem: contagem ?? { todos: 0, esgotado: 0, baixo: 0, ok: 0 },
  };
}

/** Posição completa (para CSV), com os mesmos filtros da tela. */
export async function posicaoEstoqueParaCSV(f: FiltrosPosicao): Promise<ItemPosicao[]> {
  const { conds, params } = wherePosicao(f);
  const cs = condSituacao(f.situacao);
  return query<ItemPosicao>(
    `${SELECT_POSICAO} WHERE ${[...conds, ...(cs ? [cs] : [])].join(" AND ")} ORDER BY ${ORDEM_SQL[f.ordenar]}`,
    params,
  );
}

/* ---------------- Opções para formulários ---------------- */

export type CategoriaOpcao = { id: number; nome: string; produtos: number };

/** Categorias com quantos produtos ativos têm (para filtros). */
export async function categoriasDoEstoque(): Promise<CategoriaOpcao[]> {
  return query<CategoriaOpcao>(
    `SELECT c.id, c.nome, count(p.id)::int AS produtos
       FROM categorias c
       LEFT JOIN produtos p ON p.categoria_id = c.id AND p.ativo
      GROUP BY c.id
      ORDER BY c.nome`,
  );
}

/** Produto resumido para os formulários de movimentação (serializável para o cliente). */
export type ProdutoMovimentavel = {
  id: number;
  nome: string;
  aroma: string;
  sku: string | null;
  categoria_id: number | null;
  categoria_nome: string | null;
  estoque: number;
  estoque_minimo: number;
};

/** Produtos ativos, em ordem de nome (entrada, saída, inventário e lote). */
export async function produtosMovimentaveis(): Promise<ProdutoMovimentavel[]> {
  return query<ProdutoMovimentavel>(
    `SELECT p.id, p.nome, p.aroma, p.sku, p.categoria_id, c.nome AS categoria_nome, p.estoque, p.estoque_minimo
       FROM produtos p
       LEFT JOIN categorias c ON c.id = p.categoria_id
      WHERE p.ativo
      ORDER BY p.nome, p.aroma`,
  );
}

/* ---------------- Histórico de movimentações ---------------- */

/** Filtros de motivo que agrupam vários motivos (usados pelos cards da visão geral). */
export const GRUPOS_MOTIVO = {
  /** Tudo que não é venda/cancelamento. */
  manuais: null,
  producao_compra: ["producao", "compra"],
  perdas: ["perda", "avaria"],
} as const satisfies Record<string, readonly MotivoMovimentacao[] | null>;
export type GrupoMotivo = keyof typeof GRUPOS_MOTIVO;
export const ROTULO_GRUPO_MOTIVO: Record<GrupoMotivo, string> = {
  manuais: "Tudo, menos vendas",
  producao_compra: "Produção e compra",
  perdas: "Perdas e avarias",
};

export type FiltrosMovimentacoes = {
  q: string;
  produto: number | undefined;
  tipo: TipoMovimentacao | "";
  /** Motivo específico ou um grupo (ver GRUPOS_MOTIVO). */
  motivo: MotivoMovimentacao | GrupoMotivo | "";
  /** null = todo o período. */
  periodo: Periodo | null;
  pagina: number;
};

export function lerFiltrosMovimentacoes(sp: Params): FiltrosMovimentacoes {
  const tipo = lerParam(sp, "tipo") ?? "";
  const motivo = lerParam(sp, "motivo") ?? "";
  const temPeriodo = !!(lerParam(sp, "periodo") || lerParam(sp, "de") || lerParam(sp, "ate"));
  return {
    q: (lerParam(sp, "q") ?? "").slice(0, 100),
    produto: inteiroPositivo(lerParam(sp, "produto")),
    tipo: (TIPOS_MOVIMENTACAO as readonly string[]).includes(tipo) ? (tipo as TipoMovimentacao) : "",
    motivo:
      Object.hasOwn(GRUPOS_MOTIVO, motivo) || (MOTIVOS_MOVIMENTACAO as readonly string[]).includes(motivo)
        ? (motivo as FiltrosMovimentacoes["motivo"])
        : "",
    periodo: temPeriodo ? parsePeriodo(sp) : null,
    pagina: inteiroPositivo(lerParam(sp, "pagina")) ?? 1,
  };
}

function whereMovimentacoes(f: FiltrosMovimentacoes) {
  const conds: string[] = [];
  const params: unknown[] = [];
  const add = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };
  if (f.q) {
    const p = add(f.q);
    conds.push(`(p.nome ILIKE '%' || ${p} || '%' OR p.aroma ILIKE '%' || ${p} || '%' OR m.observacao ILIKE '%' || ${p} || '%')`);
  }
  if (f.produto) conds.push(`m.produto_id = ${add(f.produto)}`);
  if (f.tipo) conds.push(`m.tipo = ${add(f.tipo)}`);
  if (f.motivo === "manuais") conds.push(`m.motivo IS DISTINCT FROM 'venda' AND m.motivo IS DISTINCT FROM 'cancelamento_venda'`);
  else if (f.motivo === "producao_compra" || f.motivo === "perdas") conds.push(`m.motivo = ANY(${add(GRUPOS_MOTIVO[f.motivo])}::text[])`);
  else if (f.motivo) conds.push(`m.motivo = ${add(f.motivo)}`);
  if (f.periodo) {
    conds.push(`m.criado_em >= ${add(f.periodo.inicio)}`);
    conds.push(`m.criado_em < ${add(f.periodo.fim)}`);
  }
  return { where: conds.length ? `WHERE ${conds.join(" AND ")}` : "", params };
}

export type LinhaMovimentacao = MovimentacaoEstoque & {
  produto_nome: string;
  produto_aroma: string;
  produto_ativo: boolean;
};

const SELECT_MOV = `
  SELECT m.id, m.produto_id, m.tipo, m.quantidade, m.motivo, m.saldo_apos, m.observacao, m.venda_id, m.criado_em,
         p.nome AS produto_nome, p.aroma AS produto_aroma, p.ativo AS produto_ativo
    FROM movimentacoes_estoque m
    JOIN produtos p ON p.id = m.produto_id`;

export const POR_PAGINA_MOV = 30;

export type ListaMovimentacoes = {
  itens: LinhaMovimentacao[];
  total: number;
  totalPaginas: number;
  porPagina: number;
  pagina: number;
  entradas: number;
  saidas: number;
};

export async function listarMovimentacoes(f: FiltrosMovimentacoes): Promise<ListaMovimentacoes> {
  const { where, params } = whereMovimentacoes(f);
  const tot = await queryOne<{ total: number; entradas: number; saidas: number }>(
    `SELECT count(*)::int AS total,
            coalesce(sum(m.quantidade) FILTER (WHERE m.tipo = 'entrada'), 0)::int AS entradas,
            coalesce(sum(m.quantidade) FILTER (WHERE m.tipo = 'saida'), 0)::int AS saidas
       FROM movimentacoes_estoque m JOIN produtos p ON p.id = m.produto_id ${where}`,
    params,
  );
  const total = tot?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA_MOV));
  const pagina = Math.min(f.pagina, totalPaginas);
  const itens = await query<LinhaMovimentacao>(
    `${SELECT_MOV} ${where} ORDER BY m.criado_em DESC, m.id DESC LIMIT ${POR_PAGINA_MOV} OFFSET ${(pagina - 1) * POR_PAGINA_MOV}`,
    params,
  );
  return {
    itens,
    total,
    totalPaginas,
    porPagina: POR_PAGINA_MOV,
    pagina,
    entradas: tot?.entradas ?? 0,
    saidas: tot?.saidas ?? 0,
  };
}

/** Limite de segurança do CSV de movimentações. */
const LIMITE_CSV = 50_000;

export async function movimentacoesParaCSV(f: FiltrosMovimentacoes): Promise<LinhaMovimentacao[]> {
  const { where, params } = whereMovimentacoes(f);
  return query<LinhaMovimentacao>(`${SELECT_MOV} ${where} ORDER BY m.criado_em DESC, m.id DESC LIMIT ${LIMITE_CSV}`, params);
}

/** Últimas movimentações (todas as origens) para o painel lateral da visão geral. */
export async function ultimasMovimentacoes(limite = 8): Promise<LinhaMovimentacao[]> {
  return query<LinhaMovimentacao>(`${SELECT_MOV} ORDER BY m.criado_em DESC, m.id DESC LIMIT $1`, [limite]);
}

/** Nome do produto para mostrar no chip de filtro (inclui desativados). */
export async function nomeProduto(id: number): Promise<string | null> {
  const r = await queryOne<{ nome: string; aroma: string }>(`SELECT nome, aroma FROM produtos WHERE id = $1`, [id]);
  return r ? `${r.nome} — ${r.aroma}` : null;
}

/** Produtos que já tiveram movimentação (para o filtro do histórico; inclui desativados). */
export async function produtosComMovimentacao(): Promise<{ id: number; nome: string; aroma: string; ativo: boolean }[]> {
  return query(
    `SELECT p.id, p.nome, p.aroma, p.ativo
       FROM produtos p
      WHERE EXISTS (SELECT 1 FROM movimentacoes_estoque m WHERE m.produto_id = p.id)
      ORDER BY p.ativo DESC, p.nome, p.aroma`,
  );
}
