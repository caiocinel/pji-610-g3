import { describe, expect, it } from "vitest";
import { calcularDesconto } from "./calculos";
import { falhaValidacao, formDataParaObjeto, lerEntrada } from "./resultado";
import {
  criarClienteSchema,
  criarProdutoSchema,
  editarClienteSchema,
  editarProdutoSchema,
  entradaLoteSchema,
  registrarVendaSchema,
  saidaEstoqueSchema,
  trocarSenhaSchema,
} from "./schemas";

function fd(campos: Record<string, string | string[]>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) for (const x of [v].flat()) f.append(k, x);
  return f;
}

describe("lerEntrada", () => {
  it("aceita (estado, FormData), (FormData) e objeto", () => {
    const f = fd({ nome: "Vela", $ACTION_ID_abc: "", "tags[]": ["a", "b"] });
    expect(lerEntrada(null, f)).toEqual({ nome: "Vela", tags: ["a", "b"] });
    expect(lerEntrada({ ok: true, mensagem: "x" }, f)).toEqual({ nome: "Vela", tags: ["a", "b"] });
    expect(lerEntrada(f)).toEqual({ nome: "Vela", tags: ["a", "b"] });
    expect(lerEntrada({ nome: "Obj" })).toEqual({ nome: "Obj" });
    expect(lerEntrada(null)).toEqual({});
  });
  it("campos repetidos sem [] viram array", () => {
    expect(formDataParaObjeto(fd({ x: ["1", "2"] }))).toEqual({ x: ["1", "2"] });
  });
});

