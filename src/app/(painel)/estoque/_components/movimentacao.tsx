"use client";

import {
  createContext,
  use,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ClipboardList,
  Ellipsis,
  History,
  PackageMinus,
  PackagePlus,
  Gift,
  Eye,
  CircleHelp,
  Flame,
  Wrench,
} from "lucide-react";
import {
  Aviso,
  Button,
  ButtonLink,
  Dialog,
  EmptyState,
  EstoqueBadge,
  Input,
  NumberStepper,
  SegmentedControl,
  Select,
  cn,
  mostrarToastResultado,
  type OpcoesBotao,
} from "@/components/ui";
import {
  ROTULO_MOTIVO,
  diferencaInventario,
  type MotivoEntrada,
  type MotivoSaida,
  type ResultadoAcao,
} from "@/lib/dominio";
import { ajustarInventario, registrarEntrada, registrarSaida } from "@/lib/dominio/acoes/estoque";
import type { ProdutoMovimentavel } from "@/lib/consultas/estoque";
import { EscolhaMotivo, type OpcaoMotivo } from "./escolha-motivo";
import { IconeDialogo } from "./icone-dialogo";
import { chamarAcao } from "@/lib/dominio/resultado";

// Falha de rede: a movimentação pode ter entrado e só a resposta se perdido.
const MSG_SEM_CONEXAO_ESTOQUE =
  "Sem conexão com o servidor. Quando a internet voltar, confira em Movimentações se ela já entrou antes de registrar de novo.";

export type AbaMovimentacao = "entrada" | "saida" | "inventario";

type Abertura = { produtoId: number | null; aba: AbaMovimentacao };

const Contexto = createContext<{ abrir: (a?: Partial<Abertura>) => void } | null>(null);

function useMovimentacao() {
  const c = use(Contexto);
  if (!c) throw new Error("Use dentro de <MovimentacaoProvider>.");
  return c;
}

/**
 * Guarda UM diálogo de movimentação para a página inteira; botões em qualquer lugar (inclusive
 * dentro de tabelas renderizadas no servidor) o abrem com `useMovimentacao().abrir(...)`.
 * `inicial` vem da URL (?produto=ID&acao=entrada|saida|inventario) — ex.: "dar entrada" do dashboard.
 */
export function MovimentacaoProvider({
  produtos,
  inicial,
  limparUrl,
  children,
}: {
  produtos: ProdutoMovimentavel[];
  inicial?: Abertura | null;
  /** Href sem ?produto/?acao, para limpar a URL ao fechar quando o diálogo abriu pela URL. */
  limparUrl?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [estado, setEstado] = useState<{ aberto: boolean; chave: number } & Abertura>(() => ({
    aberto: !!inicial,
    chave: 0,
    produtoId: inicial?.produtoId ?? null,
    aba: inicial?.aba ?? "entrada",
  }));
  // Reabre se a URL mudar por fora (ex.: link "dar entrada" com a página já aberta).
  const chaveUrl = inicial ? `${inicial.produtoId}|${inicial.aba}` : "";
  const [chaveUrlAnterior, setChaveUrlAnterior] = useState(chaveUrl);
  if (chaveUrl !== chaveUrlAnterior) {
    setChaveUrlAnterior(chaveUrl);
    if (inicial) setEstado((e) => ({ aberto: true, chave: e.chave + 1, ...inicial }));
  }

  const abrir = (a: Partial<Abertura> = {}) =>
    setEstado((e) => ({ aberto: true, chave: e.chave + 1, produtoId: a.produtoId ?? null, aba: a.aba ?? "entrada" }));

  function fechar() {
    setEstado((e) => ({ ...e, aberto: false }));
    if (inicial && limparUrl) router.replace(limparUrl, { scroll: false });
  }

  return (
    <Contexto value={{ abrir }}>
      {children}
      <DialogMovimentacao
        key={estado.chave}
        aberto={estado.aberto}
        onFechar={fechar}
        produtos={produtos}
        produtoInicial={estado.produtoId}
        abaInicial={estado.aba}
      />
    </Contexto>
  );
}

/** Botão que abre o diálogo de movimentação. */
export function BotaoMovimentar({
  produtoId,
  aba = "entrada",
  children,
  icone,
  className,
  ...botao
}: OpcoesBotao & {
  produtoId?: number;
  aba?: AbaMovimentacao;
  children: ReactNode;
  icone?: ReactNode;
  className?: string;
}) {
  const { abrir } = useMovimentacao();
  return (
    <Button {...botao} icone={icone} className={className} onClick={() => abrir({ produtoId: produtoId ?? null, aba })}>
      {children}
    </Button>
  );
}

/** Ações de uma linha da tabela de estoque: "Entrada" + menu com saída, contagem e histórico. */
export function AcoesProdutoEstoque({ produtoId, nome }: { produtoId: number; nome: string }) {
  const { abrir } = useMovimentacao();
  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variante="secundario"
        tamanho="sm"
        icone={<PackagePlus />}
        onClick={() => abrir({ produtoId, aba: "entrada" })}
        aria-label={`Dar entrada em ${nome}`}
      >
        Entrada
      </Button>
      <MenuMaisAcoes produtoId={produtoId} nome={nome} />
    </div>
  );
}

