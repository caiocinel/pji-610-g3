import { tipoExportacao, TIPOS_EXPORTACAO } from "@/app/(painel)/relatorios/_componentes/exportacao";
import { isAuthenticated } from "@/lib/auth";
import {
  faturamentoPorDia,
  porAroma,
  porCanal,
  porCategoria,
  porDiaSemana,
  porFormaPagamento,
  produtosParados,
  rankingClientes,
  rankingProdutos,
  resumoVendas,
  type FatiaItens,
  type FatiaVendas,
  type ResumoVendas,
} from "@/lib/consultas/relatorios";
import { gerarCSV, nomeArquivoCSV, respostaCSV, type ColunaCSV } from "@/lib/csv";
import { ROTULO_CANAL, ROTULO_FORMA_PAGAMENTO, rotulo, variacao } from "@/lib/dominio";
import { dataBR, parsePeriodo } from "@/lib/periodo";

export const dynamic = "force-dynamic";

const DIAS_SEMANA = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];

/** Participação (fração) arredondada a 4 casas, para virar "% do total" no Excel. */
const parte = (v: number, total: number) => (total > 0 ? Math.round((v / total) * 10000) / 100 : 0);
/** Fração → porcentagem com 2 casas (null continua null). */
const pct = (f: number | null) => (f == null ? null : Math.round(f * 10000) / 100);

const colunasFatiaItens = (total: number, primeira: string): ColunaCSV<FatiaItens>[] => [
  { titulo: primeira, valor: (l) => l.rotulo },
  { titulo: "Unidades", valor: (l) => l.unidades },
  { titulo: "Faturamento (R$)", valor: (l) => l.faturamento },
  { titulo: "% do faturamento", valor: (l) => parte(l.faturamento, total) },
  { titulo: "Custo (R$)", valor: (l) => l.custo },
  { titulo: "Lucro bruto (R$)", valor: (l) => l.lucro },
  { titulo: "Margem (%)", valor: (l) => pct(l.margem) },
  { titulo: "Faturamento sem custo informado (R$)", valor: (l) => l.receita_sem_custo },
];

