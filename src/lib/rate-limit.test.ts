import { describe, expect, it } from "vitest";
import { criarLimitador, textoEspera } from "./rate-limit";

const MIN = 60_000;

describe("criarLimitador", () => {
  it("permite até o máximo de falhas e então bloqueia", () => {
    const l = criarLimitador({ maxFalhas: 3, janelaMs: 15 * MIN });
    expect(l.consultar("ip", 0)).toEqual({ bloqueado: false, restantes: 3 });
    expect(l.registrarFalha("ip", 0)).toEqual({ bloqueado: false, restantes: 2 });
    expect(l.registrarFalha("ip", 1000)).toEqual({ bloqueado: false, restantes: 1 });
    const bloqueio = l.registrarFalha("ip", 2000);
    expect(bloqueio.bloqueado).toBe(true);
    expect(l.consultar("ip", 2000 + 5 * MIN)).toMatchObject({ bloqueado: true, esperaMs: 10 * MIN });
  });

  it("libera depois do bloqueio e recomeça a contagem", () => {
    const l = criarLimitador({ maxFalhas: 2, janelaMs: 10 * MIN });
    l.registrarFalha("ip", 0);
    l.registrarFalha("ip", 0);
    expect(l.consultar("ip", 10 * MIN)).toEqual({ bloqueado: false, restantes: 2 });
  });

  it("falhas antigas saem da janela", () => {
    const l = criarLimitador({ maxFalhas: 3, janelaMs: 15 * MIN });
    l.registrarFalha("ip", 0);
    l.registrarFalha("ip", 1);
    expect(l.consultar("ip", 16 * MIN)).toEqual({ bloqueado: false, restantes: 3 });
    expect(l.registrarFalha("ip", 16 * MIN)).toEqual({ bloqueado: false, restantes: 2 });
  });

  it("chaves são independentes e limpar zera", () => {
    const l = criarLimitador({ maxFalhas: 2, janelaMs: MIN });
    l.registrarFalha("a", 0);
    l.registrarFalha("a", 0);
    expect(l.consultar("a", 1).bloqueado).toBe(true);
    expect(l.consultar("b", 1).bloqueado).toBe(false);
    l.limpar("a");
    expect(l.consultar("a", 2)).toEqual({ bloqueado: false, restantes: 2 });
  });
});

describe("textoEspera", () => {
  it("arredonda para cima em minutos", () => {
    expect(textoEspera(1000)).toBe("1 minuto");
    expect(textoEspera(61_000)).toBe("2 minutos");
    expect(textoEspera(15 * MIN)).toBe("15 minutos");
  });
});

describe("criarLimitador.reservar (tentativas simultâneas)", () => {
  it("não deixa passar mais tentativas em andamento que o limite", () => {
    const l = criarLimitador({ maxFalhas: 3, janelaMs: 15 * MIN });
    const r = Array.from({ length: 10 }, () => l.reservar("ip", 0));
    expect(r.filter((x) => !x.bloqueado)).toHaveLength(3);
    expect(r[3].bloqueado).toBe(true);
  });

  it("falhas e reservas somam; liberar devolve a vaga", () => {
    const l = criarLimitador({ maxFalhas: 3, janelaMs: 15 * MIN });
    l.registrarFalha("ip", 0);
    expect(l.reservar("ip", 1)).toEqual({ bloqueado: false, restantes: 2 });
    expect(l.reservar("ip", 1)).toEqual({ bloqueado: false, restantes: 1 });
    expect(l.reservar("ip", 1).bloqueado).toBe(true);
    l.liberar("ip");
    expect(l.reservar("ip", 2).bloqueado).toBe(false);
  });

  it("concluir as tentativas em andamento com falha bloqueia", () => {
    const l = criarLimitador({ maxFalhas: 2, janelaMs: 10 * MIN });
    l.reservar("ip", 0);
    l.reservar("ip", 0);
    l.liberar("ip");
    l.registrarFalha("ip", 1);
    l.liberar("ip");
    expect(l.registrarFalha("ip", 2).bloqueado).toBe(true);
    expect(l.reservar("ip", 3)).toMatchObject({ bloqueado: true });
  });

  it("limpar no sucesso mantém as outras reservas contando", () => {
    const l = criarLimitador({ maxFalhas: 2, janelaMs: MIN });
    l.reservar("ip", 0);
    l.reservar("ip", 0);
    l.limpar("ip");
    expect(l.reservar("ip", 1).bloqueado).toBe(true);
    l.liberar("ip");
    l.liberar("ip");
    expect(l.reservar("ip", 2).bloqueado).toBe(false);
  });
});
