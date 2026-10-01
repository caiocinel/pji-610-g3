"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { Boxes, Clock, Plus, ScanBarcode, Sparkles, Tags, Weight } from "lucide-react";
import {
  Aviso,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  Dialog,
  EstoqueBadge,
  Input,
  MoneyInput,
  NumberStepper,
  Select,
  Textarea,
  erroCampo,
  mostrarToastResultado,
} from "@/components/ui";
import { criarProduto, editarProduto } from "@/lib/dominio/acoes/produtos";
import { criarCategoria } from "@/lib/dominio/acoes/categorias";
import type { EstadoAcao, Produto } from "@/lib/dominio";
import { formatInt } from "@/lib/format";
import { MargemPreview } from "./margem-preview";
import { chamarAcao } from "@/lib/dominio/resultado";

type CategoriaOpcao = { id: number; nome: string };

export function ProdutoForm({
  produto,
  categorias: categoriasIniciais,
  estoqueMinimoPadrao,
  categoriaInicial,
  modelo,
}: {
  /** Ausente = cadastro novo. */
  produto?: Produto;
  /** Cadastro novo pré-preenchido a partir desta vela ("Duplicar"). Nada é gravado até Cadastrar. */
  modelo?: Produto;
  categorias: CategoriaOpcao[];
  estoqueMinimoPadrao: number;
  /** Categoria pré-selecionada no cadastro (ex.: vindo de /produtos?categoria=3). */
  categoriaInicial?: number | null;
}) {
  const router = useRouter();
  const editando = Boolean(produto);
  // Valores iniciais: a própria vela (edição) ou a vela de origem (duplicar). SKU nunca é copiado.
  const base = produto ?? modelo;
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, setEstado] = useState<EstadoAcao>(null);
  const [pendente, iniciar] = useTransition();

  const [preco, setPreco] = useState<number | null>(base?.preco ?? null);
  const [custo, setCusto] = useState<number | null>(base?.custo ?? null);
  const [categorias, setCategorias] = useState(categoriasIniciais);
  const [categoriaId, setCategoriaId] = useState(String(base?.categoria_id ?? categoriaInicial ?? ""));
  const [novaCategoriaAberta, setNovaCategoriaAberta] = useState(false);

  // Leva o foco ao primeiro campo com erro depois de uma tentativa de salvar.
  useEffect(() => {
    if (estado && !estado.ok) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [estado]);

  function enviar(e: FormEvent<HTMLFormElement>) {
    // Não usamos <form action>: o React limparia os campos ao terminar, perdendo o que foi digitado se der erro.
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    iniciar(async () => {
      const r = await chamarAcao(produto ? editarProduto(fd) : criarProduto(fd));
      setEstado(r);
      if (mostrarToastResultado(r)) router.push(`/produtos/${r.id ?? produto?.id}`);
    });
  }

  const erro = (campo: string) => erroCampo(estado, campo);
  const erroGeral = estado && !estado.ok && !estado.campos ? estado.erro : null;

  return (
    <>
      <form ref={formRef} onSubmit={enviar} className="max-w-3xl space-y-6" aria-busy={pendente}>
        {produto && <input type="hidden" name="id" value={produto.id} />}

        <Card as="section" aria-labelledby="sec-identificacao">
          <CardHeader titulo={<span id="sec-identificacao">Identificação</span>} descricao="Como a vela aparece nas vendas e no recibo." />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              name="nome"
              label="Nome da vela"
              required
              maxLength={120}
              autoComplete="off"
              autoFocus={!editando}
              placeholder="Ex.: Vela Pote Âmbar 200g"
              defaultValue={produto?.nome ?? (modelo ? `${modelo.nome} (cópia)`.slice(0, 120) : undefined)}
              erro={erro("nome")}
            />
            <Input
              name="aroma"
              label="Aroma"
              required
              maxLength={120}
              autoComplete="off"
              icone={<Sparkles />}
              placeholder="Ex.: Lavanda e baunilha"
              defaultValue={base?.aroma}
              erro={erro("aroma")}
            />
            <Select
              name="categoria_id"
              label="Categoria"
              opcional
              placeholder="Sem categoria"
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.currentTarget.value)}
              opcoes={categorias.map((c) => ({ valor: c.id, rotulo: c.nome }))}
              erro={erro("categoria_id")}
              wrapperClassName="sm:col-span-2"
              extra={
                <button
                  type="button"
                  className="link inline-flex items-center gap-1 text-sm"
                  onClick={() => setNovaCategoriaAberta(true)}
                >
                  <Plus aria-hidden className="size-3.5" />
                  Nova categoria
                </button>
              }
            />
            <Textarea
              name="descricao"
              label="Descrição"
              opcional
              rows={3}
              maxLength={2000}
              placeholder="Notas olfativas, tamanho, cera usada…"
              defaultValue={base?.descricao}
              erro={erro("descricao")}
              wrapperClassName="sm:col-span-2"
            />
          </div>
        </Card>

        <Card as="section" aria-labelledby="sec-preco">
          <CardHeader
            titulo={<span id="sec-preco">Preço e margem</span>}
            descricao="O lucro é calculado na hora, enquanto você digita."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyInput
              name="custo"
              label="Custo por unidade"
              hint="Cera, pavio, essência, embalagem…"
              value={custo}
              onValueChange={setCusto}
              erro={erro("custo")}
            />
            <MoneyInput
              name="preco"
              label="Preço de venda"
              required
              value={preco}
              onValueChange={setPreco}
              erro={erro("preco")}
            />
            <MargemPreview preco={preco} custo={custo} onSugerirPreco={setPreco} className="sm:col-span-2" />
          </div>
        </Card>

        <Card as="section" aria-labelledby="sec-estoque">
          <CardHeader titulo={<span id="sec-estoque">Estoque</span>} icone={<Boxes />} />
          <div className="grid gap-4 sm:grid-cols-2">
            {produto ? (
              <div className="min-w-0">
                <p className="rotulo">Quantidade atual</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="tabular font-serif text-2xl font-semibold text-tinta">{formatInt(produto.estoque)} un.</span>
                  <EstoqueBadge estoque={produto.estoque} minimo={produto.estoque_minimo} />
                </div>
                <p className="dica">
                  Para mudar a quantidade, use o{" "}
                  <Link href={`/estoque?produto=${produto.id}`} className="link">
                    Estoque
                  </Link>{" "}
                  (assim fica registrado no histórico).
                </p>
              </div>
            ) : (
              <NumberStepper
                name="estoque_inicial"
                label="Quantas você já tem prontas?"
                hint="Opcional. Entra no histórico como “Estoque inicial”."
                min={0}
                max={1_000_000}
                defaultValue={0}
                sufixo="un."
                erro={erro("estoque_inicial")}
              />
            )}
            <NumberStepper
              name="estoque_minimo"
              label="Avisar quando chegar a"
              hint="Mostramos o alerta de estoque baixo a partir desta quantidade."
              min={0}
              max={1_000_000}
              defaultValue={base?.estoque_minimo ?? estoqueMinimoPadrao}
              sufixo="un."
              erro={erro("estoque_minimo")}
            />
          </div>
        </Card>

        <Card as="section" aria-labelledby="sec-detalhes">
          <CardHeader
            titulo={<span id="sec-detalhes">Detalhes</span>}
            descricao="Tudo opcional. Ajuda a organizar e a responder clientes."
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              name="sku"
              label="Código (SKU)"
              opcional
              maxLength={40}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              icone={<ScanBarcode />}
              placeholder="Ex.: POTE-AMB-200"
              className="uppercase placeholder:normal-case"
              defaultValue={produto?.sku ?? ""}
              erro={erro("sku")}
            />
            <Input
              name="peso_g"
              label="Peso"
              opcional
              type="number"
              inputMode="numeric"
              min={1}
              max={100000}
              step={1}
              icone={<Weight />}
              sufixo="g"
              defaultValue={base?.peso_g ?? ""}
              erro={erro("peso_g")}
            />
            <Input
              name="tempo_queima_h"
              label="Tempo de queima"
              opcional
              type="number"
              inputMode="numeric"
              min={1}
              max={10000}
              step={1}
              icone={<Clock />}
              sufixo="h"
              defaultValue={base?.tempo_queima_h ?? ""}
              erro={erro("tempo_queima_h")}
            />
          </div>
        </Card>

        {erroGeral && <Aviso tipo="erro">{erroGeral}</Aviso>}

        <div className="sticky bottom-[var(--nav-inferior,0px)] z-10 -mx-4 flex flex-col-reverse gap-2 border-t border-linha bg-papel/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <ButtonLink href={base ? `/produtos/${base.id}` : "/produtos"} variante="secundario">
            Cancelar
          </ButtonLink>
          <Button type="submit" carregando={pendente} textoCarregando="Salvando…">
            {produto ? "Salvar alterações" : "Cadastrar vela"}
          </Button>
        </div>
      </form>

      <NovaCategoriaDialog
        aberto={novaCategoriaAberta}
        onFechar={() => setNovaCategoriaAberta(false)}
        onCriada={(c) => {
          setCategorias((lista) => [...lista, c].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
          setCategoriaId(String(c.id));
          setNovaCategoriaAberta(false);
        }}
      />
    </>
  );
}

