// Tipos das linhas do banco como chegam via `query()` de src/lib/db.ts
// (NUMERIC e BIGINT já convertidos para number; TIMESTAMPTZ vira Date).
import type { Canal, FormaPagamento, MotivoMovimentacao, StatusVenda, TipoMovimentacao } from "./enums";

export type Categoria = {
  id: number;
  nome: string;
  criado_em: Date;
};

export type Produto = {
  id: number;
  nome: string;
  aroma: string;
  descricao: string;
  categoria_id: number | null;
  preco: number;
  custo: number;
  sku: string | null;
  peso_g: number | null;
  tempo_queima_h: number | null;
  estoque: number;
  estoque_minimo: number;
  ativo: boolean;
  criado_em: Date;
  atualizado_em: Date;
};

export type Cliente = {
  id: number;
  nome: string;
  /** Só dígitos, com DDD (ex.: "11987654321"). Use formatTelefone/linkWhatsApp para exibir. */
  telefone: string;
  email: string;
  /** Sem "@". */
  instagram: string;
  observacoes: string;
  ativo: boolean;
  criado_em: Date;
  atualizado_em: Date;
};

export type Venda = {
  id: number;
  data: Date;
  cliente_id: number | null;
  forma_pagamento: FormaPagamento;
  canal: Canal;
  /** Soma dos itens. */
  subtotal: number;
  /** Desconto em R$ (já convertido quando foi dado em %). */
  desconto: number;
  /** total = subtotal − desconto. */
  total: number;
  /** Só para pagamento em dinheiro; troco = valor_recebido − total. */
  valor_recebido: number | null;
  observacao: string;
  status: StatusVenda;
  cancelada_em: Date | null;
  motivo_cancelamento: string | null;
};

export type ItemVenda = {
  id: number;
  venda_id: number;
  produto_id: number;
  /** Nome copiado no momento da venda. */
  produto_nome: string;
  quantidade: number;
  preco_unitario: number;
  /** Custo copiado no momento da venda (para margem). */
  custo_unitario: number;
  /** quantidade × preco_unitario. */
  subtotal: number;
};

export type MovimentacaoEstoque = {
  id: number;
  produto_id: number;
  tipo: TipoMovimentacao;
  quantidade: number;
  /** null só em linhas muito antigas que não puderam ser classificadas. */
  motivo: MotivoMovimentacao | null;
  /** Estoque do produto logo após a movimentação; null em linhas antigas. */
  saldo_apos: number | null;
  observacao: string;
  venda_id: number | null;
  criado_em: Date;
};

/** Configurações da loja (tabela `configuracoes`), já com valores padrão. */
export type Configuracoes = {
  loja_nome: string;
  loja_telefone: string;
  loja_instagram: string;
  loja_endereco: string;
  recibo_rodape: string;
  estoque_minimo_padrao: number;
};

export const CONFIGURACOES_PADRAO: Configuracoes = {
  loja_nome: "Velas Luamme",
  loja_telefone: "",
  loja_instagram: "",
  loja_endereco: "",
  recibo_rodape: "Obrigada pela preferência!",
  estoque_minimo_padrao: 5,
};
