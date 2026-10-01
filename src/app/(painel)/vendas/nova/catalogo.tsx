"use client";

import { useState, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { Check, PackageX, Plus, Search, SearchX, Sparkles, X } from "lucide-react";
import { Button, EmptyState, Kbd, SegmentedControl, cn } from "@/components/ui";
import { formatBRL, formatInt } from "@/lib/format";
import { combinaBusca, normalizarBusca, termosBusca, type ProdutoPDV } from "./tipos";

type Ordem = "populares" | "nome" | "preco";
const SEM_CATEGORIA = "sem";

export type CatalogoProps = {
  produtos: ProdutoPDV[];
  /** Quantidade de cada produto já no carrinho. */
  noCarrinho: Map<number, number>;
  onAdicionar: (produto: ProdutoPDV) => void;
  /** Ref do campo de busca (o atalho "/" foca nele). */
  buscaRef?: Ref<HTMLInputElement>;
};

/** Grade de produtos do PDV: busca instantânea, filtro por categoria, ordenação e toque para adicionar. */
export function Catalogo({ produtos, noCarrinho, onAdicionar, buscaRef }: CatalogoProps) {
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<string>("");
  const [ordem, setOrdem] = useState<Ordem>("populares");

  // Categorias que têm produto ativo, na ordem alfabética; "Sem categoria" por último.
  const categorias = new Map<string, { nome: string; total: number }>();
  for (const p of produtos) {
    const chave = p.categoria_id ? String(p.categoria_id) : SEM_CATEGORIA;
    const atual = categorias.get(chave);
    if (atual) atual.total++;
    else categorias.set(chave, { nome: p.categoria_nome ?? "Sem categoria", total: 1 });
  }
  const chips = [...categorias].sort(([a, x], [b, y]) =>
    a === SEM_CATEGORIA ? 1 : b === SEM_CATEGORIA ? -1 : x.nome.localeCompare(y.nome, "pt-BR"),
  );
  const categoriaValida = categoria && categorias.has(categoria) ? categoria : "";

  const termos = termosBusca(busca);
  const termoSku = normalizarBusca(busca);
  const filtrados = produtos.filter(
    (p) =>
      (!categoriaValida || (p.categoria_id ? String(p.categoria_id) : SEM_CATEGORIA) === categoriaValida) &&
      combinaBusca(termos, p.nome, p.aroma, p.sku, p.categoria_nome),
  );
  const ordenados = [...filtrados].sort((a, b) => {
    // Esgotados sempre no fim da grade.
    const esgA = a.estoque <= 0 ? 1 : 0;
    const esgB = b.estoque <= 0 ? 1 : 0;
    if (esgA !== esgB) return esgA - esgB;
    if (ordem === "preco") return a.preco - b.preco || a.nome.localeCompare(b.nome, "pt-BR");
    if (ordem === "nome") return a.nome.localeCompare(b.nome, "pt-BR") || a.aroma.localeCompare(b.aroma, "pt-BR");
    return b.vendidos - a.vendidos || a.nome.localeCompare(b.nome, "pt-BR");
  });
  const vendaveis = ordenados.filter((p) => p.estoque > (noCarrinho.get(p.id) ?? 0));

  function focarCartao(indice: number) {
    const botoes = document.querySelectorAll<HTMLButtonElement>("[data-cartao-produto]");
    botoes[Math.max(0, Math.min(indice, botoes.length - 1))]?.focus();
  }

  function teclaBusca(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape" && busca) {
      e.preventDefault();
      e.stopPropagation();
      setBusca("");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      focarCartao(0);
    } else if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      // SKU exato (leitor de código de barras) ou resultado único: adiciona direto e limpa a busca.
      const porSku = termoSku ? vendaveis.find((p) => p.sku && normalizarBusca(p.sku) === termoSku) : undefined;
      const alvo = porSku ?? (vendaveis.length === 1 ? vendaveis[0] : undefined);
      if (alvo) {
        onAdicionar(alvo);
        setBusca("");
      } else if (ordenados.length > 0) {
        focarCartao(0);
      }
    }
  }

  /** Setas movem o foco entre os cartões (como numa grade). */
  function teclaGrade(e: KeyboardEvent<HTMLUListElement>) {
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const botoes = [...document.querySelectorAll<HTMLButtonElement>("[data-cartao-produto]")];
    const atual = botoes.indexOf(document.activeElement as HTMLButtonElement);
    if (atual < 0) return;
    e.preventDefault();
    const topo = botoes[0]?.offsetTop ?? 0;
    const colunas = Math.max(1, botoes.filter((b) => b.offsetTop === topo).length);
    const destino = {
      ArrowRight: atual + 1,
      ArrowLeft: atual - 1,
      ArrowDown: atual + colunas,
      ArrowUp: atual - colunas,
      Home: 0,
      End: botoes.length - 1,
    }[e.key]!;
    if (destino < 0 && e.key === "ArrowUp") {
      document.getElementById("pdv-busca")?.focus();
      return;
    }
    focarCartao(destino);
  }

  return (
    <section aria-labelledby="pdv-titulo-catalogo" className="@container min-w-0 space-y-3">
      <h2 id="pdv-titulo-catalogo" className="sr-only">
        Produtos
      </h2>

      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-suave" />
        <label htmlFor="pdv-busca" className="sr-only">
          Buscar produto por nome, aroma, categoria ou SKU
        </label>
        <input
          ref={buscaRef}
          id="pdv-busca"
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          value={busca}
          onChange={(e) => setBusca(e.currentTarget.value)}
          onKeyDown={teclaBusca}
          placeholder="Buscar vela, aroma ou SKU…"
          aria-describedby="pdv-busca-dica"
          className="campo h-12 pr-20 pl-9 text-base sm:h-11"
        />
        <div className="absolute inset-y-0 right-2 flex items-center gap-1">
          {busca ? (
            <button
              type="button"
              onClick={() => {
                setBusca("");
                document.getElementById("pdv-busca")?.focus();
              }}
              aria-label="Limpar busca"
              className="flex size-9 items-center justify-center rounded-md text-suave hover:bg-areia hover:text-tinta"
            >
              <X aria-hidden className="size-4" />
            </button>
          ) : (
            <span aria-hidden className="hidden pr-1 lg:inline">
              <Kbd>/</Kbd>
            </span>
          )}
        </div>
        <p id="pdv-busca-dica" className="sr-only">
          Enter adiciona o produto quando só um aparece ou quando o SKU confere. Seta para baixo vai para a grade.
        </p>
      </div>

      <div className="flex flex-col gap-2 @2xl:flex-row @2xl:items-start @2xl:justify-between">
        <div
          role="group"
          aria-label="Filtrar por categoria"
          className="sem-barra -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0 @2xl:flex-wrap"
        >
          <Chip ativo={!categoriaValida} onClick={() => setCategoria("")} contagem={produtos.length}>
            Todas
          </Chip>
          {chips.map(([chave, c]) => (
            <Chip
              key={chave}
              ativo={categoriaValida === chave}
              onClick={() => setCategoria(categoriaValida === chave ? "" : chave)}
              contagem={c.total}
            >
              {c.nome}
            </Chip>
          ))}
        </div>
        <SegmentedControl<Ordem>
          rotulo="Ordenar produtos"
          tamanho="sm"
          valor={ordem}
          onChange={setOrdem}
          className="shrink-0 self-start"
          opcoes={[
            { valor: "populares", rotulo: "Mais vendidas" },
            { valor: "nome", rotulo: "A–Z" },
            { valor: "preco", rotulo: "Preço" },
          ]}
        />
      </div>

      <p className="sr-only" aria-live="polite">
        {termos.length > 0 || categoriaValida ? `${ordenados.length} produtos encontrados` : ""}
      </p>

      {ordenados.length === 0 ? (
        <div className="cartao">
          <EmptyState
            compacto
            icone={<SearchX aria-hidden />}
            titulo="Nenhuma vela encontrada"
            descricao={busca ? `Nada combina com “${busca}”. Confira a grafia ou busque pelo aroma.` : "Nenhum produto nesta categoria."}
            acao={
              <Button
                variante="secundario"
                tamanho="sm"
                onClick={() => {
                  setBusca("");
                  setCategoria("");
                }}
              >
                Limpar filtros
              </Button>
            }
          />
        </div>
      ) : (
        <ul
          onKeyDown={teclaGrade}
          aria-label="Produtos disponíveis. Toque para adicionar ao carrinho."
          className="grid grid-cols-2 gap-2.5 @lg:grid-cols-3 @lg:gap-3 @4xl:grid-cols-4"
        >
          {ordenados.map((p) => (
            <li key={p.id} className="min-w-0">
              <CartaoProduto produto={p} quantidade={noCarrinho.get(p.id) ?? 0} onAdicionar={onAdicionar} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Chip({
  ativo,
  onClick,
  contagem,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  contagem: number;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition sm:h-9",
        ativo
          ? "border-chama bg-chama-clara text-chama-escura"
          : "border-linha-forte bg-papel text-suave hover:border-suave/50 hover:text-tinta",
      )}
    >
      {children}
      <span className={cn("tabular text-xs", ativo ? "text-chama-escura" : "text-suave")}>{contagem}</span>
    </button>
  );
}

function CartaoProduto({
  produto: p,
  quantidade,
  onAdicionar,
}: {
  produto: ProdutoPDV;
  quantidade: number;
  onAdicionar: (p: ProdutoPDV) => void;
}) {
  const esgotado = p.estoque <= 0;
  const restante = p.estoque - quantidade;
  const tudoNoCarrinho = !esgotado && restante <= 0;
  const baixo = !esgotado && p.estoque <= p.estoque_minimo;
  const indisponivel = esgotado || tudoNoCarrinho;

  const estoqueTexto = esgotado
    ? "Esgotado"
    : tudoNoCarrinho
      ? "Todo o estoque no carrinho"
      : baixo
        ? p.estoque === 1
          ? "Última unidade"
          : `Últimas ${formatInt(p.estoque)}`
        : `${formatInt(p.estoque)} em estoque`;

  return (
    <button
      type="button"
      data-cartao-produto
      onClick={() => onAdicionar(p)}
      aria-disabled={indisponivel || undefined}
      aria-label={`${p.nome}, ${p.aroma}. ${formatBRL(p.preco)}. ${estoqueTexto}.${quantidade ? ` ${quantidade} no carrinho.` : ""}${indisponivel ? "" : " Adicionar ao carrinho."}`}
      className={cn(
        "group relative flex h-full w-full flex-col rounded-xl border bg-papel p-3 text-left shadow-suave transition select-none sm:p-3.5",
        "active:scale-[0.98] motion-reduce:active:scale-100",
        quantidade > 0 ? "border-chama ring-1 ring-chama/40" : "border-linha hover:border-linha-forte hover:shadow-elevado",
        indisponivel && "cursor-not-allowed opacity-60 hover:shadow-suave active:scale-100",
      )}
    >
      {quantidade > 0 && (
        <span
          key={quantidade}
          aria-hidden
          className="animate-entrada tabular absolute -top-2 -right-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-chama px-1.5 text-xs font-semibold text-sobre shadow-suave ring-2 ring-papel"
        >
          {quantidade}
        </span>
      )}
      <span className="line-clamp-2 pr-2 text-sm leading-snug font-medium text-tinta">{p.nome}</span>
      <span className="mt-1 flex min-w-0 items-start gap-1 text-xs text-suave">
        <Sparkles aria-hidden className="mt-px size-3 shrink-0" />
        <span className="line-clamp-2">{p.aroma}</span>
      </span>
      <span className="mt-auto flex items-end justify-between gap-2 pt-3">
        <span className="min-w-0">
          <span className="tabular block font-serif text-base leading-tight font-semibold text-tinta sm:text-lg">
            {formatBRL(p.preco)}
          </span>
          <span
            className={cn(
              "mt-0.5 flex items-center gap-1 text-[0.6875rem] leading-tight font-medium",
              esgotado ? "text-alerta" : baixo || tudoNoCarrinho ? "text-mel" : "text-suave",
            )}
          >
            {esgotado && <PackageX aria-hidden className="size-3 shrink-0" />}
            {estoqueTexto}
          </span>
        </span>
        {!indisponivel && (
          <span
            aria-hidden
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full transition",
              quantidade > 0 ? "bg-chama text-sobre" : "bg-chama-clara text-chama-escura group-hover:bg-chama group-hover:text-sobre",
            )}
          >
            <Plus className="size-4" />
          </span>
        )}
        {tudoNoCarrinho && (
          <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-salvia-clara text-salvia">
            <Check className="size-4" />
          </span>
        )}
      </span>
    </button>
  );
}
