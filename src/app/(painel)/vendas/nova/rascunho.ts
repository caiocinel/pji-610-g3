"use client";

// Rascunho da venda em andamento guardado no navegador: se a página recarregar ou a usuária
// sair sem querer, dá para retomar. Nada aqui é confiável: tudo é revalidado contra os dados atuais.
import { useSyncExternalStore } from "react";
import { CANAIS, FORMAS_PAGAMENTO, TIPOS_DESCONTO } from "@/lib/dominio";
import type { ClientePDV, EstadoVenda, LinhaCarrinho, ProdutoPDV } from "./tipos";

const CHAVE = "luamme:pdv:rascunho:v1";
const EVENTO = "luamme:pdv:rascunho";

function ler(): string | null {
  try {
    return window.localStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}

function inscrever(aviso: () => void) {
  window.addEventListener("storage", aviso);
  window.addEventListener(EVENTO, aviso);
  return () => {
    window.removeEventListener("storage", aviso);
    window.removeEventListener(EVENTO, aviso);
  };
}

/** Texto bruto do rascunho salvo (null no servidor ou se não houver). */
export function useRascunhoSalvo(): string | null {
  return useSyncExternalStore(inscrever, ler, () => null);
}

/** Grava (ou apaga, com null) o rascunho. `avisar` atualiza quem está lendo nesta aba. */
export function salvarRascunho(venda: EstadoVenda | null, avisar = false) {
  try {
    if (venda && venda.carrinho.length > 0) window.localStorage.setItem(CHAVE, JSON.stringify(venda));
    else window.localStorage.removeItem(CHAVE);
  } catch {
    // armazenamento bloqueado (aba anônima etc.): segue sem rascunho
  }
  if (avisar) window.dispatchEvent(new Event(EVENTO));
}

function umDe<T extends string>(lista: readonly T[], valor: unknown, padrao: T): T {
  return lista.includes(valor as T) ? (valor as T) : padrao;
}

/**
 * Interpreta o rascunho e o ajusta à realidade atual: remove produtos que sumiram ou esgotaram,
 * limita quantidades ao estoque e só mantém o cliente se ele ainda existir.
 */
export function interpretarRascunho(
  bruto: string | null,
  produtos: Map<number, ProdutoPDV>,
  clientes: ClientePDV[],
): { venda: EstadoVenda; unidades: number; ajustado: boolean } | null {
  if (!bruto) return null;
  let dado: Partial<EstadoVenda>;
  try {
    dado = JSON.parse(bruto) as Partial<EstadoVenda>;
  } catch {
    return null;
  }
  if (!dado || !Array.isArray(dado.carrinho)) return null;

  let ajustado = false;
  const carrinho: LinhaCarrinho[] = [];
  for (const l of dado.carrinho as LinhaCarrinho[]) {
    const p = produtos.get(Number(l?.produto_id));
    const qtd = Math.floor(Number(l?.quantidade));
    if (!p || !(qtd > 0) || p.estoque <= 0) {
      ajustado = true;
      continue;
    }
    if (carrinho.some((c) => c.produto_id === p.id)) continue;
    if (qtd > p.estoque) ajustado = true;
    carrinho.push({ produto_id: p.id, quantidade: Math.min(qtd, p.estoque) });
  }
  if (carrinho.length === 0) return null;

  const cliente = dado.cliente ? (clientes.find((c) => c.id === dado.cliente?.id) ?? null) : null;
  if (dado.cliente && !cliente) ajustado = true;
  const numero = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);

  return {
    venda: {
      carrinho,
      cliente,
      forma: umDe(FORMAS_PAGAMENTO, dado.forma, "pix"),
      canal: umDe(CANAIS, dado.canal, "loja"),
      descontoTipo: umDe(TIPOS_DESCONTO, dado.descontoTipo, "valor"),
      descontoReais: numero(dado.descontoReais),
      descontoPercentual: typeof dado.descontoPercentual === "string" ? dado.descontoPercentual.slice(0, 8) : "",
      valorRecebido: numero(dado.valorRecebido),
      observacao: typeof dado.observacao === "string" ? dado.observacao.slice(0, 300) : "",
    },
    unidades: carrinho.reduce((s, l) => s + l.quantidade, 0),
    ajustado,
  };
}
