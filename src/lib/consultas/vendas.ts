import "server-only";
import { cache } from "react";
import { query, queryOne } from "@/lib/db";
import {
  CANAIS,
  FORMAS_PAGAMENTO,
  STATUS_VENDA,
  type Canal,
  type FormaPagamento,
  type ItemVenda,
  type StatusVenda,
  type Venda,
} from "@/lib/dominio";
import { parsePeriodo, type Periodo, type SearchParamsLike } from "@/lib/periodo";

// Consultas de leitura do histórico de vendas (lista, totais, detalhe, recibo e CSV).
// Vendas canceladas aparecem nas listas (com selo), mas NUNCA entram nos totais.

export const VENDAS_POR_PAGINA = 25;
const LIMITE_CSV = 20000;

export type FiltrosVendas = {
  periodo: Periodo;
  /** Texto livre: nº da venda ("123" ou "#123"), nome do cliente, vela ou observação. */
  q: string;
  /** Quando `q` é um nº de venda, a busca ignora o período (a venda pode ser antiga). */
  numero: number | null;
  cliente: number | null;
  forma: FormaPagamento | null;
  canal: Canal | null;
  status: StatusVenda | null;
};

function lerParam(sp: SearchParamsLike, chave: string): string {
  if (!sp) return "";
  const v = sp instanceof URLSearchParams ? sp.get(chave) : sp[chave];
  return ((Array.isArray(v) ? v[0] : v) ?? "").trim();
}

function enumOuNull<T extends string>(valores: readonly T[], v: string): T | null {
  return (valores as readonly string[]).includes(v) ? (v as T) : null;
}

