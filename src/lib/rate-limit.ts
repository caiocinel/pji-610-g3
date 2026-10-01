// Limite de tentativas em memória (por processo). Suficiente para um único servidor (PM2 com 1 instância):
// se o app reiniciar, os contadores zeram, o que é aceitável para um painel de uma pessoa só.

export type OpcoesLimite = {
  /** Falhas permitidas dentro da janela antes de bloquear. */
  maxFalhas: number;
  /** Janela de contagem e duração do bloqueio, em ms. */
  janelaMs: number;
};

export type SituacaoLimite =
  | { bloqueado: false; restantes: number }
  | { bloqueado: true; liberaEm: number; esperaMs: number };

type Registro = { falhas: number[]; bloqueadoAte: number; emAndamento: number };

/** Espera sugerida quando o limite está ocupado só por tentativas ainda em andamento. */
const ESPERA_EM_ANDAMENTO_MS = 5_000;

export function criarLimitador({ maxFalhas, janelaMs }: OpcoesLimite) {
  const registros = new Map<string, Registro>();
  let ultimaLimpeza = 0;

  function limpar(agora: number) {
    if (agora - ultimaLimpeza < 60_000) return;
    ultimaLimpeza = agora;
    for (const [chave, r] of registros) {
      if (r.emAndamento === 0 && r.bloqueadoAte <= agora && r.falhas.every((t) => agora - t >= janelaMs)) {
        registros.delete(chave);
      }
    }
  }

  function obter(chave: string) {
    let r = registros.get(chave);
    if (!r) {
      r = { falhas: [], bloqueadoAte: 0, emAndamento: 0 };
      registros.set(chave, r);
    }
    return r;
  }

  function recentes(r: Registro, agora: number) {
    r.falhas = r.falhas.filter((t) => agora - t < janelaMs);
    return r.falhas.length;
  }

  function bloqueio(ate: number, agora: number): SituacaoLimite {
    return { bloqueado: true, liberaEm: ate, esperaMs: ate - agora };
  }

  /** Situação atual da chave (sem registrar nada). Tentativas em andamento contam como falhas possíveis. */
  function consultar(chave: string, agora = Date.now()): SituacaoLimite {
    limpar(agora);
    const r = registros.get(chave);
    if (!r) return { bloqueado: false, restantes: maxFalhas };
    if (r.bloqueadoAte > agora) return bloqueio(r.bloqueadoAte, agora);
    return { bloqueado: false, restantes: Math.max(0, maxFalhas - recentes(r, agora) - r.emAndamento) };
  }

  /**
   * Reserva uma tentativa ANTES de verificar a senha (atômico: não há await entre checar e reservar).
   * Falhas recentes + tentativas em andamento nunca passam de `maxFalhas`, então disparar muitas
   * requisições ao mesmo tempo não testa mais senhas que o limite. Depois da verificação, chame
   * `registrarFalha` + `liberar` (erro) ou `limpar` (sucesso). Sempre libere num `finally`.
   */
  function reservar(chave: string, agora = Date.now()): SituacaoLimite {
    limpar(agora);
    const r = obter(chave);
    if (r.bloqueadoAte > agora) return bloqueio(r.bloqueadoAte, agora);
    const usadas = recentes(r, agora) + r.emAndamento;
    if (usadas >= maxFalhas) {
      // Ocupado por falhas: libera quando a mais antiga sair da janela; só por tentativas em curso: em instantes.
      const ate = r.falhas.length >= maxFalhas ? r.falhas[r.falhas.length - maxFalhas] + janelaMs : agora + ESPERA_EM_ANDAMENTO_MS;
      return bloqueio(ate, agora);
    }
    r.emAndamento++;
    return { bloqueado: false, restantes: maxFalhas - usadas };
  }

  /** Devolve uma reserva feita com `reservar`. */
  function liberar(chave: string) {
    const r = registros.get(chave);
    if (r && r.emAndamento > 0) r.emAndamento--;
  }

  /** Registra uma falha; ao atingir o máximo, bloqueia pela duração da janela. */
  function registrarFalha(chave: string, agora = Date.now()): SituacaoLimite {
    const r = obter(chave);
    r.falhas.push(agora);
    const n = recentes(r, agora);
    if (r.bloqueadoAte > agora) return bloqueio(r.bloqueadoAte, agora);
    if (n >= maxFalhas) {
      r.bloqueadoAte = agora + janelaMs;
      return bloqueio(r.bloqueadoAte, agora);
    }
    return { bloqueado: false, restantes: maxFalhas - n };
  }

  /** Zera falhas e bloqueio da chave (ex.: login bem-sucedido). Reservas em andamento continuam contando. */
  function limparChave(chave: string) {
    const r = registros.get(chave);
    if (!r) return;
    if (r.emAndamento > 0) {
      r.falhas = [];
      r.bloqueadoAte = 0;
    } else {
      registros.delete(chave);
    }
  }

  return { consultar, reservar, liberar, registrarFalha, limpar: limparChave };
}

/** Texto amigável para o tempo de espera ("1 minuto", "12 minutos"). */
export function textoEspera(esperaMs: number) {
  const minutos = Math.max(1, Math.ceil(esperaMs / 60_000));
  return minutos === 1 ? "1 minuto" : `${minutos} minutos`;
}

// Instâncias compartilhadas do login, guardadas em globalThis para sobreviver ao recarregamento de
// módulos em desenvolvimento:
// - por IP: 5 falhas em 15 minutos → bloqueio de 15 minutos;
// - global (todas as origens juntas, já que só existe uma conta): 30 falhas em 1 hora → bloqueio de
//   1 hora. Não depende do IP, então trocar de IP (ou forjar cabeçalho) não ajuda um ataque.
const escopo = globalThis as typeof globalThis & {
  __limiteLogin?: ReturnType<typeof criarLimitador>;
  __limiteLoginGlobal?: ReturnType<typeof criarLimitador>;
};
export const limiteLogin = (escopo.__limiteLogin ??= criarLimitador({ maxFalhas: 5, janelaMs: 15 * 60_000 }));
export const limiteLoginGlobal = (escopo.__limiteLoginGlobal ??= criarLimitador({ maxFalhas: 30, janelaMs: 60 * 60_000 }));
