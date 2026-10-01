import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { CHAVE_SENHA, credenciaisValidas } from "@/lib/dominio/configuracoes";

export const SESSION_COOKIE = "luamme_session";
const SESSION_DAYS = 30;

/** Contador em `configuracoes` incrementado por "Sair de todos os aparelhos". */
const CHAVE_VERSAO_SESSAO = "sessao_versao";

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET ausente ou curto demais (mínimo 32 caracteres).");
  }
  return value;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Confere usuário e senha do admin. A senha vem primeiro do hash salvo em `configuracoes.admin_senha_hash`
 * (definido em Configurações → Trocar senha); só sem hash vale o ADMIN_PASSWORD do env.
 * As duas comparações são sempre avaliadas, para não vazar qual campo errou pelo tempo de resposta.
 */
export async function checkCredentials(usuario: string, senha: string) {
  return credenciaisValidas(usuario, senha);
}

/**
 * Versão das sessões, gravada (assinada) no cookie. Deriva do hash da senha atual (ou do
 * ADMIN_PASSWORD do env) e do contador `sessao_versao`: trocar a senha ou "sair de todos os
 * aparelhos" muda a versão e invalida todo cookie emitido antes.
 */
async function lerVersaoSessao() {
  const rows = await query<{ chave: string; valor: string }>(
    `SELECT chave, valor FROM configuracoes WHERE chave IN ($1, $2)`,
    [CHAVE_SENHA, CHAVE_VERSAO_SESSAO],
  );
  const mapa = new Map(rows.map((r) => [r.chave, r.valor]));
  const senha = mapa.get(CHAVE_SENHA) || `env:${process.env.ADMIN_PASSWORD ?? ""}`;
  return createHmac("sha256", secret())
    .update(`sessao|${senha}|${mapa.get(CHAVE_VERSAO_SESSAO) ?? "0"}`)
    .digest("base64url")
    .slice(0, 22);
}

/** Emite o cookie de sessão com a versão atual (lida sem cache: depois de trocar a senha já sai a nova). */
export async function createSession() {
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = `admin.${expires}.${await lerVersaoSessao()}`;
  const store = await cookies();
  store.set(SESSION_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expires),
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Invalida todas as sessões emitidas até agora (em todos os aparelhos), inclusive a atual. */
export async function revogarTodasSessoes() {
  await query(
    `INSERT INTO configuracoes (chave, valor) VALUES ($1, '1')
     ON CONFLICT (chave) DO UPDATE
       SET valor = (COALESCE(NULLIF(configuracoes.valor, ''), '0')::bigint + 1)::text`,
    [CHAVE_VERSAO_SESSAO],
  );
  await destroySession();
}

/**
 * Memoizado por requisição: páginas, metadata e consultas chamam requireAuth sem repetir o HMAC
 * nem a leitura da versão da sessão no banco.
 */
export const isAuthenticated = cache(async function isAuthenticated() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return false;
  const lastDot = token.lastIndexOf(".");
  if (lastDot < 0) return false;
  const payload = token.slice(0, lastDot);
  const signature = token.slice(lastDot + 1);
  if (!safeEqual(signature, sign(payload))) return false;
  const [usuario, expiraTexto, versao] = payload.split(".");
  const expires = Number(expiraTexto);
  // Cookies antigos (sem versão) e de antes da última troca de senha deixam de valer.
  if (usuario !== "admin" || !Number.isFinite(expires) || expires <= Date.now() || !versao) return false;
  return safeEqual(versao, await lerVersaoSessao());
});

/** Usar no início de toda página e Server Action protegida. */
export async function requireAuth() {
  if (!(await isAuthenticated())) redirect("/login");
}
