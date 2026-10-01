"use client";

import { useEffect, useSyncExternalStore, useTransition } from "react";
import { CloudOff, House, RotateCw, TriangleAlert } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui";

function inscreverConexao(avisar: () => void) {
  window.addEventListener("online", avisar);
  window.addEventListener("offline", avisar);
  return () => {
    window.removeEventListener("online", avisar);
    window.removeEventListener("offline", avisar);
  };
}

/** true quando o navegador sabe que está sem internet. */
export function useSemConexao() {
  return useSyncExternalStore(
    inscreverConexao,
    () => !navigator.onLine,
    () => false,
  );
}

export type PropsErro = { error: Error & { digest?: string }; retry: () => void };

/** Textos, ícone e botões comuns às telas de erro (painel, raiz e global). */
export function useConteudoErro({ error, retry }: PropsErro) {
  const semConexao = useSemConexao();
  const [tentando, iniciar] = useTransition();

  useEffect(() => {
    console.error(error);
  }, [error]);

  const tentar = () => iniciar(() => retry());

  return {
    icone: semConexao ? <CloudOff aria-hidden /> : <TriangleAlert aria-hidden />,
    titulo: semConexao ? "Você está sem internet" : "Algo deu errado",
    descricao: semConexao
      ? "Confira o Wi-Fi ou os dados móveis e tente de novo. Nada do que você já salvou foi perdido."
      : "Não conseguimos abrir esta tela agora. Costuma ser uma falha rápida: tente de novo em alguns segundos. Nada do que você já salvou foi perdido.",
    acoes: (
      <>
        <ButtonLink href="/" variante="secundario" icone={<House />}>
          Ir para o início
        </ButtonLink>
        <Button onClick={tentar} carregando={tentando} textoCarregando="Tentando…" icone={<RotateCw />}>
          Tentar de novo
        </Button>
      </>
    ),
    codigo: error.digest ? (
      <>
        Se o problema continuar, informe o código <code className="rounded bg-areia px-1 py-0.5 font-mono">{error.digest}</code>
      </>
    ) : null,
  };
}
