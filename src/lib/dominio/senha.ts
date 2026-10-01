// Hash de senha com scrypt (node:crypto). Formato: "scrypt$N$r$p$salt_b64$hash_b64".
import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

const N = 16384;
const R = 8;
const P = 1;
const TAMANHO = 64;

function scrypt(senha: string, salt: Buffer, tamanho: number, opcoes: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(senha.normalize("NFKC"), salt, tamanho, opcoes, (erro, chave) => (erro ? reject(erro) : resolve(chave))),
  );
}

export async function gerarHashSenha(senha: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(senha, salt, TAMANHO, { N, r: R, p: P });
  return ["scrypt", N, R, P, salt.toString("base64"), hash.toString("base64")].join("$");
}

/** Compara em tempo constante. Hash malformado → false. */
export async function verificarHashSenha(senha: string, armazenado: string): Promise<boolean> {
  const partes = armazenado.split("$");
  if (partes.length !== 6 || partes[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = partes;
  const esperado = Buffer.from(hashB64, "base64");
  if (esperado.length === 0) return false;
  try {
    const obtido = await scrypt(senha, Buffer.from(saltB64, "base64"), esperado.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 64 * 1024 * 1024,
    });
    return timingSafeEqual(obtido, esperado);
  } catch {
    return false;
  }
}
