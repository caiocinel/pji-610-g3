import { describe, expect, it } from "vitest";
import { diaSP, hojeSP, inicioDoDiaSP, listarDias, parsePeriodo, somarDias } from "./periodo";

// 01/10/2026 01:30 em UTC = 30/09/2026 22:30 em São Paulo.
const AGORA = new Date("2026-10-01T01:30:00Z");

describe("fuso de São Paulo", () => {
  it("dia civil e meia-noite", () => {
    expect(hojeSP(AGORA)).toBe("2026-09-30");
    expect(diaSP("2026-10-01T03:00:00Z")).toBe("2026-10-01");
    expect(inicioDoDiaSP("2026-09-30").toISOString()).toBe("2026-09-30T03:00:00.000Z");
  });
  it("aritmética de dias", () => {
    expect(somarDias("2026-03-01", -1)).toBe("2026-02-28");
    expect(somarDias("2024-12-31", 1)).toBe("2025-01-01");
    expect(listarDias("2026-09-29", "2026-10-01")).toEqual(["2026-09-29", "2026-09-30", "2026-10-01"]);
  });
});

describe("parsePeriodo", () => {
  it("padrão 30d", () => {
    const p = parsePeriodo({}, { agora: AGORA });
    expect(p.atalho).toBe("30d");
    expect(p.de).toBe("2026-09-01");
    expect(p.ate).toBe("2026-09-30");
    expect(p.dias).toBe(30);
    expect(p.fim.toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(p.anterior).toMatchObject({ de: "2026-08-02", ate: "2026-08-31", dias: 30 });
    expect(p.params).toEqual({ periodo: "30d" });
  });
  it("hoje e 7d", () => {
    const hoje = parsePeriodo({ periodo: "hoje" }, { agora: AGORA });
    expect([hoje.de, hoje.ate, hoje.rotulo, hoje.intervalo]).toEqual(["2026-09-30", "2026-09-30", "Hoje", "30/09/2026"]);
    expect(hoje.inicio.toISOString()).toBe("2026-09-30T03:00:00.000Z");
    expect(hoje.anterior.de).toBe("2026-09-29");
    const sete = parsePeriodo(new URLSearchParams("periodo=7d"), { agora: AGORA });
    expect([sete.de, sete.ate]).toEqual(["2026-09-24", "2026-09-30"]);
  });
  it("mês atual compara com o mesmo trecho do mês anterior", () => {
    const p = parsePeriodo({ periodo: "mes" }, { agora: new Date("2026-03-31T15:00:00Z") });
    expect([p.de, p.ate, p.rotulo]).toEqual(["2026-03-01", "2026-03-31", "Março de 2026"]);
    expect([p.anterior.de, p.anterior.ate]).toEqual(["2026-02-01", "2026-02-28"]);
    const q = parsePeriodo({ periodo: "mes" }, { agora: AGORA });
    expect([q.anterior.de, q.anterior.ate]).toEqual(["2026-08-01", "2026-08-30"]);
  });
  it("período em andamento compara até o mesmo horário do período anterior", () => {
    // 01/10/2026 09:00 em SP.
    const agora = new Date("2026-10-01T12:00:00Z");
    const mes = parsePeriodo({ periodo: "mes" }, { agora });
    expect([mes.anterior.de, mes.anterior.ate]).toEqual(["2026-09-01", "2026-09-01"]);
    expect(mes.anterior.inicio.toISOString()).toBe("2026-09-01T03:00:00.000Z");
    expect(mes.anterior.fim.toISOString()).toBe("2026-09-01T12:00:00.000Z");
    const hoje = parsePeriodo({ periodo: "hoje" }, { agora });
    expect(hoje.anterior.fim.toISOString()).toBe("2026-09-30T12:00:00.000Z");
    const sete = parsePeriodo({ periodo: "7d" }, { agora });
    expect(sete.anterior.fim.getTime() - sete.anterior.inicio.getTime()).toBe(agora.getTime() - sete.inicio.getTime());
    // Período já encerrado: compara dias inteiros.
    const passado = parsePeriodo({ periodo: "mes_anterior" }, { agora });
    expect(passado.anterior.fim.toISOString()).toBe("2026-09-01T03:00:00.000Z");
  });
  it("mês anterior e ano", () => {
    const p = parsePeriodo({ periodo: "mes_anterior" }, { agora: new Date("2026-01-15T15:00:00Z") });
    expect([p.de, p.ate, p.rotulo]).toEqual(["2025-12-01", "2025-12-31", "Dezembro de 2025"]);
    expect([p.anterior.de, p.anterior.ate]).toEqual(["2025-11-01", "2025-11-30"]);
    const a = parsePeriodo({ periodo: "ano" }, { agora: AGORA });
    expect([a.de, a.ate, a.anterior.de, a.anterior.ate]).toEqual(["2026-01-01", "2026-09-30", "2025-01-01", "2025-09-30"]);
  });
  it("personalizado: troca datas invertidas, completa e valida", () => {
    const p = parsePeriodo({ de: "2026-09-10", ate: "2026-09-01" }, { agora: AGORA });
    expect(p.atalho).toBe("personalizado");
    expect([p.de, p.ate, p.dias]).toEqual(["2026-09-01", "2026-09-10", 10]);
    expect(p.rotulo).toBe("01/09/2026 a 10/09/2026");
    expect(p.params).toEqual({ periodo: "personalizado", de: "2026-09-01", ate: "2026-09-10" });
    const so = parsePeriodo({ periodo: "personalizado", de: "2026-09-20" }, { agora: AGORA });
    expect([so.de, so.ate]).toEqual(["2026-09-20", "2026-09-30"]);
    const ruim = parsePeriodo({ periodo: "personalizado", de: "2026-02-30" }, { agora: AGORA, padrao: "7d" });
    expect(ruim.atalho).toBe("7d");
    const lixo = parsePeriodo({ periodo: "xyz" }, { agora: AGORA, padrao: "mes" });
    expect(lixo.atalho).toBe("mes");
  });
});
