import { describe, expect, it } from "vitest";
import { gerarHashSenha, verificarHashSenha } from "./senha";

describe("senha scrypt", () => {
  it("gera e verifica", async () => {
    const hash = await gerarHashSenha("vela-cheirosa-123");
    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(await verificarHashSenha("vela-cheirosa-123", hash)).toBe(true);
    expect(await verificarHashSenha("errada", hash)).toBe(false);
    expect(await verificarHashSenha("x", "lixo")).toBe(false);
  });
  it("salt diferente a cada hash", async () => {
    expect(await gerarHashSenha("a")).not.toBe(await gerarHashSenha("a"));
  });
});
