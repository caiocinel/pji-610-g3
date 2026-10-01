// CSV que abre direto no Excel em pt-BR: separador ";", decimal com vírgula, BOM UTF-8 e CRLF.
import { TIMEZONE } from "./format";

export type ColunaCSV<T> = {
  titulo: string;
  valor: (linha: T) => unknown;
};

const BOM = "﻿";

const fmtData = new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE, dateStyle: "short" });
const fmtDataHora = new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE, dateStyle: "short", timeStyle: "short" });

/** Número com vírgula decimal e sem separador de milhar (o Excel pt-BR reconhece como número). */
export function numeroCSV(v: number, casas?: number): string {
  if (!Number.isFinite(v)) return "";
  const s = casas == null ? String(Math.round(v * 1e6) / 1e6) : v.toFixed(casas);
  return s.replace(".", ",");
}

/** Converte um valor em célula de texto. Date → "dd/mm/aaaa hh:mm" (ou só a data se for meia-noite em SP). */
export function celulaCSV(valor: unknown): string {
  if (valor == null) return "";
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return "";
    const completa = fmtDataHora.format(valor);
    return completa.endsWith(" 00:00") ? fmtData.format(valor) : completa.replace(",", "");
  }
  if (typeof valor === "number") return numeroCSV(valor);
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  return String(valor);
}

/** Escapa a célula: aspas quando precisa; neutraliza fórmulas (=, +, -, @) em textos. */
export function escaparCSV(texto: string, eraNumero = false): string {
  let t = texto;
  if (!eraNumero && /^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return /[;"\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

/**
 * Gera o conteúdo CSV (com BOM). Exemplo:
 *   gerarCSV(vendas, [
 *     { titulo: "Nº", valor: (v) => v.id },
 *     { titulo: "Data", valor: (v) => v.data },
 *     { titulo: "Total (R$)", valor: (v) => v.total },
 *   ])
 */
export function gerarCSV<T>(linhas: readonly T[], colunas: readonly ColunaCSV<T>[]): string {
  const cabecalho = colunas.map((c) => escaparCSV(c.titulo)).join(";");
  const corpo = linhas.map((l) =>
    colunas
      .map((c) => {
        const v = c.valor(l);
        return escaparCSV(celulaCSV(v), typeof v === "number");
      })
      .join(";"),
  );
  return BOM + [cabecalho, ...corpo].join("\r\n") + "\r\n";
}

/** Nome de arquivo seguro: "vendas_2026-09-01_a_2026-09-30.csv". */
export function nomeArquivoCSV(base: string, periodo?: { de: string; ate: string }): string {
  const limpo =
    base
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || "dados";
  const sufixo = periodo ? (periodo.de === periodo.ate ? `_${periodo.de}` : `_${periodo.de}_a_${periodo.ate}`) : "";
  return `${limpo}${sufixo}.csv`;
}

/** Response de download para Route Handlers (`export async function GET() { return respostaCSV(...) }`). */
export function respostaCSV(nomeArquivo: string, conteudo: string): Response {
  const ascii = nomeArquivo.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return new Response(conteudo, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nomeArquivo)}`,
      "Cache-Control": "no-store",
    },
  });
}
