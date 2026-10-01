"use client";

import { useEffect, useEffectEvent, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronUp, ExternalLink, History, ShoppingBag, ShoppingCart } from "lucide-react";
import { useTeclaComando } from "@/components/command-palette/contexto";
import { Aviso, Button, Card, CardHeader, Dialog, Drawer, Kbd, cn, toast } from "@/components/ui";
import {
  ROTULO_CANAL,
  ROTULO_FORMA_PAGAMENTO,
  calcularTotaisVenda,
  calcularTroco,
  parseDecimalBR,
  subtotalLinha,
  validarDesconto,
} from "@/lib/dominio";
import { registrarVenda } from "@/lib/dominio/acoes/vendas";
import { formatBRL, formatInt, plural } from "@/lib/format";
import { Catalogo } from "./catalogo";
import { PainelVenda, ResumoValores, type CalculoVenda } from "./painel-venda";
import { interpretarRascunho, salvarRascunho, useRascunhoSalvo } from "./rascunho";
import { VendaSucesso } from "./sucesso";
import {
  VENDA_VAZIA,
  type ClientePDV,
  type EstadoVenda,
  type LinhaCarrinho,
  type ProdutoPDV,
  type VendaConcluida,
} from "./tipos";

export type PDVProps = {
  produtos: ProdutoPDV[];
  clientes: ClientePDV[];
  lojaNome: string;
  /** Pré-seleções vindas da URL (?cliente=ID&produto=ID), ex.: botão "Nova venda" no detalhe do cliente. */
  clienteInicialId?: number | null;
  produtoInicialId?: number | null;
};

function nomeCompleto(p: ProdutoPDV) {
  return `${p.nome} – ${p.aroma}`;
}

