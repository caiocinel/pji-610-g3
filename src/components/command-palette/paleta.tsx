"use client";

import { useEffect, useId, useRef, useState, useTransition, type KeyboardEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CircleAlert,
  Clock,
  CornerDownLeft,
  LoaderCircle,
  Package,
  Receipt,
  Search,
  SearchX,
  UserRound,
} from "lucide-react";
import { logout } from "@/app/actions";
import { Badge, EstoqueBadge, Kbd, cn } from "@/components/ui";
import type { ResultadoBusca } from "@/lib/consultas/busca";
import { formatBRL, formatDateShort, formatTelefone, formatTime, plural } from "@/lib/format";
import { buscarNaPaleta } from "./acoes";
import {
  ACOES_INICIAIS,
  ACOES_RAPIDAS,
  PAGINAS,
  combina,
  lerRecentes,
  limparRecentes,
  salvarRecente,
  type Recente,
} from "./itens";

type Item = {
  id: string;
  titulo: ReactNode;
  subtitulo?: ReactNode;
  icone: ReactNode;
  /** Informação à direita (preço, selo). */
  extra?: ReactNode;
  href?: string;
  sair?: boolean;
  recente?: Recente;
};

type Grupo = { id: string; titulo: string; itens: Item[]; acao?: ReactNode };

type EstadoBusca = ResultadoBusca & { erro?: string; termo: string };

const VAZIO: EstadoBusca = { produtos: [], clientes: [], vendas: [], termo: "" };

const ICONE_RECENTE = { produto: <Package />, cliente: <UserRound />, venda: <Receipt /> };

/** Paleta de comandos: busca global + ações rápidas. Controlada pelo PaletaProvider. */
export function PaletaComandos({ aberta, onFechar }: { aberta: boolean; onFechar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberta && !d.open) {
      d.showModal();
      d.querySelector<HTMLInputElement>("input[type=search]")?.focus();
    } else if (!aberta && d.open) d.close();
  }, [aberta]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitulo}
      onClose={onFechar}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
      className={cn(
        "m-0 h-dvh max-h-none w-full max-w-none border-0 bg-papel p-0 pt-[env(safe-area-inset-top)] text-tinta shadow-elevado sm:pt-0",
        "sm:mx-auto sm:mt-[12vh] sm:h-auto sm:max-h-[min(38rem,76dvh)] sm:w-[calc(100%-2rem)] sm:max-w-xl sm:rounded-2xl sm:border sm:border-linha",
      )}
    >
      <h2 id={idTitulo} className="sr-only">
        Buscar e ir para
      </h2>
      {aberta && <ConteudoPaleta onFechar={onFechar} />}
    </dialog>
  );
}

