// Validação do parâmetro `de` (página para onde voltar depois do login). Puro, testável.

const BASE = "http://interno.invalid";

/**
 * Só aceita caminhos internos ("/vendas?x=1"). Recusa URLs externas ("//site", "https://…") e
 * truques que o navegador normaliza para "//site": barras invertidas e caracteres de controle
 * (TAB/CR/LF são removidos pelo parser de URL, então "/\t/site" viraria "//site").
 * Devolve o caminho normalizado ou `undefined`.
 */
export function destinoInterno(valor: unknown): string | undefined {
  const bruto = Array.isArray(valor) ? valor[0] : valor;
  if (typeof bruto !== "string" || bruto.length > 500) return undefined;
  if (!bruto.startsWith("/") || /[\u0000-\u001f\u007f\\]/.test(bruto)) return undefined;
  let url: URL;
  try {
    url = new URL(bruto, BASE);
  } catch {
    return undefined;
  }
  if (url.origin !== BASE) return undefined;
  const caminho = url.pathname + url.search + url.hash;
  // Os próprios caminhos normalizados também não podem virar "//…" nem voltar para o login.
  if (caminho.startsWith("//") || url.pathname === "/login" || url.pathname.startsWith("/login/")) return undefined;
  return caminho;
}
