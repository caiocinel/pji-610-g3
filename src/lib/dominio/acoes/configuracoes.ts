"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession, requireAuth } from "@/lib/auth";
import { transaction } from "@/lib/db";
import { criarLimitador, textoEspera } from "@/lib/rate-limit";
import { CHAVE_SENHA, verificarSenhaAdmin } from "../configuracoes";
import { configuracoesSchema, trocarSenhaSchema, type ConfiguracoesInput, type TrocarSenhaInput } from "../schemas";
import { falha, falhaValidacao, lerEntrada, sucesso, type EstadoAcao, type ResultadoAcao } from "../resultado";
import { gerarHashSenha } from "../senha";
import { revalidarPainel, tratarErro } from "../servidor";

/** Salva os dados da loja (usados no recibo) e o estoque mínimo padrão. Envie todos os campos. */
export async function salvarConfiguracoes(
  a: EstadoAcao | FormData | ConfiguracoesInput,
  b?: FormData,
): Promise<ResultadoAcao> {
  await requireAuth();
  const parsed = configuracoesSchema.safeParse(lerEntrada(a, b));
  if (!parsed.success) return falhaValidacao(parsed.error);
  try {
    await transaction(async (c) => {
      for (const [chave, valor] of Object.entries(parsed.data)) {
        await c.query(
          `INSERT INTO configuracoes (chave, valor) VALUES ($1, $2)
           ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor`,
          [chave, String(valor)],
        );
      }
    });
    revalidarPainel();
    return sucesso("Configurações salvas.");
  } catch (erro) {
    return tratarErro(erro);
  }
}

// Conferir a senha atual é um "login" dentro da sessão: sem limite, quem tivesse um cookie roubado
// poderia testar senhas à vontade. 5 erros em 15 minutos → bloqueia e encerra a sessão.
const CHAVE_LIMITE = "trocar-senha";
const escopo = globalThis as typeof globalThis & { __limiteTrocarSenha?: ReturnType<typeof criarLimitador> };
const limiteTrocarSenha = (escopo.__limiteTrocarSenha ??= criarLimitador({ maxFalhas: 5, janelaMs: 15 * 60_000 }));

/**
 * Troca a senha do admin: confere a atual (hash salvo ou ADMIN_PASSWORD do env), grava o hash
 * scrypt da nova em `configuracoes.admin_senha_hash`. Desconecta os outros aparelhos; a sessão atual
 * recebe um cookie novo e continua válida.
 * Após 5 senhas atuais erradas em 15 minutos, encerra a sessão (redireciona para /login) e
 * recusa novas tentativas até o fim do bloqueio.
 */
export async function trocarSenha(a: EstadoAcao | FormData | TrocarSenhaInput, b?: FormData): Promise<ResultadoAcao> {
  await requireAuth();
  const parsed = trocarSenhaSchema.safeParse(lerEntrada(a, b));
  if (!parsed.success) return falhaValidacao(parsed.error);
  const { senha_atual, nova_senha } = parsed.data;
  const situacao = limiteTrocarSenha.consultar(CHAVE_LIMITE);
  if (situacao.bloqueado) {
    return falha(`Muitas tentativas com a senha atual errada. Aguarde ${textoEspera(situacao.esperaMs)} e tente de novo.`);
  }
  if (!(await verificarSenhaAdmin(senha_atual))) {
    await new Promise((r) => setTimeout(r, 400));
    if (limiteTrocarSenha.registrarFalha(CHAVE_LIMITE).bloqueado) {
      await destroySession();
      redirect("/login");
    }
    return falha("A senha atual está incorreta.", { senha_atual: "A senha atual está incorreta." });
  }
  limiteTrocarSenha.limpar(CHAVE_LIMITE);
  try {
    const hash = await gerarHashSenha(nova_senha);
    await transaction(async (c) => {
      await c.query(
        `INSERT INTO configuracoes (chave, valor) VALUES ($1, $2)
         ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor`,
        [CHAVE_SENHA, hash],
      );
    });
    // A versão da sessão deriva do hash da senha: os cookies antigos (outros aparelhos) deixam de
    // valer, e este aparelho recebe um cookie novo para continuar conectado.
    await createSession();
    return sucesso("Senha alterada. Os outros aparelhos foram desconectados; este continua conectado.");
  } catch (erro) {
    return tratarErro(erro);
  }
}