/** Criação rápida de categoria sem sair do formulário (fica fora do <form> principal de propósito). */
function NovaCategoriaDialog({
  aberto,
  onFechar,
  onCriada,
}: {
  aberto: boolean;
  onFechar: () => void;
  onCriada: (c: CategoriaOpcao) => void;
}) {
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | undefined>();
  const [pendente, iniciar] = useTransition();

  function fechar() {
    setNome("");
    setErro(undefined);
    onFechar();
  }

  function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    iniciar(async () => {
      const r = await chamarAcao(criarCategoria({ nome }));
      if (mostrarToastResultado(r) && r.id) {
        onCriada({ id: r.id, nome: r.dados?.nome ?? nome.trim() });
        setNome("");
        setErro(undefined);
      } else {
        setErro(r.campos?.nome ?? r.erro);
      }
    });
  }

  return (
    <Dialog
      aberto={aberto}
      onFechar={fechar}
      titulo="Nova categoria"
      descricao="Ela já fica selecionada nesta vela."
      tamanho="sm"
      icone={
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-chama-clara text-chama-escura">
          <Tags aria-hidden className="size-5" />
        </span>
      }
    >
      <form onSubmit={salvar} className="pb-5 sm:pb-6">
        <Input
          name="nova_categoria"
          label="Nome da categoria"
          required
          maxLength={60}
          autoFocus
          autoComplete="off"
          placeholder="Ex.: Velas em pote"
          value={nome}
          onChange={(e) => {
            setNome(e.currentTarget.value);
            setErro(undefined);
          }}
          erro={erro}
        />
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variante="secundario" onClick={fechar}>
            Cancelar
          </Button>
          <Button type="submit" carregando={pendente} textoCarregando="Criando…" disabled={!nome.trim()}>
            Criar categoria
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
