"use client";

import { useEffect, useSyncExternalStore, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Toaster as Sonner, toast } from "sonner";
import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert } from "lucide-react";
import { COOKIE_FLASH, type MensagemFlash } from "./flash-tipos";

export { toast };

/**
 * Formato aceito: o ResultadoAcao de src/lib/dominio/resultado.ts ({ ok:true, mensagem } | { ok:false, erro })
 * e também o FormState da v1 ({ ok?: string; error?: string }).
 */
export type RetornoAcao =
  | { ok?: boolean | string; mensagem?: string; erro?: string; error?: string }
  | null
  | undefined
  | void;

export type OpcoesToastAcao = {
  /** Mensagem de sucesso quando a action não devolver `mensagem`. */
  sucesso?: string;
  /** Não mostrar toast de sucesso (só erros). */
  silenciarSucesso?: boolean;
  /** Ação no toast, ex.: { label: "Ver recibo", onClick: () => router.push(…) }. */
  acao?: { label: string; onClick: () => void };
  descricao?: string;
};

/**
 * Mostra o toast certo a partir do retorno de uma Server Action. Retorna true se deu certo.
 * Uso (Client Component):
 *   const r = await salvarProduto(fd);
 *   if (mostrarToastResultado(r)) router.push("/produtos");
 */
export function mostrarToastResultado(r: RetornoAcao, opcoes: OpcoesToastAcao = {}): boolean {
  const retorno = r ?? undefined;
  const erro = retorno ? (retorno.erro ?? retorno.error) : undefined;
  if (erro || (retorno && retorno.ok === false)) {
    toast.error(erro ?? "Não foi possível concluir. Tente novamente.", { description: opcoes.descricao });
    return false;
  }
  if (!opcoes.silenciarSucesso) {
    const msg = (retorno && (retorno.mensagem ?? (typeof retorno.ok === "string" ? retorno.ok : undefined))) ?? opcoes.sucesso;
    if (msg) toast.success(msg, { description: opcoes.descricao, action: opcoes.acao });
  }
  return true;
}

/**
 * Para formulários com useActionState: mostra um toast sempre que o estado mudar.
 *   const [estado, acao] = useActionState(salvarProduto, null);
 *   useToastAcao(estado);
 */
export function useToastAcao(estado: RetornoAcao, opcoes?: { silenciarSucesso?: boolean; sucesso?: string }) {
  const silenciar = opcoes?.silenciarSucesso;
  const sucesso = opcoes?.sucesso;
  useEffect(() => {
    if (estado) mostrarToastResultado(estado, { silenciarSucesso: silenciar, sucesso });
  }, [estado, silenciar, sucesso]);
}

const estiloToaster = {
  "--normal-bg": "var(--color-papel)",
  "--normal-border": "var(--color-linha)",
  "--normal-text": "var(--color-tinta)",
  "--success-bg": "var(--color-salvia-clara)",
  "--success-border": "color-mix(in oklab, var(--color-salvia) 30%, transparent)",
  "--success-text": "var(--color-salvia)",
  "--error-bg": "var(--color-alerta-clara)",
  "--error-border": "color-mix(in oklab, var(--color-alerta) 30%, transparent)",
  "--error-text": "var(--color-alerta)",
  "--warning-bg": "var(--color-mel-clara)",
  "--warning-border": "color-mix(in oklab, var(--color-mel) 30%, transparent)",
  "--warning-text": "var(--color-mel)",
  "--info-bg": "var(--color-info-clara)",
  "--info-border": "color-mix(in oklab, var(--color-info) 25%, transparent)",
  "--info-text": "var(--color-info)",
  "--border-radius": "0.75rem",
} as CSSProperties;

/** Lê o cookie de flash (definido por flashToast() numa Server Action antes de redirect) e mostra o toast. */
function lerFlash() {
  const bruto = document.cookie.split("; ").find((c) => c.startsWith(`${COOKIE_FLASH}=`));
  if (!bruto) return;
  document.cookie = `${COOKIE_FLASH}=; Max-Age=0; path=/`;
  try {
    const { tipo, mensagem } = JSON.parse(decodeURIComponent(bruto.slice(COOKIE_FLASH.length + 1))) as MensagemFlash;
    if (!mensagem) return;
    if (tipo === "erro") toast.error(mensagem);
    else if (tipo === "info") toast.info(mensagem);
    else toast.success(mensagem);
  } catch {
    // cookie malformado: ignora
  }
}

function FlashToast() {
  const pathname = usePathname();
  useEffect(() => {
    lerFlash();
  }, [pathname]);
  return null;
}

/*
 * Diálogos abertos com showModal() ficam na "top layer" e deixam o resto da página inerte: um toast
 * no <body> apareceria atrás do fundo escurecido, sem receber toque (ex.: "Desfazer" no carrinho do PDV).
 * Por isso o Toaster vive num contêiner próprio que é movido para dentro do diálogo modal aberto mais
 * recente e volta ao <body> quando ele fecha. Mover o contêiner (e não remontar) preserva os toasts.
 */
let conteinerToasts: HTMLDivElement | null = null;

function obterContainer() {
  if (!conteinerToasts) {
    conteinerToasts = document.createElement("div");
    conteinerToasts.dataset.toasts = "";
  }
  return conteinerToasts;
}

const semAssinatura = () => () => {};

function useContainerToasts() {
  const host = useSyncExternalStore(semAssinatura, obterContainer, () => null);

  useEffect(() => {
    if (!host) return;
    const pilha: HTMLDialogElement[] = [];

    function reposicionar() {
      // Atualiza a pilha de diálogos modais abertos (ordem de abertura = ordem na top layer).
      for (let i = pilha.length - 1; i >= 0; i--) {
        const d = pilha[i];
        if (!d.isConnected || !d.open) pilha.splice(i, 1);
      }
      for (const d of document.querySelectorAll<HTMLDialogElement>("dialog[open]")) {
        if (!pilha.includes(d) && d.matches(":modal")) pilha.push(d);
      }
      const alvo: HTMLElement = pilha.at(-1) ?? document.body;
      if (host!.parentElement !== alvo) alvo.appendChild(host!);
    }

    reposicionar();
    const obs = new MutationObserver(reposicionar);
    obs.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["open"] });
    return () => {
      obs.disconnect();
      host.remove();
    };
  }, [host]);

  return host;
}

/** Toaster global, já estilizado com a paleta. Fica no layout raiz (não use em outro lugar). */
export function Toaster() {
  const host = useContainerToasts();
  return (
    <>
      {host && createPortal(<ToasterEstilizado />, host)}
      <FlashToast />
    </>
  );
}

function ToasterEstilizado() {
  return (
    <Sonner
      position="top-right"
      richColors
      closeButton
      duration={4500}
      gap={10}
      offset={16}
      mobileOffset={12}
      style={estiloToaster}
      containerAriaLabel="Notificações"
      toastOptions={{
        closeButtonAriaLabel: "Fechar notificação",
        classNames: {
          toast: "font-sans !shadow-elevado",
          title: "!font-medium !text-sm",
          description: "!text-xs !opacity-90",
          actionButton: "!bg-chama !text-sobre !rounded-md !font-medium",
          cancelButton: "!bg-areia !text-tinta !rounded-md",
        },
      }}
      icons={{
        success: <CircleCheck className="size-[18px]" />,
        error: <CircleAlert className="size-[18px]" />,
        warning: <TriangleAlert className="size-[18px]" />,
        info: <Info className="size-[18px]" />,
        loading: <LoaderCircle className="size-[18px] animate-spin" />,
      }}
    />
  );
}