// Lucro e margem consideram só itens com custo informado (custo_unitario > 0); o faturamento sem custo
// sai numa coluna própria.
// GET /api/export/relatorios?tipo=resumo|diario|produtos|clientes|categorias|aromas|pagamentos|canais|semana|parados
//   &periodo=…[&de=…&ate=…]  — vendas canceladas nunca entram.
export async function GET(req: Request) {
  if (!(await isAuthenticated())) {
    return new Response("Sessão expirada. Entre novamente.", { status: 401 });
  }
  const sp = new URL(req.url).searchParams;
  const tipo = tipoExportacao(sp.get("tipo"));
  if (!tipo) return new Response("Tipo de relatório inválido.", { status: 400 });
  const periodo = parsePeriodo(sp);
  const nome = nomeArquivoCSV(TIPOS_EXPORTACAO.find((t) => t.tipo === tipo)!.arquivo, periodo);
  const csv = (conteudo: string) => respostaCSV(nome, conteudo);

  switch (tipo) {
    case "resumo": {
      const [atual, anterior] = await Promise.all([resumoVendas(periodo), resumoVendas(periodo.anterior)]);
      const metricas: { titulo: string; valor: (r: ResumoVendas) => number | null; pontos?: boolean }[] = [
        { titulo: "Faturamento (R$)", valor: (r) => r.faturamento },
        { titulo: "Vendas", valor: (r) => r.vendas },
        { titulo: "Ticket médio (R$)", valor: (r) => r.ticket },
        { titulo: "Unidades vendidas", valor: (r) => r.unidades },
        { titulo: "Custo dos produtos (R$)", valor: (r) => r.custo },
        { titulo: "Lucro bruto (R$)", valor: (r) => r.lucro },
        { titulo: "Margem média (%)", valor: (r) => pct(r.margem), pontos: true },
        { titulo: "Faturamento sem custo informado (R$)", valor: (r) => r.receita_sem_custo },
        { titulo: "% do faturamento sem custo informado", valor: (r) => pct(r.fracao_sem_custo), pontos: true },
        { titulo: "Descontos concedidos (R$)", valor: (r) => r.descontos },
        { titulo: "Clientes identificados", valor: (r) => r.clientes },
      ];
      return csv(
        gerarCSV(metricas, [
          { titulo: "Indicador", valor: (m) => m.titulo },
          { titulo: `Período (${periodo.intervalo})`, valor: (m) => m.valor(atual) },
          {
            titulo: `Período anterior (${periodo.anterior.de === periodo.anterior.ate ? dataBR(periodo.anterior.de) : `${dataBR(periodo.anterior.de)} a ${dataBR(periodo.anterior.ate)}`})`,
            valor: (m) => m.valor(anterior),
          },
          {
            titulo: "Variação (%)",
            valor: (m) => {
              const a = m.valor(atual);
              const b = m.valor(anterior);
              if (a == null || b == null) return null;
              if (m.pontos) return null; // margem: compare as colunas (pontos percentuais)
              const v = variacao(a, b);
              return v == null ? null : Math.round(v * 10000) / 100;
            },
          },
        ]),
      );
    }
    case "diario": {
      const dias = await faturamentoPorDia(periodo);
      return csv(
        gerarCSV(dias, [
          { titulo: "Data", valor: (d) => dataBR(d.dia) },
          { titulo: "Dia da semana", valor: (d) => DIAS_SEMANA[(new Date(`${d.dia}T12:00:00Z`).getUTCDay() + 6) % 7] },
          { titulo: "Vendas", valor: (d) => d.vendas },
          { titulo: "Faturamento (R$)", valor: (d) => d.faturamento },
          { titulo: "Lucro bruto (R$)", valor: (d) => d.lucro },
          { titulo: "Faturamento sem custo informado (R$)", valor: (d) => d.receita_sem_custo },
        ]),
      );
    }
    case "produtos": {
      const produtos = await rankingProdutos(periodo);
      const total = produtos.reduce((s, p) => s + p.faturamento, 0);
      return csv(
        gerarCSV(produtos, [
          { titulo: "Posição", valor: (p) => produtos.indexOf(p) + 1 },
          { titulo: "Vela", valor: (p) => p.nome },
          { titulo: "Aroma", valor: (p) => p.aroma },
          { titulo: "Categoria", valor: (p) => p.categoria ?? "Sem categoria" },
          { titulo: "Unidades", valor: (p) => p.unidades },
          { titulo: "Vendas", valor: (p) => p.vendas },
          { titulo: "Faturamento (R$)", valor: (p) => p.faturamento },
          { titulo: "% do faturamento", valor: (p) => parte(p.faturamento, total) },
          { titulo: "Custo (R$)", valor: (p) => p.custo },
          { titulo: "Lucro bruto (R$)", valor: (p) => p.lucro },
          { titulo: "Margem (%)", valor: (p) => pct(p.margem) },
          { titulo: "Faturamento sem custo informado (R$)", valor: (p) => p.receita_sem_custo },
          { titulo: "Ativo", valor: (p) => p.ativo },
        ]),
      );
    }
    case "clientes": {
      const clientes = await rankingClientes(periodo, 10000);
      return csv(
        gerarCSV(clientes, [
          { titulo: "Posição", valor: (c) => clientes.indexOf(c) + 1 },
          { titulo: "Cliente", valor: (c) => c.nome },
          { titulo: "Telefone", valor: (c) => c.telefone },
          { titulo: "Compras", valor: (c) => c.compras },
          { titulo: "Total gasto (R$)", valor: (c) => c.faturamento },
          { titulo: "Ticket médio (R$)", valor: (c) => c.ticket },
          { titulo: "Última compra", valor: (c) => c.ultima_compra },
        ]),
      );
    }
    case "categorias":
    case "aromas": {
      const linhas = tipo === "categorias" ? await porCategoria(periodo) : await porAroma(periodo);
      const total = linhas.reduce((s, l) => s + l.faturamento, 0);
      return csv(gerarCSV(linhas, colunasFatiaItens(total, tipo === "categorias" ? "Categoria" : "Aroma")));
    }
    case "pagamentos":
    case "canais": {
      const linhas: FatiaVendas[] = tipo === "pagamentos" ? await porFormaPagamento(periodo) : await porCanal(periodo);
      const total = linhas.reduce((s, l) => s + l.faturamento, 0);
      const rotulos: Record<string, string> = tipo === "pagamentos" ? ROTULO_FORMA_PAGAMENTO : ROTULO_CANAL;
      return csv(
        gerarCSV(linhas, [
          { titulo: tipo === "pagamentos" ? "Forma de pagamento" : "Canal", valor: (l) => rotulo(rotulos, l.chave) },
          { titulo: "Vendas", valor: (l) => l.vendas },
          { titulo: "Faturamento (R$)", valor: (l) => l.faturamento },
          { titulo: "% do faturamento", valor: (l) => parte(l.faturamento, total) },
          { titulo: "Ticket médio (R$)", valor: (l) => (l.vendas ? Math.round((l.faturamento / l.vendas) * 100) / 100 : 0) },
        ]),
      );
    }
    case "semana": {
      const dias = await porDiaSemana(periodo);
      return csv(
        gerarCSV(dias, [
          { titulo: "Dia da semana", valor: (d) => DIAS_SEMANA[d.isodow - 1] },
          { titulo: "Vendas", valor: (d) => d.vendas },
          { titulo: "Faturamento (R$)", valor: (d) => d.faturamento },
          { titulo: "Dias no período", valor: (d) => d.ocorrencias },
          { titulo: "Média por dia (R$)", valor: (d) => d.media },
        ]),
      );
    }
    case "parados": {
      const parados = await produtosParados(periodo);
      return csv(
        gerarCSV(parados, [
          { titulo: "Vela", valor: (p) => p.nome },
          { titulo: "Aroma", valor: (p) => p.aroma },
          { titulo: "Categoria", valor: (p) => p.categoria ?? "Sem categoria" },
          { titulo: "Estoque", valor: (p) => p.estoque },
          { titulo: "Preço (R$)", valor: (p) => p.preco },
          { titulo: "Valor em estoque a custo (R$)", valor: (p) => p.valor_custo },
          { titulo: "Valor em estoque a preço de venda (R$)", valor: (p) => p.valor_venda },
          { titulo: "Última venda", valor: (p) => p.ultima_venda ?? "Nunca vendida" },
        ]),
      );
    }
  }
}