/** Ponto de venda: catálogo à esquerda, carrinho/pagamento à direita (gaveta no celular). */
export function PDV({ produtos, clientes, lojaNome, clienteInicialId, produtoInicialId }: PDVProps) {
  const router = useRouter();
  const porId = new Map(produtos.map((p) => [p.id, p]));

  const [venda, setVenda] = useState<EstadoVenda>(() => {
    const produto = produtos.find((p) => p.id === produtoInicialId && p.estoque > 0);
    return {
      ...VENDA_VAZIA,
      carrinho: produto ? [{ produto_id: produto.id, quantidade: 1 }] : [],
      cliente: clientes.find((c) => c.id === clienteInicialId) ?? null,
    };
  });
  const [concluida, setConcluida] = useState<VendaConcluida | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [gaveta, setGaveta] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  // A última tentativa falhou na rede: a venda pode ter entrado ou não (a resposta se perdeu).
  const [envioIncerto, setEnvioIncerto] = useState(false);
  const [anuncio, setAnuncio] = useState("");
  const [rascunhoIgnorado, setRascunhoIgnorado] = useState(false);
  const [pendente, startTransition] = useTransition();
  const buscaRef = useRef<HTMLInputElement>(null);
  const confirmarRef = useRef<HTMLButtonElement>(null);
  // Só grava rascunho depois que a usuária mexeu (para não apagar um rascunho antigo ao abrir a tela).
  const alterado = useRef(false);
  // Chave de idempotência da venda em andamento: repetir o envio (resposta perdida na rede) com a
  // mesma chave devolve a venda já gravada em vez de duplicar. Renova quando a venda muda ou conclui.
  const chaveVenda = useRef<string | null>(null);
  const rascunhoBruto = useRascunhoSalvo();
  const teclaComando = useTeclaComando();

  // ---------- cálculos ao vivo (o servidor recalcula tudo ao registrar) ----------
  const descontoPctTexto = venda.descontoPercentual.trim();
  const descontoValor =
    venda.descontoTipo === "valor" ? (venda.descontoReais ?? 0) : descontoPctTexto ? parseDecimalBR(descontoPctTexto) : 0;
  const linhasValidas = venda.carrinho.flatMap((l) => {
    const p = porId.get(l.produto_id);
    return p ? [{ preco_unitario: p.preco, quantidade: l.quantidade }] : [];
  });
  const totais = calcularTotaisVenda(linhasValidas, {
    tipo: venda.descontoTipo,
    valor: Number.isFinite(descontoValor) ? descontoValor : 0,
  });
  const erroDesconto = Number.isNaN(descontoValor)
    ? "Digite o desconto só com números (ex.: 10 ou 7,5)."
    : linhasValidas.length > 0
      ? validarDesconto(totais.subtotal, venda.descontoTipo, descontoValor)
      : null;
  const recebido = venda.forma === "dinheiro" ? venda.valorRecebido : null;
  const erroRecebido =
    recebido != null && recebido > 0 && recebido < totais.total
      ? `Faltam ${formatBRL(totais.total - recebido)} para cobrir o total.`
      : null;
  const problemas = new Map<number, string>();
  for (const l of venda.carrinho) {
    const p = porId.get(l.produto_id);
    if (!p) problemas.set(l.produto_id, "Este produto não está mais disponível. Remova para continuar.");
    else if (p.estoque <= 0) problemas.set(l.produto_id, "Esgotou enquanto a venda era montada. Remova para continuar.");
    else if (l.quantidade > p.estoque) problemas.set(l.produto_id, `Só há ${formatInt(p.estoque)} em estoque. Ajuste a quantidade.`);
  }
  const calculo: CalculoVenda = {
    ...totais,
    troco: recebido != null ? calcularTroco(totais.total, recebido) : null,
    unidades: venda.carrinho.reduce((s, l) => s + l.quantidade, 0),
    erroDesconto,
    erroRecebido,
    problemas,
  };
  const bloqueio =
    venda.carrinho.length === 0
      ? "Adicione pelo menos uma vela."
      : problemas.size > 0
        ? "Resolva os itens marcados no carrinho."
        : (erroDesconto ?? erroRecebido);

  // ---------- alterações ----------
  function mudar(fn: (v: EstadoVenda) => EstadoVenda) {
    alterado.current = true;
    chaveVenda.current = null;
    setErroEnvio(null);
    setEnvioIncerto(false);
    // Mexeu na venda atual: o aviso de rascunho antigo deixa de fazer sentido.
    setRascunhoIgnorado(true);
    setVenda(fn);
  }

  function atualizar(parcial: Partial<EstadoVenda>) {
    mudar((v) => ({ ...v, ...parcial }));
  }

  function adicionar(p: ProdutoPDV) {
    const atual = venda.carrinho.find((l) => l.produto_id === p.id)?.quantidade ?? 0;
    if (p.estoque <= 0) {
      toast.error(`${nomeCompleto(p)} está esgotada.`, { description: "Dê entrada no estoque para vender." });
      return;
    }
    if (atual >= p.estoque) {
      toast.warning(`Todo o estoque de ${nomeCompleto(p)} já está no carrinho (${formatInt(p.estoque)}).`);
      return;
    }
    mudar((v) => ({
      ...v,
      carrinho: atual
        ? v.carrinho.map((l) => (l.produto_id === p.id ? { ...l, quantidade: l.quantidade + 1 } : l))
        : [...v.carrinho, { produto_id: p.id, quantidade: 1 }],
    }));
    setAnuncio(`${nomeCompleto(p)} adicionada. ${atual + 1} no carrinho.`);
  }

  function alterarQuantidade(produtoId: number, quantidade: number) {
    const q = Math.max(1, Math.floor(quantidade) || 1);
    mudar((v) => ({ ...v, carrinho: v.carrinho.map((l) => (l.produto_id === produtoId ? { ...l, quantidade: q } : l)) }));
  }

  function remover(produtoId: number) {
    const indice = venda.carrinho.findIndex((l) => l.produto_id === produtoId);
    const linha = venda.carrinho[indice];
    if (!linha) return;
    mudar((v) => ({ ...v, carrinho: v.carrinho.filter((l) => l.produto_id !== produtoId) }));
    const p = porId.get(produtoId);
    toast(`${p ? nomeCompleto(p) : "Item"} removida do carrinho.`, {
      action: { label: "Desfazer", onClick: () => restaurarLinha(linha, indice) },
    });
  }

  function restaurarLinha(linha: LinhaCarrinho, indice: number) {
    mudar((v) => {
      if (v.carrinho.some((l) => l.produto_id === linha.produto_id)) return v;
      const carrinho = [...v.carrinho];
      carrinho.splice(Math.min(indice, carrinho.length), 0, linha);
      return { ...v, carrinho };
    });
  }

  function limpar() {
    const anterior = venda;
    mudar((v) => ({ ...VENDA_VAZIA, canal: v.canal }));
    setGaveta(false);
    toast("Venda limpa.", {
      action: {
        label: "Desfazer",
        onClick: () => {
          alterado.current = true;
          setVenda(anterior);
        },
      },
    });
  }

  // ---------- finalização ----------
  function abrirConfirmacao() {
    if (pendente) return;
    if (bloqueio) {
      toast.error(bloqueio);
      if (venda.carrinho.length > 0 && window.matchMedia("(max-width: 1023px)").matches) setGaveta(true);
      return;
    }
    setErroEnvio(null);
    setConfirmando(true);
  }

  function confirmar() {
    if (pendente || bloqueio) return;
    const snapshot = venda;
    const totalVisto = calculo.total;
    chaveVenda.current ??= typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : null;
    const chave = chaveVenda.current;
    startTransition(async () => {
      let r: Awaited<ReturnType<typeof registrarVenda>>;
      try {
        r = await registrarVenda({
          // Preços e total que a usuária está vendo: se mudaram no banco, o servidor recusa em vez de cobrar outro valor.
          itens: snapshot.carrinho.map((l) => ({ ...l, preco_esperado: porId.get(l.produto_id)?.preco ?? null })),
          total_esperado: totalVisto,
          cliente_id: snapshot.cliente?.id ?? null,
          forma_pagamento: snapshot.forma,
          canal: snapshot.canal,
          desconto_tipo: snapshot.descontoTipo,
          desconto_valor: descontoValor,
          valor_recebido: snapshot.forma === "dinheiro" ? snapshot.valorRecebido : null,
          observacao: snapshot.observacao,
          chave_idempotencia: chave,
        });
      } catch {
        // Falha de rede (wifi/4G caiu, servidor reiniciando): o pedido pode ter chegado e só a resposta se perdido.
        // Mantém a tela, o carrinho e a chave: confirmar de novo sem mudar nada não duplica a venda.
        setErroEnvio(
          chave
            ? "Sem conexão com o servidor. Quando a internet voltar, toque em Confirmar de novo sem mudar nada: se a venda já tiver entrado, ela não será registrada duas vezes."
            : "Sem conexão com o servidor. A venda pode ter sido registrada ou não: confira em Vendas antes de tentar de novo.",
        );
        setEnvioIncerto(true);
        toast.error("Sem conexão com o servidor. A venda continua aberta.");
        return;
      }
      if (r.ok && r.id) {
        chaveVenda.current = null;
        const dados =r.dados ?? { ...totais, troco: calculo.troco, itens: [] };
        // Itens como o servidor gravou (nome e preço do banco); o aroma vem do catálogo.
        const itens =
          dados.itens.length > 0
            ? dados.itens.map((i) => ({
                nome: i.nome,
                aroma: porId.get(i.produto_id)?.aroma ?? "",
                quantidade: i.quantidade,
                preco: i.preco_unitario,
              }))
            : snapshot.carrinho.flatMap((l) => {
                const p = porId.get(l.produto_id);
                return p ? [{ nome: p.nome, aroma: p.aroma, quantidade: l.quantidade, preco: p.preco }] : [];
              });
        alterado.current = false;
        salvarRascunho(null, true);
        setEnvioIncerto(false);
        setConcluida({
          id: r.id,
          subtotal: dados.subtotal,
          desconto: dados.desconto,
          total: dados.total,
          troco: dados.troco,
          forma: snapshot.forma,
          cliente: snapshot.cliente,
          itens,
        });
        // Mantém o canal (ex.: dia de feira); o resto volta ao padrão.
        setVenda({ ...VENDA_VAZIA, canal: snapshot.canal });
        setConfirmando(false);
        setGaveta(false);
        setAnuncio(r.mensagem);
      } else {
        const erro = r.erro ?? "Não foi possível registrar a venda. Tente novamente.";
        setErroEnvio(erro);
        setEnvioIncerto(false);
        toast.error(erro);
        // Estoque ou preço podem ter mudado: busca os dados atuais para a tela mostrar o que ajustar.
        router.refresh();
      }
    });
  }

  function novaVenda() {
    setConcluida(null);
    setRascunhoIgnorado(true);
    requestAnimationFrame(() => buscaRef.current?.focus());
  }

  useEffect(() => {
    if (confirmando) requestAnimationFrame(() => confirmarRef.current?.focus());
  }, [confirmando]);

  useEffect(() => {
    if (alterado.current) salvarRascunho(venda);
  }, [venda]);

  // ---------- atalhos de teclado ----------
  const aoTeclar = useEffectEvent((e: KeyboardEvent) => {
    if (concluida) return;
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      // Só vale com a tela do PDV na frente (no máximo a gaveta e a confirmação abertas).
      const abertos = document.querySelectorAll("dialog[open]").length;
      if (abertos > (gaveta ? 1 : 0) + (confirmando ? 1 : 0)) return;
      e.preventDefault();
      e.stopPropagation();
      if (confirmando) confirmar();
      else abrirConfirmacao();
      return;
    }
    const alvo = e.target instanceof HTMLElement ? e.target : null;
    const digitando = alvo?.closest("input, textarea, select, [contenteditable='true']");
    if (e.key === "/" && !digitando && !e.ctrlKey && !e.metaKey && !e.altKey && !document.querySelector("dialog[open]")) {
      e.preventDefault();
      e.stopPropagation();
      buscaRef.current?.focus();
      buscaRef.current?.select();
    }
  });
  useEffect(() => {
    // Captura na janela para vir antes do atalho global "/" da paleta de comandos:
    // no PDV, "/" vai direto para a busca de produtos.
    const ouvir = (e: KeyboardEvent) => aoTeclar(e);
    window.addEventListener("keydown", ouvir, true);
    return () => window.removeEventListener("keydown", ouvir, true);
  }, []);

  // ---------- rascunho ----------
  const rascunho =
    !concluida && !rascunhoIgnorado && venda.carrinho.length === 0
      ? interpretarRascunho(rascunhoBruto, porId, clientes)
      : null;

  // Cliente já escolhido nesta tela (ex.: "Nova venda" no perfil do cliente) vale mais que o do rascunho.
  const clienteMantido = venda.cliente && venda.cliente.id !== rascunho?.venda.cliente?.id ? venda.cliente : null;

  function retomarRascunho() {
    if (!rascunho) return;
    alterado.current = true;
    setVenda({ ...rascunho.venda, cliente: venda.cliente ?? rascunho.venda.cliente });
    setRascunhoIgnorado(true);
    if (clienteMantido) {
      toast.info(`Itens retomados. A venda continua para ${clienteMantido.nome}.`, {
        description: rascunho.ajustado ? "Alguns itens foram ajustados ao estoque atual." : undefined,
      });
    } else if (rascunho.ajustado) toast.info("Alguns itens foram ajustados ao estoque atual.");
  }

  function descartarRascunho() {
    salvarRascunho(null, true);
    setRascunhoIgnorado(true);
  }

  const anuncioVivo = (
    <p className="sr-only" aria-live="polite" role="status">
      {anuncio}
    </p>
  );

  if (concluida) {
    return (
      <>
        {anuncioVivo}
        <VendaSucesso venda={concluida} lojaNome={lojaNome} onNovaVenda={novaVenda} />
      </>
    );
  }

  const painelProps = {
    venda,
    calculo,
    produtos: porId,
    clientes,
    atualizar,
    alterarQuantidade,
    remover,
    limpar,
  };

  const botaoFinalizar = (
    <Button
      tamanho="lg"
      larguraTotal
      icone={<Check />}
      onClick={abrirConfirmacao}
      aria-describedby={bloqueio ? "pdv-bloqueio" : undefined}
      className={cn(bloqueio && "opacity-60")}
    >
      Finalizar venda
    </Button>
  );

  const temItens = venda.carrinho.length > 0;

  return (
    <>
      {anuncioVivo}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,25rem)] lg:items-start">
        <div className={cn("min-w-0 space-y-4", temItens && "pb-24 lg:pb-0")}>
          {rascunho && (
            <Aviso
              tipo="info"
              titulo="Venda não finalizada"
              acao={
                <div className="flex flex-col gap-1.5 sm:flex-row">
                  <Button tamanho="sm" onClick={retomarRascunho} icone={<History />}>
                    Retomar
                  </Button>
                  <Button tamanho="sm" variante="fantasma" onClick={descartarRascunho}>
                    Descartar
                  </Button>
                </div>
              }
            >
              Você tinha {plural(rascunho.unidades, "vela")} no carrinho
              {rascunho.venda.cliente ? ` para ${rascunho.venda.cliente.nome}` : ""}.
              {clienteMantido && ` Ao retomar, os itens entram na venda para ${clienteMantido.nome}.`}
            </Aviso>
          )}
          <Catalogo produtos={produtos} noCarrinho={quantidades(venda.carrinho)} onAdicionar={adicionar} buscaRef={buscaRef} />
        </div>

        {/* Desktop: painel fixo ao lado. No celular ele vive na gaveta. */}
        <aside aria-label="Carrinho e pagamento" className="hidden lg:sticky lg:top-6 lg:block">
          {!gaveta && (
            <Card padding="none" className="flex max-h-[calc(100dvh-3rem)] flex-col">
              <CardHeader
                inset
                divisoria
                titulo="Venda"
                icone={<ShoppingCart />}
                acoes={
                  temItens ? (
                    <span className="tabular text-sm text-suave">{plural(calculo.unidades, "item", "itens")}</span>
                  ) : undefined
                }
              />
              <div className="rolagem-fina min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <PainelVenda {...painelProps} />
              </div>
              {temItens && (
                <div className="space-y-3 rounded-b-xl border-t border-linha bg-areia/40 px-5 py-4">
                  <ResumoValores calculo={calculo} />
                  {botaoFinalizar}
                  {bloqueio ? (
                    <p id="pdv-bloqueio" className="text-center text-xs text-suave">
                      {bloqueio}
                    </p>
                  ) : (
                    <p className="flex items-center justify-center gap-1 text-xs text-suave">
                      <Kbd>{teclaComando}</Kbd>
                      <Kbd>Enter</Kbd>
                      <span className="ml-1">finaliza ·</span>
                      <Kbd>/</Kbd>
                      <span>busca</span>
                    </p>
                  )}
                </div>
              )}
            </Card>
          )}
        </aside>
      </div>

      {/* Celular/tablet: barra fixa com total, abre a gaveta do carrinho. */}
      {temItens && (
        <div
          className="animate-entrada fixed inset-x-0 z-30 px-3 lg:hidden print:hidden"
          // --nav-inferior (layout do painel) = altura da barra de navegação do celular, já com a área segura.
          style={{ bottom: "calc(var(--nav-inferior, env(safe-area-inset-bottom, 0px)) + 0.75rem)" }}
        >
          <div className="mx-auto flex max-w-xl items-center gap-2 rounded-2xl border border-linha bg-papel/95 p-2 shadow-elevado backdrop-blur">
            <button
              type="button"
              onClick={() => setGaveta(true)}
              aria-haspopup="dialog"
              aria-label={`Ver carrinho: ${plural(calculo.unidades, "item", "itens")}, total ${formatBRL(calculo.total)}`}
              className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl px-2 text-left transition hover:bg-areia"
            >
              <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-chama-clara text-chama-escura">
                <ShoppingCart aria-hidden className="size-5" />
                <span
                  key={calculo.unidades}
                  className="animate-entrada tabular absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-chama px-1 text-[0.6875rem] font-semibold text-sobre ring-2 ring-papel"
                >
                  {calculo.unidades}
                </span>
              </span>
              <span className="min-w-0">
                <span className="block text-xs text-suave">
                  {problemas.size > 0 ? <span className="font-medium text-alerta">Revise o carrinho</span> : "Ver carrinho"}
                  <ChevronUp aria-hidden className="ml-0.5 inline size-3.5 align-[-2px]" />
                </span>
                <span className="tabular block font-serif text-xl leading-tight font-semibold text-tinta">
                  {formatBRL(calculo.total)}
                </span>
              </span>
            </button>
            <Button tamanho="lg" onClick={abrirConfirmacao} iconeDireita={<ArrowRight />} className="px-4">
              Finalizar
            </Button>
          </div>
        </div>
      )}

      <Drawer
        aberto={gaveta}
        onFechar={() => setGaveta(false)}
        titulo="Carrinho"
        descricao={temItens ? `${plural(calculo.unidades, "item", "itens")} · ${formatBRL(calculo.total)}` : undefined}
        rodape={
          temItens ? (
            <div className="space-y-3">
              <ResumoValores calculo={calculo} compacto />
              {botaoFinalizar}
              {bloqueio && (
                <p id="pdv-bloqueio" className="text-center text-xs text-suave">
                  {bloqueio}
                </p>
              )}
            </div>
          ) : undefined
        }
      >
        <PainelVenda {...painelProps} />
      </Drawer>

      <Dialog
        aberto={confirmando}
        bloqueado={pendente}
        onFechar={() => {
          if (!pendente) setConfirmando(false);
        }}
        fecharAoClicarFora={!pendente}
        titulo="Confirmar venda"
        descricao="Confira os dados. Ao confirmar, o estoque é baixado."
        icone={
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-chama-clara text-chama-escura">
            <ShoppingBag aria-hidden className="size-5" />
          </span>
        }
        rodape={
          <>
            <Button variante="secundario" onClick={() => setConfirmando(false)} disabled={pendente}>
              Voltar e editar
            </Button>
            <Button ref={confirmarRef} icone={<Check />} onClick={confirmar} carregando={pendente} textoCarregando="Registrando…">
              Confirmar {formatBRL(calculo.total)}
            </Button>
          </>
        }
      >
        <Confirmacao venda={venda} calculo={calculo} produtos={porId} erro={erroEnvio} incerto={envioIncerto} />
      </Dialog>
    </>
  );
}

