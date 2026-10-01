// Valores aceitos pelo banco (CHECKs em db/migrations/002_v2.sql) e rótulos para a interface.
// Seguro para importar em componentes cliente.

export const FORMAS_PAGAMENTO = ["pix", "dinheiro", "cartao_credito", "cartao_debito", "outro"] as const;
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number];
export const ROTULO_FORMA_PAGAMENTO: Record<FormaPagamento, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  outro: "Outro",
};

export const CANAIS = ["loja", "whatsapp", "instagram", "feira", "site", "outro"] as const;
export type Canal = (typeof CANAIS)[number];
export const ROTULO_CANAL: Record<Canal, string> = {
  loja: "Loja / ateliê",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  feira: "Feira / evento",
  site: "Site",
  outro: "Outro",
};

export const STATUS_VENDA = ["concluida", "cancelada"] as const;
export type StatusVenda = (typeof STATUS_VENDA)[number];
export const ROTULO_STATUS_VENDA: Record<StatusVenda, string> = {
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const TIPOS_MOVIMENTACAO = ["entrada", "saida"] as const;
export type TipoMovimentacao = (typeof TIPOS_MOVIMENTACAO)[number];
export const ROTULO_TIPO_MOVIMENTACAO: Record<TipoMovimentacao, string> = {
  entrada: "Entrada",
  saida: "Saída",
};

export const MOTIVOS_MOVIMENTACAO = [
  "estoque_inicial",
  "producao",
  "compra",
  "venda",
  "cancelamento_venda",
  "perda",
  "avaria",
  "uso_interno",
  "ajuste_inventario",
  "outro",
] as const;
export type MotivoMovimentacao = (typeof MOTIVOS_MOVIMENTACAO)[number];
export const ROTULO_MOTIVO: Record<MotivoMovimentacao, string> = {
  estoque_inicial: "Estoque inicial",
  producao: "Produção",
  compra: "Compra",
  venda: "Venda",
  cancelamento_venda: "Venda cancelada",
  perda: "Perda",
  avaria: "Avaria / defeito",
  uso_interno: "Uso interno / brinde",
  ajuste_inventario: "Ajuste de inventário",
  outro: "Outro",
};

/** Motivos que a usuária pode escolher numa entrada manual. */
export const MOTIVOS_ENTRADA = ["producao", "compra", "outro"] as const satisfies readonly MotivoMovimentacao[];
export type MotivoEntrada = (typeof MOTIVOS_ENTRADA)[number];
/** Motivos que a usuária pode escolher numa saída manual. */
export const MOTIVOS_SAIDA = ["perda", "avaria", "uso_interno", "outro"] as const satisfies readonly MotivoMovimentacao[];
export type MotivoSaida = (typeof MOTIVOS_SAIDA)[number];

export const TIPOS_DESCONTO = ["valor", "percentual"] as const;
export type TipoDesconto = (typeof TIPOS_DESCONTO)[number];
export const ROTULO_TIPO_DESCONTO: Record<TipoDesconto, string> = {
  valor: "R$",
  percentual: "%",
};

/** Situação do estoque de um produto (ver `situacaoEstoque` em calculos.ts). */
export const SITUACOES_ESTOQUE = ["esgotado", "baixo", "ok"] as const;
export type SituacaoEstoque = (typeof SITUACOES_ESTOQUE)[number];
export const ROTULO_SITUACAO_ESTOQUE: Record<SituacaoEstoque, string> = {
  esgotado: "Esgotado",
  baixo: "Estoque baixo",
  ok: "Em estoque",
};

/** Lista `{ valor, rotulo }` pronta para <select>/radios. */
export function opcoes<T extends string>(valores: readonly T[], rotulos: Record<T, string>) {
  return valores.map((valor) => ({ valor, rotulo: rotulos[valor] }));
}

/** Rótulo seguro para valores vindos do banco (devolve o próprio valor se desconhecido). */
export function rotulo<T extends string>(rotulos: Record<T, string>, valor: string | null | undefined) {
  if (!valor) return "";
  return (rotulos as Record<string, string>)[valor] ?? valor;
}
