// Regras de cálculo puras (sem banco), usadas no servidor e também nas telas para prévias ao vivo.
// O servidor SEMPRE recalcula com estas mesmas funções; o valor do navegador é só exibição.
import type { SituacaoEstoque, TipoDesconto } from "./enums";

/** Arredonda para centavos evitando o erro clássico de ponto flutuante (1.005 → 1.01). */
export function arredondar(valor: number): number {
  if (!Number.isFinite(valor)) return 0;
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

/**
 * Converte texto digitado em número: aceita "39,90", "39.90", "1.234,56", "1234.5", "R$ 10".
 * Devolve NaN se não for um número.
 */
export function parseDecimalBR(texto: string | number | null | undefined): number {
  if (typeof texto === "number") return texto;
  if (texto == null) return NaN;
  let v = String(texto).trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (v === "") return NaN;
  if (v.includes(",")) v = v.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(v)) v = v.replace(/\./g, ""); // "1.234" = mil duzentos e trinta e quatro
  if (!/^-?\d+(\.\d+)?$/.test(v)) return NaN;
  return Number(v);
}

export type LinhaCalculo = { preco_unitario: number; quantidade: number };

/** Subtotal de uma linha (preço × quantidade), em centavos exatos. */
export function subtotalLinha(linha: LinhaCalculo): number {
  return arredondar(linha.preco_unitario * linha.quantidade);
}

/** Soma dos subtotais das linhas. */
export function calcularSubtotal(linhas: LinhaCalculo[]): number {
  return arredondar(linhas.reduce((s, l) => s + subtotalLinha(l), 0));
}

/**
 * Converte o desconto informado em R$. Em "percentual", `valor` é de 0 a 100.
 * Não limita ao subtotal: quem chama valida com `validarDesconto`.
 */
export function calcularDesconto(subtotal: number, tipo: TipoDesconto, valor: number): number {
  if (!Number.isFinite(valor) || valor <= 0) return 0;
  return tipo === "percentual" ? arredondar((subtotal * valor) / 100) : arredondar(valor);
}

/** Devolve mensagem de erro ou null se o desconto é válido. */
export function validarDesconto(subtotal: number, tipo: TipoDesconto, valor: number): string | null {
  if (!Number.isFinite(valor) || valor < 0) return "O desconto não pode ser negativo.";
  if (tipo === "percentual" && valor > 100) return "O desconto não pode passar de 100%.";
  if (calcularDesconto(subtotal, tipo, valor) > subtotal) return "O desconto não pode ser maior que o subtotal.";
  return null;
}

export type TotaisVenda = { subtotal: number; desconto: number; total: number };

/** Subtotal, desconto em R$ e total (nunca negativo) de uma venda. */
export function calcularTotaisVenda(
  linhas: LinhaCalculo[],
  desconto: { tipo: TipoDesconto; valor: number } = { tipo: "valor", valor: 0 },
): TotaisVenda {
  const subtotal = calcularSubtotal(linhas);
  const d = Math.min(calcularDesconto(subtotal, desconto.tipo, desconto.valor), subtotal);
  return { subtotal, desconto: d, total: arredondar(subtotal - d) };
}

/** Troco do pagamento em dinheiro; null se o valor recebido não cobre o total (ou não foi informado). */
export function calcularTroco(total: number, valorRecebido: number | null | undefined): number | null {
  if (valorRecebido == null || !Number.isFinite(valorRecebido)) return null;
  const troco = arredondar(valorRecebido - total);
  return troco >= 0 ? troco : null;
}

export type Margem = {
  /** Lucro bruto por unidade (preço − custo), em R$. */
  lucro: number;
  /** Lucro sobre o preço de venda, fração (0.6 = 60%). null se preço = 0. */
  margem: number | null;
  /** Lucro sobre o custo, fração (1.5 = 150%). null se custo = 0. */
  markup: number | null;
};

/** Margem de um produto ou de uma venda (passe receita e custo totais). */
export function calcularMargem(preco: number, custo: number): Margem {
  const lucro = arredondar(preco - custo);
  return {
    lucro,
    margem: preco > 0 ? lucro / preco : null,
    markup: custo > 0 ? lucro / custo : null,
  };
}

/** Preço sugerido a partir do custo e da margem desejada (fração sobre o preço, ex.: 0.6). */
export function precoPorMargem(custo: number, margemDesejada: number): number | null {
  if (margemDesejada >= 1 || margemDesejada < 0) return null;
  // Arredonda PARA CIMA nos centavos (com folga p/ ruído de ponto flutuante): a sugestão nunca fica abaixo da margem anunciada.
  return Math.ceil((custo / (1 - margemDesejada)) * 100 - 1e-6) / 100;
}

/** esgotado: 0; baixo: até o estoque mínimo; ok: acima. */
export function situacaoEstoque(estoque: number, estoqueMinimo: number): SituacaoEstoque {
  if (estoque <= 0) return "esgotado";
  if (estoque <= estoqueMinimo) return "baixo";
  return "ok";
}

/** Diferença a registrar num ajuste de inventário (positiva = entrada, negativa = saída). */
export function diferencaInventario(estoqueAtual: number, contagem: number) {
  const diferenca = contagem - estoqueAtual;
  return {
    diferenca,
    tipo: diferenca > 0 ? ("entrada" as const) : diferenca < 0 ? ("saida" as const) : null,
    quantidade: Math.abs(diferenca),
  };
}

/** Variação percentual entre dois períodos (fração). null quando não há base de comparação. */
export function variacao(atual: number, anterior: number): number | null {
  if (!anterior) return null;
  return (atual - anterior) / Math.abs(anterior);
}

/** Ticket médio (0 se não houve vendas). */
export function ticketMedio(faturamento: number, numeroVendas: number): number {
  return numeroVendas > 0 ? arredondar(faturamento / numeroVendas) : 0;
}

// ---------- Normalizações de cadastro ----------

/** Mantém só os dígitos e tira o DDI 55 quando vier junto ("+55 (11) 98765-4321" → "11987654321"). */
export function normalizarTelefone(telefone: string): string {
  let d = telefone.replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  return d;
}

/** Telefone BR válido: DDD + 8 ou 9 dígitos (vazio é aceito, pois é opcional). */
export function telefoneValido(telefone: string): boolean {
  const d = normalizarTelefone(telefone);
  return d === "" || /^[1-9]{2}9?\d{8}$/.test(d);
}

/** "@luamme.velas" ou "instagram.com/luamme.velas/" → "luamme.velas". */
export function normalizarInstagram(valor: string): string {
  return valor
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "");
}

/** SKU em maiúsculas, sem espaços nas pontas; vazio vira null. */
export function normalizarSku(valor: string | null | undefined): string | null {
  const v = (valor ?? "").trim().toUpperCase();
  return v === "" ? null : v;
}
