import "server-only";
import { query } from "@/lib/db";
import type { ClientePDV, ProdutoPDV } from "./tipos";

// Consultas de leitura exclusivas do PDV (Nova venda).

export async function listarProdutosPDV(): Promise<ProdutoPDV[]> {
  return query<ProdutoPDV>(
    `SELECT p.id, p.nome, p.aroma, p.sku, p.preco, p.estoque, p.estoque_minimo,
            p.categoria_id, c.nome AS categoria_nome, coalesce(r.vendidos, 0)::int AS vendidos
       FROM produtos p
       LEFT JOIN categorias c ON c.id = p.categoria_id
       LEFT JOIN (
         SELECT i.produto_id, sum(i.quantidade)::int AS vendidos
           FROM itens_venda i
           JOIN vendas v ON v.id = i.venda_id AND v.status = 'concluida'
          WHERE v.data >= now() - interval '90 days'
          GROUP BY i.produto_id
       ) r ON r.produto_id = p.id
      WHERE p.ativo
      ORDER BY vendidos DESC, p.nome`,
  );
}

/**
 * Clientes ativos (a lista de uma loja pequena cabe tranquila no navegador e a busca fica instantânea).
 * Ordem: quem comprou mais recentemente primeiro.
 */
export async function listarClientesPDV(limite = 3000): Promise<ClientePDV[]> {
  return query<ClientePDV>(
    `SELECT c.id, c.nome, c.telefone, c.instagram, c.email, coalesce(r.compras, 0)::int AS compras
       FROM clientes c
       LEFT JOIN (
         SELECT cliente_id, count(*)::int AS compras, max(data) AS ultima
           FROM vendas
          WHERE status = 'concluida' AND cliente_id IS NOT NULL
          GROUP BY cliente_id
       ) r ON r.cliente_id = c.id
      WHERE c.ativo
      ORDER BY r.ultima DESC NULLS LAST, lower(c.nome)
      LIMIT $1`,
    [limite],
  );
}
