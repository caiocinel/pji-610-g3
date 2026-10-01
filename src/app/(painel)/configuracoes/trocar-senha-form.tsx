"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, Circle, KeyRound } from "lucide-react";
import { Aviso, Badge, Button, Card, CardHeader, ProgressBar, cn, erroCampo, mostrarToastResultado } from "@/components/ui";
import type { EstadoAcao } from "@/lib/dominio";
import { trocarSenha } from "@/lib/dominio/acoes/configuracoes";
import { CampoSenha } from "@/app/login/campo-senha";
import { chamarAcao } from "@/lib/dominio/resultado";

const VAZIO = { senha_atual: "", nova_senha: "", confirmacao: "" };
type Campo = keyof typeof VAZIO;

/** Força aproximada (0–4) só para orientar; a regra obrigatória é o mínimo de 8 caracteres. */
function forca(senha: string) {
  if (!senha) return 0;
  let pontos = 0;
  if (senha.length >= 8) pontos++;
  if (senha.length >= 12) pontos++;
  if (/[a-zA-Z]/.test(senha) && /\d/.test(senha)) pontos++;
  if (/[^a-zA-Z0-9]/.test(senha) || (/[a-z]/.test(senha) && /[A-Z]/.test(senha))) pontos++;
  return senha.length < 8 ? Math.min(pontos, 1) : pontos;
}

const NIVEIS = [
  { rotulo: "", tom: "alerta" },
  { rotulo: "Fraca", tom: "alerta" },
  { rotulo: "Razoável", tom: "mel" },
  { rotulo: "Boa", tom: "salvia" },
  { rotulo: "Forte", tom: "salvia" },
] as const;

export function TrocarSenhaForm({ senhaPersonalizada }: { senhaPersonalizada: boolean }) {
  const router = useRouter();
  const [valores, setValores] = useState(VAZIO);
  const [estado, setEstado] = useState<EstadoAcao>(null);
  // Campos editados desde o último envio: o erro do servidor neles já não vale e some ao digitar.
  const [editados, setEditados] = useState<ReadonlySet<Campo>>(new Set());
  const [pendente, startTransition] = useTransition();

  const nivel = forca(valores.nova_senha);
  const requisitos = [
    { ok: valores.nova_senha.length >= 8, texto: "Pelo menos 8 caracteres" },
    { ok: /[a-zA-Z]/.test(valores.nova_senha) && /\d/.test(valores.nova_senha), texto: "Letras e números (recomendado)" },
    {
      ok: valores.nova_senha.length > 0 && valores.nova_senha !== valores.senha_atual,
      texto: "Diferente da senha atual",
    },
  ];
  const confirmacaoConfere = valores.confirmacao.length > 0 && valores.confirmacao === valores.nova_senha;
  const confirmacaoErrada = valores.confirmacao.length >= valores.nova_senha.length && valores.confirmacao.length > 0 && !confirmacaoConfere;

  function mudar(campo: Campo, valor: string) {
    setValores((v) => ({ ...v, [campo]: valor }));
    // Mudar a nova senha também invalida o erro "confirmação não confere".
    const afetados: Campo[] = campo === "nova_senha" ? ["nova_senha", "confirmacao"] : [campo];
    setEditados((atual) => (afetados.every((c) => atual.has(c)) ? atual : new Set([...atual, ...afetados])));
  }

  function erroServidor(campo: Campo) {
    return editados.has(campo) ? undefined : erroCampo(estado, campo);
  }

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await chamarAcao(trocarSenha(fd));
      setEstado(r);
      setEditados(new Set());
      mostrarToastResultado(r);
      if (r.ok) {
        setValores(VAZIO);
        router.refresh();
      }
    });
  }

  return (
    <Card id="senha" className="scroll-mt-24">
      <CardHeader
        icone={<KeyRound />}
        titulo="Senha de acesso"
        descricao="Troque a senha usada para entrar no sistema."
        acoes={
          senhaPersonalizada ? (
            <Badge tom="salvia" ponto>
              Senha personalizada
            </Badge>
          ) : (
            <Badge tom="mel" ponto>
              Senha inicial
            </Badge>
          )
        }
      />

      {!senhaPersonalizada && (
        <Aviso tipo="atencao" className="mb-4">
          Você ainda usa a senha definida na instalação. Recomendamos criar uma senha só sua.
        </Aviso>
      )}

      <form onSubmit={enviar} className="space-y-4" noValidate>
        <CampoSenha
          name="senha_atual"
          label="Senha atual"
          autoComplete="current-password"
          required
          value={valores.senha_atual}
          onChange={(e) => mudar("senha_atual", e.target.value)}
          erro={erroServidor("senha_atual")}
          wrapperClassName="sm:max-w-sm"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <CampoSenha
              name="nova_senha"
              label="Nova senha"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              value={valores.nova_senha}
              onChange={(e) => mudar("nova_senha", e.target.value)}
              erro={erroServidor("nova_senha")}
            />
            {valores.nova_senha && (
              <div className="mt-2 flex items-center gap-3">
                <ProgressBar
                  valor={nivel}
                  max={4}
                  tom={NIVEIS[nivel].tom}
                  rotulo={`Força da senha: ${NIVEIS[nivel].rotulo}`}
                  className="flex-1"
                />
                <span className="w-16 text-right text-xs font-medium text-suave">{NIVEIS[nivel].rotulo}</span>
              </div>
            )}
          </div>
          <CampoSenha
            name="confirmacao"
            label="Repita a nova senha"
            autoComplete="new-password"
            required
            maxLength={128}
            value={valores.confirmacao}
            onChange={(e) => mudar("confirmacao", e.target.value)}
            erro={erroServidor("confirmacao") ?? (confirmacaoErrada ? "As senhas não são iguais." : undefined)}
            hint={confirmacaoConfere ? "As senhas conferem." : undefined}
          />
        </div>

        <ul className="grid gap-1.5 text-sm sm:grid-cols-3" aria-label="Requisitos da nova senha">
          {requisitos.map((r) => (
            <li key={r.texto} className={cn("flex items-center gap-2", r.ok ? "text-salvia" : "text-suave")}>
              {r.ok ? <Check aria-hidden className="size-4 shrink-0" /> : <Circle aria-hidden className="size-4 shrink-0" />}
              <span>
                {r.texto}
                <span className="sr-only">{r.ok ? ": atendido" : ": pendente"}</span>
              </span>
            </li>
          ))}
        </ul>

        {estado?.ok === false && !estado.campos && <Aviso tipo="erro">{estado.erro}</Aviso>}

        <div className="flex flex-col gap-3 border-t border-linha pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-suave">Você continua conectada neste aparelho. Os outros aparelhos serão desconectados e precisarão da nova senha.</p>
          <Button
            type="submit"
            icone={<KeyRound />}
            carregando={pendente}
            textoCarregando="Trocando…"
            disabled={!valores.senha_atual || !valores.nova_senha || !valores.confirmacao}
          >
            Trocar senha
          </Button>
        </div>
      </form>
    </Card>
  );
}
