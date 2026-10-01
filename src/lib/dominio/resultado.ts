// Formato padrão de retorno das Server Actions de src/lib/dominio/acoes/*.
// Seguro para importar em componentes cliente (só tipos e funções puras).
import type { ZodError } from "zod";

export type Sucesso<D = undefined> = {
  ok: true;
  mensagem: string;
  /** Id do registro criado/alterado, quando houver. */
  id?: number;
  /** Dados extras específicos da ação (ex.: total e troco da venda). */
  dados?: D;
  erro?: never;
  campos?: never;
};

export type Falha = {
  ok: false;
  erro: string;
  /** Erro por campo (nome do campo do formulário → mensagem), quando a validação falhou. */
  campos?: Record<string, string>;
  // Permitem ler `r.id`, `r.mensagem`, `r.dados` sem estreitar o tipo antes (vêm undefined).
  mensagem?: never;
  id?: never;
  dados?: never;
};

export type ResultadoAcao<D = undefined> = Sucesso<D> | Falha;

/** Estado de `useActionState`: comece com `null`. */
export type EstadoAcao<D = undefined> = ResultadoAcao<D> | null;

export function sucesso<D = undefined>(mensagem: string, extras: { id?: number; dados?: D } = {}): Sucesso<D> {
  return { ok: true, mensagem, ...extras };
}

export function falha(erro: string, campos?: Record<string, string>): Falha {
  return campos ? { ok: false, erro, campos } : { ok: false, erro };
}

/** Converte um erro do zod em Falha com a primeira mensagem e o mapa de erros por campo. */
export function falhaValidacao(error: ZodError): Falha {
  const campos: Record<string, string> = {};
  for (const issue of error.issues) {
    const chave = issue.path.map(String).join(".") || "_";
    campos[chave] ??= issue.message;
  }
  return falha(error.issues[0]?.message ?? "Dados inválidos.", campos);
}

export function eFalha<D>(r: ResultadoAcao<D> | null | undefined): r is Falha {
  return !!r && r.ok === false;
}

/**
 * Normaliza os argumentos de uma action que pode ser usada de três formas:
 *  - `useActionState(acao, null)` → (estadoAnterior, formData)
 *  - `<form action={acao}>`       → (formData)
 *  - chamada direta              → (objeto)
 * FormData vira objeto simples (campos repetidos viram array; campos internos do Next são ignorados).
 */
export function lerEntrada(a: unknown, b?: unknown): Record<string, unknown> {
  if (typeof FormData !== "undefined") {
    if (b instanceof FormData) return formDataParaObjeto(b);
    if (a instanceof FormData) return formDataParaObjeto(a);
  }
  if (a && typeof a === "object" && !Array.isArray(a)) return a as Record<string, unknown>;
  return {};
}

export function formDataParaObjeto(fd: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [chave, valor] of fd.entries()) {
    if (chave.startsWith("$ACTION") || typeof valor !== "string") continue;
    const nome = chave.endsWith("[]") ? chave.slice(0, -2) : chave;
    if (nome in obj) {
      const atual = obj[nome];
      obj[nome] = Array.isArray(atual) ? [...atual, valor] : [atual, valor];
    } else {
      obj[nome] = chave.endsWith("[]") ? [valor] : valor;
    }
  }
  return obj;
}

export const MSG_SEM_CONEXAO = "Sem conexão com o servidor. Verifique a internet e tente de novo.";

/**
 * Para chamar uma Server Action no cliente: falha de rede (wifi/4G caiu, servidor reiniciando) vira
 * uma Falha amigável em vez de derrubar a tela no error.tsx (e perder o que foi digitado).
 * redirect()/notFound() da action chegam como erro com `digest` e seguem para o Next tratar.
 */
export async function chamarAcao<D>(
  promessa: Promise<ResultadoAcao<D>>,
  mensagem: string = MSG_SEM_CONEXAO,
): Promise<ResultadoAcao<D>> {
  try {
    return await promessa;
  } catch (erro) {
    if (erro && typeof erro === "object" && "digest" in erro) throw erro;
    return falha(mensagem);
  }
}
