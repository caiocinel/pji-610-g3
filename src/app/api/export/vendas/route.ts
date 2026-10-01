import { isAuthenticated } from "@/lib/auth";
import { lerFiltrosVendas, listarItensParaCSV, listarVendasParaCSV } from "@/lib/consultas/vendas";
import { gerarCSV, nomeArquivoCSV, respostaCSV } from "@/lib/csv";
import { ROTULO_CANAL, ROTULO_FORMA_PAGAMENTO, ROTULO_STATUS_VENDA } from "@/lib/dominio";

export const dynamic = "force-dynamic";

// GET /api/export/vendas?periodo=…&q=…&cliente=…&forma=…&canal=…&status=…[&formato=itens]
// Mesmos filtros do histórico. Canceladas saem no arquivo com a coluna "Situação", mas com todos os
// valores somáveis zerados (canceladas não contam em nenhum total): somar a coluna "Total" na planilha
// bate com o faturamento da tela. O valor original fica em "Valor cancelado (R$)".
export async function GET(req: Request) {
  if (!(await isAuthenticated())) {
    return new Response("Sessão expirada. Entre novamente.", { status: 401 });
  }
  const sp = new URL(req.url).searchParams;
  const filtros = lerFiltrosVendas(sp);
  const periodo = filtros.numero === null ? filtros.periodo : undefined;

  if (sp.get("formato") === "itens") {
    const itens = await listarItensParaCSV(filtros);
    return respostaCSV(
      nomeArquivoCSV("itens-vendidos", periodo),
      gerarCSV(itens, [
        { titulo: "Venda nº", valor: (i) => i.venda_id },
        { titulo: "Data", valor: (i) => i.data },
        { titulo: "Situação", valor: (i) => ROTULO_STATUS_VENDA[i.status] },
        { titulo: "Cliente", valor: (i) => i.cliente_nome ?? "" },
        { titulo: "Forma de pagamento", valor: (i) => ROTULO_FORMA_PAGAMENTO[i.forma_pagamento] },
        { titulo: "Canal", valor: (i) => ROTULO_CANAL[i.canal] },
        { titulo: "Vela", valor: (i) => i.produto_nome },
        { titulo: "Aroma", valor: (i) => i.aroma ?? "" },
        { titulo: "Categoria", valor: (i) => i.categoria ?? "" },
        { titulo: "Quantidade", valor: (i) => i.quantidade },
        { titulo: "Preço unitário (R$)", valor: (i) => i.preco_unitario },
        { titulo: "Subtotal (R$)", valor: (i) => (i.status === "cancelada" ? 0 : i.subtotal) },
        { titulo: "Custo unitário (R$)", valor: (i) => i.custo_unitario },
        { titulo: "Custo total (R$)", valor: (i) => (i.status === "cancelada" ? 0 : i.custo_total) },
        { titulo: "Lucro antes de descontos (R$)", valor: (i) => (i.status === "cancelada" ? 0 : i.lucro) },
        { titulo: "Valor cancelado (R$)", valor: (i) => (i.status === "cancelada" ? i.subtotal : null) },
      ]),
    );
  }

  const vendas = await listarVendasParaCSV(filtros);
  return respostaCSV(
    nomeArquivoCSV("vendas", periodo),
    gerarCSV(vendas, [
      { titulo: "Nº", valor: (v) => v.id },
      { titulo: "Data", valor: (v) => v.data },
      { titulo: "Situação", valor: (v) => ROTULO_STATUS_VENDA[v.status] },
      { titulo: "Cliente", valor: (v) => v.cliente_nome ?? "" },
      { titulo: "Forma de pagamento", valor: (v) => ROTULO_FORMA_PAGAMENTO[v.forma_pagamento] },
      { titulo: "Canal", valor: (v) => ROTULO_CANAL[v.canal] },
      { titulo: "Unidades", valor: (v) => v.unidades },
      { titulo: "Itens", valor: (v) => v.produtos },
      { titulo: "Subtotal (R$)", valor: (v) => (v.status === "cancelada" ? 0 : v.subtotal) },
      { titulo: "Desconto (R$)", valor: (v) => (v.status === "cancelada" ? 0 : v.desconto) },
      { titulo: "Total (R$)", valor: (v) => (v.status === "cancelada" ? 0 : v.total) },
      { titulo: "Custo (R$)", valor: (v) => (v.status === "cancelada" ? 0 : v.custo) },
      { titulo: "Lucro bruto (R$)", valor: (v) => (v.status === "cancelada" ? 0 : v.lucro) },
      { titulo: "Valor cancelado (R$)", valor: (v) => (v.status === "cancelada" ? v.total : null) },
      { titulo: "Valor recebido (R$)", valor: (v) => v.valor_recebido },
      {
        titulo: "Troco (R$)",
        valor: (v) => (v.valor_recebido != null && v.valor_recebido >= v.total ? Math.round((v.valor_recebido - v.total) * 100) / 100 : null),
      },
      { titulo: "Observação", valor: (v) => v.observacao },
      { titulo: "Cancelada em", valor: (v) => v.cancelada_em },
      { titulo: "Motivo do cancelamento", valor: (v) => v.motivo_cancelamento ?? "" },
    ]),
  );
}
