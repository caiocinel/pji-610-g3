"use client";

import { useEffect, useId, useRef, useState, useTransition, type FormEvent, type ReactNode, type SyntheticEvent } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert, X } from "lucide-react";
import { Button, type OpcoesBotao, type VarianteBotao } from "./button";
import { cn } from "./cn";
import { Aviso } from "./feedback";
import { mostrarToastResultado, type RetornoAcao } from "./toast";

/**
 * Abre/fecha um <dialog> nativo como modal (foco preso e topo da pilha vêm do navegador).
 * Sincroniza a cada render (não só quando `aberto` muda): se o navegador fechou o diálogo por conta
 * própria e o dono recusou fechar (ex.: ação em andamento), ele volta a abrir no próximo render.
 */
function useDialogoNativo(aberto: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) {
      d.showModal();
      // O React não grava o atributo autofocus no cliente e o .focus() dele roda com o diálogo ainda
      // fechado. Os campos/botões do kit marcam data-autofocus; focamos aqui, já com o modal aberto.
      d.querySelector<HTMLElement>("[data-autofocus], [autofocus]")?.focus();
    } else if (!aberto && d.open) d.close();
  });
  return ref;
}

/**
 * Esc dispara "cancel": cancelamos o fechamento nativo e deixamos o estado React decidir
 * (o effect acima fecha quando `aberto` vira false). Assim nada fica aberto no estado e fechado na tela.
 */
function cancelarNativo(e: SyntheticEvent<HTMLDialogElement>, onFechar: () => void, bloqueado?: boolean) {
  e.preventDefault();
  if (!bloqueado) onFechar();
}

type BaseProps = {
  aberto: boolean;
  /** Chamado ao fechar (Esc, X, clique fora, botão Cancelar). Atualize seu estado aqui. */
  onFechar: () => void;
  titulo: ReactNode;
  descricao?: ReactNode;
  children?: ReactNode;
  /** Botões do rodapé. */
  rodape?: ReactNode;
  /** Fecha ao clicar no fundo escurecido (padrão: true). */
  fecharAoClicarFora?: boolean;
  /** Enquanto true (ex.: ação em andamento), Esc, X e clique fora não fecham. */
  bloqueado?: boolean;
  className?: string;
};

function Cabecalho({
  idTitulo,
  idDescricao,
  titulo,
  descricao,
  onFechar,
  icone,
  bloqueado,
}: {
  idTitulo: string;
  idDescricao: string;
  titulo: ReactNode;
  descricao?: ReactNode;
  onFechar: () => void;
  icone?: ReactNode;
  bloqueado?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      {icone}
      <div className="min-w-0 flex-1 pt-0.5">
        <h2 id={idTitulo} className="font-serif text-xl leading-snug font-semibold text-tinta">
          {titulo}
        </h2>
        {descricao && (
          <div id={idDescricao} className="mt-1 text-sm text-suave">
            {descricao}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onFechar}
        disabled={bloqueado}
        aria-label="Fechar"
        className="-mt-1 -mr-1 flex size-10 shrink-0 items-center justify-center rounded-lg text-suave transition hover:bg-areia hover:text-tinta disabled:pointer-events-none disabled:opacity-40 sm:size-9"
      >
        <X aria-hidden className="size-5" />
      </button>
    </div>
  );
}

export type DialogProps = BaseProps & {
  tamanho?: "sm" | "md" | "lg";
  /** Ícone ao lado do título. */
  icone?: ReactNode;
};

/**
 * Diálogo modal controlado.
 *   const [aberto, setAberto] = useState(false);
 *   <Dialog aberto={aberto} onFechar={() => setAberto(false)} titulo="…" rodape={…}>conteúdo</Dialog>
 */
export function Dialog({
  aberto,
  onFechar,
  titulo,
  descricao,
  children,
  rodape,
  fecharAoClicarFora = true,
  bloqueado,
  tamanho = "md",
  icone,
  className,
}: DialogProps) {
  const ref = useDialogoNativo(aberto);
  const idTitulo = useId();
  const idDescricao = useId();
  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitulo}
      aria-describedby={descricao ? idDescricao : undefined}
      onClose={onFechar}
      onCancel={(e) => cancelarNativo(e, onFechar, bloqueado)}
      onMouseDown={(e) => {
        if (fecharAoClicarFora && !bloqueado && e.target === e.currentTarget) onFechar();
      }}
      className={cn(
        "w-[calc(100%-2rem)] rounded-2xl border border-linha bg-papel p-0 text-tinta shadow-elevado",
        "max-h-[calc(100dvh-2rem)]",
        tamanho === "sm" && "max-w-sm",
        tamanho === "md" && "max-w-lg",
        tamanho === "lg" && "max-w-2xl",
        className,
      )}
    >
      {aberto && (
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <div className="px-5 pt-5 sm:px-6 sm:pt-6">
            <Cabecalho
              idTitulo={idTitulo}
              idDescricao={idDescricao}
              titulo={titulo}
              descricao={descricao}
              onFechar={onFechar}
              icone={icone}
              bloqueado={bloqueado}
            />
          </div>
          {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 sm:px-6">{children}</div>}
          {rodape ? (
            <div className="mt-5 flex flex-col-reverse gap-2 border-t border-linha bg-areia/40 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              {rodape}
            </div>
          ) : (
            <div className="pb-5 sm:pb-6" />
          )}
        </div>
      )}
    </dialog>
  );
}