const ALTURA_MENU = 200;

/**
 * Menu "…" da linha. Fica num portal com position:fixed porque a tabela rola na horizontal
 * (overflow-x-auto), o que recortaria um menu absoluto na última linha. Abre para cima quando
 * não há espaço embaixo.
 */
function MenuMaisAcoes({ produtoId, nome }: { produtoId: number; nome: string }) {
  const { abrir } = useMovimentacao();
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const idMenu = useId();
  const aberto = pos !== null;
  const rotulo = `Mais ações para ${nome}`;

  function abrirMenu() {
    const r = botao.current?.getBoundingClientRect();
    if (!r) return;
    const right = Math.max(8, window.innerWidth - r.right);
    const paraCima = window.innerHeight - r.bottom < ALTURA_MENU + 16 && r.top > ALTURA_MENU + 16;
    setPos(paraCima ? { bottom: window.innerHeight - r.top + 6, right } : { top: r.bottom + 6, right });
  }

  function fechar(focarBotao = true) {
    setPos(null);
    if (focarBotao) botao.current?.focus();
  }

  useEffect(() => {
    if (!aberto) return;
    const fechaSemFoco = () => setPos(null);
    function fora(e: PointerEvent) {
      const alvo = e.target as Node;
      if (!menu.current?.contains(alvo) && !botao.current?.contains(alvo)) setPos(null);
    }
    document.addEventListener("pointerdown", fora);
    // Posição fixa: se a página ou a tabela rolar, fecha em vez de deixar o menu "flutuando".
    window.addEventListener("scroll", fechaSemFoco, true);
    window.addEventListener("resize", fechaSemFoco);
    menu.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("pointerdown", fora);
      window.removeEventListener("scroll", fechaSemFoco, true);
      window.removeEventListener("resize", fechaSemFoco);
    };
  }, [aberto]);

  function teclado(e: KeyboardEvent<HTMLDivElement>) {
    const itens = [...(menu.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
    const i = itens.indexOf(document.activeElement as HTMLElement);
    const focar = (n: number) => itens[(n + itens.length) % itens.length]?.focus();
    if (e.key === "Escape") {
      e.preventDefault();
      fechar();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      focar(i + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focar(i - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focar(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focar(itens.length - 1);
    } else if (e.key === "Tab") {
      e.preventDefault();
      fechar();
    }
  }

  const classeItem =
    "flex h-11 w-full items-center gap-2.5 rounded-md px-3 text-left text-sm text-tinta outline-none transition hover:bg-areia focus:bg-areia sm:h-9 [&_svg]:size-4 [&_svg]:shrink-0";
  const acao = (rotuloItem: string, icone: ReactNode, aba: AbaMovimentacao) => (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      className={classeItem}
      onClick={() => {
        fechar(false);
        abrir({ produtoId, aba });
      }}
    >
      {icone}
      <span className="truncate">{rotuloItem}</span>
    </button>
  );
  const link = (rotuloItem: string, icone: ReactNode, href: string) => (
    <Link href={href} role="menuitem" tabIndex={-1} className={classeItem} onClick={() => fechar(false)}>
      {icone}
      <span className="truncate">{rotuloItem}</span>
    </Link>
  );

  return (
    <>
      <Button
        ref={botao}
        variante="fantasma"
        tamanho="sm"
        somenteIcone
        icone={<Ellipsis />}
        aria-label={rotulo}
        title={rotulo}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? idMenu : undefined}
        onClick={() => (aberto ? fechar(false) : abrirMenu())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !aberto) {
            e.preventDefault();
            abrirMenu();
          }
        }}
      />
      {pos &&
        createPortal(
          <div
            ref={menu}
            id={idMenu}
            role="menu"
            aria-label={rotulo}
            onKeyDown={teclado}
            style={{ top: pos.top, bottom: pos.bottom, right: pos.right }}
            className="animate-entrada fixed z-50 min-w-52 rounded-xl border border-linha bg-papel p-1 shadow-elevado"
          >
            {acao("Registrar saída", <PackageMinus />, "saida")}
            {acao("Contagem (inventário)", <ClipboardList />, "inventario")}
            <div role="separator" className="my-1 h-px bg-linha" />
            {link("Ver histórico", <History />, `/estoque/movimentacoes?produto=${produtoId}`)}
            {link("Ver produto", <Eye />, `/produtos/${produtoId}`)}
          </div>,
          document.body,
        )}
    </>
  );
}

/* ---------------- Diálogo ---------------- */

const OPCOES_ENTRADA: OpcaoMotivo<MotivoEntrada>[] = [
  { valor: "producao", rotulo: ROTULO_MOTIVO.producao },
  { valor: "compra", rotulo: ROTULO_MOTIVO.compra },
  { valor: "outro", rotulo: ROTULO_MOTIVO.outro },
];

const OPCOES_SAIDA: OpcaoMotivo<MotivoSaida>[] = [
  { valor: "perda", rotulo: ROTULO_MOTIVO.perda, descricao: "Quebrou, sumiu, venceu", icone: <Flame /> },
  { valor: "avaria", rotulo: ROTULO_MOTIVO.avaria, descricao: "Saiu com defeito", icone: <Wrench /> },
  { valor: "uso_interno", rotulo: ROTULO_MOTIVO.uso_interno, descricao: "Mostruário, presente", icone: <Gift /> },
  { valor: "outro", rotulo: ROTULO_MOTIVO.outro, descricao: "Explique na observação", icone: <CircleHelp /> },
];

const ATALHOS_QTD = [6, 12, 24];

const TITULOS: Record<AbaMovimentacao, { titulo: string; confirmar: string; enviando: string }> = {
  entrada: { titulo: "Dar entrada no estoque", confirmar: "Dar entrada", enviando: "Registrando…" },
  saida: { titulo: "Registrar saída", confirmar: "Registrar saída", enviando: "Registrando…" },
  inventario: { titulo: "Contagem de estoque", confirmar: "Salvar contagem", enviando: "Salvando…" },
};

function DialogMovimentacao({
  aberto,
  onFechar,
  produtos,
  produtoInicial,
  abaInicial,
}: {
  aberto: boolean;
  onFechar: () => void;
  produtos: ProdutoMovimentavel[];
  produtoInicial: number | null;
  abaInicial: AbaMovimentacao;
}) {
  const router = useRouter();
  const [pendente, startTransition] = useTransition();
  const inicialValido = produtos.some((p) => p.id === produtoInicial) ? produtoInicial : null;
  const [produtoId, setProdutoId] = useState<number | null>(inicialValido ?? (produtos.length === 1 ? produtos[0].id : null));
  const produto = produtos.find((p) => p.id === produtoId) ?? null;
  const [aba, setAba] = useState<AbaMovimentacao>(abaInicial);
  const [quantidade, setQuantidade] = useState(1);
  const [contagem, setContagem] = useState(produto?.estoque ?? 0);
  const [motivoEntrada, setMotivoEntrada] = useState<MotivoEntrada>("producao");
  const [motivoSaida, setMotivoSaida] = useState<MotivoSaida>("perda");
  const [observacao, setObservacao] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const formId = "form-movimentacao";
  const produtoNaoEncontrado = produtoInicial !== null && inicialValido === null;

  function trocarProduto(id: number | null) {
    setProdutoId(id);
    const p = produtos.find((x) => x.id === id);
    setContagem(p?.estoque ?? 0);
    setErros({});
  }

  const estoque = produto?.estoque ?? 0;
  const semEstoqueParaSaida = aba === "saida" && !!produto && estoque <= 0;
  // Nunca limitar em silêncio: o que está no campo é o que será gravado. Acima do saldo, bloqueia com erro.
  const excedeSaida = aba === "saida" && !!produto && estoque > 0 && quantidade > estoque;
  const msgExcede = `Só há ${estoque} em estoque. Diminua a quantidade.`;
  const erroQtdSaida = erros.quantidade ?? (excedeSaida ? msgExcede : undefined);
  const dif = diferencaInventario(estoque, contagem);
  const novoSaldo = aba === "entrada" ? estoque + quantidade : aba === "saida" ? estoque - quantidade : contagem;

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!produto) {
      setErros({ produto_id: "Escolha a vela." });
      return;
    }
    if (semEstoqueParaSaida) return;
    if (excedeSaida) {
      setErros({ quantidade: msgExcede });
      document.getElementById("mov-quantidade")?.focus();
      return;
    }
    const id = produto.id;
    startTransition(async () => {
      let r: ResultadoAcao<unknown>;
      if (aba === "entrada") {
        r = await chamarAcao(registrarEntrada({ produto_id: id, quantidade, motivo: motivoEntrada, observacao }), MSG_SEM_CONEXAO_ESTOQUE);
      } else if (aba === "saida") {
        r = await chamarAcao(registrarSaida({ produto_id: id, quantidade, motivo: motivoSaida, observacao }), MSG_SEM_CONEXAO_ESTOQUE);
      } else {
        r = await chamarAcao(ajustarInventario({ produto_id: id, contagem, observacao }), MSG_SEM_CONEXAO_ESTOQUE);
      }
      const ok = mostrarToastResultado(r, {
        acao: r.ok && r.id ? { label: "Ver histórico", onClick: () => router.push(`/estoque/movimentacoes?produto=${id}`) } : undefined,
      });
      if (ok) {
        onFechar();
        router.refresh();
      } else {
        setErros(r.campos ?? {});
      }
    });
  }

  const textos = TITULOS[aba];

  return (
    <Dialog
      aberto={aberto}
      bloqueado={pendente}
      onFechar={() => !pendente && onFechar()}
      titulo={textos.titulo}
      descricao={produto ? `${produto.nome} — ${produto.aroma}` : "Escolha a vela e o que aconteceu com ela."}
      icone={<IconeDialogo>{aba === "entrada" ? <PackagePlus /> : aba === "saida" ? <PackageMinus /> : <ClipboardList />}</IconeDialogo>}
      rodape={
        produtos.length > 0 ? (
          <>
            <Button variante="secundario" onClick={onFechar} disabled={pendente}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form={formId}
              variante={aba === "saida" ? "perigo-solido" : "primario"}
              carregando={pendente}
              textoCarregando={textos.enviando}
              disabled={semEstoqueParaSaida}
            >
              {textos.confirmar}
            </Button>
          </>
        ) : undefined
      }
    >
      {produtos.length === 0 ? (
        <EmptyState
          compacto
          icone={<PackagePlus />}
          titulo="Nenhuma vela ativa"
          descricao="Cadastre uma vela para controlar o estoque dela."
          acao={<ButtonLink href="/produtos/novo">Cadastrar vela</ButtonLink>}
        />
      ) : (
        <form id={formId} onSubmit={enviar} className="space-y-5" noValidate>
          {produtoNaoEncontrado && (
            <Aviso tipo="atencao">Essa vela não está disponível (pode ter sido desativada). Escolha outra abaixo.</Aviso>
          )}
          <SegmentedControl<AbaMovimentacao>
            rotulo="O que aconteceu?"
            larguraTotal
            // Em 360px as três opções com ícone não cabem: no celular, só o texto e menos padding.
            className="[&_svg]:hidden sm:[&_svg]:inline [&>button]:px-2 sm:[&>button]:px-3"
            valor={aba}
            onChange={(v) => {
              setAba(v);
              setErros({});
            }}
            opcoes={[
              { valor: "entrada", rotulo: "Entrada", icone: <PackagePlus /> },
              { valor: "saida", rotulo: "Saída", icone: <PackageMinus /> },
              { valor: "inventario", rotulo: "Contagem", icone: <ClipboardList /> },
            ]}
          />

          <div>
            <Select
              name="produto_id"
              id="mov-produto"
              label="Vela"
              placeholder="Escolha a vela…"
              value={produtoId ?? ""}
              onChange={(e) => trocarProduto(e.currentTarget.value ? Number(e.currentTarget.value) : null)}
              erro={erros.produto_id}
              opcoes={produtos.map((p) => ({
                valor: p.id,
                rotulo: `${p.nome} — ${p.aroma} (${p.estoque} un.)`,
              }))}
            />
            {produto && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-suave">
                <EstoqueBadge estoque={produto.estoque} minimo={produto.estoque_minimo} />
                <span className="tabular">
                  Agora: <strong className="text-tinta">{produto.estoque} un.</strong> · mínimo {produto.estoque_minimo}
                </span>
              </div>
            )}
          </div>

          {aba === "entrada" && (
            <>
              <div>
                <NumberStepper
                  id="mov-quantidade"
                  label="Quantas unidades entraram?"
                  min={1}
                  max={100000}
                  value={quantidade}
                  onValueChange={setQuantidade}
                  sufixo="un."
                  erro={erros.quantidade}
                />
                <div className="mt-2 flex flex-wrap gap-2" aria-label="Atalhos de quantidade">
                  {ATALHOS_QTD.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setQuantidade(n)}
                      className={cn(
                        "tabular h-9 rounded-full border px-3 text-xs font-medium transition",
                        quantidade === n
                          ? "border-chama bg-chama-clara text-chama-escura"
                          : "border-linha-forte bg-papel text-suave hover:bg-areia hover:text-tinta",
                      )}
                    >
                      {n} un.
                    </button>
                  ))}
                </div>
              </div>
              <EscolhaMotivo
                legenda="De onde veio?"
                colunas={3}
                opcoes={OPCOES_ENTRADA}
                valor={motivoEntrada}
                onChange={setMotivoEntrada}
                erro={erros.motivo}
              />
            </>
          )}

          {aba === "saida" &&
            (semEstoqueParaSaida ? (
              <Aviso tipo="atencao" titulo="Sem unidades para tirar">
                Essa vela está com estoque zerado. Se a contagem real for diferente, use a aba “Contagem”.
              </Aviso>
            ) : (
              <>
                <div>
                  <NumberStepper
                    id="mov-quantidade"
                    label="Quantas unidades saíram?"
                    min={1}
                    max={100000}
                    value={quantidade}
                    onValueChange={(v) => {
                      setQuantidade(v);
                      if (erros.quantidade)
                        setErros((atual) => {
                          const resto = { ...atual };
                          delete resto.quantidade;
                          return resto;
                        });
                    }}
                    sufixo="un."
                    hint={produto && !erroQtdSaida ? `Há ${estoque} em estoque.` : undefined}
                    erro={erroQtdSaida}
                  />
                  {excedeSaida && (
                    <button
                      type="button"
                      className="link mt-2 inline-flex min-h-10 items-center text-sm sm:min-h-0"
                      onClick={() => {
                        setQuantidade(estoque);
                        setErros({});
                      }}
                    >
                      Tirar todas as {estoque} unidades
                    </button>
                  )}
                </div>
                <EscolhaMotivo
                  legenda="Por quê?"
                  opcoes={OPCOES_SAIDA}
                  valor={motivoSaida}
                  onChange={setMotivoSaida}
                  erro={erros.motivo}
                />
              </>
            ))}

          {aba === "inventario" && (
            <>
              <NumberStepper
                id="mov-contagem"
                label="Quantas unidades você contou?"
                min={0}
                max={1000000}
                value={contagem}
                onValueChange={setContagem}
                sufixo="un."
                hint="Conte as velas na prateleira e informe o número real. O sistema acerta a diferença."
                erro={erros.contagem}
              />
              {produto && (
                <Aviso tipo={dif.tipo === null ? "ok" : "info"}>
                  {dif.tipo === null
                    ? "A contagem confere com o sistema. Nada será alterado."
                    : dif.tipo === "entrada"
                      ? `Sobraram ${dif.quantidade} a mais do que o sistema mostrava: será registrada uma entrada de ${dif.quantidade} un.`
                      : `Faltam ${dif.quantidade} em relação ao sistema: será registrada uma saída de ${dif.quantidade} un.`}
                </Aviso>
              )}
            </>
          )}

          {!(aba === "saida" && semEstoqueParaSaida) && (
            <Input
              name="observacao"
              id="mov-observacao"
              label="Observação"
              opcional
              maxLength={300}
              value={observacao}
              onChange={(e) => setObservacao(e.currentTarget.value)}
              placeholder={
                aba === "entrada" ? "Ex.: lote 12, fornecedor X" : aba === "saida" ? "Ex.: caiu da prateleira" : "Ex.: contagem de fim de mês"
              }
              erro={erros.observacao}
            />
          )}

          {produto && !(aba === "saida" && (semEstoqueParaSaida || excedeSaida)) && (
            <p
              className="tabular flex items-center justify-center gap-2 rounded-lg bg-areia px-3 py-2.5 text-sm text-suave"
              aria-live="polite"
            >
              Estoque: <strong className="text-tinta">{estoque}</strong>
              <ArrowRight aria-hidden className="size-4" />
              <strong
                className={cn(
                  novoSaldo > estoque ? "text-salvia" : novoSaldo < estoque ? "text-alerta" : "text-tinta",
                )}
              >
                {novoSaldo} un.
              </strong>
            </p>
          )}
        </form>
      )}
    </Dialog>
  );
}
