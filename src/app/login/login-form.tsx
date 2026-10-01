"use client";

import { useActionState, useEffect, useRef } from "react";
import { ArrowRight, LockKeyhole, UserRound } from "lucide-react";
import { Aviso, Input, SubmitButton } from "@/components/ui";
import { entrar, type EstadoLogin } from "./actions";
import { CampoSenha } from "./campo-senha";

export function LoginForm({ destino }: { destino?: string }) {
  const [estado, acao] = useActionState<EstadoLogin, FormData>(entrar, null);
  const senhaRef = useRef<HTMLInputElement>(null);

  // Depois de um erro, o usuário continua preenchido e o foco vai para a senha.
  useEffect(() => {
    if (estado && !estado.bloqueado) senhaRef.current?.focus();
  }, [estado]);

  return (
    <form action={acao} className="space-y-4">
      {destino && <input type="hidden" name="de" value={destino} />}

      <Input
        // A chave muda a cada tentativa para remontar o campo com o usuário digitado.
        key={`usuario-${estado?.tentativa ?? 0}`}
        name="usuario"
        label="Usuário"
        icone={<UserRound />}
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        required
        maxLength={100}
        defaultValue={estado?.usuario ?? ""}
        autoFocus={!estado}
      />

      <CampoSenha
        key={`senha-${estado?.tentativa ?? 0}`}
        name="senha"
        label="Senha"
        autoComplete="current-password"
        required
        maxLength={200}
        inputRef={senhaRef}
      />

      {estado?.erro && (
        <Aviso tipo={estado.bloqueado ? "atencao" : "erro"} titulo={estado.bloqueado ? "Acesso pausado" : undefined}>
          {estado.erro}
          {estado.restantes !== undefined && (
            <span className="mt-1 block text-xs">
              {estado.restantes === 1
                ? "Resta 1 tentativa antes de uma pausa de 15 minutos."
                : `Restam ${estado.restantes} tentativas antes de uma pausa de 15 minutos.`}
            </span>
          )}
        </Aviso>
      )}

      <SubmitButton larguraTotal tamanho="lg" pendente="Entrando…">
        Entrar
        <ArrowRight aria-hidden />
      </SubmitButton>

      <p className="flex items-center justify-center gap-1.5 text-xs text-suave">
        <LockKeyhole aria-hidden className="size-3.5" />
        Você continua conectada neste aparelho por 30 dias.
      </p>
    </form>
  );
}