export type ConfirmDialogProps = {
  /** Botão que abre o diálogo. Ex.: { rotulo: "Excluir", variante: "perigo", icone: <Trash2 /> } */
  gatilho: OpcoesBotao & { rotulo: string; icone?: ReactNode; className?: string; somenteIcone?: boolean };
  titulo: ReactNode;
  descricao?: ReactNode;
  /** Texto do botão de confirmação. */
  confirmar?: string;
  /** Texto enquanto a ação roda. */
  confirmando?: string;
  cancelar?: string;
  /** "perigo" usa botão vermelho e ícone de alerta. */
  tom?: "perigo" | "padrao";
  /**
   * Server Action chamada com o FormData do diálogo (inclui `campos` e os inputs de `children`).
   * Deve retornar ResultadoAcao ({ ok, mensagem } | { ok:false, erro }) ou fazer redirect().
   */
  acao: (formData: FormData) => Promise<RetornoAcao> | RetornoAcao;
  /** Inputs hidden enviados junto, ex.: { id: venda.id }. */
  campos?: Record<string, string | number>;
  /** Campos extras dentro do diálogo (ex.: <Textarea name="motivo" label="Motivo" required />). */
  children?: ReactNode;
  /** Mensagem de sucesso se a action não devolver `mensagem`. */
  mensagemSucesso?: string;
  /** Navega para esta rota após sucesso. */
  redirecionarPara?: string;
};

/**
 * Confirmação com Server Action, pronta para usar até em Server Components:
 *   <ConfirmDialog gatilho={{ rotulo: "Excluir", variante: "perigo", icone: <Trash2 /> }}
 *     titulo="Excluir esta vela?" descricao="Essa ação não pode ser desfeita."
 *     confirmar="Excluir" tom="perigo" acao={excluirProduto} campos={{ id: produto.id }} />
 */
