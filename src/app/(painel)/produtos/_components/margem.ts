// Classificação da margem (fração do preço) usada no formulário, na lista e no detalhe.

export type TomMargem = "alerta" | "mel" | "salvia" | "neutro";

/** Abaixo disso a margem é considerada apertada para velas artesanais. */
export const MARGEM_SAUDAVEL = 0.4;

/** Margens sugeridas no formulário (botões "preço para X% de margem"). */
export const MARGENS_SUGERIDAS = [0.5, 0.6, 0.7] as const;

export function tomMargem(margem: number | null | undefined): TomMargem {
  if (margem === null || margem === undefined || !Number.isFinite(margem)) return "neutro";
  if (margem < 0) return "alerta";
  if (margem < MARGEM_SAUDAVEL) return "mel";
  return "salvia";
}

export const CLASSE_TEXTO_MARGEM: Record<TomMargem, string> = {
  alerta: "text-alerta",
  mel: "text-mel",
  salvia: "text-salvia",
  neutro: "text-suave",
};

export function resumoMargem(margem: number | null, custo: number): string {
  if (margem === null) return "Informe o preço para ver o lucro.";
  if (custo <= 0) return "Sem custo informado: o lucro real pode ser menor.";
  if (margem < 0) return "Prejuízo: o preço está abaixo do custo.";
  if (margem === 0) return "Sem lucro: o preço é igual ao custo.";
  if (margem < MARGEM_SAUDAVEL) return "Margem apertada. Considere subir o preço.";
  return "Margem saudável.";
}
