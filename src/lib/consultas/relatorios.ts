import "server-only";
import { query, queryOne } from "@/lib/db";
import { arredondar, type Canal, type FormaPagamento, type StatusVenda } from "@/lib/dominio";
import { listarDias, type Intervalo } from "@/lib/periodo";

// Consultas de leitura do dashboard e dos relatórios.
// Regra de ouro: vendas canceladas NÃO entram em nenhum número daqui (status = 'concluida').
// Receita por produto/categoria/aroma é rateada pelo desconto da venda
// (i.subtotal × v.total / v.subtotal), para que a soma das partes bata com o faturamento.
//
// Custo desconhecido: itens com `custo_unitario = 0` (vendas da v1, anteriores ao campo, e velas
// sem custo cadastrado) NÃO entram no lucro nem na margem — senão apareceriam com 100% de margem.
// O lucro bruto é calculado só sobre os itens com custo informado, e cada consulta devolve quanto
// do faturamento ficou de fora (`receita_sem_custo`) para a tela avisar.

const RECEITA_ITEM = "i.subtotal * v.total / NULLIF(v.subtotal, 0)";
const COM_CUSTO = "i.custo_unitario > 0";
const SEM_CUSTO = "i.custo_unitario <= 0";
const FUSO = "'America/Sao_Paulo'";

/** Lucro sobre a parte com custo conhecido; null quando nada do faturamento tem custo informado. */
function lucroConhecido(faturamento: number, receitaSemCusto: number, custo: number) {
  const receitaComCusto = arredondar(faturamento - receitaSemCusto);
  if (receitaComCusto <= 0.005) return { lucro: faturamento > 0 ? null : 0, margem: null };
  const lucro = arredondar(receitaComCusto - custo);
  return { lucro, margem: lucro / receitaComCusto };
}

type Faixa = Pick<Intervalo, "inicio" | "fim">;

/* ---------- Resumo (cartões) ---------- */

export type ResumoVendas = {
  vendas: number;
  faturamento: number;
  /** Soma dos itens antes dos descontos. */
  bruto: number;
  descontos: number;
  /** Custo dos itens com custo informado. */
  custo: number;
  /** Lucro bruto dos itens com custo informado; null se nenhum item do período tem custo. */
  lucro: number | null;
  /** Fração lucro / faturamento com custo informado, ou null. */
  margem: number | null;
  /** Faturamento (rateado) de itens sem custo informado: fica fora do lucro e da margem. */
  receita_sem_custo: number;
  unidades_sem_custo: number;
  /** receita_sem_custo / faturamento (0 a 1). */
  fracao_sem_custo: number;
  ticket: number;
  unidades: number;
  /** Clientes identificados distintos. */
  clientes: number;
};

export async function resumoVendas({ inicio, fim }: Faixa): Promise<ResumoVendas> {
  const r = await queryOne<{
    vendas: number;
    faturamento: number;
    bruto: number;
    descontos: number;
    clientes: number;
    custo: number;
    unidades: number;
    unidades_sem_custo: number;
    receita_sem_custo: number;
  }>(
    `WITH v AS (
       SELECT id, total, subtotal, desconto, cliente_id
         FROM vendas
        WHERE status = 'concluida' AND data >= $1 AND data < $2
     ), i AS (
       SELECT COALESCE(SUM(i.custo_unitario * i.quantidade) FILTER (WHERE ${COM_CUSTO}), 0) AS custo,
              COALESCE(SUM(i.quantidade), 0) AS unidades,
              COALESCE(SUM(i.quantidade) FILTER (WHERE ${SEM_CUSTO}), 0) AS unidades_sem_custo,
              COALESCE(SUM(${RECEITA_ITEM}) FILTER (WHERE ${SEM_CUSTO}), 0) AS receita_sem_custo
         FROM itens_venda i JOIN v ON v.id = i.venda_id
     )
     SELECT (SELECT count(*) FROM v) AS vendas,
            (SELECT COALESCE(SUM(total), 0) FROM v) AS faturamento,
            (SELECT COALESCE(SUM(subtotal), 0) FROM v) AS bruto,
            (SELECT COALESCE(SUM(desconto), 0) FROM v) AS descontos,
            (SELECT count(DISTINCT cliente_id) FROM v) AS clientes,
            i.custo, i.unidades, i.unidades_sem_custo, i.receita_sem_custo
       FROM i`,
    [inicio, fim],
  );
  const faturamento = arredondar(r?.faturamento ?? 0);
  const vendas = r?.vendas ?? 0;
  const custo = arredondar(r?.custo ?? 0);
  const receitaSemCusto = Math.min(faturamento, arredondar(r?.receita_sem_custo ?? 0));
  return {
    vendas,
    faturamento,
    bruto: arredondar(r?.bruto ?? 0),
    descontos: arredondar(r?.descontos ?? 0),
    custo,
    ...lucroConhecido(faturamento, receitaSemCusto, custo),
    receita_sem_custo: receitaSemCusto,
    unidades_sem_custo: r?.unidades_sem_custo ?? 0,
    fracao_sem_custo: faturamento > 0 ? receitaSemCusto / faturamento : 0,
    ticket: vendas > 0 ? arredondar(faturamento / vendas) : 0,
    unidades: r?.unidades ?? 0,
    clientes: r?.clientes ?? 0,
  };
}

