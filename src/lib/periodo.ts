// Períodos de relatório/filtro a partir de searchParams, sempre no fuso de negócio (America/Sao_Paulo).
// Datas "de"/"ate" são dias civis (AAAA-MM-DD, inclusivos); "inicio"/"fim" são instantes prontos
// para SQL: `WHERE v.data >= $1 AND v.data < $2` com [periodo.inicio, periodo.fim].
import { TIMEZONE } from "./format";

export const ATALHOS_PERIODO = ["hoje", "7d", "30d", "mes", "mes_anterior", "ano", "personalizado"] as const;
export type AtalhoPeriodo = (typeof ATALHOS_PERIODO)[number];

export const ROTULO_ATALHO: Record<AtalhoPeriodo, string> = {
  hoje: "Hoje",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  mes: "Este mês",
  mes_anterior: "Mês anterior",
  ano: "Este ano",
  personalizado: "Personalizado",
};

export type Intervalo = {
  /** Primeiro dia (AAAA-MM-DD, inclusivo, fuso de SP). */
  de: string;
  /** Último dia (AAAA-MM-DD, inclusivo, fuso de SP). */
  ate: string;
  /** 00:00 de `de` em SP, como instante. Use com `>=`. */
  inicio: Date;
  /**
   * 00:00 do dia seguinte a `ate` em SP. Use com `<` (exclusivo). No `anterior` de um período em
   * andamento, é o mesmo horário de agora no dia `ate` (ver `periodoAnterior`).
   */
  fim: Date;
  /** Quantidade de dias do intervalo. */
  dias: number;
};

export type Periodo = Intervalo & {
  atalho: AtalhoPeriodo;
  /** Rótulo curto: "Últimos 7 dias", "Outubro de 2026", "01/09/2026 a 15/09/2026". */
  rotulo: string;
  /** Intervalo por extenso: "25/09/2026 a 01/10/2026" (ou "01/10/2026" se for um dia só). */
  intervalo: string;
  /** Período anterior equivalente, para comparação (ver regras em `periodoAnterior`). */
  anterior: Intervalo;
  /** Parâmetros que reproduzem este período em links: { periodo: "7d" } ou { periodo, de, ate }. */
  params: Record<string, string>;
};

export type SearchParamsLike =
  | URLSearchParams
  | Record<string, string | string[] | undefined>
  | null
  | undefined;

const MAX_DIAS = 3660;
const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

const fmtYMD = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const fmtMesAno = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "long", year: "numeric" });

function lerParam(sp: SearchParamsLike, chave: string): string | undefined {
  if (!sp) return undefined;
  if (sp instanceof URLSearchParams) return sp.get(chave) ?? undefined;
  const v = sp[chave];
  return Array.isArray(v) ? v[0] : v;
}

/** Dia civil atual em SP (AAAA-MM-DD). */
export function hojeSP(agora: Date = new Date()): string {
  return fmtYMD.format(agora);
}

/** Dia civil em SP de um instante. */
export function diaSP(instante: Date | string): string {
  return fmtYMD.format(new Date(instante));
}

