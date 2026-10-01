"use client";

import { useState, type ReactNode } from "react";
import {
  Banknote,
  CircleAlert,
  Coins,
  CreditCard,
  MessageSquareText,
  Percent,
  QrCode,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { Button, EmptyState, MoneyInput, NumberStepper, SegmentedControl, Select, Textarea, cn, toast } from "@/components/ui";
import {
  CANAIS,
  ROTULO_CANAL,
  opcoes,
  subtotalLinha,
  type FormaPagamento,
  type TipoDesconto,
} from "@/lib/dominio";
import { formatBRL, formatInt } from "@/lib/format";
import { SeletorCliente } from "./seletor-cliente";
import { sugestoesRecebido, type ClientePDV, type EstadoVenda, type ProdutoPDV } from "./tipos";

export const FORMAS_PDV: { valor: FormaPagamento; rotulo: string; icone: ReactNode }[] = [
  { valor: "pix", rotulo: "Pix", icone: <QrCode aria-hidden /> },
  { valor: "dinheiro", rotulo: "Dinheiro", icone: <Banknote aria-hidden /> },
  { valor: "cartao_credito", rotulo: "Crédito", icone: <CreditCard aria-hidden /> },
  { valor: "cartao_debito", rotulo: "Débito", icone: <CreditCard aria-hidden /> },
  { valor: "outro", rotulo: "Outro", icone: <Coins aria-hidden /> },
];

export type CalculoVenda = {
  subtotal: number;
  desconto: number;
  total: number;
  troco: number | null;
  unidades: number;
  erroDesconto: string | null;
  erroRecebido: string | null;
  /** produto_id → problema da linha (sem estoque, indisponível). */
  problemas: Map<number, string>;
};

export type PainelVendaProps = {
  venda: EstadoVenda;
  calculo: CalculoVenda;
  produtos: Map<number, ProdutoPDV>;
  clientes: ClientePDV[];
  atualizar: (parcial: Partial<EstadoVenda>) => void;
  alterarQuantidade: (produtoId: number, quantidade: number) => void;
  remover: (produtoId: number) => void;
  limpar: () => void;
};

/** Carrinho + dados da venda (cliente, pagamento, canal, desconto, troco, observação). */
export function PainelVenda(props: PainelVendaProps) {
  const { venda, calculo, atualizar } = props;
  return (
    <div className="@container space-y-5">
      <ListaCarrinho {...props} />

      {venda.carrinho.length > 0 && (
        <>
          <Bloco titulo="Cliente" opcional idRotulo={venda.cliente ? undefined : "pdv-cliente"}>
            <SeletorCliente
              clientes={props.clientes}
              cliente={venda.cliente}
              onSelecionar={(cliente) => atualizar({ cliente })}
            />
          </Bloco>

          <fieldset>
            <legend className="rotulo">Forma de pagamento</legend>
            <div className="grid grid-cols-5 gap-1.5">
              {FORMAS_PDV.map((f) => {
                const ativo = venda.forma === f.valor;
                return (
                  <label
                    key={f.valor}
                    className={cn(
                      "relative flex h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border text-center text-xs font-medium transition select-none [&_svg]:size-5",
                      "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-chama",
                      ativo
                        ? "border-chama bg-chama-clara text-chama-escura"
                        : "border-linha-forte bg-papel text-suave hover:bg-areia hover:text-tinta",
                    )}
                  >
                    <input
                      type="radio"
                      name="pdv-forma"
                      value={f.valor}
                      checked={ativo}
                      onChange={() => atualizar({ forma: f.valor })}
                      className="sr-only"
                    />
                    {f.icone}
                    <span className="leading-none">{f.rotulo}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {venda.forma === "dinheiro" && <Recebimento {...props} />}

          {/* Só divide a linha com folga: senão o campo de desconto fica estreito e corta o valor. */}
          <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
            <Select
              id="pdv-canal"
              label="Canal"
              value={venda.canal}
              onChange={(e) => atualizar({ canal: e.currentTarget.value as EstadoVenda["canal"] })}
              opcoes={opcoes(CANAIS, ROTULO_CANAL)}
            />
            <Desconto {...props} />
          </div>
          {calculo.erroDesconto && (
            <p role="alert" className="-mt-3 flex items-start gap-1 text-xs font-medium text-alerta">
              <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
              {calculo.erroDesconto}
            </p>
          )}

          <Observacao valor={venda.observacao} onChange={(observacao) => atualizar({ observacao })} />
        </>
      )}
    </div>
  );
}

function Bloco({
  titulo,
  opcional,
  idRotulo,
  children,
}: {
  titulo: string;
  opcional?: boolean;
  idRotulo?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={idRotulo} className="rotulo">
        {titulo}
        {opcional && <span className="ml-1 font-normal text-suave">(opcional)</span>}
      </label>
      {children}
    </div>
  );
}

function ListaCarrinho({ venda, produtos, calculo, alterarQuantidade, remover, limpar }: PainelVendaProps) {
  if (venda.carrinho.length === 0) {
    return (
      <EmptyState
        compacto
        icone={<ShoppingCart aria-hidden />}
        titulo="Carrinho vazio"
        descricao="Toque nas velas para adicionar. Dica: busque pelo aroma."
      />
    );
  }
  return (
    <section aria-labelledby="pdv-titulo-itens">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 id="pdv-titulo-itens" className="text-sm font-medium text-tinta">
          Itens <span className="tabular font-normal text-suave">({formatInt(calculo.unidades)} un.)</span>
        </h3>
        <Button variante="fantasma" tamanho="sm" icone={<Trash2 />} onClick={limpar} className="-mr-2">
          Limpar
        </Button>
      </div>
      <ul className="divide-y divide-linha rounded-xl border border-linha">
        {venda.carrinho.map((l) => {
          const p = produtos.get(l.produto_id);
          const problema = calculo.problemas.get(l.produto_id);
          return (
            <li key={l.produto_id} className={cn("animate-entrada p-3", problema && "bg-alerta-clara/50")}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug font-medium text-tinta">{p?.nome ?? "Produto indisponível"}</p>
                  {p && (
                    <p className="truncate text-xs text-suave">
                      {p.aroma} · <span className="tabular">{formatBRL(p.preco)}</span> cada
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => remover(l.produto_id)}
                  aria-label={`Remover ${p ? `${p.nome} ${p.aroma}` : "item"} do carrinho`}
                  title="Remover"
                  className="-mt-1 -mr-1 flex size-10 shrink-0 items-center justify-center rounded-lg text-suave transition hover:bg-alerta-clara hover:text-alerta sm:size-8"
                >
                  <Trash2 aria-hidden className="size-4" />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                {p ? (
                  <NumberStepper
                    id={`pdv-qtd-${l.produto_id}`}
                    tamanho="sm"
                    min={1}
                    max={Math.max(p.estoque, 1)}
                    value={l.quantidade}
                    onValueChange={(q) => alterarQuantidade(l.produto_id, q)}
                    onAcimaDoMaximo={() =>
                      toast.warning(
                        `Só há ${formatInt(p.estoque)} ${p.estoque === 1 ? "unidade" : "unidades"} de ${p.nome} ${p.aroma} em estoque.`,
                        { id: `pdv-estoque-${l.produto_id}` },
                      )
                    }
                    rotuloAcessivel={`Quantidade de ${p.nome} ${p.aroma}`}
                  />
                ) : (
                  <span className="text-xs text-suave">{l.quantidade} un.</span>
                )}
                <span className="tabular text-sm font-semibold text-tinta">
                  {p ? formatBRL(subtotalLinha({ preco_unitario: p.preco, quantidade: l.quantidade })) : "—"}
                </span>
              </div>
              {problema && (
                <p className="mt-2 flex items-start gap-1 text-xs font-medium text-alerta">
                  <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
                  {problema}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Desconto({ venda, calculo, atualizar }: PainelVendaProps) {
  const tipo = venda.descontoTipo;
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={tipo === "valor" ? "pdv-desconto-reais" : "pdv-desconto-pct"} className="rotulo">
          Desconto <span className="font-normal text-suave">(opcional)</span>
        </label>
      </div>
      <div className="flex gap-1.5">
        <SegmentedControl<TipoDesconto>
          rotulo="Tipo de desconto"
          tamanho="sm"
          valor={tipo}
          onChange={(t) => atualizar({ descontoTipo: t })}
          className="shrink-0 py-0.5"
          opcoes={[
            { valor: "valor", rotulo: "R$" },
            { valor: "percentual", rotulo: "%" },
          ]}
        />
        {tipo === "valor" ? (
          <MoneyInput
            id="pdv-desconto-reais"
            value={venda.descontoReais}
            onValueChange={(v) => atualizar({ descontoReais: v })}
            max={calculo.subtotal}
            aria-invalid={calculo.erroDesconto ? true : undefined}
            wrapperClassName="min-w-[7.5rem] flex-1"
          />
        ) : (
          <div className="relative min-w-0 flex-1">
            <input
              id="pdv-desconto-pct"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              maxLength={6}
              value={venda.descontoPercentual}
              onChange={(e) => atualizar({ descontoPercentual: e.currentTarget.value.replace(/[^\d.,]/g, "") })}
              aria-invalid={calculo.erroDesconto ? true : undefined}
              aria-describedby="pdv-desconto-pct-valor"
              className="campo tabular pr-8 text-right"
            />
            <Percent aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-suave" />
          </div>
        )}
      </div>
      {tipo === "percentual" && calculo.desconto > 0 && (
        <p id="pdv-desconto-pct-valor" className="dica tabular">
          = {formatBRL(calculo.desconto)} de desconto
        </p>
      )}
    </div>
  );
}

function Recebimento({ venda, calculo, atualizar }: PainelVendaProps) {
  const sugestoes = sugestoesRecebido(calculo.total);
  return (
    <div className="rounded-xl border border-linha bg-areia/50 p-3">
      <MoneyInput
        id="pdv-recebido"
        label="Valor recebido"
        opcional
        value={venda.valorRecebido}
        onValueChange={(v) => atualizar({ valorRecebido: v })}
        hint={calculo.erroRecebido ? undefined : "Informe para calcular o troco."}
        erro={calculo.erroRecebido ?? undefined}
      />
      {sugestoes.length > 0 && (
        <div role="group" aria-label="Valores sugeridos" className="mt-2 flex flex-wrap gap-1.5">
          {sugestoes.map((v, i) => {
            const ativo = venda.valorRecebido === v;
            return (
              <button
                key={v}
                type="button"
                aria-pressed={ativo}
                onClick={() => atualizar({ valorRecebido: v })}
                className={cn(
                  "tabular h-10 rounded-full border px-3 text-sm font-medium transition sm:h-8",
                  ativo
                    ? "border-chama bg-chama-clara text-chama-escura"
                    : "border-linha-forte bg-papel text-tinta hover:bg-areia",
                )}
              >
                {i === 0 ? `Exato ${formatBRL(v)}` : formatBRL(v)}
              </button>
            );
          })}
        </div>
      )}
      {calculo.troco != null && calculo.troco > 0 && (
        <p className="mt-3 flex items-baseline justify-between rounded-lg bg-salvia-clara px-3 py-2 text-salvia" aria-live="polite">
          <span className="text-sm font-medium">Troco</span>
          <span className="tabular font-serif text-xl font-semibold">{formatBRL(calculo.troco)}</span>
        </p>
      )}
    </div>
  );
}

function Observacao({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  const [aberta, setAberta] = useState(valor !== "");
  if (!aberta && !valor) {
    return (
      <button
        type="button"
        onClick={() => {
          setAberta(true);
          requestAnimationFrame(() => document.getElementById("pdv-observacao")?.focus());
        }}
        className="link inline-flex min-h-10 items-center gap-1.5 text-sm"
      >
        <MessageSquareText aria-hidden className="size-4" />
        Adicionar observação
      </button>
    );
  }
  return (
    <Textarea
      id="pdv-observacao"
      label="Observação"
      opcional
      rows={2}
      maxLength={300}
      value={valor}
      onChange={(e) => onChange(e.currentTarget.value)}
      placeholder="Ex.: embrulhar para presente, entregar sábado…"
      hint={`${valor.length}/300`}
    />
  );
}

/** Subtotal, desconto, total e troco. */
export function ResumoValores({ calculo, compacto }: { calculo: CalculoVenda; compacto?: boolean }) {
  return (
    <dl className={cn("space-y-1.5 text-sm", compacto && "space-y-1")}>
      {calculo.desconto > 0 && (
        <>
          <div className="flex justify-between gap-4 text-suave">
            <dt>Subtotal</dt>
            <dd className="tabular">{formatBRL(calculo.subtotal)}</dd>
          </div>
          <div className="flex justify-between gap-4 text-salvia">
            <dt>Desconto</dt>
            <dd className="tabular">− {formatBRL(calculo.desconto)}</dd>
          </div>
        </>
      )}
      <div className="flex items-baseline justify-between gap-4">
        <dt className="font-medium text-tinta">Total</dt>
        <dd className={cn("tabular font-serif font-semibold text-tinta", compacto ? "text-2xl" : "text-3xl")}>
          {formatBRL(calculo.total)}
        </dd>
      </div>
    </dl>
  );
}
