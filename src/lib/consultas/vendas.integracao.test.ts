// Teste de leitura (não altera dados) das consultas de vendas contra o STAGING.
//   INTEGRACAO=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run consultas/vendas.integracao
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const ativo = process.env.INTEGRACAO === "1" && (process.env.DATABASE_URL ?? "").includes("staging");

describe.skipIf(!ativo)("consultas de vendas (staging)", async () => {
  const { pool, queryOne } = await import("@/lib/db");
  const c = await import("./vendas");
  afterAll(() => pool.end());

  it("lista com totais só de concluídas", async () => {
    const f = c.lerFiltrosVendas({ periodo: "ano" });
    const r = await c.listarVendas(f, 1);
    expect(r.itens.length).toBeGreaterThan(0);
    expect(r.itens.length).toBeLessThanOrEqual(c.VENDAS_POR_PAGINA);
    const esperado = await queryOne<{ s: number; n: number }>(
      `SELECT coalesce(sum(total),0) AS s, count(*)::int AS n FROM vendas WHERE status='concluida' AND data >= $1 AND data < $2`,
      [f.periodo.inicio, f.periodo.fim],
    );
    expect(r.resumo.faturamento).toBeCloseTo(esperado!.s, 2);
    expect(r.resumo.vendas).toBe(esperado!.n);
    expect(r.porForma.reduce((s, x) => s + x.total, 0)).toBeCloseTo(esperado!.s, 2);
    expect(typeof r.itens[0].custo).toBe("number");
    expect(typeof r.itens[0].unidades).toBe("number");
  });

  it("filtra por status, forma e texto", async () => {
    const canc = await c.listarVendas(c.lerFiltrosVendas({ periodo: "ano", status: "cancelada" }));
    expect(canc.itens.every((v) => v.status === "cancelada")).toBe(true);
    expect(canc.resumo.faturamento).toBe(0);
    const pix = await c.listarVendas(c.lerFiltrosVendas({ periodo: "ano", forma: "pix" }));
    expect(pix.itens.every((v) => v.forma_pagamento === "pix")).toBe(true);
    const nome = pix.itens.find((v) => v.cliente_nome)?.cliente_nome;
    if (nome) {
      const busca = await c.listarVendas(c.lerFiltrosVendas({ periodo: "ano", q: nome.slice(0, 5) }));
      expect(busca.itens.length).toBeGreaterThan(0);
    }
  });

  it("busca por nº ignora o período", async () => {
    const primeira = await queryOne<{ id: number }>(`SELECT min(id) AS id FROM vendas`);
    const r = await c.listarVendas(c.lerFiltrosVendas({ periodo: "hoje", q: `#${primeira!.id}` }));
    expect(r.itens.map((v) => v.id)).toEqual([primeira!.id]);
  });

  it("detalhe com itens, custo e vizinhas", async () => {
    const v = await queryOne<{ id: number }>(`SELECT id FROM vendas WHERE cliente_id IS NOT NULL ORDER BY data DESC OFFSET 3 LIMIT 1`);
    const d = await c.obterVenda(v!.id);
    expect(d).not.toBeNull();
    expect(d!.itens.length).toBeGreaterThan(0);
    expect(d!.cliente?.nome).toBeTruthy();
    expect(d!.anterior).not.toBeNull();
    expect(d!.proxima).not.toBeNull();
    expect(d!.subtotal).toBeCloseTo(d!.itens.reduce((s, i) => s + i.subtotal, 0), 2);
    expect(await c.obterVenda(999999999)).toBeNull();
  });

  it("CSV de vendas e de itens", async () => {
    const f = c.lerFiltrosVendas({ periodo: "30d" });
    const vendas = await c.listarVendasParaCSV(f);
    const itens = await c.listarItensParaCSV(f);
    expect(itens.length).toBeGreaterThanOrEqual(vendas.length);
    expect((await c.listarClientesFiltro()).length).toBeGreaterThan(0);
  });
});
