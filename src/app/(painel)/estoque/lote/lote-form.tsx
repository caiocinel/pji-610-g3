"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { History, Layers, PackagePlus, Search, X } from "lucide-react";
import {
  Aviso,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  Checkbox,
  Dialog,
  EmptyState,
  EstoqueBadge,
  Input,
  NumberStepper,
  Select,
  cn,
  mostrarToastResultado,
} from "@/components/ui";
import { ROTULO_MOTIVO, type MotivoEntrada } from "@/lib/dominio";
import { entradaEmLote } from "@/lib/dominio/acoes/estoque";
import type { ProdutoMovimentavel } from "@/lib/consultas/estoque";
import { formatInt, plural } from "@/lib/format";
import { useProtecaoSaida } from "@/components/protecao-saida";
import { EscolhaMotivo, type OpcaoMotivo } from "../_components/escolha-motivo";
import { IconeDialogo } from "../_components/icone-dialogo";
import { interpretarRascunhoLote, salvarRascunhoLote, useRascunhoLote } from "./rascunho-lote";
import { chamarAcao } from "@/lib/dominio/resultado";

// Falha de rede: a movimentação pode ter entrado e só a resposta se perdido.
const MSG_SEM_CONEXAO_ESTOQUE =
  "Sem conexão com o servidor. Quando a internet voltar, confira em Movimentações se ela já entrou antes de registrar de novo.";

const OPCOES: OpcaoMotivo<MotivoEntrada>[] = [
  { valor: "producao", rotulo: ROTULO_MOTIVO.producao },
  { valor: "compra", rotulo: ROTULO_MOTIVO.compra },
  { valor: "outro", rotulo: ROTULO_MOTIVO.outro },
];