function quantidades(carrinho: LinhaCarrinho[]) {
  return new Map(carrinho.map((l) => [l.produto_id, l.quantidade]));
}

function Confirmacao({
  venda,
  calculo,
  produtos,
  erro,
  incerto,
}: {
  venda: EstadoVenda;
  calculo: CalculoVenda;
  produtos: Map<number, ProdutoPDV>;
  erro: string | null;
  incerto: boolean;
}) {
  const detalhes: [string, string][] = [
    ["Cliente", venda.cliente?.nome ?? "Não informado"],
    ["Pagamento", ROTULO_FORMA_PAGAMENTO[venda.forma]],
    ["Canal", ROTULO_CANAL[venda.canal]],
  ];
  if (venda.forma === "dinheiro" && venda.valorRecebido != null && venda.valorRecebido > 0) {
    detalhes.push(["Recebido", formatBRL(venda.valorRecebido)]);
  }
  if (venda.observacao.trim()) detalhes.push(["Observação", venda.observacao.trim()]);

  return (
    <div className="space-y-4">
      {erro && (
        <Aviso tipo="erro">
          {erro}
          {incerto && (
            <a
              href="/vendas?periodo=hoje"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 flex min-h-10 w-fit items-center gap-1 font-medium underline underline-offset-2"
            >
              Ver vendas de hoje
              <ExternalLink aria-hidden className="size-3.5" />
              <span className="sr-only">(abre em nova aba)</span>
            </a>
          )}
        </Aviso>
      )}
      <ul className="divide-y divide-linha rounded-xl border border-linha text-sm">
        {venda.carrinho.map((l) => {
          const p = produtos.get(l.produto_id);
          if (!p) return null;
          return (
            <li key={l.produto_id} className="flex items-baseline justify-between gap-3 px-3 py-2">
              <span className="min-w-0">
                <span className="tabular font-medium">{l.quantidade}×</span> {p.nome}{" "}
                <span className="text-suave">· {p.aroma}</span>
              </span>
              <span className="tabular shrink-0">{formatBRL(subtotalLinha({ preco_unitario: p.preco, quantidade: l.quantidade }))}</span>
            </li>
          );
        })}
      </ul>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        {detalhes.map(([rotulo, valor]) => (
          <div key={rotulo} className="contents">
            <dt className="text-suave">{rotulo}</dt>
            <dd className="min-w-0 text-right break-words text-tinta">{valor}</dd>
          </div>
        ))}
      </dl>
      <div className="rounded-xl bg-areia/60 px-4 py-3">
        <ResumoValores calculo={calculo} />
        {calculo.troco != null && calculo.troco > 0 && (
          <p className="mt-2 flex items-baseline justify-between border-t border-linha pt-2 text-salvia">
            <span className="text-sm font-medium">Troco</span>
            <span className="tabular font-serif text-xl font-semibold">{formatBRL(calculo.troco)}</span>
          </p>
        )}
      </div>
    </div>
  );
}
