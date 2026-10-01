// Tipos e funções puras do PDV (seguro para cliente e servidor).
import type { Canal, FormaPagamento, TipoDesconto } from "@/lib/dominio";

/** Produto como o PDV precisa: só ativos, com categoria e popularidade recente. */
export type ProdutoPDV = {
  id: number;
  nome: string;
  aroma: string;
  sku: string | null;
  preco: number;
  estoque: number;
  estoque_minimo: number;
  categoria_id: number | null;
  categoria_nome: string | null;
  /** Unidades vendidas (vendas concluídas) nos últimos 90 dias. */
  vendidos: number;
};

/** Cliente resumido para a busca do PDV. */
export type ClientePDV = {
  id: number;
  nome: string;
  telefone: string;
  instagram: string;
  email: string;
  compras: number;
};

export type LinhaCarrinho = { produto_id: number; quantidade: number };

/** Tudo o que a tela guarda de uma venda em andamento (também é o rascunho salvo no navegador). */
export type EstadoVenda = {
  carrinho: LinhaCarrinho[];
  cliente: ClientePDV | null;
  forma: FormaPagamento;
  canal: Canal;
  descontoTipo: TipoDesconto;
  /** Desconto em R$ (quando tipo = valor). */
  descontoReais: number | null;
  /** Desconto em % digitado (quando tipo = percentual). */
  descontoPercentual: string;
  valorRecebido: number | null;
  observacao: string;
};

export const VENDA_VAZIA: EstadoVenda = {
  carrinho: [],
  cliente: null,
  forma: "pix",
  canal: "loja",
  descontoTipo: "valor",
  descontoReais: null,
  descontoPercentual: "",
  valorRecebido: null,
  observacao: "",
};

/** Venda concluída, para a tela de sucesso. */
export type VendaConcluida = {
  id: number;
  subtotal: number;
  desconto: number;
  total: number;
  troco: number | null;
  forma: FormaPagamento;
  cliente: ClientePDV | null;
  itens: { nome: string; aroma: string; quantidade: number; preco: number }[];
};

/** Texto sem acentos e minúsculo, para busca tolerante ("lavanda" acha "Lavanda", "acucar" acha "Açúcar"). */
export function normalizarBusca(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Todos os termos da busca precisam aparecer em algum dos campos. */
export function combinaBusca(termos: string[], ...campos: (string | null | undefined)[]): boolean {
  if (termos.length === 0) return true;
  const alvo = normalizarBusca(campos.filter(Boolean).join(" "));
  return termos.every((t) => alvo.includes(t));
}

export function termosBusca(texto: string): string[] {
  return normalizarBusca(texto).split(/\s+/).filter(Boolean);
}

/**
 * Sugestões de cédulas para o valor recebido em dinheiro: o valor exato e os próximos valores "redondos"
 * que uma pessoa normalmente entrega (ex.: total 47,90 → 47,90 · 50 · 60 · 100).
 */
export function sugestoesRecebido(total: number): number[] {
  if (!(total > 0)) return [];
  const valores = new Set<number>([Math.round(total * 100) / 100]);
  for (const passo of [5, 10, 20, 50, 100]) {
    const v = Math.ceil(total / passo) * passo;
    if (v > total) valores.add(v);
  }
  return [...valores].sort((a, b) => a - b).slice(0, 4);
}
