// Formatação para exibição (pt-BR, fuso America/Sao_Paulo). Seguro para servidor e cliente.
export const TIMEZONE = "America/Sao_Paulo";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlCompacto = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});
const inteiro = new Intl.NumberFormat("pt-BR");
const dataHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIMEZONE,
  dateStyle: "short",
  timeStyle: "short",
});
const data = new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE, day: "2-digit", month: "2-digit", year: "numeric" });
const dataCurta = new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE, day: "2-digit", month: "2-digit" });
const dataLonga = new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE, day: "numeric", month: "long", year: "numeric" });
const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit" });
const diaSemana = new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE, weekday: "long" });
const mesAno = new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE, month: "long", year: "numeric" });

/** Datas "AAAA-MM-DD" (dia civil) são tratadas como meio-dia em SP para não "voltar um dia". */
function paraData(d: Date | string | number): Date {
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) return new Date(`${d}T12:00:00-03:00`);
  return new Date(d);
}

/** R$ 1.234,56 */
export const formatBRL = (v: number) => brl.format(v);
/** R$ 1,2 mil — para eixos de gráfico e cartões apertados. */
export const formatBRLCompacto = (v: number) => brlCompacto.format(v);
/** 1.234 */
export const formatInt = (v: number) => inteiro.format(v);
/** 1.234,5 (casas decimais fixas). */
export const formatNumber = (v: number, casas = 2) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }).format(v);
/** Valor para preencher <input> de dinheiro: 39.9 → "39,90". */
export const formatDecimalInput = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? "" : v.toFixed(2).replace(".", ",");

/**
 * Porcentagem a partir de FRAÇÃO: 0.253 → "25,3%". null/NaN → "—".
 * `sinal: true` mostra "+" em positivos (útil para variação: "+12,5%").
 */
export function formatPercent(fracao: number | null | undefined, opcoes: { casas?: number; sinal?: boolean } = {}) {
  if (fracao == null || !Number.isFinite(fracao)) return "—";
  const casas = opcoes.casas ?? 1;
  const texto = new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: casas,
  }).format(fracao);
  return opcoes.sinal && fracao > 0 ? `+${texto}` : texto;
}

/** 01/10/2026 14:30 */
export const formatDateTime = (d: Date | string) => dataHora.format(new Date(d));
/** 01/10/2026 (aceita Date, ISO ou "AAAA-MM-DD"). */
export const formatDate = (d: Date | string) => data.format(paraData(d));
/** 01/10 */
export const formatDateShort = (d: Date | string) => dataCurta.format(paraData(d));
/** 1 de outubro de 2026 */
export const formatDateLong = (d: Date | string) => dataLonga.format(paraData(d));
/** 14:30 */
export const formatTime = (d: Date | string) => hora.format(new Date(d));
/** quinta-feira */
export const formatWeekday = (d: Date | string) => diaSemana.format(paraData(d));
/** outubro de 2026 */
export const formatMonth = (d: Date) => mesAno.format(d);

// Dia civil em SP como número de dias desde 1970 (para comparar "hoje"/"ontem" pelo calendário).
const diaCivil = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" });
function numeroDoDia(d: Date): number {
  const [y, m, dia] = diaCivil.format(d).split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, dia) / 86_400_000);
}

/**
 * Tempo relativo curto pelo calendário de SP: "agora", "há 5 min", "há 3 h" (só se foi hoje),
 * "ontem", "há 4 dias", ou a data (> 30 dias).
 */
export function formatRelative(d: Date | string, agora: Date = new Date()): string {
  const instante = new Date(d);
  const dias = numeroDoDia(agora) - numeroDoDia(instante);
  if (dias <= 0) {
    const min = Math.floor((agora.getTime() - instante.getTime()) / 60_000);
    if (min < 1) return "agora";
    if (min < 60) return `há ${min} min`;
    return `há ${Math.floor(min / 60)} h`;
  }
  if (dias === 1) return "ontem";
  if (dias <= 30) return `há ${dias} dias`;
  return formatDate(instante);
}

/** Só dígitos, sem o DDI 55. */
function digitosTelefone(telefone: string) {
  let d = (telefone ?? "").replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  return d;
}

/** "11987654321" → "(11) 98765-4321"; "1133334444" → "(11) 3333-4444"; outros formatos voltam como vieram. */
export function formatTelefone(telefone: string | null | undefined): string {
  if (!telefone) return "";
  const d = digitosTelefone(telefone);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return telefone;
}

/**
 * Link do WhatsApp: "https://wa.me/5511987654321" (+ "?text=..." se houver mensagem).
 * Devolve null se o telefone não tiver DDD + número.
 */
export function linkWhatsApp(telefone: string | null | undefined, mensagem?: string): string | null {
  const d = digitosTelefone(telefone ?? "");
  if (d.length !== 10 && d.length !== 11) return null;
  const base = `https://wa.me/55${d}`;
  return mensagem ? `${base}?text=${encodeURIComponent(mensagem)}` : base;
}

/** Link do perfil do Instagram (aceita com ou sem "@"). */
export function linkInstagram(usuario: string | null | undefined): string | null {
  const u = (usuario ?? "").trim().replace(/^@/, "");
  return u ? `https://instagram.com/${encodeURIComponent(u)}` : null;
}

/** "1 vela" / "3 velas" */
export function plural(n: number, singular: string, pluralForma = `${singular}s`) {
  return `${formatInt(n)} ${n === 1 ? singular : pluralForma}`;
}