/** Lê os filtros do histórico a partir dos searchParams (página e Route Handler do CSV). */
export function lerFiltrosVendas(sp: SearchParamsLike): FiltrosVendas {
  const q = lerParam(sp, "q").slice(0, 100);
  const numeroTexto = q.replace(/^(n[º°o]?\s*|#)/i, "").trim();
  const numero = /^\d{1,9}$/.test(numeroTexto) ? Number(numeroTexto) : null;
  const cliente = Number(lerParam(sp, "cliente"));
  return {
    periodo: parsePeriodo(sp, { padrao: "30d" }),
    q,
    numero,
    cliente: Number.isInteger(cliente) && cliente > 0 ? cliente : null,
    forma: enumOuNull(FORMAS_PAGAMENTO, lerParam(sp, "forma")),
    canal: enumOuNull(CANAIS, lerParam(sp, "canal")),
    status: enumOuNull(STATUS_VENDA, lerParam(sp, "status")),
  };
}

/** Monta o WHERE (sem a palavra) e os parâmetros. Espera `v` = vendas e `c` = clientes no FROM. */
function montarWhere(f: FiltrosVendas): { where: string; params: unknown[] } {
  const cond: string[] = [];
  const params: unknown[] = [];
  const p = (valor: unknown) => {
    params.push(valor);
    return `$${params.length}`;
  };

  if (f.numero !== null) {
    cond.push(`v.id = ${p(f.numero)}`);
  } else {
    cond.push(`v.data >= ${p(f.periodo.inicio)}`, `v.data < ${p(f.periodo.fim)}`);
    if (f.q) {
      const termo = p(f.q);
      cond.push(`(
        c.nome ILIKE '%' || ${termo} || '%'
        OR v.observacao ILIKE '%' || ${termo} || '%'
        OR EXISTS (
          SELECT 1 FROM itens_venda iq
          LEFT JOIN produtos pq ON pq.id = iq.produto_id
          LEFT JOIN categorias cq ON cq.id = pq.categoria_id
          WHERE iq.venda_id = v.id
            AND (iq.produto_nome ILIKE '%' || ${termo} || '%'
              OR pq.aroma ILIKE '%' || ${termo} || '%'
              OR pq.sku ILIKE '%' || ${termo} || '%'
              OR cq.nome ILIKE '%' || ${termo} || '%')
        )
      )`);
    }
  }
  if (f.cliente) cond.push(`v.cliente_id = ${p(f.cliente)}`);
  if (f.forma) cond.push(`v.forma_pagamento = ${p(f.forma)}`);
  if (f.canal) cond.push(`v.canal = ${p(f.canal)}`);
  if (f.status) cond.push(`v.status = ${p(f.status)}`);
  return { where: cond.join(" AND "), params };
}

// Agregado dos itens por venda (unidades, custo e nomes) — usado na lista e no CSV.
const LATERAL_ITENS = `
  LEFT JOIN LATERAL (
    SELECT sum(i.quantidade)::int AS unidades,
           coalesce(sum(i.custo_unitario * i.quantidade), 0)::numeric(12,2) AS custo,
           count(*)::int AS n_itens,
           -- Itens sem custo informado (custo_unitario = 0): ficam fora do lucro do resumo.
           coalesce(sum(i.subtotal) FILTER (WHERE i.custo_unitario <= 0), 0)::numeric(12,2) AS subtotal_sem_custo,
           string_agg(i.produto_nome || CASE WHEN i.quantidade > 1 THEN ' (' || i.quantidade || ')' ELSE '' END, ', ' ORDER BY i.id) AS produtos
    FROM itens_venda i
    WHERE i.venda_id = v.id
  ) it ON true`;

export type VendaLista = Venda & {
  cliente_nome: string | null;
  unidades: number;
  n_itens: number;
  /** "Vela Lavanda (2), Vela Baunilha" */
  produtos: string;
  custo: number;
  /** total − custo (zero para canceladas não é calculado: use status). */
  lucro: number;
};

const SELECT_VENDA_LISTA = `
  SELECT v.id, v.data, v.cliente_id, v.forma_pagamento, v.canal, v.subtotal, v.desconto, v.total,
         v.valor_recebido, v.observacao, v.status, v.cancelada_em, v.motivo_cancelamento,
         c.nome AS cliente_nome,
         coalesce(it.unidades, 0) AS unidades,
         coalesce(it.n_itens, 0) AS n_itens,
         coalesce(it.produtos, '') AS produtos,
         coalesce(it.custo, 0) AS custo,
         (v.total - coalesce(it.custo, 0))::numeric(12,2) AS lucro
  FROM vendas v
  LEFT JOIN clientes c ON c.id = v.cliente_id
  ${LATERAL_ITENS}`;

/** Parte do total da venda (desconto rateado) que vem de itens sem custo informado. */
const RECEITA_SEM_CUSTO = `coalesce(it.subtotal_sem_custo * v.total / nullif(v.subtotal, 0), 0)`;

export type ResumoVendas = {
  /** Registros que batem com o filtro (inclui canceladas): base da paginação. */
  registros: number;
  /** Só concluídas daqui para baixo. */
  vendas: number;
  faturamento: number;
  descontos: number;
  custo: number;
  /** Lucro só dos itens com custo informado; null quando nenhum item do filtro tem custo. */
  lucro: number | null;
  /** Faturamento (já com desconto rateado) de itens sem custo informado: fica fora do lucro. */
  receitaSemCusto: number;
  unidades: number;
  ticketMedio: number;
  /** margem = lucro / faturamento (fração) ou null. */
  margem: number | null;
  canceladas: number;
  valorCancelado: number;
};

export type TotalPorForma = { forma_pagamento: FormaPagamento; vendas: number; total: number };

export type ResultadoListaVendas = {
  itens: VendaLista[];
  resumo: ResumoVendas;
  porForma: TotalPorForma[];
  pagina: number;
  porPagina: number;
  totalPaginas: number;
};

export async function listarVendas(f: FiltrosVendas, pagina = 1, porPagina = VENDAS_POR_PAGINA): Promise<ResultadoListaVendas> {
  const { where, params } = montarWhere(f);

  const [resumoLinha, porForma] = await Promise.all([
    queryOne<Omit<ResumoVendas, "ticketMedio" | "margem">>(
      `SELECT count(*)::int AS registros,
              count(*) FILTER (WHERE v.status = 'concluida')::int AS vendas,
              coalesce(sum(v.total) FILTER (WHERE v.status = 'concluida'), 0) AS faturamento,
              coalesce(sum(v.desconto) FILTER (WHERE v.status = 'concluida'), 0) AS descontos,
              coalesce(sum(it.custo) FILTER (WHERE v.status = 'concluida'), 0) AS custo,
              coalesce(sum(${RECEITA_SEM_CUSTO}) FILTER (WHERE v.status = 'concluida'), 0)::float8 AS "receitaSemCusto",
              (sum(v.total - ${RECEITA_SEM_CUSTO} - coalesce(it.custo, 0))
                 FILTER (WHERE v.status = 'concluida' AND coalesce(it.custo, 0) > 0))::float8 AS lucro,
              coalesce(sum(it.unidades) FILTER (WHERE v.status = 'concluida'), 0)::int AS unidades,
              count(*) FILTER (WHERE v.status = 'cancelada')::int AS canceladas,
              coalesce(sum(v.total) FILTER (WHERE v.status = 'cancelada'), 0) AS "valorCancelado"
       FROM vendas v
       LEFT JOIN clientes c ON c.id = v.cliente_id
       ${LATERAL_ITENS}
       WHERE ${where}`,
      params,
    ),
    query<TotalPorForma>(
      `SELECT v.forma_pagamento, count(*)::int AS vendas, sum(v.total) AS total
       FROM vendas v
       LEFT JOIN clientes c ON c.id = v.cliente_id
       WHERE ${where} AND v.status = 'concluida'
       GROUP BY v.forma_pagamento
       ORDER BY sum(v.total) DESC`,
      params,
    ),
  ]);

  const r = resumoLinha ?? {
    registros: 0, vendas: 0, faturamento: 0, descontos: 0, custo: 0, lucro: null, receitaSemCusto: 0, unidades: 0, canceladas: 0, valorCancelado: 0,
  };
  const totalPaginas = Math.max(1, Math.ceil(r.registros / porPagina));
  const paginaReal = Math.min(Math.max(1, pagina), totalPaginas);

  const itens = await query<VendaLista>(
    `${SELECT_VENDA_LISTA}
     WHERE ${where}
     ORDER BY v.data DESC, v.id DESC
     LIMIT ${porPagina} OFFSET ${(paginaReal - 1) * porPagina}`,
    params,
  );

  return {
    itens,
    porForma,
    pagina: paginaReal,
    porPagina,
    totalPaginas,
    resumo: {
      ...r,
      lucro: r.lucro == null ? null : Math.round(r.lucro * 100) / 100,
      receitaSemCusto: Math.round(r.receitaSemCusto * 100) / 100,
      ticketMedio: r.vendas ? Math.round((r.faturamento / r.vendas) * 100) / 100 : 0,
      margem: r.lucro != null && r.faturamento - r.receitaSemCusto > 0 ? r.lucro / (r.faturamento - r.receitaSemCusto) : null,
    },
  };
}

/** Todas as vendas do filtro (sem paginação) para o CSV. */
export async function listarVendasParaCSV(f: FiltrosVendas): Promise<VendaLista[]> {
  const { where, params } = montarWhere(f);
  return query<VendaLista>(
    `${SELECT_VENDA_LISTA}
     WHERE ${where}
     ORDER BY v.data DESC, v.id DESC
     LIMIT ${LIMITE_CSV}`,
    params,
  );
}

export type ItemVendaCSV = {
  venda_id: number;
  data: Date;
  status: StatusVenda;
  cliente_nome: string | null;
  forma_pagamento: FormaPagamento;
  canal: Canal;
  produto_id: number;
  produto_nome: string;
  aroma: string | null;
  categoria: string | null;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  custo_unitario: number;
  custo_total: number;
  lucro: number;
};

/** Uma linha por item vendido (para análise em planilha). */
export async function listarItensParaCSV(f: FiltrosVendas): Promise<ItemVendaCSV[]> {
  const { where, params } = montarWhere(f);
  return query<ItemVendaCSV>(
    `SELECT v.id AS venda_id, v.data, v.status, c.nome AS cliente_nome, v.forma_pagamento, v.canal,
            i.produto_id, i.produto_nome, p.aroma, cat.nome AS categoria,
            i.quantidade, i.preco_unitario, i.subtotal, i.custo_unitario,
            (i.custo_unitario * i.quantidade)::numeric(12,2) AS custo_total,
            (i.subtotal - i.custo_unitario * i.quantidade)::numeric(12,2) AS lucro
     FROM vendas v
     JOIN itens_venda i ON i.venda_id = v.id
     LEFT JOIN clientes c ON c.id = v.cliente_id
     LEFT JOIN produtos p ON p.id = i.produto_id
     LEFT JOIN categorias cat ON cat.id = p.categoria_id
     WHERE ${where}
     ORDER BY v.data DESC, v.id DESC, i.id
     LIMIT ${LIMITE_CSV}`,
    params,
  );
}

/** Clientes para o filtro: ativos + os que já compraram (mesmo desativados). */
export async function listarClientesFiltro(): Promise<{ id: number; nome: string; ativo: boolean }[]> {
  return query(
    `SELECT c.id, c.nome, c.ativo
     FROM clientes c
     WHERE c.ativo OR EXISTS (SELECT 1 FROM vendas v WHERE v.cliente_id = c.id)
     ORDER BY lower(c.nome)`,
  );
}

/* ---------- Detalhe e recibo ---------- */

export type ItemVendaDetalhe = ItemVenda & {
  aroma: string | null;
  produto_ativo: boolean | null;
  /** quantidade × custo_unitario */
  custo_total: number;
  lucro: number;
};

export type ClienteVenda = {
  id: number;
  nome: string;
  telefone: string;
  email: string;
  instagram: string;
  ativo: boolean;
  /** Compras concluídas do cliente (todas). */
  compras: number;
};

export type VendaDetalhe = Venda & {
  cliente: ClienteVenda | null;
  itens: ItemVendaDetalhe[];
  unidades: number;
  custo: number;
  lucro: number;
  /** lucro / total (fração) ou null. */
  margem: number | null;
  troco: number | null;
  /** Nº das vendas vizinhas (mais antiga / mais nova) para navegar. */
  anterior: number | null;
  proxima: number | null;
};

export const obterVenda = cache(async (id: number): Promise<VendaDetalhe | null> => {
  if (!Number.isInteger(id) || id <= 0 || id > 2147483647) return null;

  const venda = await queryOne<
    Venda & {
      c_id: number | null;
      c_nome: string | null;
      c_telefone: string | null;
      c_email: string | null;
      c_instagram: string | null;
      c_ativo: boolean | null;
      c_compras: number | null;
      anterior: number | null;
      proxima: number | null;
    }
  >(
    `SELECT v.id, v.data, v.cliente_id, v.forma_pagamento, v.canal, v.subtotal, v.desconto, v.total,
            v.valor_recebido, v.observacao, v.status, v.cancelada_em, v.motivo_cancelamento,
            c.id AS c_id, c.nome AS c_nome, c.telefone AS c_telefone, c.email AS c_email,
            c.instagram AS c_instagram, c.ativo AS c_ativo,
            (SELECT count(*)::int FROM vendas vc WHERE vc.cliente_id = c.id AND vc.status = 'concluida') AS c_compras,
            (SELECT va.id FROM vendas va WHERE (va.data, va.id) < (v.data, v.id) ORDER BY va.data DESC, va.id DESC LIMIT 1) AS anterior,
            (SELECT vp.id FROM vendas vp WHERE (vp.data, vp.id) > (v.data, v.id) ORDER BY vp.data, vp.id LIMIT 1) AS proxima
     FROM vendas v
     LEFT JOIN clientes c ON c.id = v.cliente_id
     WHERE v.id = $1`,
    [id],
  );
  if (!venda) return null;

  const itens = await query<ItemVendaDetalhe>(
    `SELECT i.id, i.venda_id, i.produto_id, i.produto_nome, i.quantidade, i.preco_unitario, i.custo_unitario, i.subtotal,
            p.aroma, p.ativo AS produto_ativo,
            (i.custo_unitario * i.quantidade)::numeric(12,2) AS custo_total,
            (i.subtotal - i.custo_unitario * i.quantidade)::numeric(12,2) AS lucro
     FROM itens_venda i
     LEFT JOIN produtos p ON p.id = i.produto_id
     WHERE i.venda_id = $1
     ORDER BY i.id`,
    [id],
  );

  const { c_id, c_nome, c_telefone, c_email, c_instagram, c_ativo, c_compras, anterior, proxima, ...base } = venda;
  const custo = Math.round(itens.reduce((s, i) => s + i.custo_total, 0) * 100) / 100;
  const lucro = Math.round((base.total - custo) * 100) / 100;
  const troco =
    base.forma_pagamento === "dinheiro" && base.valor_recebido != null && base.valor_recebido >= base.total
      ? Math.round((base.valor_recebido - base.total) * 100) / 100
      : null;

  return {
    ...base,
    cliente:
      c_id != null
        ? {
            id: c_id,
            nome: c_nome ?? "",
            telefone: c_telefone ?? "",
            email: c_email ?? "",
            instagram: c_instagram ?? "",
            ativo: c_ativo ?? true,
            compras: c_compras ?? 0,
          }
        : null,
    itens,
    unidades: itens.reduce((s, i) => s + i.quantidade, 0),
    custo,
    lucro,
    margem: base.total > 0 ? lucro / base.total : null,
    troco,
    anterior,
    proxima,
  };
});
