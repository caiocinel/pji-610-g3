import { describe, expect, it } from "vitest";
import {
  formatBRL,
  formatDate,
  formatDateShort,
  formatDateTime,
  formatDecimalInput,
  formatPercent,
  formatRelative,
  formatTelefone,
  linkInstagram,
  linkWhatsApp,
  plural,
} from "./format";

// Intl usa espaço não separável em alguns formatos; normaliza para comparar.
const n = (s: string) => s.replace(/\s/g, " ");

describe("format", () => {
  it("dinheiro e números", () => {
    expect(n(formatBRL(1234.5))).toBe("R$ 1.234,50");
    expect(formatDecimalInput(39.9)).toBe("39,90");
    expect(formatDecimalInput(null)).toBe("");
    expect(plural(1, "vela")).toBe("1 vela");
    expect(plural(1200, "vela")).toBe("1.200 velas");
  });
  it("porcentagem a partir de fração", () => {
    expect(n(formatPercent(0.253))).toBe("25,3%");
    expect(n(formatPercent(0.5))).toBe("50%");
    expect(n(formatPercent(0.125, { sinal: true }))).toBe("+12,5%");
    expect(n(formatPercent(-0.1, { sinal: true }))).toBe("-10%");
    expect(formatPercent(null)).toBe("—");
  });
  it("datas no fuso de São Paulo", () => {
    const d = new Date("2026-10-01T01:30:00Z");
    expect(formatDate(d)).toBe("30/09/2026");
    expect(formatDateShort(d)).toBe("30/09");
    expect(formatDate("2026-10-01")).toBe("01/10/2026");
    expect(n(formatDateTime(d))).toBe("30/09/2026, 22:30");
  });
  it("tempo relativo", () => {
    const agora = new Date("2026-10-01T12:00:00Z");
    expect(formatRelative(new Date("2026-10-01T11:59:40Z"), agora)).toBe("agora");
    expect(formatRelative(new Date("2026-10-01T11:00:00Z"), agora)).toBe("há 1 h");
    expect(formatRelative(new Date("2026-09-30T11:00:00Z"), agora)).toBe("ontem");
    expect(formatRelative(new Date("2026-09-25T12:00:00Z"), agora)).toBe("há 6 dias");
    // Pelo calendário de SP, não por janelas de 24 h (agora = 01/10 09:00 em SP).
    expect(formatRelative(new Date("2026-09-30T13:00:00Z"), agora)).toBe("ontem"); // 30/09 10:00, 23 h atrás
    expect(formatRelative(new Date("2026-09-30T01:00:00Z"), agora)).toBe("há 2 dias"); // 29/09 22:00, 35 h atrás
    const madrugada = new Date("2026-10-01T03:10:00Z"); // 01/10 00:10 em SP
    expect(formatRelative(new Date("2026-10-01T02:50:00Z"), madrugada)).toBe("ontem"); // 30/09 23:50
    expect(formatRelative(new Date("2026-10-01T03:05:00Z"), madrugada)).toBe("há 5 min");
  });
  it("telefone e links", () => {
    expect(formatTelefone("11987654321")).toBe("(11) 98765-4321");
    expect(formatTelefone("1133334444")).toBe("(11) 3333-4444");
    expect(formatTelefone("123")).toBe("123");
    expect(linkWhatsApp("(11) 98765-4321")).toBe("https://wa.me/5511987654321");
    expect(linkWhatsApp("5511987654321", "Olá, tudo bem?")).toBe(
      "https://wa.me/5511987654321?text=Ol%C3%A1%2C%20tudo%20bem%3F",
    );
    expect(linkWhatsApp("")).toBeNull();
    expect(linkInstagram("@luamme")).toBe("https://instagram.com/luamme");
  });
});