const semAcento = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export function LoteForm({ produtos }: { produtos: ProdutoMovimentavel[] }) {
  const router = useRouter();
  const [pendente, startTransition] = useTransition();
  const [qtd, setQtd] = useState<Record<number, number>>({});
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("");
  const [soEscolhidos, setSoEscolhidos] = useState(false);
  const [motivo, setMotivo] = useState<MotivoEntrada>("producao");
  const [observacao, setObservacao] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [concluido, setConcluido] = useState<string | null>(null);

  const escolhidos = produtos.filter((p) => (qtd[p.id] ?? 0) > 0);
  const unidades = escolhidos.reduce((s, p) => s + qtd[p.id], 0);

  // Lote preenchido e não registrado: pede confirmação ao trocar de tela e guarda um rascunho
  // no aparelho (cobre também voltar do navegador e a paleta de comandos).
  const { dialogo: dialogoSaida } = useProtecaoSaida(unidades > 0, {
    titulo: "Sair sem registrar o lote?",
    descricao: `${plural(unidades, "unidade")} ainda não ${unidades === 1 ? "entrou" : "entraram"} no estoque. O lote fica guardado neste aparelho e você pode retomar depois.`,
  });
  const editou = useRef(false);
  useEffect(() => {
    if (editou.current) salvarRascunhoLote({ qtd, motivo, observacao });
  }, [qtd, motivo, observacao]);

  const rascunhoBruto = useRascunhoLote();
  const [rascunhoDispensado, setRascunhoDispensado] = useState(false);
  const rascunho =
    unidades === 0 && !rascunhoDispensado
      ? interpretarRascunhoLote(rascunhoBruto, new Set(produtos.map((p) => p.id)))
      : null;

  function retomarRascunho() {
    if (!rascunho) return;
    editou.current = true;
    setConcluido(null);
    setErro(null);
    setQtd(rascunho.qtd);
    setMotivo(rascunho.motivo);
    setObservacao(rascunho.observacao);
  }

  function descartarRascunho() {
    salvarRascunhoLote(null, true);
    setRascunhoDispensado(true);
  }

  const categorias = [
    ...new Map(
      produtos.filter((p) => p.categoria_id !== null).map((p) => [p.categoria_id!, p.categoria_nome ?? ""]),
    ).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  const temSemCategoria = produtos.some((p) => p.categoria_id === null);

  const termo = semAcento(busca.trim());
  const visiveis = produtos.filter((p) => {
    if (soEscolhidos && !(qtd[p.id] > 0)) return false;
    if (categoria === "sem" ? p.categoria_id !== null : categoria && String(p.categoria_id) !== categoria) return false;
    if (termo && !semAcento(`${p.nome} ${p.aroma} ${p.sku ?? ""}`).includes(termo)) return false;
    return true;
  });

  function definir(id: number, n: number) {
    editou.current = true;
    setConcluido(null);
    setErro(null);
    setQtd((q) => {
      const novo = { ...q };
      if (n > 0) novo[id] = n;
      else delete novo[id];
      return novo;
    });
  }

  function registrar() {
    setErro(null);
    const itens = escolhidos.map((p) => ({ produto_id: p.id, quantidade: qtd[p.id] }));
    startTransition(async () => {
      const r = await chamarAcao(entradaEmLote({ itens, motivo, observacao }), MSG_SEM_CONEXAO_ESTOQUE);
      const ok = mostrarToastResultado(r, {
        acao: { label: "Ver movimentações", onClick: () => router.push("/estoque/movimentacoes?periodo=hoje&tipo=entrada") },
      });
      setConfirmando(false);
      if (ok) {
        setConcluido(r.mensagem ?? "Entrada registrada.");
        editou.current = false;
        salvarRascunhoLote(null, true);
        setQtd({});
        setObservacao("");
        setSoEscolhidos(false);
        router.refresh();
      } else {
        setErro(r.erro ?? "Não foi possível registrar agora.");
      }
    });
  }

  if (produtos.length === 0) {
    return (
      <Card>
        <EmptyState
          icone={<Layers />}
          titulo="Nenhuma vela ativa"
          descricao="Cadastre suas velas para registrar a produção de várias de uma vez."
          acao={<ButtonLink href="/produtos/novo">Cadastrar vela</ButtonLink>}
        />
      </Card>
    );
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Card padding="none">
        <div className="space-y-3 border-b border-linha p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
            <Input
              name="busca-lote"
              label="Buscar vela"
              labelOculto
              type="search"
              icone={<Search />}
              placeholder="Buscar por nome, aroma ou código…"
              value={busca}
              onChange={(e) => setBusca(e.currentTarget.value)}
              autoComplete="off"
            />
            <Select
              name="categoria-lote"
              label="Categoria"
              labelOculto
              value={categoria}
              onChange={(e) => setCategoria(e.currentTarget.value)}
              opcoes={[
                { valor: "", rotulo: "Todas as categorias" },
                ...categorias.map(([id, nome]) => ({ valor: String(id), rotulo: nome })),
                ...(temSemCategoria ? [{ valor: "sem", rotulo: "Sem categoria" }] : []),
              ]}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Checkbox
              name="so-escolhidos"
              label={`Mostrar só as escolhidas (${escolhidos.length})`}
              checked={soEscolhidos}
              onChange={(e) => setSoEscolhidos(e.currentTarget.checked)}
              disabled={escolhidos.length === 0 && !soEscolhidos}
            />
            {escolhidos.length > 0 && (
              <Button
                variante="fantasma"
                tamanho="sm"
                icone={<X />}
                onClick={() => {
                  editou.current = true;
                  setQtd({});
                }}
              >
                Zerar quantidades
              </Button>
            )}
          </div>
        </div>

        {visiveis.length === 0 ? (
          <EmptyState
            compacto
            icone={<Search />}
            titulo="Nenhuma vela encontrada"
            descricao={soEscolhidos ? "Nenhuma vela escolhida com esse filtro." : "Tente outra busca ou categoria."}
          />
        ) : (
          <ul className="divide-y divide-linha" aria-label="Velas para dar entrada">
            {visiveis.map((p) => {
              const n = qtd[p.id] ?? 0;
              return (
                <li
                  key={p.id}
                  className={cn(
                    "flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors sm:px-5",
                    n > 0 && "bg-chama-clara/40",
                  )}
                >
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="truncate font-medium text-tinta">{p.nome}</p>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-suave">
                      <span className="truncate">{p.aroma}</span>
                      <EstoqueBadge estoque={p.estoque} minimo={p.estoque_minimo} />
                      <span className="tabular">
                        {formatInt(p.estoque)} un.
                        {n > 0 && <strong className="text-salvia"> → {formatInt(p.estoque + n)}</strong>}
                      </span>
                    </p>
                  </div>
                  <NumberStepper
                    id={`lote-${p.id}`}
                    tamanho="sm"
                    min={0}
                    max={100000}
                    value={n}
                    onValueChange={(v) => definir(p.id, v)}
                    rotuloAcessivel={`Quantidade de ${p.nome} — ${p.aroma}`}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="space-y-4 lg:sticky lg:top-6">
        {rascunho && (
          <Aviso
            tipo="info"
            titulo="Lote não registrado"
            acao={
              <div className="flex flex-wrap gap-2">
                <Button tamanho="sm" icone={<History />} onClick={retomarRascunho}>
                  Retomar
                </Button>
                <Button variante="fantasma" tamanho="sm" onClick={descartarRascunho}>
                  Descartar
                </Button>
              </div>
            }
          >
            Você deixou {plural(rascunho.velas, "vela")} ({plural(rascunho.unidades, "unidade")}) preenchidas sem
            registrar.
          </Aviso>
        )}
        {concluido && (
          <Aviso
            tipo="ok"
            titulo="Lote registrado"
            acao={
              <ButtonLink href="/estoque" variante="secundario" tamanho="sm">
                Ver estoque
              </ButtonLink>
            }
          >
            {concluido}
          </Aviso>
        )}
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <Card>
          <CardHeader titulo="Resumo do lote" icone={<Layers />} />
          <p className="tabular text-sm text-suave" aria-live="polite">
            {escolhidos.length === 0 ? (
              "Nenhuma vela escolhida ainda. Informe quantas unidades de cada uma ficaram prontas."
            ) : (
              <>
                <strong className="text-tinta">{plural(escolhidos.length, "vela")}</strong> ·{" "}
                <strong className="text-tinta">{plural(unidades, "unidade")}</strong>
              </>
            )}
          </p>
          {escolhidos.length > 0 && (
            <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto rolagem-fina text-sm">
              {escolhidos.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate">
                    {p.nome} <span className="text-suave">— {p.aroma}</span>
                  </span>
                  <span className="tabular shrink-0 font-semibold text-salvia">+{formatInt(qtd[p.id])}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5 space-y-4">
            <EscolhaMotivo
              legenda="De onde veio?"
              colunas={3}
              opcoes={OPCOES}
              valor={motivo}
              onChange={(m) => {
                editou.current = true;
                setMotivo(m);
              }}
            />
            <Input
              name="observacao"
              label="Observação"
              opcional
              maxLength={300}
              placeholder="Ex.: produção de 12/10, lote 8"
              value={observacao}
              onChange={(e) => {
                editou.current = true;
                setObservacao(e.currentTarget.value);
              }}
            />
            <Button
              larguraTotal
              tamanho="lg"
              icone={<PackagePlus />}
              disabled={unidades === 0}
              onClick={() => setConfirmando(true)}
            >
              Registrar entrada
            </Button>
            {unidades > 0 && (
              <p className="text-center text-xs text-suave" role="status">
                O estoque só muda depois de registrar. Até lá, o lote fica guardado neste aparelho.
              </p>
            )}
          </div>
        </Card>
      </div>

      <Dialog
        aberto={confirmando}
        bloqueado={pendente}
        onFechar={() => !pendente && setConfirmando(false)}
        titulo="Confirmar entrada em lote?"
        descricao={`${plural(unidades, "unidade")} em ${plural(escolhidos.length, "vela")} · ${ROTULO_MOTIVO[motivo]}`}
        icone={
          <IconeDialogo>
            <PackagePlus />
          </IconeDialogo>
        }
        rodape={
          <>
            <Button variante="secundario" onClick={() => setConfirmando(false)} disabled={pendente}>
              Voltar
            </Button>
            <Button onClick={registrar} carregando={pendente} textoCarregando="Registrando…">
              Confirmar entrada
            </Button>
          </>
        }
      >
        <ul className="divide-y divide-linha rounded-lg border border-linha text-sm">
          {escolhidos.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="min-w-0 truncate">
                {p.nome} <span className="text-suave">— {p.aroma}</span>
              </span>
              <span className="tabular shrink-0 text-suave">
                {formatInt(p.estoque)} → <strong className="text-salvia">{formatInt(p.estoque + qtd[p.id])}</strong>
              </span>
            </li>
          ))}
        </ul>
        {observacao.trim() && <p className="mt-3 text-sm text-suave">Observação: {observacao.trim()}</p>}
      </Dialog>
      {dialogoSaida}
    </div>
  );
}
