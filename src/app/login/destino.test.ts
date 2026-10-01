import { describe, expect, it } from "vitest";
import { destinoInterno } from "./destino";

describe("destinoInterno", () => {
  it("aceita caminhos internos", () => {
    expect(destinoInterno("/vendas")).toBe("/vendas");
    expect(destinoInterno("/vendas?periodo=7d&forma=pix")).toBe("/vendas?periodo=7d&forma=pix");
    expect(destinoInterno(["/produtos/3", "/x"])).toBe("/produtos/3");
  });

  it("recusa URLs externas e protocolos", () => {
    for (const v of ["//evil.com", "https://evil.com", "javascript:alert(1)", "evil.com", "/\\evil.com", "\\\\evil.com"]) {
      expect(destinoInterno(v)).toBeUndefined();
    }
  });

  it("recusa caracteres de controle que o navegador remove", () => {
    expect(destinoInterno("/\t/evil.com")).toBeUndefined();
    expect(destinoInterno("/\n/evil.com")).toBeUndefined();
    expect(destinoInterno("/\r\n/evil.com")).toBeUndefined();
    expect(destinoInterno(decodeURIComponent("/%09/evil.com"))).toBeUndefined();
  });

  it("recusa o próprio login e valores inválidos", () => {
    expect(destinoInterno("/login")).toBeUndefined();
    expect(destinoInterno("/login?de=/vendas")).toBeUndefined();
    expect(destinoInterno("")).toBeUndefined();
    expect(destinoInterno(undefined)).toBeUndefined();
    expect(destinoInterno(null)).toBeUndefined();
    expect(destinoInterno(`/${"a".repeat(600)}`)).toBeUndefined();
  });

  it("normaliza pontos sem sair do site", () => {
    expect(destinoInterno("/a/../vendas")).toBe("/vendas");
    expect(destinoInterno("/./../evil.com")).toBe("/evil.com");
  });
});