function ConteudoPaleta({ onFechar }: { onFechar: () => void }) {
  const router = useRouter();
  const idLista = useId();
  const [termo, setTermo] = useState("");
  const [busca, setBusca] = useState<EstadoBusca>(VAZIO);
  const [carregando, setCarregando] = useState(false);
  const [ativo, setAtivo] = useState(0);
  // Montado só com a paleta aberta (no cliente), então ler o localStorage aqui é seguro.
  const [recentes, setRecentes] = useState<Recente[]>(lerRecentes);
  const [saindo, iniciarSaida] = useTransition();
  const seq = useRef(0);
  const temporizador = useRef<number | undefined>(undefined);
  const lista = useRef<HTMLDivElement>(null);

  // Sugestões iniciais (vendas recentes) assim que abre.
  useEffect(() => {
    let vivo = true;
    buscarNaPaleta("")
      .then((r) => {
        if (vivo && seq.current === 0) setBusca({ ...r, termo: "" });
      })
      // Sem conexão: só não mostra as sugestões; a busca digitada avisa o erro.
      .catch(() => {});
    return () => {
      vivo = false;
      window.clearTimeout(temporizador.current);
    };
  }, []);

  function aoDigitar(valor: string) {
    setTermo(valor);
    setAtivo(0);
    window.clearTimeout(temporizador.current);
    const meu = ++seq.current;
    const limpo = valor.trim();
    if (!limpo) {
      setCarregando(false);
      return;
    }
    setCarregando(true);
    temporizador.current = window.setTimeout(async () => {
      let r: Awaited<ReturnType<typeof buscarNaPaleta>>;
      try {
        r = await buscarNaPaleta(limpo);
      } catch {
        // A Server Action não chegou ao servidor (sem internet, nova versão publicada…).
        r = { ...VAZIO, erro: "Sem conexão com o servidor. Confira a internet e tente de novo." };
      }
      if (meu !== seq.current) return;
      setBusca({ ...r, termo: limpo });
      setCarregando(false);
    }, 200);
  }

  const grupos = montarGrupos(termo.trim(), busca, recentes, () => {
    limparRecentes();
    setRecentes([]);
  });
  const itens = grupos.flatMap((g) => g.itens);
  const indiceAtivo = itens.length ? Math.min(ativo, itens.length - 1) : -1;
  const idOpcao = (i: number) => `${idLista}-op-${i}`;

  useEffect(() => {
    if (indiceAtivo < 0) return;
    lista.current?.querySelector(`[data-indice="${indiceAtivo}"]`)?.scrollIntoView({ block: "nearest" });
  }, [indiceAtivo]);

  function selecionar(item: Item | undefined, novaAba = false) {
    if (!item) return;
    if (item.sair) {
      iniciarSaida(async () => {
        await logout();
      });
      return;
    }
    if (!item.href) return;
    if (item.recente) salvarRecente(item.recente);
    if (novaAba) {
      window.open(item.href, "_blank", "noopener");
      return;
    }
    onFechar();
    router.push(item.href);
  }

  function aoTeclar(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!itens.length) return;
      const passo = e.key === "ArrowDown" ? 1 : -1;
      setAtivo((indiceAtivo + passo + itens.length) % itens.length);
    } else if (e.key === "PageDown" || e.key === "PageUp") {
      e.preventDefault();
      if (!itens.length) return;
      setAtivo(e.key === "PageDown" ? Math.min(itens.length - 1, indiceAtivo + 5) : Math.max(0, indiceAtivo - 5));
    } else if (e.key === "Enter") {
      e.preventDefault();
      selecionar(itens[indiceAtivo], e.ctrlKey || e.metaKey);
    } else if (e.key === "Escape" && termo) {
      // Primeiro Esc limpa a busca; o segundo fecha a paleta.
      e.preventDefault();
      aoDigitar("");
    }
  }

  const limpo = termo.trim();
  const semResultados = !!limpo && !carregando && busca.termo === limpo && itens.length === 0;
  const inicioGrupo = grupos.map((_, gi) => grupos.slice(0, gi).reduce((soma, g) => soma + g.itens.length, 0));

  return (
    <div className="flex h-full max-h-[inherit] flex-col">
      <div className="flex items-center gap-2 border-b border-linha px-3 sm:px-4">
        <Search aria-hidden className="size-5 shrink-0 text-suave" />
        <input
          type="search"
          role="combobox"
          aria-expanded="true"
          aria-controls={idLista}
          aria-autocomplete="list"
          aria-activedescendant={indiceAtivo >= 0 ? idOpcao(indiceAtivo) : undefined}
          aria-label="Buscar produtos, clientes, vendas ou ações"
          placeholder="Buscar vela, cliente, nº da venda…"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          value={termo}
          onChange={(e) => aoDigitar(e.target.value)}
          onKeyDown={aoTeclar}
          className="h-14 min-w-0 flex-1 bg-transparent text-base text-tinta outline-none placeholder:text-suave focus-visible:outline-none"
        />
        {(carregando || saindo) && <LoaderCircle aria-hidden className="size-5 shrink-0 animate-spin text-suave" />}
        <button
          type="button"
          onClick={onFechar}
          className="-mr-1 flex h-10 shrink-0 items-center rounded-lg px-2 text-sm font-medium text-chama-escura hover:bg-areia sm:hidden"
        >
          Fechar
        </button>
        <Kbd className="hidden sm:inline-flex">Esc</Kbd>
      </div>

      <div ref={lista} className="rolagem-fina min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
        <div id={idLista} role="listbox" aria-label="Resultados" aria-busy={carregando || undefined}>
          {grupos.map((g, gi) => (
            <div key={g.id} role="group" aria-labelledby={`${idLista}-${g.id}`} className="pb-1">
              <div className="flex items-center justify-between px-2 pt-2 pb-1">
                <p id={`${idLista}-${g.id}`} className="text-xs font-medium tracking-wide text-suave uppercase">
                  {g.titulo}
                </p>
                {g.acao}
              </div>
              {g.itens.map((item, ii) => {
                const i = inicioGrupo[gi] + ii;
                const marcado = i === indiceAtivo;
                return (
                  <div
                    key={item.id}
                    id={idOpcao(i)}
                    role="option"
                    aria-selected={marcado}
                    data-indice={i}
                    onMouseMove={() => {
                      if (!marcado) setAtivo(i);
                    }}
                    onClick={(e) => selecionar(item, e.ctrlKey || e.metaKey)}
                    className={cn(
                      "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-2 py-2 select-none sm:min-h-11",
                      marcado ? "bg-chama-clara text-chama-escura" : "text-tinta",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-md [&_svg]:size-4",
                        marcado ? "bg-papel/70 text-chama-escura" : "bg-areia text-suave",
                      )}
                    >
                      {item.icone}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.titulo}</span>
                      {item.subtitulo && (
                        <span className={cn("block truncate text-xs", marcado ? "text-chama-escura" : "text-suave")}>
                          {item.subtitulo}
                        </span>
                      )}
                    </span>
                    {item.extra && <span className="flex shrink-0 items-center gap-2 text-sm">{item.extra}</span>}
                    <CornerDownLeft
                      aria-hidden
                      className={cn("hidden size-4 shrink-0 sm:block", marcado ? "opacity-70" : "opacity-0")}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {busca.erro && limpo && (
          <p role="alert" className="mx-2 mt-2 flex items-center gap-2 rounded-lg bg-alerta-clara px-3 py-2 text-sm text-alerta">
            <CircleAlert aria-hidden className="size-4 shrink-0" />
            {busca.erro}
          </p>
        )}

        {semResultados && (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-areia text-suave">
              <SearchX aria-hidden className="size-6" />
            </span>
            <p className="font-serif text-base font-semibold">Nada encontrado para “{limpo}”</p>
            <p className="text-sm text-suave">Confira a grafia ou busque pelo aroma, telefone ou nº da venda.</p>
          </div>
        )}

        <p className="sr-only" aria-live="polite">
          {limpo && !carregando ? (itens.length ? plural(itens.length, "resultado") : "Nenhum resultado") : ""}
        </p>
      </div>

      <div className="hidden items-center gap-4 border-t border-linha bg-areia/40 px-4 py-2.5 text-xs text-suave sm:flex">
        <span className="flex items-center gap-1.5">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> navegar
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>Enter</Kbd> abrir
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>Ctrl</Kbd>
          <Kbd>Enter</Kbd> nova aba
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <Kbd>Esc</Kbd> fechar
        </span>
      </div>
    </div>
  );
}

/* ---------- Montagem dos grupos ---------- */

function montarGrupos(termo: string, busca: EstadoBusca, recentes: Recente[], limparHistorico: () => void): Grupo[] {
  const grupos: Grupo[] = [];

  if (!termo) {
    if (recentes.length) {
      grupos.push({
        id: "recentes",
        titulo: "Abertos recentemente",
        acao: (
          <button
            type="button"
            onClick={limparHistorico}
            className="-my-3 inline-flex min-h-10 items-center rounded px-2 text-xs font-medium text-suave hover:text-tinta hover:underline sm:-my-1 sm:min-h-6"
          >
            Limpar
          </button>
        ),
        itens: recentes.map((r) => ({
          id: `rec-${r.href}`,
          titulo: r.titulo,
          subtitulo: r.subtitulo,
          icone: ICONE_RECENTE[r.tipo] ?? <Clock />,
          href: r.href,
          recente: r,
        })),
      });
    }
    grupos.push({ id: "acoes", titulo: "Ações rápidas", itens: ACOES_RAPIDAS.slice(0, ACOES_INICIAIS).map(itemAcao) });
    if (busca.vendas.length) grupos.push({ id: "vendas", titulo: "Vendas recentes", itens: busca.vendas.map(itemVenda) });
    grupos.push({ id: "paginas", titulo: "Ir para", itens: PAGINAS.map(itemPagina) });
    return grupos;
  }

  const acoes = ACOES_RAPIDAS.filter((a) => combina(termo, a.titulo, a.subtitulo, a.palavras)).slice(0, 4);
  const paginas = PAGINAS.filter((p) => combina(termo, p.rotulo, p.palavras));
  // Resultados do servidor só valem para o termo atual (evita piscar resultados antigos).
  const atual = busca.termo === termo;
  const produtos = atual ? busca.produtos : [];
  const clientes = atual ? busca.clientes : [];
  const vendas = atual ? busca.vendas : [];
  const ehNumero = /^#?\s*\d+$/.test(termo);

  const grupoVendas: Grupo | null = vendas.length ? { id: "vendas", titulo: "Vendas", itens: vendas.map(itemVenda) } : null;
  if (ehNumero && grupoVendas) grupos.push(grupoVendas);
  if (acoes.length) grupos.push({ id: "acoes", titulo: "Ações", itens: acoes.map(itemAcao) });
  if (produtos.length) grupos.push({ id: "produtos", titulo: "Produtos", itens: produtos.map(itemProduto) });
  if (clientes.length) grupos.push({ id: "clientes", titulo: "Clientes", itens: clientes.map(itemCliente) });
  if (!ehNumero && grupoVendas) grupos.push(grupoVendas);
  if (paginas.length) grupos.push({ id: "paginas", titulo: "Ir para", itens: paginas.map(itemPagina) });

  if (atual && !ehNumero) {
    const q = encodeURIComponent(termo);
    grupos.push({
      id: "ver-todos",
      titulo: "Ver todos",
      itens: [
        { id: "todos-produtos", titulo: <>Buscar “{termo}” em produtos</>, icone: <ArrowRight />, href: `/produtos?q=${q}` },
        { id: "todos-clientes", titulo: <>Buscar “{termo}” em clientes</>, icone: <ArrowRight />, href: `/clientes?q=${q}` },
      ],
    });
  }
  return grupos;
}

function itemAcao(a: (typeof ACOES_RAPIDAS)[number]): Item {
  const Icone = a.icone;
  return { id: `acao-${a.id}`, titulo: a.titulo, subtitulo: a.subtitulo, icone: <Icone />, href: a.href, sair: a.id === "sair" };
}

function itemPagina(p: (typeof PAGINAS)[number]): Item {
  const Icone = p.icone;
  return { id: `pag-${p.href}`, titulo: p.rotulo, icone: <Icone />, href: p.href };
}

function itemProduto(p: ResultadoBusca["produtos"][number]): Item {
  const subtitulo = [p.aroma, p.sku].filter(Boolean).join(" · ");
  return {
    id: `prod-${p.id}`,
    titulo: p.nome,
    subtitulo,
    icone: <Package />,
    href: `/produtos/${p.id}`,
    extra: (
      <>
        <EstoqueBadge estoque={p.estoque} minimo={p.estoque_minimo} className="hidden sm:inline-flex" />
        <span className="tabular font-medium">{formatBRL(p.preco)}</span>
      </>
    ),
    recente: { tipo: "produto", href: `/produtos/${p.id}`, titulo: p.nome, subtitulo },
  };
}

function itemCliente(c: ResultadoBusca["clientes"][number]): Item {
  const subtitulo = c.telefone ? formatTelefone(c.telefone) : c.email || (c.instagram ? `@${c.instagram}` : "Sem contato");
  return {
    id: `cli-${c.id}`,
    titulo: c.nome,
    subtitulo,
    icone: <UserRound />,
    href: `/clientes/${c.id}`,
    recente: { tipo: "cliente", href: `/clientes/${c.id}`, titulo: c.nome, subtitulo },
  };
}

function itemVenda(v: ResultadoBusca["vendas"][number]): Item {
  const quando = `${formatDateShort(v.data)} às ${formatTime(v.data)}`;
  const subtitulo = `${quando} · ${v.cliente_nome ?? "Sem cliente"} · ${plural(v.itens, "item", "itens")}`;
  return {
    id: `venda-${v.id}`,
    titulo: `Venda #${v.id}`,
    subtitulo,
    icone: <Receipt />,
    href: `/vendas/${v.id}`,
    extra: (
      <>
        {v.status === "cancelada" && <Badge tom="alerta">Cancelada</Badge>}
        <span className={cn("tabular font-medium", v.status === "cancelada" && "text-suave line-through")}>
          {formatBRL(v.total)}
        </span>
      </>
    ),
    recente: { tipo: "venda", href: `/vendas/${v.id}`, titulo: `Venda #${v.id}`, subtitulo: quando },
  };
}