export function dataValida(ymd: string | undefined | null): ymd is string {
  if (!ymd || !RE_DATA.test(ymd)) return false;
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function partes(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return { y, m, d };
}

function paraYMD(dt: Date) {
  return dt.toISOString().slice(0, 10);
}

/** Soma (ou subtrai) dias a uma data AAAA-MM-DD. */
export function somarDias(ymd: string, n: number): string {
  const { y, m, d } = partes(ymd);
  return paraYMD(new Date(Date.UTC(y, m - 1, d + n)));
}

/** Diferença em dias (b − a). */
export function diasEntre(a: string, b: string): number {
  const pa = partes(a);
  const pb = partes(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86_400_000);
}

/** Lista de dias de `de` até `ate` (inclusivo) — útil para preencher dias sem vendas nos gráficos. */
export function listarDias(de: string, ate: string): string[] {
  const n = diasEntre(de, ate);
  return Array.from({ length: Math.max(0, n + 1) }, (_, i) => somarDias(de, i));
}

/** Diferença (ms) entre o horário de parede em SP e UTC num instante. */
const fmtPartes = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMEZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function deslocamento(instante: number): number {
  const p = fmtPartes.formatToParts(new Date(instante));
  const v = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"), v("second")) - instante;
}

/** Instante de 00:00 em SP do dia informado. */
export function inicioDoDiaSP(ymd: string): Date {
  const { y, m, d } = partes(ymd);
  const guess = Date.UTC(y, m - 1, d);
  let t = guess - deslocamento(guess);
  t = guess - deslocamento(t); // corrige bordas de horário de verão (históricas)
  return new Date(t);
}

export function intervalo(de: string, ate: string): Intervalo {
  return { de, ate, inicio: inicioDoDiaSP(de), fim: inicioDoDiaSP(somarDias(ate, 1)), dias: diasEntre(de, ate) + 1 };
}

function primeiroDoMes(ymd: string) {
  return `${ymd.slice(0, 7)}-01`;
}

function ultimoDoMes(ymd: string) {
  const { y, m } = partes(ymd);
  return paraYMD(new Date(Date.UTC(y, m, 0)));
}

function mesAnterior(ymd: string) {
  const { y, m } = partes(ymd);
  return paraYMD(new Date(Date.UTC(y, m - 2, 1)));
}

/** "01/10/2026" */
export function dataBR(ymd: string): string {
  const { y, m, d } = partes(ymd);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

function nomeMes(ymd: string) {
  const { y, m } = partes(ymd);
  const s = fmtMesAno.format(new Date(Date.UTC(y, m - 1, 15)));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function textoIntervalo(de: string, ate: string) {
  return de === ate ? dataBR(de) : `${dataBR(de)} a ${dataBR(ate)}`;
}

/**
 * Período anterior para comparação:
 * - mes: mês anterior do dia 1 até o mesmo dia do mês (limitado ao fim dele) — comparação justa no meio do mês;
 * - mes_anterior: o mês inteiro antes dele;
 * - ano: mesmo trecho do ano anterior;
 * - demais: a mesma quantidade de dias imediatamente antes.
 * Se o período atual ainda está em andamento (termina hoje), o anterior é cortado no mesmo horário
 * do seu último dia: às 09:00 de 01/10, "Este mês" (01/10 00:00–09:00) compara com 01/09 00:00–09:00,
 * e não com o dia 01/09 inteiro. Assim `fim` pode não ser meia-noite (continua exclusivo).
 */
export function periodoAnterior(atalho: AtalhoPeriodo, atual: Intervalo, agora: Date = new Date()): Intervalo {
  const base = periodoAnteriorDiasInteiros(atalho, atual);
  const t = agora.getTime();
  if (t < atual.inicio.getTime() || t >= atual.fim.getTime()) return base;
  // Quanto do dia de hoje já passou, aplicado ao último dia do período anterior.
  const decorridoHoje = t - inicioDoDiaSP(atual.ate).getTime();
  const corte = inicioDoDiaSP(base.ate).getTime() + decorridoHoje;
  return corte < base.fim.getTime() ? { ...base, fim: new Date(corte) } : base;
}

function periodoAnteriorDiasInteiros(atalho: AtalhoPeriodo, atual: Intervalo): Intervalo {
  if (atalho === "mes") {
    const de = mesAnterior(atual.de);
    const ultimo = ultimoDoMes(de);
    const mesmoDia = `${de.slice(0, 8)}${atual.ate.slice(8)}`;
    return intervalo(de, dataValida(mesmoDia) && mesmoDia < ultimo ? mesmoDia : ultimo);
  }
  if (atalho === "mes_anterior") {
    const de = mesAnterior(atual.de);
    return intervalo(de, ultimoDoMes(de));
  }
  if (atalho === "ano") {
    const ano = Number(atual.de.slice(0, 4)) - 1;
    const ate = `${ano}${atual.ate.slice(4)}`;
    return intervalo(`${ano}-01-01`, dataValida(ate) ? ate : `${ano}-02-28`);
  }
  return intervalo(somarDias(atual.de, -atual.dias), somarDias(atual.de, -1));
}

/**
 * Lê `periodo` (atalho), `de` e `ate` (AAAA-MM-DD) dos searchParams.
 * Sem `periodo` mas com `de`/`ate` válidos → personalizado. Datas inválidas → usa o padrão.
 * Datas invertidas são trocadas; intervalo limitado a ~10 anos; `ate` sem `de` → só aquele dia.
 */
export function parsePeriodo(
  sp: SearchParamsLike,
  opcoes: { padrao?: Exclude<AtalhoPeriodo, "personalizado">; agora?: Date } = {},
): Periodo {
  const padrao = opcoes.padrao ?? "30d";
  const hoje = hojeSP(opcoes.agora);
  const bruto = lerParam(sp, "periodo");
  let de = lerParam(sp, "de");
  let ate = lerParam(sp, "ate");

  let atalho: AtalhoPeriodo = (ATALHOS_PERIODO as readonly string[]).includes(bruto ?? "")
    ? (bruto as AtalhoPeriodo)
    : dataValida(de) || dataValida(ate)
      ? "personalizado"
      : padrao;

  if (atalho === "personalizado") {
    if (!dataValida(de) && !dataValida(ate)) atalho = padrao;
    else {
      if (!dataValida(de)) de = ate;
      if (!dataValida(ate)) ate = dataValida(de) && de! > hoje ? de : hoje;
      if (de! > ate!) [de, ate] = [ate, de];
      if (diasEntre(de!, ate!) >= MAX_DIAS) de = somarDias(ate!, -(MAX_DIAS - 1));
    }
  }

  let atual: Intervalo;
  let rotulo = ROTULO_ATALHO[atalho];
  switch (atalho) {
    case "hoje":
      atual = intervalo(hoje, hoje);
      break;
    case "7d":
      atual = intervalo(somarDias(hoje, -6), hoje);
      break;
    case "30d":
      atual = intervalo(somarDias(hoje, -29), hoje);
      break;
    case "mes":
      atual = intervalo(primeiroDoMes(hoje), hoje);
      rotulo = nomeMes(hoje);
      break;
    case "mes_anterior": {
      const inicio = mesAnterior(hoje);
      atual = intervalo(inicio, ultimoDoMes(inicio));
      rotulo = nomeMes(inicio);
      break;
    }
    case "ano":
      atual = intervalo(`${hoje.slice(0, 4)}-01-01`, hoje);
      rotulo = `Ano de ${hoje.slice(0, 4)}`;
      break;
    default:
      atual = intervalo(de!, ate!);
      rotulo = textoIntervalo(de!, ate!);
  }

  return {
    ...atual,
    atalho,
    rotulo,
    intervalo: textoIntervalo(atual.de, atual.ate),
    anterior: periodoAnterior(atalho, atual, opcoes.agora),
    params: atalho === "personalizado" ? { periodo: atalho, de: atual.de, ate: atual.ate } : { periodo: atalho },
  };
}
