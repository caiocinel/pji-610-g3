// Gráficos da Velas Luamme. Cores só por token (var(--color-grafico-N)), valores em BRL,
// sempre com resumo em texto e tabela (via <Figura>).
export { Figura } from "./figura";
export type { FiguraProps, TabelaFigura } from "./figura";
export { BarrasHorizontais } from "./barras-horizontais";
export type { BarrasHorizontaisProps, ItemBarra } from "./barras-horizontais";
export { GraficoFaturamento } from "./grafico-faturamento";
export type { GraficoFaturamentoProps, PontoFaturamento } from "./grafico-faturamento";
export { GraficoColunas } from "./grafico-colunas";
export type { GraficoColunasProps, PontoColuna } from "./grafico-colunas";
export {
  serieComparada,
  rotuloBalde,
  rotuloEixoBalde,
  resumoSerieDiaria,
  tabelaSerieDiaria,
  colunasDiaSemana,
  resumoDiaSemana,
  tabelaDiaSemana,
} from "./dados";
export type { AgrupamentoSerie } from "./dados";
