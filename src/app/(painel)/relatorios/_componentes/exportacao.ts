// Tipos de planilha exportáveis em /api/export/relatorios?tipo=… (compartilhado entre a tela e a rota).

export const TIPOS_EXPORTACAO = [
  { tipo: "resumo", rotulo: "Resumo do período", arquivo: "Resumo" },
  { tipo: "diario", rotulo: "Faturamento por dia", arquivo: "Faturamento por dia" },
  { tipo: "produtos", rotulo: "Ranking de produtos", arquivo: "Ranking de produtos" },
  { tipo: "clientes", rotulo: "Ranking de clientes", arquivo: "Ranking de clientes" },
  { tipo: "categorias", rotulo: "Vendas por categoria", arquivo: "Vendas por categoria" },
  { tipo: "aromas", rotulo: "Vendas por aroma", arquivo: "Vendas por aroma" },
  { tipo: "pagamentos", rotulo: "Por forma de pagamento", arquivo: "Formas de pagamento" },
  { tipo: "canais", rotulo: "Por canal de venda", arquivo: "Canais de venda" },
  { tipo: "semana", rotulo: "Por dia da semana", arquivo: "Dias da semana" },
  { tipo: "parados", rotulo: "Produtos parados", arquivo: "Produtos parados" },
] as const;

export type TipoExportacao = (typeof TIPOS_EXPORTACAO)[number]["tipo"];

export function tipoExportacao(valor: string | null | undefined): TipoExportacao | null {
  return TIPOS_EXPORTACAO.find((t) => t.tipo === valor)?.tipo ?? null;
}
