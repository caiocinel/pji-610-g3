import "server-only";
import { cache } from "react";
import { query, queryOne } from "@/lib/db";
import type { Categoria, MovimentacaoEstoque, Produto, SituacaoEstoque, StatusVenda } from "@/lib/dominio";
import { SITUACOES_ESTOQUE } from "@/lib/dominio";
import { hojeSP, parsePeriodo } from "@/lib/periodo";

// ---------- Listagem ----------

export const ORDENACOES_PRODUTO = ["nome", "preco", "preco_desc", "estoque", "vendidos", "margem", "recentes"] as const;
export type OrdenacaoProduto = (typeof ORDENACOES_PRODUTO)[number];
export const ROTULO_ORDENACAO_PRODUTO: Record<OrdenacaoProduto, string> = {
  nome: "Nome (A–Z)",
  preco: "Menor preço",
  preco_desc: "Maior preço",
  estoque: "Menor estoque",
  vendidos: "Mais vendidos",
  margem: "Maior margem",
  recentes: "Cadastro mais recente",
};

const ORDER_BY: Record<OrdenacaoProduto, string> = {
  nome: "lower(p.nome), p.id",
  // Toda ordenação termina em p.id: sem desempate único, o OFFSET pode repetir/pular itens entre páginas.
  preco: "p.preco, lower(p.nome), p.id",
  preco_desc: "p.preco DESC, lower(p.nome), p.id",
  estoque: "p.estoque, lower(p.nome), p.id",
  vendidos: "vendidos DESC, lower(p.nome), p.id",
  margem: "(CASE WHEN p.preco > 0 THEN (p.preco - p.custo) / p.preco END) DESC NULLS LAST, lower(p.nome), p.id",
  recentes: "p.criado_em DESC, p.id DESC",
};

export type StatusProduto = "ativos" | "inativos";

export type FiltrosProdutos = {
  q?: string;
  /** "" = todas, "sem" = sem categoria, ou id numérico em texto. */
  categoria?: string;
  situacao?: SituacaoEstoque | "";
  status?: StatusProduto;
  ordenar?: OrdenacaoProduto;
  pagina?: number;
  porPagina?: number;
};

export type ProdutoLista = Produto & {
  categoria_nome: string | null;
  /** Unidades vendidas (só vendas concluídas). */
  vendidos: number;
};

export type ContagemProdutos = {
  /** Produtos do status pedido (ativos ou desativados) que casam com busca/categoria. */
  total: number;
  esgotado: number;
  baixo: number;
  ok: number;
  ativos: number;
  inativos: number;
};

export function lerOrdenacao(v: string | undefined): OrdenacaoProduto {
  return (ORDENACOES_PRODUTO as readonly string[]).includes(v ?? "") ? (v as OrdenacaoProduto) : "nome";
}

export function lerSituacao(v: string | undefined): SituacaoEstoque | "" {
  return (SITUACOES_ESTOQUE as readonly string[]).includes(v ?? "") ? (v as SituacaoEstoque) : "";
}

/** Monta o WHERE de busca + categoria (comum à listagem e às contagens). */
function filtroBase(f: FiltrosProdutos, params: unknown[]): string[] {
  const where: string[] = [];
  const q = f.q?.trim();
  if (q) {
    params.push(q);
    const i = params.length;
    where.push(`(p.nome ILIKE '%' || $${i} || '%' OR p.aroma ILIKE '%' || $${i} || '%' OR p.sku ILIKE '%' || $${i} || '%')`);
  }
  if (f.categoria === "sem") where.push("p.categoria_id IS NULL");
  else if (f.categoria && /^\d+$/.test(f.categoria)) {
    params.push(Number(f.categoria));
    where.push(`p.categoria_id = $${params.length}`);
  }
  return where;
}

const SQL_SITUACAO = `CASE WHEN p.estoque <= 0 THEN 'esgotado' WHEN p.estoque <= p.estoque_minimo THEN 'baixo' ELSE 'ok' END`;

export async function contarProdutos(f: FiltrosProdutos): Promise<ContagemProdutos> {
  const params: unknown[] = [];
  const where = filtroBase(f, params);
  params.push(f.status !== "inativos");
  const ativo = `p.ativo = $${params.length}`;
  const linha = await queryOne<ContagemProdutos>(
    `SELECT count(*) FILTER (WHERE ${ativo})::int AS total,
            count(*) FILTER (WHERE ${ativo} AND ${SQL_SITUACAO} = 'esgotado')::int AS esgotado,
            count(*) FILTER (WHERE ${ativo} AND ${SQL_SITUACAO} = 'baixo')::int AS baixo,
            count(*) FILTER (WHERE ${ativo} AND ${SQL_SITUACAO} = 'ok')::int AS ok,
            count(*) FILTER (WHERE p.ativo)::int AS ativos,
            count(*) FILTER (WHERE NOT p.ativo)::int AS inativos
       FROM produtos p
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`,
    params,
  );
  return linha ?? { total: 0, esgotado: 0, baixo: 0, ok: 0, ativos: 0, inativos: 0 };
}