describe("produto", () => {
  it("rejeita preço zero", () => {
    const r = criarProdutoSchema.safeParse({ nome: "Vela", aroma: "X", preco: "0,00" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("Informe um preço maior que zero.");
  });

  it("converte texto de formulário", () => {
    const r = criarProdutoSchema.parse(
      lerEntrada(
        fd({
          nome: " Vela Lavanda ",
          aroma: "Lavanda",
          preco: "39,90",
          custo: "",
          sku: "lav-1",
          peso_g: "",
          estoque_inicial: "10",
          categoria_id: "",
        }),
      ),
    );
    expect(r).toMatchObject({
      nome: "Vela Lavanda",
      preco: 39.9,
      custo: 0,
      sku: "LAV-1",
      peso_g: null,
      estoque_inicial: 10,
      categoria_id: null,
      descricao: "",
    });
    expect(r.estoque_minimo).toBeUndefined();
  });
  it("mensagens amigáveis", () => {
    const r = criarProdutoSchema.safeParse({ nome: "", aroma: "x", preco: "abc" });
    expect(r.success).toBe(false);
    const f = falhaValidacao(r.error!);
    expect(f.erro).toBe("Informe o nome da vela.");
    expect(f.campos?.preco).toMatch(/Preço/);
  });
  it("edição parcial: ausente fica undefined, vazio limpa", () => {
    const r = editarProdutoSchema.parse({ id: "3", preco: "45", sku: "", categoria_id: "" });
    expect(r).toEqual({ id: 3, preco: 45, sku: null, categoria_id: null });
    expect(r.nome).toBeUndefined();
  });
  it("edição parcial de cliente", () => {
    expect(editarClienteSchema.parse({ id: 2, telefone: "11 98765-4321" })).toEqual({ id: 2, telefone: "11987654321" });
  });
});

describe("venda", () => {
  it("aplica padrões e aceita itens em JSON", () => {
    const r = registrarVendaSchema.parse(lerEntrada(fd({ itens: JSON.stringify([{ produto_id: 1, quantidade: 2 }]) })));
    expect(r).toMatchObject({
      itens: [{ produto_id: 1, quantidade: 2 }],
      forma_pagamento: "pix",
      canal: "loja",
      desconto_tipo: "valor",
      desconto_valor: 0,
      valor_recebido: null,
      cliente_id: null,
      observacao: "",
    });
  });
  it("aceita o formato da v1 (produtoId)", () => {
    const r = registrarVendaSchema.parse({ itens: [{ produtoId: 4, quantidade: 1 }], observacao: "" });
    expect(r.itens).toMatchObject([{ produto_id: 4, quantidade: 1 }]);
  });
  it("rejeita venda vazia e forma inválida", () => {
    expect(registrarVendaSchema.safeParse({ itens: [] }).error?.issues[0].message).toMatch(/pelo menos um produto/);
    expect(
      registrarVendaSchema.safeParse({ itens: [{ produto_id: 1, quantidade: 1 }], forma_pagamento: "cheque" }).success,
    ).toBe(false);
  });
  it("desconto e valor recebido em texto", () => {
    const r = registrarVendaSchema.parse({
      itens: [{ produto_id: 1, quantidade: 1 }],
      forma_pagamento: "dinheiro",
      desconto_tipo: "percentual",
      desconto_valor: "10",
      valor_recebido: "50,00",
    });
    expect(r).toMatchObject({ desconto_valor: 10, valor_recebido: 50, desconto_tipo: "percentual" });
  });
  it("percentual não é arredondado (igual à prévia do PDV); valor em R$ é", () => {
    const item = [{ produto_id: 1, quantidade: 1 }];
    const pct = registrarVendaSchema.parse({ itens: item, desconto_tipo: "percentual", desconto_valor: "33,333" });
    expect(pct.desconto_valor).toBe(33.333);
    expect(calcularDesconto(1000, "percentual", pct.desconto_valor)).toBe(333.33);
    const reais = registrarVendaSchema.parse({ itens: item, desconto_tipo: "valor", desconto_valor: "10,555" });
    expect(reais.desconto_valor).toBe(10.56);
  });
  it("chave de idempotência", () => {
    const item = [{ produto_id: 1, quantidade: 1 }];
    expect(registrarVendaSchema.parse({ itens: item }).chave_idempotencia).toBeNull();
    const uuid = "3F2504E0-4F89-41D3-9A0C-0305E82C3301";
    expect(registrarVendaSchema.parse({ itens: item, chave_idempotencia: uuid }).chave_idempotencia).toBe(uuid.toLowerCase());
    expect(registrarVendaSchema.safeParse({ itens: item, chave_idempotencia: "abc" }).success).toBe(false);
  });
});

describe("estoque", () => {
  it("saída exige motivo", () => {
    expect(saidaEstoqueSchema.safeParse({ produto_id: 1, quantidade: 1 }).success).toBe(false);
    expect(saidaEstoqueSchema.parse({ produto_id: "1", quantidade: "2", motivo: "perda" })).toMatchObject({ quantidade: 2 });
  });
  it("lote valida itens", () => {
    expect(entradaLoteSchema.safeParse({ itens: [] }).success).toBe(false);
    expect(entradaLoteSchema.parse({ itens: [{ produto_id: 1, quantidade: "3" }] }).motivo).toBe("producao");
    expect(entradaLoteSchema.safeParse({ itens: [{ produto_id: 1, quantidade: 0 }] }).success).toBe(false);
  });
});

describe("cliente e senha", () => {
  it("normaliza cliente", () => {
    expect(criarClienteSchema.parse({ nome: "Ana", telefone: "(11) 98765-4321", instagram: "@ana", email: "" })).toEqual({
      nome: "Ana",
      telefone: "11987654321",
      email: "",
      instagram: "ana",
      observacoes: "",
    });
    expect(criarClienteSchema.safeParse({ nome: "Ana", email: "x@" }).success).toBe(false);
  });
  it("confirmação de senha", () => {
    expect(
      trocarSenhaSchema.safeParse({ senha_atual: "a", nova_senha: "12345678", confirmacao: "1234567" }).success,
    ).toBe(false);
    expect(
      trocarSenhaSchema.safeParse({ senha_atual: "a", nova_senha: "12345678", confirmacao: "12345678" }).success,
    ).toBe(true);
  });
});
