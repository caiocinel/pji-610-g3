import { requireAuth } from "@/lib/auth";
import {
  lerFiltrosMovimentacoes,
  lerFiltrosPosicao,
  movimentacoesParaCSV,
  posicaoEstoqueParaCSV,
} from "@/lib/consultas/estoque";
import { gerarCSV, nomeArquivoCSV, numeroCSV, respostaCSV } from "@/lib/csv";
import { ROTULO_MOTIVO, ROTULO_SITUACAO_ESTOQUE, ROTULO_TIPO_MOVIMENTACAO, rotulo } from "@/lib/dominio";
import { hojeSP } from "@/lib/periodo";

/** R$ sempre com 2 casas ("10,20", "0,00"), igual à tela. Valores aqui nunca são negativos. */
const dinheiro = (v: number) => numeroCSV(v, 2);

/**
 * CSV do estoque (abre direto no Excel).
 * - padrão: posição atual por vela, com os filtros da tela /estoque (q, categoria, situacao, ordenar);
 * - ?relatorio=movimentacoes: histórico com os filtros de /estoque/movimentacoes (q, produto, tipo, motivo, período).
 */
export async function GET(req: Request) {
  await requireAuth();
  const sp = new URL(req.url).searchParams;

  if (sp.get("relatorio") === "movimentacoes") {
    const f = lerFiltrosMovimentacoes(sp);
    const linhas = await movimentacoesParaCSV(f);
    const conteudo = gerarCSV(linhas, [
      { titulo: "Data", valor: (m) => m.criado_em },
      { titulo: "Vela", valor: (m) => m.produto_nome },
      { titulo: "Aroma", valor: (m) => m.produto_aroma },
      { titulo: "Tipo", valor: (m) => ROTULO_TIPO_MOVIMENTACAO[m.tipo] },
      { titulo: "Motivo", valor: (m) => rotulo(ROTULO_MOTIVO, m.motivo) },
      // Quantidade com sinal, para somar direto na planilha.
      { titulo: "Quantidade", valor: (m) => (m.tipo === "entrada" ? m.quantidade : -m.quantidade) },
      { titulo: "Saldo depois", valor: (m) => m.saldo_apos },
      { titulo: "Venda nº", valor: (m) => m.venda_id },
      { titulo: "Observação", valor: (m) => m.observacao },
    ]);
    return respostaCSV(nomeArquivoCSV("movimentacoes_estoque", f.periodo ?? undefined), conteudo);
  }

  const f = lerFiltrosPosicao(sp);
  const linhas = await posicaoEstoqueParaCSV(f);
  const conteudo = gerarCSV(linhas, [
    { titulo: "Vela", valor: (p) => p.nome },
    { titulo: "Aroma", valor: (p) => p.aroma },
    { titulo: "Categoria", valor: (p) => p.categoria_nome },
    { titulo: "Código (SKU)", valor: (p) => p.sku },
    { titulo: "Estoque (un.)", valor: (p) => p.estoque },
    { titulo: "Mínimo (un.)", valor: (p) => p.estoque_minimo },
    { titulo: "Situação", valor: (p) => ROTULO_SITUACAO_ESTOQUE[p.situacao] },
    { titulo: "Custo unitário (R$)", valor: (p) => dinheiro(p.custo) },
    { titulo: "Preço (R$)", valor: (p) => dinheiro(p.preco) },
    { titulo: "Valor a custo (R$)", valor: (p) => dinheiro(p.valor_custo) },
    { titulo: "Valor de venda (R$)", valor: (p) => dinheiro(p.valor_preco) },
    { titulo: "Última movimentação", valor: (p) => p.ultima_movimentacao },
  ]);
  const hoje = hojeSP();
  return respostaCSV(nomeArquivoCSV("estoque", { de: hoje, ate: hoje }), conteudo);
}
