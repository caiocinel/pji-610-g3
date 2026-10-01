import "server-only";
import { requireAuth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import type { StatusVenda } from "@/lib/dominio";

export type ResultadoBuscaProduto = {
  id: number;
  nome: string;
  aroma: string;
  sku: string | null;
  preco: number;
  estoque: number;
  estoque_minimo: number;
};

export type ResultadoBuscaCliente = {
  id: number;
  nome: string;
  telefone: string;
  email: string;
  instagram: string;
};

export type ResultadoBuscaVenda = {
  id: number;
  data: Date;
  total: number;
  status: StatusVenda;
  cliente_nome: string | null;
  itens: number;
};

export type ResultadoBusca = {
  produtos: ResultadoBuscaProduto[];
  clientes: ResultadoBuscaCliente[];
  vendas: ResultadoBuscaVenda[];
};

const LIMITE_PRODUTOS = 6;
const LIMITE_CLIENTES = 5;
const LIMITE_VENDAS = 5;

const SQL_VENDA = `
  SELECT v.id, v.data, v.total, v.status, c.nome AS cliente_nome,
         (SELECT coalesce(sum(i.quantidade), 0) FROM itens_venda i WHERE i.venda_id = v.id) AS itens
    FROM vendas v
    LEFT JOIN clientes c ON c.id = v.cliente_id`;

/**
 * Busca global da paleta de comandos: produtos ativos (nome/aroma/SKU), clientes ativos
 * (nome/telefone/e-mail/Instagram) e vendas pelo número ("123" ou "#123").
 * Resultados que começam com o termo vêm primeiro.
 */
export async function buscarGlobal(termoBruto: string): Promise<ResultadoBusca> {
  await requireAuth();
  const termo = termoBruto.trim().slice(0, 80);
  if (!termo) return { produtos: [], clientes: [], vendas: await ultimasVendas(3) };

  const semCerquilha = termo.replace(/^#\s*/, "");
  const numeroVenda = /^\d{1,9}$/.test(semCerquilha) ? Number(semCerquilha) : null;
  const digitos = termo.replace(/\D/g, "");
  // Só busca por telefone quando há dígitos suficientes para não casar com tudo.
  const digitosTelefone = digitos.length >= 3 ? digitos : null;
  const textoBusca = termo.startsWith("#") && numeroVenda !== null ? null : termo;

  const [produtos, clientes, vendas] = await Promise.all([
    textoBusca
      ? query<ResultadoBuscaProduto>(
          `SELECT id, nome, aroma, sku, preco, estoque, estoque_minimo
             FROM produtos
            WHERE ativo
              AND (nome ILIKE '%' || $1 || '%' OR aroma ILIKE '%' || $1 || '%' OR sku ILIKE '%' || $1 || '%')
            ORDER BY (nome ILIKE $1 || '%') DESC, (sku ILIKE $1) DESC, nome
            LIMIT ${LIMITE_PRODUTOS}`,
          [escaparLike(textoBusca)],
        )
      : Promise.resolve([]),
    textoBusca
      ? query<ResultadoBuscaCliente>(
          `SELECT id, nome, telefone, email, instagram
             FROM clientes
            WHERE ativo
              AND (nome ILIKE '%' || $1 || '%'
                   OR email ILIKE '%' || $1 || '%'
                   OR instagram ILIKE '%' || ltrim($1, '@') || '%'
                   OR ($2::text IS NOT NULL AND telefone LIKE '%' || $2 || '%'))
            ORDER BY (nome ILIKE $1 || '%') DESC, nome
            LIMIT ${LIMITE_CLIENTES}`,
          [escaparLike(textoBusca), digitosTelefone],
        )
      : Promise.resolve([]),
    numeroVenda !== null
      ? query<ResultadoBuscaVenda>(
          `${SQL_VENDA}
            WHERE v.id = $1 OR v.id::text LIKE $2 || '%'
            ORDER BY (v.id = $1) DESC, v.id DESC
            LIMIT ${LIMITE_VENDAS}`,
          [numeroVenda, String(numeroVenda)],
        )
      : Promise.resolve([]),
  ]);

  return { produtos, clientes, vendas };
}

/** Vendas mais recentes (sugestões da paleta antes de digitar). */
export async function ultimasVendas(limite = 3): Promise<ResultadoBuscaVenda[]> {
  await requireAuth();
  return query<ResultadoBuscaVenda>(`${SQL_VENDA} ORDER BY v.data DESC, v.id DESC LIMIT $1`, [limite]);
}

/** Quantos produtos ativos estão com estoque baixo ou esgotado (selo no menu "Estoque"). */
export async function contarAlertasEstoque(): Promise<number> {
  await requireAuth();
  const linha = await queryOne<{ total: number }>(
    `SELECT count(*) AS total FROM produtos WHERE ativo AND estoque <= estoque_minimo`,
  );
  return linha?.total ?? 0;
}

/** Escapa curingas do LIKE (%, _ e \) digitados pela usuária. */
function escaparLike(texto: string) {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`);
}
