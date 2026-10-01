// Teste de integração das Server Actions contra o banco de STAGING (apaga dados!).
// Só roda com INTEGRACAO=1 e DATABASE_URL de staging:
//   INTEGRACAO=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run acoes.integracao
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAuth: vi.fn(async () => {}) }));

const ativo = process.env.INTEGRACAO === "1" && (process.env.DATABASE_URL ?? "").includes("staging");

describe.skipIf(!ativo)("ações no banco (staging)", async () => {
  const { pool, query } = await import("@/lib/db");
  const acoes = await import("./index");

  beforeAll(async () => {
    await pool.query(
      `TRUNCATE itens_venda, movimentacoes_estoque, vendas, produtos, categorias, clientes RESTART IDENTITY CASCADE`,
    );
    // O teste de configurações grava estoque_minimo_padrao = 4; volta ao padrão (5) para reexecuções.
    await pool.query(`DELETE FROM configuracoes WHERE chave = 'estoque_minimo_padrao'`);
  });
  afterAll(async () => {
    await pool.end();
  });

  let produtoId = 0;
  let categoriaId = 0;
  let clienteId = 0;
  let vendaId = 0;

  it("categoria e produto", async () => {
    const cat = await acoes.criarCategoria({ nome: "Florais" });
    expect(cat.ok).toBe(true);
    categoriaId = cat.id!;
    expect((await acoes.criarCategoria({ nome: "florais" })).ok).toBe(false);

    const fd = new FormData();
    for (const [k, v] of Object.entries({
      nome: "Vela Lavanda",
      aroma: "Lavanda",
      preco: "40,00",
      custo: "16",
      sku: "lav-1",
      categoria_id: String(categoriaId),
      estoque_inicial: "10",
    }))
      fd.set(k, v);
    const p = await acoes.criarProduto(null, fd);
    expect(p).toMatchObject({ ok: true });
    produtoId = p.id!;
    const [row] = await query<{ estoque: number; estoque_minimo: number; custo: number }>(
      `SELECT estoque, estoque_minimo, custo FROM produtos WHERE id = $1`,
      [produtoId],
    );
    expect(row).toEqual({ estoque: 10, estoque_minimo: 5, custo: 16 });

    const dup = await acoes.criarProduto({ nome: "Outra", aroma: "X", preco: 10, sku: "LAV-1" });
    expect(dup).toMatchObject({ ok: false, erro: "Já existe outro produto com esse SKU." });

    expect((await acoes.excluirCategoria({ id: categoriaId })).ok).toBe(false);
    const ed = await acoes.editarProduto({ id: produtoId, preco: "42" });
    expect(ed.ok).toBe(true);
    const [depois] = await query<{ preco: number; custo: number; sku: string }>(
      `SELECT preco, custo, sku FROM produtos WHERE id = $1`,
      [produtoId],
    );
    expect(depois).toEqual({ preco: 42, custo: 16, sku: "LAV-1" });

    const copia = await acoes.duplicarProduto({ id: produtoId });
    expect(copia.ok).toBe(true);
    expect((await acoes.desativarProduto({ id: copia.id! })).ok).toBe(true);
  });

  it("estoque", async () => {
    const e = await acoes.registrarEntrada({ produto_id: produtoId, quantidade: 5, motivo: "compra" });
    expect(e).toMatchObject({ ok: true, dados: { saldo: 15 } });
    const s = await acoes.registrarSaida({ produto_id: produtoId, quantidade: 2, motivo: "avaria" });
    expect(s).toMatchObject({ ok: true, dados: { saldo: 13 } });
    expect((await acoes.registrarSaida({ produto_id: produtoId, quantidade: 99, motivo: "perda" })).ok).toBe(false);
    const aj = await acoes.ajustarInventario({ produto_id: produtoId, contagem: 12 });
    expect(aj).toMatchObject({ ok: true, dados: { saldo: 12, diferenca: -1 } });
    const igual = await acoes.ajustarInventario({ produto_id: produtoId, contagem: 12 });
    expect(igual.ok && igual.id).toBeUndefined();

    const fd = new FormData();
    fd.set(`quantidade_${produtoId}`, "3");
    fd.set("quantidade_999", "");
    const lote = await acoes.entradaEmLote(null, fd);
    expect(lote).toMatchObject({ ok: true, dados: { itens: 1, unidades: 3 } });

    const movs = await query<{ motivo: string; saldo_apos: number }>(
      `SELECT motivo, saldo_apos FROM movimentacoes_estoque WHERE produto_id = $1 ORDER BY id`,
      [produtoId],
    );
    expect(movs.map((m) => `${m.motivo}:${m.saldo_apos}`)).toEqual([
      "estoque_inicial:10",
      "compra:15",
      "avaria:13",
      "ajuste_inventario:12",
      "producao:15",
    ]);
  });

  it("cliente, venda e cancelamento", async () => {
    const c = await acoes.criarCliente({ nome: "Maria", telefone: "(11) 98765-4321" });
    expect(c).toMatchObject({ ok: true, dados: { nome: "Maria", telefone: "11987654321" } });
    clienteId = c.id!;

    const v = await acoes.registrarVenda({
      itens: [
        { produto_id: produtoId, quantidade: 2 },
        { produto_id: produtoId, quantidade: 1 },
      ],
      cliente_id: clienteId,
      forma_pagamento: "dinheiro",
      canal: "feira",
      desconto_tipo: "percentual",
      desconto_valor: 10,
      valor_recebido: "150",
    });
    expect(v).toMatchObject({ ok: true, dados: { subtotal: 126, desconto: 12.6, total: 113.4, troco: 36.6 } });
    vendaId = v.id!;
    const [item] = await query<{ quantidade: number; custo_unitario: number }>(
      `SELECT quantidade, custo_unitario FROM itens_venda WHERE venda_id = $1`,
      [vendaId],
    );
    expect(item).toEqual({ quantidade: 3, custo_unitario: 16 });

    const pouco = await acoes.registrarVenda({ itens: [{ produto_id: produtoId, quantidade: 1 }], forma_pagamento: "dinheiro", valor_recebido: 1 });
    expect(pouco.ok).toBe(false);
    const demais = await acoes.registrarVenda({ itens: [{ produto_id: produtoId, quantidade: 1000 }] });
    expect(demais).toMatchObject({ ok: false });
    expect((demais as { erro: string }).erro).toMatch(/Estoque insuficiente/);

    const cancel = await acoes.cancelarVenda({ id: vendaId, motivo: "Cliente desistiu" });
    expect(cancel.ok).toBe(true);
    expect((await acoes.cancelarVenda({ id: vendaId, motivo: "de novo" })).ok).toBe(false);
    const [p] = await query<{ estoque: number }>(`SELECT estoque FROM produtos WHERE id = $1`, [produtoId]);
    expect(p.estoque).toBe(15);
    const [venda] = await query<{ status: string }>(`SELECT status FROM vendas WHERE id = $1`, [vendaId]);
    expect(venda.status).toBe("cancelada");
  });

  it("configurações", async () => {
    const r = await acoes.salvarConfiguracoes({
      loja_nome: "Velas Luamme",
      loja_telefone: "11 98765-4321",
      loja_instagram: "@velasluamme",
      loja_endereco: "",
      recibo_rodape: "Obrigada!",
      estoque_minimo_padrao: "4",
    });
    expect(r.ok).toBe(true);
    const { getConfiguracoes } = await import("../configuracoes");
    expect(await getConfiguracoes()).toMatchObject({ loja_instagram: "velasluamme", estoque_minimo_padrao: 4 });
    expect((await acoes.trocarSenha({ senha_atual: "errada", nova_senha: "12345678", confirmacao: "12345678" })).ok).toBe(false);
  });
});
