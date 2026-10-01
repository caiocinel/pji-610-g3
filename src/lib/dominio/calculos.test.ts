import { describe, expect, it } from "vitest";
import {
  arredondar,
  calcularDesconto,
  calcularMargem,
  calcularSubtotal,
  calcularTotaisVenda,
  calcularTroco,
  diferencaInventario,
  normalizarInstagram,
  normalizarSku,
  normalizarTelefone,
  parseDecimalBR,
  precoPorMargem,
  situacaoEstoque,
  telefoneValido,
  ticketMedio,
  validarDesconto,
  variacao,
} from "./calculos";

describe("arredondar", () => {
  it("arredonda para centavos sem erro de ponto flutuante", () => {
    expect(arredondar(1.005)).toBe(1.01);
    expect(arredondar(0.1 + 0.2)).toBe(0.3);
    expect(arredondar(39.9 * 3)).toBe(119.7);
    expect(arredondar(NaN)).toBe(0);
  });
});

describe("parseDecimalBR", () => {
  it.each([
    ["39,90", 39.9],
    ["39.90", 39.9],
    ["1.234,56", 1234.56],
    ["1.234", 1234],
    ["R$ 10,5", 10.5],
    [" 7 ", 7],
    [12.5, 12.5],
  ] as const)("%s → %s", (entrada, esperado) => {
    expect(parseDecimalBR(entrada)).toBe(esperado);
  });
  it("devolve NaN para texto inválido", () => {
    expect(parseDecimalBR("abc")).toBeNaN();
    expect(parseDecimalBR("")).toBeNaN();
    expect(parseDecimalBR(null)).toBeNaN();
    expect(parseDecimalBR("1,2,3")).toBeNaN();
  });
});

describe("totais da venda", () => {
  const linhas = [
    { preco_unitario: 39.9, quantidade: 3 },
    { preco_unitario: 24.5, quantidade: 1 },
  ];
  it("soma o subtotal", () => {
    expect(calcularSubtotal(linhas)).toBe(144.2);
    expect(calcularSubtotal([])).toBe(0);
  });
  it("desconto em valor e percentual", () => {
    expect(calcularDesconto(144.2, "valor", 10)).toBe(10);
    expect(calcularDesconto(144.2, "percentual", 10)).toBe(14.42);
    expect(calcularDesconto(100, "percentual", 0)).toBe(0);
    expect(calcularDesconto(100, "valor", -5)).toBe(0);
  });
  it("valida limites do desconto", () => {
    expect(validarDesconto(100, "valor", 100)).toBeNull();
    expect(validarDesconto(100, "valor", 100.01)).toMatch(/maior que o subtotal/);
    expect(validarDesconto(100, "percentual", 101)).toMatch(/100%/);
    expect(validarDesconto(100, "valor", -1)).toMatch(/negativo/);
  });
  it("calcula total nunca negativo", () => {
    expect(calcularTotaisVenda(linhas, { tipo: "percentual", valor: 10 })).toEqual({
      subtotal: 144.2,
      desconto: 14.42,
      total: 129.78,
    });
    expect(calcularTotaisVenda(linhas, { tipo: "valor", valor: 999 }).total).toBe(0);
    expect(calcularTotaisVenda(linhas).desconto).toBe(0);
  });
  it("calcula troco", () => {
    expect(calcularTroco(129.78, 150)).toBe(20.22);
    expect(calcularTroco(50, 50)).toBe(0);
    expect(calcularTroco(50, 40)).toBeNull();
    expect(calcularTroco(50, null)).toBeNull();
  });
});

describe("margem", () => {
  it("lucro, margem e markup", () => {
    const m = calcularMargem(40, 16);
    expect(m.lucro).toBe(24);
    expect(m.margem).toBeCloseTo(0.6);
    expect(m.markup).toBeCloseTo(1.5);
  });
  it("sem preço ou custo", () => {
    expect(calcularMargem(0, 10).margem).toBeNull();
    expect(calcularMargem(10, 0).markup).toBeNull();
  });
  it("preço por margem", () => {
    expect(precoPorMargem(16, 0.6)).toBe(40);
    expect(precoPorMargem(16, 1)).toBeNull();
    // 12,35 / 0,4 = 30,875 → nunca abaixo da margem anunciada
    expect(precoPorMargem(12.35, 0.6)).toBe(30.88);
    expect(calcularMargem(30.88, 12.35).margem!).toBeGreaterThanOrEqual(0.6);
  });
});

describe("estoque", () => {
  it("situação", () => {
    expect(situacaoEstoque(0, 5)).toBe("esgotado");
    expect(situacaoEstoque(5, 5)).toBe("baixo");
    expect(situacaoEstoque(6, 5)).toBe("ok");
  });
  it("diferença de inventário", () => {
    expect(diferencaInventario(10, 12)).toEqual({ diferenca: 2, tipo: "entrada", quantidade: 2 });
    expect(diferencaInventario(10, 7)).toEqual({ diferenca: -3, tipo: "saida", quantidade: 3 });
    expect(diferencaInventario(10, 10).tipo).toBeNull();
  });
});

describe("indicadores", () => {
  it("variação e ticket médio", () => {
    expect(variacao(120, 100)).toBeCloseTo(0.2);
    expect(variacao(10, 0)).toBeNull();
    expect(ticketMedio(100, 3)).toBe(33.33);
    expect(ticketMedio(100, 0)).toBe(0);
  });
});

describe("normalizações", () => {
  it("telefone", () => {
    expect(normalizarTelefone("+55 (11) 98765-4321")).toBe("11987654321");
    expect(normalizarTelefone("(11) 3333-4444")).toBe("1133334444");
    expect(telefoneValido("11 98765-4321")).toBe(true);
    expect(telefoneValido("")).toBe(true);
    expect(telefoneValido("12345")).toBe(false);
  });
  it("instagram e SKU", () => {
    expect(normalizarInstagram("@luamme.velas")).toBe("luamme.velas");
    expect(normalizarInstagram("https://www.instagram.com/luamme.velas/?hl=pt")).toBe("luamme.velas");
    expect(normalizarSku("  lav-200 ")).toBe("LAV-200");
    expect(normalizarSku("")).toBeNull();
  });
});
