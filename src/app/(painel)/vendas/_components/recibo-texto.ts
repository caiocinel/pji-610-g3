import { ROTULO_FORMA_PAGAMENTO, type Configuracoes } from "@/lib/dominio";
import type { VendaDetalhe } from "@/lib/consultas/vendas";
import { formatBRL, formatDateTime, formatTelefone } from "@/lib/format";

/** Nº da venda com zeros à esquerda, como em cupom: 000123. */
export function numeroRecibo(id: number) {
  return String(id).padStart(6, "0");
}

/**
 * Recibo em texto simples (para copiar ou enviar pelo WhatsApp).
 * Usa *negrito* do WhatsApp nos títulos.
 */
export function textoRecibo(v: VendaDetalhe, loja: Configuracoes): string {
  const linhas: string[] = [];
  linhas.push(`*${loja.loja_nome}*`);
  if (v.status === "cancelada") linhas.push("*VENDA CANCELADA*");
  linhas.push(`Recibo nº ${numeroRecibo(v.id)} · ${formatDateTime(v.data)}`);
  if (v.cliente) linhas.push(`Cliente: ${v.cliente.nome}`);
  linhas.push("");
  for (const i of v.itens) {
    linhas.push(`${i.quantidade}× ${i.produto_nome}${i.aroma ? ` (${i.aroma})` : ""} — ${formatBRL(i.subtotal)}`);
  }
  linhas.push("");
  if (v.desconto > 0) {
    linhas.push(`Subtotal: ${formatBRL(v.subtotal)}`);
    linhas.push(`Desconto: −${formatBRL(v.desconto)}`);
  }
  linhas.push(`*Total: ${formatBRL(v.total)}*`);
  linhas.push(`Pagamento: ${ROTULO_FORMA_PAGAMENTO[v.forma_pagamento] ?? v.forma_pagamento}`);
  if (v.valor_recebido != null && v.forma_pagamento === "dinheiro") {
    linhas.push(`Recebido: ${formatBRL(v.valor_recebido)}`);
    if (v.troco != null) linhas.push(`Troco: ${formatBRL(v.troco)}`);
  }
  const contato = [
    loja.loja_telefone ? formatTelefone(loja.loja_telefone) : "",
    loja.loja_instagram ? `@${loja.loja_instagram}` : "",
  ].filter(Boolean);
  if (loja.recibo_rodape || contato.length) linhas.push("");
  if (loja.recibo_rodape) linhas.push(loja.recibo_rodape);
  if (contato.length) linhas.push(contato.join(" · "));
  return linhas.join("\n");
}
