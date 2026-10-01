import "server-only";
import { timingSafeEqual } from "node:crypto";
import { query } from "@/lib/db";
import { verificarHashSenha } from "./senha";
import { CONFIGURACOES_PADRAO, type Configuracoes } from "./tipos";

/** Chave em `configuracoes` onde fica o hash scrypt da senha do admin. */
export const CHAVE_SENHA = "admin_senha_hash";

/** Lê as configurações da loja com valores padrão para chaves ausentes. Nunca inclui o hash da senha. */
export async function getConfiguracoes(): Promise<Configuracoes> {
  const rows = await query<{ chave: string; valor: string }>(
    `SELECT chave, valor FROM configuracoes WHERE chave <> $1`,
    [CHAVE_SENHA],
  );
  const mapa = new Map(rows.map((r) => [r.chave, r.valor]));
  const minimo = Number.parseInt(mapa.get("estoque_minimo_padrao") ?? "", 10);
  return {
    loja_nome: mapa.get("loja_nome") || CONFIGURACOES_PADRAO.loja_nome,
    loja_telefone: mapa.get("loja_telefone") ?? CONFIGURACOES_PADRAO.loja_telefone,
    loja_instagram: mapa.get("loja_instagram") ?? CONFIGURACOES_PADRAO.loja_instagram,
    loja_endereco: mapa.get("loja_endereco") ?? CONFIGURACOES_PADRAO.loja_endereco,
    recibo_rodape: mapa.get("recibo_rodape") ?? CONFIGURACOES_PADRAO.recibo_rodape,
    estoque_minimo_padrao: Number.isFinite(minimo) && minimo >= 0 ? minimo : CONFIGURACOES_PADRAO.estoque_minimo_padrao,
  };
}

/** Hash da senha salvo pela tela de configurações, ou null se ainda vale o ADMIN_PASSWORD do env. */
export async function getSenhaHash(): Promise<string | null> {
  const rows = await query<{ valor: string }>(`SELECT valor FROM configuracoes WHERE chave = $1`, [CHAVE_SENHA]);
  return rows[0]?.valor || null;
}

function iguais(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Confere a senha do admin: usa o hash de `configuracoes` quando existir; senão, ADMIN_PASSWORD do env.
 * (Não confere o usuário: compare com ADMIN_USER à parte.)
 */
export async function verificarSenhaAdmin(senha: string): Promise<boolean> {
  const hash = await getSenhaHash();
  if (hash) return verificarHashSenha(senha, hash);
  const env = process.env.ADMIN_PASSWORD ?? "";
  return env !== "" && iguais(senha, env);
}

/** Usuário + senha válidos? Avalia as duas comparações sempre (não vaza qual errou pelo tempo). */
export async function credenciaisValidas(usuario: string, senha: string): Promise<boolean> {
  const esperado = process.env.ADMIN_USER ?? "";
  const usuarioOk = esperado !== "" && iguais(usuario, esperado);
  const senhaOk = await verificarSenhaAdmin(senha);
  return usuarioOk && senhaOk;
}