/* ---------- Série (dia, semana ou mês) ---------- */

export type Agrupamento = "dia" | "semana" | "mes";

export type PontoDia = {
  /** Primeiro dia do balde dentro do período (AAAA-MM-DD). Na série diária, o próprio dia. */
  dia: string;
  /** Último dia do balde dentro do período (igual a `dia` na série diária). */
  ate: string;
  faturamento: number;
  vendas: number;
  /** Lucro dos itens com custo informado; null se houve venda mas nenhum item tinha custo. */
  lucro: number | null;
  /** Faturamento sem custo informado (fora do lucro). */
  receita_sem_custo: number;
};

/** Períodos longos viram semanas ou meses: milhares de pontos diários pesam e não se leem no gráfico. */
export function agrupamentoPara(dias: number): Agrupamento {
  if (dias > 730) return "mes";
  if (dias > 120) return "semana";
  return "dia";
}

/** Chave do balde de um dia: o próprio dia, a segunda-feira da semana ou o dia 1º do mês. */
export function baldeDoDia(dia: string, agrupamento: Agrupamento): string {
  if (agrupamento === "mes") return `${dia.slice(0, 8)}01`;
  if (agrupamento === "semana") {
    const d = new Date(`${dia}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  }
  return dia;
}

const TRUNC: Record<Agrupamento, string> = {
  dia: `v.data AT TIME ZONE ${FUSO}`,
  semana: `date_trunc('week', v.data AT TIME ZONE ${FUSO})`,
  mes: `date_trunc('month', v.data AT TIME ZONE ${FUSO})`,
};

/**
 * Faturamento por dia, semana ou mês (fuso de SP), com zeros nos baldes sem venda.
 * Sem `agrupamento`, é sempre diária (o CSV e o dashboard usam assim).
 */
export async function faturamentoPorDia(
  p: Faixa & Pick<Intervalo, "de" | "ate">,
  agrupamento: Agrupamento = "dia",
): Promise<PontoDia[]> {
  const linhas = await query<{ balde: string; faturamento: number; vendas: number; custo: number; sem_custo: number }>(
    `SELECT to_char(${TRUNC[agrupamento]}, 'YYYY-MM-DD') AS balde,
            SUM(v.total) AS faturamento,
            count(*) AS vendas,
            SUM(c.custo) AS custo,
            SUM(c.sem_custo) AS sem_custo
       FROM vendas v
       CROSS JOIN LATERAL (
         SELECT COALESCE(SUM(i.custo_unitario * i.quantidade) FILTER (WHERE ${COM_CUSTO}), 0) AS custo,
                COALESCE(SUM(${RECEITA_ITEM}) FILTER (WHERE ${SEM_CUSTO}), 0) AS sem_custo
           FROM itens_venda i WHERE i.venda_id = v.id
       ) c
      WHERE v.status = 'concluida' AND v.data >= $1 AND v.data < $2
      GROUP BY 1`,
    [p.inicio, p.fim],
  );
  const mapa = new Map(linhas.map((l) => [l.balde, l]));
  const baldes: { chave: string; dia: string; ate: string }[] = [];
  for (const dia of listarDias(p.de, p.ate)) {
    const chave = baldeDoDia(dia, agrupamento);
    const ultimo = baldes.at(-1);
    if (ultimo?.chave === chave) ultimo.ate = dia;
    else baldes.push({ chave, dia, ate: dia });
  }
  return baldes.map(({ chave, dia, ate }) => {
    const l = mapa.get(chave);
    const faturamento = arredondar(l?.faturamento ?? 0);
    const semCusto = Math.min(faturamento, arredondar(l?.sem_custo ?? 0));
    return {
      dia,
      ate,
      faturamento,
      vendas: l?.vendas ?? 0,
      lucro: lucroConhecido(faturamento, semCusto, l?.custo ?? 0).lucro,
      receita_sem_custo: semCusto,
    };
  });
}

/* ---------- Agrupamentos ---------- */

export type FatiaVendas<K extends string = string> = {
  chave: K;
  vendas: number;
  faturamento: number;
};

export async function porFormaPagamento({ inicio, fim }: Faixa) {
  return query<FatiaVendas<FormaPagamento>>(
    `SELECT forma_pagamento AS chave, count(*) AS vendas, SUM(total) AS faturamento
       FROM vendas
      WHERE status = 'concluida' AND data >= $1 AND data < $2
      GROUP BY 1 ORDER BY faturamento DESC, vendas DESC`,
    [inicio, fim],
  );
}

export async function porCanal({ inicio, fim }: Faixa) {
  return query<FatiaVendas<Canal>>(
    `SELECT canal AS chave, count(*) AS vendas, SUM(total) AS faturamento
       FROM vendas
      WHERE status = 'concluida' AND data >= $1 AND data < $2
      GROUP BY 1 ORDER BY faturamento DESC, vendas DESC`,
    [inicio, fim],
  );
}

export type FatiaItens = {
  chave: string;
  rotulo: string;
  unidades: number;
  faturamento: number;
  /** Custo dos itens com custo informado. */
  custo: number;
  /** Lucro dos itens com custo informado; null se nenhum tinha custo. */
  lucro: number | null;
  /** Fração lucro / faturamento com custo informado, ou null. */
  margem: number | null;
  receita_sem_custo: number;
};

type FatiaBruta = { faturamento: number; custo: number | null; receita_sem_custo: number };

function arredondarFatia<T extends FatiaBruta>(l: T) {
  const faturamento = arredondar(l.faturamento);
  const custo = arredondar(l.custo ?? 0);
  const receitaSemCusto = Math.min(faturamento, arredondar(l.receita_sem_custo));
  return { ...l, faturamento, custo, receita_sem_custo: receitaSemCusto, ...lucroConhecido(faturamento, receitaSemCusto, custo) };
}

/** Colunas de custo dos agrupamentos de itens (custo só dos itens com custo informado). */
const COLUNAS_CUSTO = `COALESCE(SUM(i.custo_unitario * i.quantidade) FILTER (WHERE ${COM_CUSTO}), 0) AS custo,
            COALESCE(SUM(${RECEITA_ITEM}) FILTER (WHERE ${SEM_CUSTO}), 0) AS receita_sem_custo`;

export async function porCategoria({ inicio, fim }: Faixa): Promise<FatiaItens[]> {
  const linhas = await query<Omit<FatiaItens, "lucro" | "margem">>(
    `SELECT COALESCE(c.id::text, 'sem') AS chave,
            COALESCE(c.nome, 'Sem categoria') AS rotulo,
            SUM(i.quantidade) AS unidades,
            SUM(${RECEITA_ITEM}) AS faturamento,
            ${COLUNAS_CUSTO}
       FROM itens_venda i
       JOIN vendas v ON v.id = i.venda_id AND v.status = 'concluida'
       LEFT JOIN produtos p ON p.id = i.produto_id
       LEFT JOIN categorias c ON c.id = p.categoria_id
      WHERE v.data >= $1 AND v.data < $2
      GROUP BY c.id, c.nome
      ORDER BY faturamento DESC`,
    [inicio, fim],
  );
  return linhas.map(arredondarFatia);
}

export async function porAroma({ inicio, fim }: Faixa): Promise<FatiaItens[]> {
  const linhas = await query<Omit<FatiaItens, "lucro" | "margem">>(
    `SELECT lower(COALESCE(NULLIF(trim(p.aroma), ''), '—')) AS chave,
            min(COALESCE(NULLIF(trim(p.aroma), ''), 'Aroma não informado')) AS rotulo,
            SUM(i.quantidade) AS unidades,
            SUM(${RECEITA_ITEM}) AS faturamento,
            ${COLUNAS_CUSTO}
       FROM itens_venda i
       JOIN vendas v ON v.id = i.venda_id AND v.status = 'concluida'
       LEFT JOIN produtos p ON p.id = i.produto_id
      WHERE v.data >= $1 AND v.data < $2
      GROUP BY 1
      ORDER BY faturamento DESC`,
    [inicio, fim],
  );
  return linhas.map(arredondarFatia);
}

export type PontoDiaSemana = {
  /** 1 = segunda … 7 = domingo. */
  isodow: number;
  vendas: number;
  faturamento: number;
  /** Quantas vezes esse dia da semana aparece no período. */
  ocorrencias: number;
  /** Faturamento médio por ocorrência do dia. */
  media: number;
};

export async function porDiaSemana(p: Faixa & Pick<Intervalo, "de" | "ate">): Promise<PontoDiaSemana[]> {
  const linhas = await query<{ isodow: number; vendas: number; faturamento: number }>(
    `SELECT extract(isodow FROM v.data AT TIME ZONE ${FUSO})::int AS isodow,
            count(*) AS vendas, SUM(v.total) AS faturamento
       FROM vendas v
      WHERE v.status = 'concluida' AND v.data >= $1 AND v.data < $2
      GROUP BY 1`,
    [p.inicio, p.fim],
  );
  const ocorrencias = new Array<number>(8).fill(0);
  for (const dia of listarDias(p.de, p.ate)) {
    const dow = new Date(`${dia}T12:00:00Z`).getUTCDay(); // 0 = domingo
    ocorrencias[dow === 0 ? 7 : dow]++;
  }
  const mapa = new Map(linhas.map((l) => [l.isodow, l]));
  return [1, 2, 3, 4, 5, 6, 7].map((isodow) => {
    const l = mapa.get(isodow);
    const faturamento = arredondar(l?.faturamento ?? 0);
    const n = ocorrencias[isodow];
    return { isodow, vendas: l?.vendas ?? 0, faturamento, ocorrencias: n, media: n ? arredondar(faturamento / n) : 0 };
  });
}

/* ---------- Rankings ---------- */

export type ProdutoRanking = {
  produto_id: number;
  nome: string;
  aroma: string;
  categoria: string | null;
  ativo: boolean;
  unidades: number;
  vendas: number;
  faturamento: number;
  custo: number;
  lucro: number | null;
  margem: number | null;
  receita_sem_custo: number;
};

/** Todos os produtos vendidos no período (ordenados por receita). */
export async function rankingProdutos({ inicio, fim }: Faixa): Promise<ProdutoRanking[]> {
  const linhas = await query<Omit<ProdutoRanking, "lucro" | "margem">>(
    `SELECT i.produto_id,
            COALESCE(p.nome, max(i.produto_nome)) AS nome,
            COALESCE(p.aroma, '') AS aroma,
            c.nome AS categoria,
            COALESCE(p.ativo, false) AS ativo,
            SUM(i.quantidade) AS unidades,
            count(DISTINCT v.id) AS vendas,
            SUM(${RECEITA_ITEM}) AS faturamento,
            ${COLUNAS_CUSTO}
       FROM itens_venda i
       JOIN vendas v ON v.id = i.venda_id AND v.status = 'concluida'
       LEFT JOIN produtos p ON p.id = i.produto_id
       LEFT JOIN categorias c ON c.id = p.categoria_id
      WHERE v.data >= $1 AND v.data < $2
      GROUP BY i.produto_id, p.nome, p.aroma, p.ativo, c.nome
      ORDER BY faturamento DESC, unidades DESC`,
    [inicio, fim],
  );
  return linhas.map(arredondarFatia);
}

export type ClienteRanking = {
  cliente_id: number;
  nome: string;
  telefone: string;
  compras: number;
  faturamento: number;
  ticket: number;
  ultima_compra: Date;
};

export async function rankingClientes({ inicio, fim }: Faixa, limite = 10): Promise<ClienteRanking[]> {
  const linhas = await query<Omit<ClienteRanking, "ticket">>(
    `SELECT c.id AS cliente_id, c.nome, c.telefone,
            count(*) AS compras, SUM(v.total) AS faturamento, max(v.data) AS ultima_compra
       FROM vendas v
       JOIN clientes c ON c.id = v.cliente_id
      WHERE v.status = 'concluida' AND v.data >= $1 AND v.data < $2
      GROUP BY c.id
      ORDER BY faturamento DESC, compras DESC
      LIMIT $3`,
    [inicio, fim, limite],
  );
  return linhas.map((l) => ({
    ...l,
    faturamento: arredondar(l.faturamento),
    ticket: l.compras ? arredondar(l.faturamento / l.compras) : 0,
  }));
}

/** Vendas sem cliente identificado no período (para contextualizar o ranking). */
export async function vendasSemCliente({ inicio, fim }: Faixa) {
  const r = await queryOne<{ vendas: number; faturamento: number }>(
    `SELECT count(*) AS vendas, COALESCE(SUM(total), 0) AS faturamento
       FROM vendas
      WHERE status = 'concluida' AND cliente_id IS NULL AND data >= $1 AND data < $2`,
    [inicio, fim],
  );
  return { vendas: r?.vendas ?? 0, faturamento: arredondar(r?.faturamento ?? 0) };
}

export type ProdutoParado = {
  id: number;
  nome: string;
  aroma: string;
  categoria: string | null;
  estoque: number;
  estoque_minimo: number;
  preco: number;
  /** Valor parado em estoque, a custo. */
  valor_custo: number;
  /** Valor parado em estoque, a preço de venda. */
  valor_venda: number;
  ultima_venda: Date | null;
};

/** Produtos ativos sem nenhuma venda concluída no período. Os com mais dinheiro parado vêm primeiro. */
export async function produtosParados({ inicio, fim }: Faixa): Promise<ProdutoParado[]> {
  return query<ProdutoParado>(
    `SELECT p.id, p.nome, p.aroma, c.nome AS categoria, p.estoque, p.estoque_minimo, p.preco,
            round(p.estoque * p.custo, 2) AS valor_custo,
            round(p.estoque * p.preco, 2) AS valor_venda,
            (SELECT max(v.data)
               FROM itens_venda i JOIN vendas v ON v.id = i.venda_id AND v.status = 'concluida'
              WHERE i.produto_id = p.id) AS ultima_venda
       FROM produtos p
       LEFT JOIN categorias c ON c.id = p.categoria_id
      WHERE p.ativo
        AND NOT EXISTS (
          SELECT 1 FROM itens_venda i
            JOIN vendas v ON v.id = i.venda_id AND v.status = 'concluida'
           WHERE i.produto_id = p.id AND v.data >= $1 AND v.data < $2
        )
      ORDER BY p.estoque * p.preco DESC, p.nome`,
    [inicio, fim],
  );
}

/* ---------- Dashboard ---------- */

export type AlertaEstoque = {
  id: number;
  nome: string;
  aroma: string;
  estoque: number;
  estoque_minimo: number;
};

/** Produtos ativos esgotados ou abaixo do mínimo (os mais críticos primeiro) + total. */
export async function alertasEstoque(limite = 6) {
  const [itens, total] = await Promise.all([
    query<AlertaEstoque>(
      `SELECT id, nome, aroma, estoque, estoque_minimo
         FROM produtos
        WHERE ativo AND estoque <= estoque_minimo
        ORDER BY (estoque <= 0) DESC, estoque - estoque_minimo, nome
        LIMIT $1`,
      [limite],
    ),
    queryOne<{ esgotados: number; baixos: number }>(
      `SELECT count(*) FILTER (WHERE estoque <= 0) AS esgotados,
              count(*) FILTER (WHERE estoque > 0 AND estoque <= estoque_minimo) AS baixos
         FROM produtos WHERE ativo`,
    ),
  ]);
  return { itens, esgotados: total?.esgotados ?? 0, baixos: total?.baixos ?? 0 };
}

export type VendaRecente = {
  id: number;
  data: Date;
  total: number;
  forma_pagamento: FormaPagamento;
  canal: Canal;
  status: StatusVenda;
  cliente_nome: string | null;
  itens: string;
  unidades: number;
};

/** Últimas vendas concluídas, com resumo dos itens ("2× Lavanda, 1× Baunilha"). */
export async function ultimasVendas(limite = 5): Promise<VendaRecente[]> {
  return query<VendaRecente>(
    `SELECT v.id, v.data, v.total, v.forma_pagamento, v.canal, v.status, c.nome AS cliente_nome,
            COALESCE(string_agg(i.quantidade || '× ' || i.produto_nome, ', ' ORDER BY i.id), '') AS itens,
            COALESCE(SUM(i.quantidade), 0) AS unidades
       FROM vendas v
       LEFT JOIN clientes c ON c.id = v.cliente_id
       LEFT JOIN itens_venda i ON i.venda_id = v.id
      WHERE v.status = 'concluida'
      GROUP BY v.id, c.nome
      ORDER BY v.data DESC, v.id DESC
      LIMIT $1`,
    [limite],
  );
}

/** Há alguma venda concluída registrada? (para o estado vazio do primeiro uso). */
export async function existeVenda(): Promise<boolean> {
  const r = await queryOne<{ existe: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM vendas WHERE status = 'concluida') AS existe`,
  );
  return !!r?.existe;
}
