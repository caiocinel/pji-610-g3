// Montagem de dados para os gráficos (puro; serve no servidor e no cliente).
import { formatBRL, formatDate, formatDateShort, formatInt, formatMonth, formatWeekday } from "@/lib/format";
import type { PontoColuna } from "./grafico-colunas";
import type { PontoFaturamento } from "./grafico-faturamento";
import type { TabelaFigura } from "./figura";

/** Granularidade da série: períodos longos vêm em semanas ou meses (ver agrupamentoPara nas consultas). */
export type AgrupamentoSerie = "dia" | "semana" | "mes";

/** `ate` = último dia do balde (semana/mês); ausente ou igual a `dia` na série diária. */
type Dia = { dia: string; ate?: string; faturamento: number; vendas: number };

const NOME_BALDE: Record<AgrupamentoSerie, [string, string, string]> = {
  dia: ["dia", "dias", "Dia"],
  semana: ["semana", "semanas", "Semana"],
  mes: ["mês", "meses", "Mês"],
};

const meio = (ymd: string) => new Date(`${ymd}T12:00:00-03:00`);

/** Rótulo por extenso de um ponto: "01/10/2026", "29/09 a 05/10/2026" ou "Outubro de 2026". */
export function rotuloBalde(dia: string, ate: string | undefined | null, agrupamento: AgrupamentoSerie = "dia"): string {
  if (agrupamento === "mes") {
    const m = formatMonth(meio(dia));
    return `${m.charAt(0).toUpperCase()}${m.slice(1)}`;
  }
  if (!ate || ate === dia) return formatDate(dia);
  return `${formatDateShort(dia)} a ${formatDate(ate)}`;
}

/** Rótulo curto para o eixo: "01/10" (dia/semana) ou "out/26" (mês). */
export function rotuloEixoBalde(dia: string, agrupamento: AgrupamentoSerie = "dia"): string {
  if (agrupamento !== "mes") return formatDateShort(dia);
  const mes = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" }).format(new Date(`${dia}T12:00:00Z`));
  return `${mes.replace(".", "")}/${dia.slice(2, 4)}`;
}

/** Junta a série atual com a anterior, ponto a ponto pela posição (1º dia com 1º dia…). */
export function serieComparada(atual: Dia[], anterior?: Dia[]): PontoFaturamento[] {
  return atual.map((d, i) => ({
    dia: d.dia,
    ate: d.ate ?? null,
    valor: d.faturamento,
    vendas: d.vendas,
    anterior: anterior?.[i]?.faturamento ?? null,
    diaAnterior: anterior?.[i]?.dia ?? null,
    ateAnterior: anterior?.[i]?.ate ?? null,
  }));
}

/** Frase-resumo da série: total, média e melhor dia (ou semana/mês). */
export function resumoSerieDiaria(dias: Dia[], agrupamento: AgrupamentoSerie = "dia"): string {
  const total = dias.reduce((s, d) => s + d.faturamento, 0);
  if (total <= 0) return "Nenhuma venda no período.";
  const melhor = dias.reduce((m, d) => (d.faturamento > m.faturamento ? d : m), dias[0]);
  const comVenda = dias.filter((d) => d.vendas > 0).length;
  const [um, varios] = NOME_BALDE[agrupamento];
  const n = dias.length;
  const quando =
    agrupamento === "dia"
      ? `${formatWeekday(melhor.dia)}, ${formatDateShort(melhor.dia)}`
      : rotuloBalde(melhor.dia, melhor.ate, agrupamento);
  return (
    `${formatBRL(total)} em ${formatInt(n)} ${n === 1 ? um : varios} (média de ${formatBRL(total / n)} por ${um}). ` +
    `Melhor ${um}: ${quando}, com ${formatBRL(melhor.faturamento)}. ` +
    `Houve venda em ${formatInt(comVenda)} de ${formatInt(n)} ${n === 1 ? um : varios}.` +
    (agrupamento === "semana"
      ? " A primeira e a última semana podem estar incompletas."
      : agrupamento === "mes"
        ? " O primeiro e o último mês podem estar incompletos."
        : "")
  );
}

export function tabelaSerieDiaria(dias: Dia[], agrupamento: AgrupamentoSerie = "dia"): TabelaFigura {
  return {
    cabecalhos: [NOME_BALDE[agrupamento][2], "Vendas", "Faturamento"],
    linhas: [...dias].reverse().map((d) => [rotuloBalde(d.dia, d.ate, agrupamento), formatInt(d.vendas), formatBRL(d.faturamento)]),
  };
}

const DIAS_SEMANA: [string, string][] = [
  ["Seg", "Segunda-feira"],
  ["Ter", "Terça-feira"],
  ["Qua", "Quarta-feira"],
  ["Qui", "Quinta-feira"],
  ["Sex", "Sexta-feira"],
  ["Sáb", "Sábado"],
  ["Dom", "Domingo"],
];

type DiaSemana = { isodow: number; vendas: number; faturamento: number; ocorrencias: number; media: number };

export function colunasDiaSemana(dados: DiaSemana[]): PontoColuna[] {
  return dados.map((d) => {
    const [rotulo, rotuloLongo] = DIAS_SEMANA[d.isodow - 1];
    return {
      rotulo,
      rotuloLongo,
      valor: d.faturamento,
      detalhes: [
        d.vendas === 1 ? "1 venda" : `${formatInt(d.vendas)} vendas`,
        d.ocorrencias > 1 ? `Média de ${formatBRL(d.media)} por ${rotuloLongo.toLowerCase()}` : "",
      ].filter(Boolean),
    };
  });
}

export function resumoDiaSemana(dados: DiaSemana[]): string {
  const total = dados.reduce((s, d) => s + d.faturamento, 0);
  if (total <= 0) return "Nenhuma venda no período.";
  const ordenado = [...dados].sort((a, b) => b.faturamento - a.faturamento);
  const melhor = ordenado[0];
  const pior = ordenado[ordenado.length - 1];
  const nome = (d: DiaSemana) => DIAS_SEMANA[d.isodow - 1][1].toLowerCase();
  return (
    `O dia mais forte é ${nome(melhor)} (${formatBRL(melhor.faturamento)}, ${Math.round((melhor.faturamento / total) * 100)}% do total); ` +
    `o mais fraco, ${nome(pior)} (${formatBRL(pior.faturamento)}).`
  );
}

export function tabelaDiaSemana(dados: DiaSemana[]): TabelaFigura {
  return {
    cabecalhos: ["Dia da semana", "Vendas", "Faturamento", "Média por dia"],
    linhas: dados.map((d) => [
      DIAS_SEMANA[d.isodow - 1][1],
      formatInt(d.vendas),
      formatBRL(d.faturamento),
      formatBRL(d.media),
    ]),
  };
}
