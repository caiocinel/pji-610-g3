"use client";

// Proteção contra perder um formulário preenchido ao sair da tela.
// `beforeunload` só cobre recarregar/fechar a aba; as trocas de tela do app (sidebar, barra inferior,
// abas, breadcrumb) são cliques em <a> internos, que interceptamos aqui para pedir confirmação.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { Button, Dialog } from "@/components/ui";

type Opcoes = {
  titulo?: string;
  descricao?: string;
  /** Texto do botão que confirma a saída. */
  sair?: string;
  /** Texto do botão que mantém na tela. */
  ficar?: string;
};

/** Link interno que trocaria de tela (ignora âncoras da própria página, nova aba, downloads etc.). */
function destinoInterno(e: MouseEvent): string | null {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  const alvo = e.target instanceof Element ? e.target.closest("a[href]") : null;
  if (!(alvo instanceof HTMLAnchorElement)) return null;
  if ((alvo.target && alvo.target !== "_self") || alvo.hasAttribute("download")) return null;
  const url = new URL(alvo.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  if (url.pathname === window.location.pathname && url.search === window.location.search) return null;
  return url.pathname + url.search + url.hash;
}

/**
 * Enquanto `ativo`, pede confirmação antes de sair da tela (links internos e recarregar/fechar a aba).
 * Renderize o `dialogo` devolvido em algum lugar do componente.
 */
export function useProtecaoSaida(ativo: boolean, opcoes: Opcoes = {}) {
  const router = useRouter();
  const [destino, setDestino] = useState<string | null>(null);

  useEffect(() => {
    if (!ativo) return;
    const antesDeSair = (e: BeforeUnloadEvent) => e.preventDefault();
    // Captura na janela: roda antes do onClick do <Link> do Next (que respeita defaultPrevented).
    const clique = (e: MouseEvent) => {
      const href = destinoInterno(e);
      if (!href) return;
      e.preventDefault();
      e.stopPropagation();
      setDestino(href);
    };
    window.addEventListener("beforeunload", antesDeSair);
    window.addEventListener("click", clique, true);
    return () => {
      window.removeEventListener("beforeunload", antesDeSair);
      window.removeEventListener("click", clique, true);
    };
  }, [ativo]);

  function sair() {
    const href = destino;
    setDestino(null);
    if (href) router.push(href);
  }

  const dialogo = (
    <Dialog
      aberto={destino !== null}
      onFechar={() => setDestino(null)}
      tamanho="sm"
      titulo={opcoes.titulo ?? "Sair sem salvar?"}
      descricao={opcoes.descricao ?? "O que você preencheu nesta tela ainda não foi salvo."}
      icone={
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-alerta-clara text-alerta">
          <TriangleAlert aria-hidden className="size-5" />
        </span>
      }
      rodape={
        <>
          <Button variante="secundario" onClick={sair}>
            {opcoes.sair ?? "Sair mesmo assim"}
          </Button>
          <Button onClick={() => setDestino(null)} autoFocus>
            {opcoes.ficar ?? "Continuar aqui"}
          </Button>
        </>
      }
    />
  );

  return { dialogo };
}
