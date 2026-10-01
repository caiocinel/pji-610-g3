import { describe, expect, it } from "vitest";
import { celulaCSV, escaparCSV, gerarCSV, nomeArquivoCSV, numeroCSV, respostaCSV } from "./csv";

describe("csv", () => {
  it("gera com BOM, ponto e vírgula e CRLF", () => {
    const csv = gerarCSV(
      [
        { id: 1, nome: "Vela; Lavanda", total: 1234.5, data: new Date("2026-09-30T17:05:00Z") },
        { id: 2, nome: 'Diz "oi"', total: 0.1, data: null },
      ],
      [
        { titulo: "Nº", valor: (l) => l.id },
        { titulo: "Nome", valor: (l) => l.nome },
        { titulo: "Total (R$)", valor: (l) => l.total },
        { titulo: "Data", valor: (l) => l.data },
      ],
    );
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.slice(1).split("\r\n")).toEqual([
      "Nº;Nome;Total (R$);Data",
      '1;"Vela; Lavanda";1234,5;30/09/2026 14:05',
      '2;"Diz ""oi""";0,1;',
      "",
    ]);
  });
  it("células", () => {
    expect(numeroCSV(39.9, 2)).toBe("39,90");
    expect(numeroCSV(-3)).toBe("-3");
    expect(celulaCSV(true)).toBe("Sim");
    expect(celulaCSV(new Date("2026-09-30T03:00:00Z"))).toBe("30/09/2026");
    expect(escaparCSV("=SOMA(A1)")).toBe("'=SOMA(A1)");
    expect(escaparCSV("-3", true)).toBe("-3");
    expect(escaparCSV("linha\nnova")).toBe('"linha\nnova"');
  });
  it("nome de arquivo e resposta", async () => {
    expect(nomeArquivoCSV("Vendas Canceladas", { de: "2026-09-01", ate: "2026-09-30" })).toBe(
      "vendas_canceladas_2026-09-01_a_2026-09-30.csv",
    );
    expect(nomeArquivoCSV("Movimentações")).toBe("movimentacoes.csv");
    const r = respostaCSV("relatório.csv", "﻿a;b\r\n");
    expect(r.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(r.headers.get("Content-Disposition")).toContain("filename*=UTF-8''relat%C3%B3rio.csv");
    expect(await r.text()).toContain("a;b");
  });
});