export async function listarProdutos(f: FiltrosProdutos & { offset: number; limite: number }): Promise<ProdutoLista[]> {
  const params: unknown[] = [];
  const where = filtroBase(f, params);
  params.push(f.status !== "inativos");
  where.push(`p.ativo = $${params.length}`);
  if (f.situacao) {
    params.push(f.situacao);
    where.push(`${SQL_SITUACAO} = $${params.length}`);
  }
  params.push(f.limite, f.offset);
  return query<ProdutoLista>(
    `WITH vendidos AS (
       SELECT i.produto_id, sum(i.quantidade)::int AS vendidos
         FROM itens_venda i
         JOIN vendas v ON v.id = i.venda_id AND v.status = 'concluida'
        GROUP BY i.produto_id
     )
     SELECT p.*, c.nome AS categoria_nome, coalesce(vd.vendidos, 0)::int AS vendidos
       FROM produtos p
       LEFT JOIN categorias c ON c.id = p.categoria_id
       LEFT JOIN vendidos vd ON vd.produto_id = p.id
      WHERE ${where.join(" AND ")}
      ORDER BY ${ORDER_BY[f.ordenar ?? "nome"]}
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
}

/** Contagem + página da listagem, com a página limitada ao intervalo válido. */
export async function paginaProdutos(f: FiltrosProdutos) {
  const porPagina = f.porPagina ?? 20;
  const contagem = await contarProdutos(f);
  const total = f.situacao ? contagem[f.situacao] : contagem.total;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const pagina = Math.min(Math.max(1, f.pagina ?? 1), totalPaginas);
  const itens = total ? await listarProdutos({ ...f, offset: (pagina - 1) * porPagina, limite: porPagina }) : [];
  return { itens, contagem, total, totalPaginas, pagina, porPagina };
}

// ---------- Detalhe ----------

export type ProdutoDetalhe = Produto & { categoria_nome: string | null };

/** Produto com o nome da categoria (memorizado por requisição: página + metadata). */
export const buscarProduto = cache(async (id: number): Promise<ProdutoDetalhe | null> => {
  if (!Number.isInteger(id) || id <= 0 || id > 2_147_483_647) return null;
  return queryOne<ProdutoDetalhe>(
    `SELECT p.*, c.nome AS categoria_nome
       FROM produtos p LEFT JOIN categorias c ON c.id = p.categoria_id
      WHERE p.id = $1`,
    [id],
  );
});

export type IndicadoresProduto = {
  unidades: number;
  /** Receita líquida de descontos (desconto da venda rateado entre os itens). */
  receita: number;
  /**
   * Receita − custo, só dos itens com custo informado (custo_unitario > 0, copiado na venda).
   * null quando nenhum item vendido tem custo.
   */
  lucro: number | null;
  /** Receita dos itens vendidos sem custo informado (fora do lucro). */
  receita_sem_custo: number;
  /** Receita dos itens com custo informado (base da margem real). */
  receita_com_custo: number;
  vendas: number;
  ultima_venda: Date | null;
  unidades_30d: number;
};

export async function indicadoresProduto(id: number): Promise<IndicadoresProduto> {
  // "30 dias" = mesmos dias civis em SP de parsePeriodo("30d") (relatórios, vendas).
  const trinta = parsePeriodo({ periodo: "30d" });
  const linha = await queryOne<IndicadoresProduto>(
    `SELECT coalesce(sum(i.quantidade), 0)::int AS unidades,
            coalesce(sum(i.subtotal * v.total / nullif(v.subtotal, 0)), 0)::float8 AS receita,
            (sum(i.subtotal * v.total / nullif(v.subtotal, 0) - i.custo_unitario * i.quantidade)
               FILTER (WHERE i.custo_unitario > 0))::float8 AS lucro,
            coalesce(sum(i.subtotal * v.total / nullif(v.subtotal, 0)) FILTER (WHERE i.custo_unitario > 0), 0)::float8 AS receita_com_custo,
            coalesce(sum(i.subtotal * v.total / nullif(v.subtotal, 0)) FILTER (WHERE i.custo_unitario <= 0), 0)::float8 AS receita_sem_custo,
            count(DISTINCT v.id)::int AS vendas,
            max(v.data) AS ultima_venda,
            coalesce(sum(i.quantidade) FILTER (WHERE v.data >= $2 AND v.data < $3), 0)::int AS unidades_30d
       FROM itens_venda i
       JOIN vendas v ON v.id = i.venda_id AND v.status = 'concluida'
      WHERE i.produto_id = $1`,
    [id, trinta.inicio, trinta.fim],
  );
  const r = linha ?? {
    unidades: 0, receita: 0, lucro: null, receita_com_custo: 0, receita_sem_custo: 0, vendas: 0, ultima_venda: null, unidades_30d: 0,
  };
  const centavos = (x: number) => Math.round(x * 100) / 100;
  return {
    ...r,
    receita: centavos(r.receita),
    lucro: r.lucro == null ? null : centavos(r.lucro),
    receita_com_custo: centavos(r.receita_com_custo),
    receita_sem_custo: centavos(r.receita_sem_custo),
  };
}

export type VendasMes = { mes: string; rotulo: string; unidades: number };

const rotuloMes = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" });

/** Unidades vendidas por mês (fuso de SP), dos últimos `meses` meses incluindo o atual. */
export async function vendasPorMes(id: number, meses = 6): Promise<VendasMes[]> {
  const [ano, mes] = hojeSP().split("-").map(Number);
  const lista: { mes: string; data: Date }[] = [];
  for (let k = meses - 1; k >= 0; k--) {
    const d = new Date(Date.UTC(ano, mes - 1 - k, 15));
    lista.push({ mes: d.toISOString().slice(0, 7), data: d });
  }
  const rows = await query<{ mes: string; unidades: number }>(
    `SELECT to_char(v.data AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') AS mes, sum(i.quantidade)::int AS unidades
       FROM itens_venda i
       JOIN vendas v ON v.id = i.venda_id AND v.status = 'concluida'
      WHERE i.produto_id = $1
        AND v.data >= ($2::date)::timestamp AT TIME ZONE 'America/Sao_Paulo'
      GROUP BY 1`,
    [id, `${lista[0].mes}-01`],
  );
  const mapa = new Map(rows.map((r) => [r.mes, r.unidades]));
  return lista.map((m) => ({
    mes: m.mes,
    rotulo: rotuloMes.format(m.data).replace(".", ""),
    unidades: mapa.get(m.mes) ?? 0,
  }));
}

export async function movimentacoesProduto(
  id: number,
  limite = 15,
): Promise<{ itens: MovimentacaoEstoque[]; total: number }> {
  const [itens, total] = await Promise.all([
    query<MovimentacaoEstoque>(
      `SELECT * FROM movimentacoes_estoque WHERE produto_id = $1 ORDER BY criado_em DESC, id DESC LIMIT $2`,
      [id, limite],
    ),
    queryOne<{ n: number }>(`SELECT count(*)::int AS n FROM movimentacoes_estoque WHERE produto_id = $1`, [id]),
  ]);
  return { itens, total: total?.n ?? 0 };
}

export type VendaDoProduto = {
  venda_id: number;
  data: Date;
  status: StatusVenda;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  cliente_nome: string | null;
};

/** Últimas vendas que incluíram o produto (inclui canceladas, para o histórico). */
export async function vendasRecentesProduto(id: number, limite = 6): Promise<VendaDoProduto[]> {
  return query<VendaDoProduto>(
    `SELECT v.id AS venda_id, v.data, v.status, sum(i.quantidade)::int AS quantidade,
            max(i.preco_unitario) AS preco_unitario, sum(i.subtotal) AS subtotal, cl.nome AS cliente_nome
       FROM itens_venda i
       JOIN vendas v ON v.id = i.venda_id
       LEFT JOIN clientes cl ON cl.id = v.cliente_id
      WHERE i.produto_id = $1
      GROUP BY v.id, cl.nome
      ORDER BY v.data DESC, v.id DESC
      LIMIT $2`,
    [id, limite],
  );
}

// ---------- Categorias ----------

/** Para selects (ordem alfabética). */
export async function listarCategorias(): Promise<Pick<Categoria, "id" | "nome">[]> {
  return query<Pick<Categoria, "id" | "nome">>(`SELECT id, nome FROM categorias ORDER BY lower(nome)`);
}

export type CategoriaResumo = Categoria & {
  ativos: number;
  inativos: number;
  /** Unidades em estoque dos produtos ativos. */
  unidades: number;
  /** Unidades vendidas nos últimos 30 dias (vendas concluídas). */
  vendidos_30d: number;
};

export async function resumoCategorias(): Promise<{ categorias: CategoriaResumo[]; semCategoria: number }> {
  const trinta = parsePeriodo({ periodo: "30d" });
  const [categorias, sem] = await Promise.all([
    query<CategoriaResumo>(
      `WITH vendidos AS (
         SELECT p.categoria_id, sum(i.quantidade)::int AS n
           FROM itens_venda i
           JOIN vendas v ON v.id = i.venda_id AND v.status = 'concluida' AND v.data >= $1 AND v.data < $2
           JOIN produtos p ON p.id = i.produto_id
          GROUP BY p.categoria_id
       )
       SELECT c.*,
              count(p.id) FILTER (WHERE p.ativo)::int AS ativos,
              count(p.id) FILTER (WHERE NOT p.ativo)::int AS inativos,
              coalesce(sum(p.estoque) FILTER (WHERE p.ativo), 0)::int AS unidades,
              coalesce(max(vd.n), 0)::int AS vendidos_30d
         FROM categorias c
         LEFT JOIN produtos p ON p.categoria_id = c.id
         LEFT JOIN vendidos vd ON vd.categoria_id = c.id
        GROUP BY c.id
        ORDER BY lower(c.nome)`,
      [trinta.inicio, trinta.fim],
    ),
    queryOne<{ n: number }>(`SELECT count(*)::int AS n FROM produtos WHERE categoria_id IS NULL AND ativo`),
  ]);
  return { categorias, semCategoria: sem?.n ?? 0 };
}
