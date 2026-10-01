// Teste de integração (SOMENTE LEITURA) das consultas de relatório contra o banco de staging.
//   INTEGRACAO=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run relatorios.integracao
import { afterAll, describe, expect, it, vi } from "vitest";
import { parsePeriodo } from "@/lib/periodo";

vi.mock("server-only", () => ({}));

const ativo = process.env.INTEGRACAO === "1" && (process.env.DATABASE_URL ?? "").includes("staging");

describe.skipIf(!ativo)("consultas de relatório (staging)", async () => {
  const { pool, queryOne } = await import("@/lib/db");
  const r = await import("./relatorios");
  const p = parsePeriodo({ periodo: "ano" });

  afterAll(() => pool.end());

  it("resumo bate com a soma direta das vendas concluídas", async () => {
    const resumo = await r.resumoVendas(p);
    const direto = await queryOne<{ total: number; n: number }>(
      `SELECT COALESCE(SUM(total),0) AS total, count(*) AS n FROM vendas
        WHERE status='concluida' AND data >= $1 AND data < $2`,
      [p.inicio, p.fim],
    );
    expect(resumo.faturamento).toBeCloseTo(direto!.total, 2);
    expect(resumo.vendas).toBe(direto!.n);
    // Lucro só sobre itens com custo informado (custo_unitario > 0).
    if (resumo.lucro != null) {
      expect(resumo.lucro).toBeCloseTo(resumo.faturamento - resumo.receita_sem_custo - resumo.custo, 1);
    }
    expect(resumo.fracao_sem_custo).toBeGreaterThanOrEqual(0);
    expect(resumo.fracao_sem_custo).toBeLessThanOrEqual(1);
  });

  it("série diária, agrupamentos e rankings somam o faturamento", async () => {
    const resumo = await r.resumoVendas(p);
    const soma = (xs: { faturamento: number }[]) => xs.reduce((s, x) => s + x.faturamento, 0);
    const dias = await r.faturamentoPorDia(p);
    expect(dias.length).toBe(p.dias);
    expect(soma(dias)).toBeCloseTo(resumo.faturamento, 1);
    const semanas = await r.faturamentoPorDia(p, "semana");
    expect(semanas.length).toBeLessThanOrEqual(Math.ceil(p.dias / 7) + 1);
    expect(soma(semanas)).toBeCloseTo(resumo.faturamento, 1);
    const meses = await r.faturamentoPorDia(p, "mes");
    expect(soma(meses)).toBeCloseTo(resumo.faturamento, 1);
    expect(soma(await r.porFormaPagamento(p))).toBeCloseTo(resumo.faturamento, 1);
    expect(soma(await r.porCanal(p))).toBeCloseTo(resumo.faturamento, 1);
    expect(soma(await r.porCategoria(p))).toBeCloseTo(resumo.faturamento, 0);
    expect(soma(await r.porAroma(p))).toBeCloseTo(resumo.faturamento, 0);
    expect(soma(await r.rankingProdutos(p))).toBeCloseTo(resumo.faturamento, 0);
    const semana = await r.porDiaSemana(p);
    expect(semana.length).toBe(7);
    expect(soma(semana)).toBeCloseTo(resumo.faturamento, 1);
    expect(semana.reduce((s, d) => s + d.ocorrencias, 0)).toBe(p.dias);
  });

  it("clientes, parados, alertas e últimas vendas", async () => {
    const clientes = await r.rankingClientes(p, 5);
    expect(clientes.length).toBeLessThanOrEqual(5);
    const sem = await r.vendasSemCliente(p);
    expect(sem.vendas).toBeGreaterThanOrEqual(0);
    const parados = await r.produtosParados(parsePeriodo({ periodo: "7d" }));
    expect(Array.isArray(parados)).toBe(true);
    const alertas = await r.alertasEstoque(3);
    expect(alertas.itens.length).toBeLessThanOrEqual(3);
    const ultimas = await r.ultimasVendas(5);
    expect(ultimas.every((v) => v.status === "concluida")).toBe(true);
    expect(await r.existeVenda()).toBe(true);
  });
});