export function ConfirmDialog({
  gatilho,
  titulo,
  descricao,
  confirmar = "Confirmar",
  confirmando = "Aguarde…",
  cancelar = "Cancelar",
  tom = "padrao",
  acao,
  campos,
  children,
  mensagemSucesso,
  redirecionarPara,
}: ConfirmDialogProps) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();
  const router = useRouter();
  const variante: VarianteBotao = tom === "perigo" ? "perigo-solido" : "primario";
  const { rotulo, icone, className, ...opcoesGatilho } = gatilho;

  function fechar() {
    if (pendente) return;
    setAberto(false);
    setErro(null);
  }

  // onSubmit (e não <form action>): o React reseta o formulário depois de uma action, o que apagaria
  // o motivo digitado quando dá erro. O erro aparece dentro do diálogo, onde a pessoa está olhando.
  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErro(null);
    startTransition(async () => {
      let r: RetornoAcao;
      try {
        r = await acao(fd);
      } catch (falha) {
        // redirect()/notFound() da Server Action chegam como erro com digest: deixa o Next tratar.
        if (falha && typeof falha === "object" && "digest" in falha) throw falha;
        setErro("Não foi possível concluir. Verifique a conexão e tente de novo.");
        return;
      }
      const retorno = r ?? undefined;
      const msgErro = retorno ? (retorno.erro ?? retorno.error) : undefined;
      if (msgErro || (retorno && retorno.ok === false)) {
        setErro(msgErro ?? "Não foi possível concluir. Tente novamente.");
        return;
      }
      mostrarToastResultado(r, { sucesso: mensagemSucesso });
      setAberto(false);
      if (redirecionarPara) router.push(redirecionarPara);
    });
  }

  return (
    <>
      <Button
        variante="secundario"
        {...opcoesGatilho}
        icone={icone}
        className={className}
        aria-label={opcoesGatilho.somenteIcone ? rotulo : undefined}
        title={opcoesGatilho.somenteIcone ? rotulo : undefined}
        aria-haspopup="dialog"
        onClick={() => setAberto(true)}
      >
        {!opcoesGatilho.somenteIcone && rotulo}
      </Button>
      <Dialog
        aberto={aberto}
        onFechar={fechar}
        bloqueado={pendente}
        titulo={titulo}
        descricao={descricao}
        tamanho="sm"
        icone={
          tom === "perigo" ? (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-alerta-clara text-alerta">
              <TriangleAlert aria-hidden className="size-5" />
            </span>
          ) : undefined
        }
      >
        <form onSubmit={enviar}>
          {campos &&
            Object.entries(campos).map(([nome, valor]) => <input key={nome} type="hidden" name={nome} value={valor} />)}
          {children && <div className="space-y-4">{children}</div>}
          {erro && (
            <Aviso tipo="erro" className={cn(children ? "mt-4" : undefined)}>
              {erro}
            </Aviso>
          )}
          <div className="mt-6 flex flex-col-reverse gap-2 pb-5 sm:flex-row sm:justify-end sm:pb-6">
            <Button variante="secundario" onClick={fechar} disabled={pendente} autoFocus={tom === "perigo"}>
              {cancelar}
            </Button>
            <Button type="submit" variante={variante} carregando={pendente} textoCarregando={confirmando}>
              {confirmar}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export type DrawerProps = BaseProps & {
  /**
   * "auto" (padrão): sobe de baixo no celular e abre à direita a partir de md.
   * "baixo": sempre de baixo. "direita": sempre lateral.
   */
  lado?: "auto" | "baixo" | "direita";
};

/** Gaveta (sheet): carrinho do PDV no celular, filtros, formulários rápidos. */
export function Drawer({
  aberto,
  onFechar,
  titulo,
  descricao,
  children,
  rodape,
  fecharAoClicarFora = true,
  bloqueado,
  lado = "auto",
  className,
}: DrawerProps) {
  const ref = useDialogoNativo(aberto);
  const idTitulo = useId();
  const idDescricao = useId();
  const baixo = "mt-auto mb-0 h-auto max-h-[88dvh] w-full max-w-none rounded-t-2xl border-t";
  const direita = "mr-0 ml-auto h-dvh max-h-none w-full max-w-md rounded-l-2xl border-l";
  return (
    <dialog
      ref={ref}
      data-gaveta={lado}
      aria-labelledby={idTitulo}
      aria-describedby={descricao ? idDescricao : undefined}
      onClose={onFechar}
      onCancel={(e) => cancelarNativo(e, onFechar, bloqueado)}
      onMouseDown={(e) => {
        if (fecharAoClicarFora && !bloqueado && e.target === e.currentTarget) onFechar();
      }}
      className={cn(
        "border-0 border-linha bg-papel p-0 text-tinta shadow-elevado",
        lado === "baixo" && baixo,
        lado === "direita" && direita,
        lado === "auto" &&
          cn(baixo, "md:mt-0 md:mr-0 md:ml-auto md:h-dvh md:max-h-none md:max-w-md md:rounded-none md:rounded-l-2xl md:border-t-0 md:border-l"),
        className,
      )}
    >
      {aberto && (
        <div className={cn("flex flex-col", lado === "baixo" ? "max-h-[88dvh]" : "max-h-[88dvh] md:h-dvh md:max-h-none")}>
          {lado !== "direita" && (
            <div aria-hidden className={cn("mx-auto mt-2 h-1.5 w-10 rounded-full bg-linha-forte", lado === "auto" && "md:hidden")} />
          )}
          <div className="border-b border-linha px-5 pt-4 pb-4">
            <Cabecalho
              idTitulo={idTitulo}
              idDescricao={idDescricao}
              titulo={titulo}
              descricao={descricao}
              onFechar={onFechar}
              bloqueado={bloqueado}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
          {rodape && (
            <div className="border-t border-linha bg-papel px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{rodape}</div>
          )}
        </div>
      )}
    </dialog>
  );
}
