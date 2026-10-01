// Helpers de URL para filtros, paginação e abas baseados em searchParams.
// Funções puras: funcionam em Server e Client Components.

export type ParamsBusca =
  | Record<string, string | string[] | undefined>
  | URLSearchParams
  | null
  | undefined;

export type AlteracoesParams = Record<string, string | number | boolean | null | undefined>;

/** Converte os searchParams (objeto do Next ou URLSearchParams) em URLSearchParams. */
export function paraURLSearchParams(params: ParamsBusca): URLSearchParams {
  if (!params) return new URLSearchParams();
  if (params instanceof URLSearchParams) return new URLSearchParams(params);
  const sp = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params)) {
    if (valor === undefined) continue;
    if (Array.isArray(valor)) valor.forEach((v) => sp.append(chave, v));
    else sp.set(chave, valor);
  }
  return sp;
}

/**
 * Monta um href preservando os parâmetros atuais e aplicando alterações.
 * `null`, `undefined`, `""` ou `false` removem o parâmetro.
 * Ex.: montarHref("/vendas", searchParams, { pagina: 2 }) → "/vendas?periodo=mes&pagina=2"
 */
export function montarHref(caminho: string, params: ParamsBusca, alteracoes: AlteracoesParams = {}): string {
  const sp = paraURLSearchParams(params);
  for (const [chave, valor] of Object.entries(alteracoes)) {
    if (valor === null || valor === undefined || valor === "" || valor === false) sp.delete(chave);
    else sp.set(chave, String(valor));
  }
  const qs = sp.toString();
  return qs ? `${caminho}?${qs}` : caminho;
}

/** Lê um parâmetro como string única (primeiro valor, se vier repetido). */
export function param(params: ParamsBusca, chave: string): string | undefined {
  if (!params) return undefined;
  if (params instanceof URLSearchParams) return params.get(chave) ?? undefined;
  const v = params[chave];
  return Array.isArray(v) ? v[0] : v;
}

/** Lê o número da página (1 quando ausente ou inválido; limitada a 1.000.000, ex.: "?pagina=1e21"). */
export function paginaAtual(params: ParamsBusca, chave = "pagina"): number {
  const n = Number(param(params, chave));
  return Number.isSafeInteger(n) && n > 0 ? Math.min(n, 1_000_000) : 1;
}
