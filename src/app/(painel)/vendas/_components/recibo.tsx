import { Ban, Flame } from "lucide-react";
import { cn } from "@/components/ui";
import { ROTULO_FORMA_PAGAMENTO, type Configuracoes } from "@/lib/dominio";
import type { VendaDetalhe } from "@/lib/consultas/vendas";
import { formatBRL, formatDateTime, formatTelefone } from "@/lib/format";
import { numeroRecibo } from "./recibo-texto";

function Divisoria() {
  return <hr aria-hidden className="my-4 border-0 border-t border-dashed border-linha-forte" />;
}

function Linha({ rotulo, valor, forte }: { rotulo: string; valor: string; forte?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4", forte ? "text-base font-semibold" : "text-sm")}>
      <dt className={forte ? "text-tinta" : "text-suave"}>{rotulo}</dt>
      <dd className="tabular text-right text-tinta">{valor}</dd>
    </div>
  );
}

/** Recibo da venda em formato de cupom: bom para imprimir e para print de tela no WhatsApp. */
export function Recibo({ venda: v, loja }: { venda: VendaDetalhe; loja: Configuracoes }) {
  const cancelada = v.status === "cancelada";
  const contato = [
    loja.loja_telefone ? formatTelefone(loja.loja_telefone) : "",
    loja.loja_instagram ? `@${loja.loja_instagram}` : "",
  ].filter(Boolean);

  return (
    <article
      aria-label={`Recibo da venda nº ${numeroRecibo(v.id)}`}
      className="cartao relative mx-auto w-full max-w-sm overflow-hidden px-5 py-6 sm:px-7 sm:py-8 print:max-w-[80mm] print:border-0 print:px-0 print:py-0"
    >
      <header className="text-center">
        <span className="mx-auto mb-2 flex size-11 items-center justify-center rounded-full bg-chama-clara text-chama-escura print:bg-transparent">
          <Flame aria-hidden className="size-6" />
        </span>
        <h1 className="font-serif text-2xl leading-tight font-semibold text-tinta">{loja.loja_nome}</h1>
        {loja.loja_endereco && <p className="mt-1 text-xs text-suave">{loja.loja_endereco}</p>}
        {contato.length > 0 && <p className="mt-0.5 text-xs text-suave">{contato.join(" · ")}</p>}
      </header>

      <Divisoria />

      <div className="text-center">
        <p className="text-xs font-semibold tracking-[0.2em] text-suave uppercase">Recibo de venda</p>
        <p className="tabular mt-1 font-serif text-xl font-semibold text-tinta">Nº {numeroRecibo(v.id)}</p>
        <p className="mt-0.5 text-sm text-suave">{formatDateTime(v.data)}</p>
        {v.cliente && (
          <p className="mt-2 text-sm text-tinta">
            <span className="text-suave">Cliente: </span>
            {v.cliente.nome}
          </p>
        )}
      </div>

      {cancelada && (
        <div
          role="status"
          className="mt-4 flex items-start gap-2 rounded-lg border border-alerta bg-alerta-clara px-3 py-2 text-sm text-alerta print:bg-transparent"
        >
          <Ban aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p>
            <strong className="font-semibold tracking-wide uppercase">Venda cancelada</strong>
            {v.cancelada_em && <> em {formatDateTime(v.cancelada_em)}</>}. Este recibo não tem validade.
          </p>
        </div>
      )}

      <Divisoria />

      <ul className="space-y-3" aria-label="Itens">
        {v.itens.map((i) => (
          <li key={i.id} className="flex items-start justify-between gap-4 text-sm">
            <div className="min-w-0">
              <p className="font-medium break-words text-tinta">{i.produto_nome}</p>
              {i.aroma && <p className="text-xs break-words text-suave">{i.aroma}</p>}
              <p className="tabular text-xs text-suave">
                {i.quantidade} × {formatBRL(i.preco_unitario)}
              </p>
            </div>
            <p className="tabular shrink-0 text-right text-tinta">{formatBRL(i.subtotal)}</p>
          </li>
        ))}
      </ul>

      <Divisoria />

      <dl className="space-y-1.5">
        {v.desconto > 0 && (
          <>
            <Linha rotulo="Subtotal" valor={formatBRL(v.subtotal)} />
            <Linha rotulo="Desconto" valor={`− ${formatBRL(v.desconto)}`} />
          </>
        )}
        <div className={cn("flex items-baseline justify-between gap-4 pt-1", cancelada && "line-through decoration-2")}>
          <dt className="font-serif text-lg font-semibold text-tinta">Total</dt>
          <dd className="tabular font-serif text-2xl font-semibold text-tinta">{formatBRL(v.total)}</dd>
        </div>
        <Linha rotulo="Pagamento" valor={ROTULO_FORMA_PAGAMENTO[v.forma_pagamento] ?? v.forma_pagamento} />
        {v.forma_pagamento === "dinheiro" && v.valor_recebido != null && (
          <>
            <Linha rotulo="Valor recebido" valor={formatBRL(v.valor_recebido)} />
            {v.troco != null && <Linha rotulo="Troco" valor={formatBRL(v.troco)} />}
          </>
        )}
      </dl>

      {v.observacao && (
        <p className="mt-4 rounded-lg bg-areia/60 px-3 py-2 text-xs break-words text-tinta print:bg-transparent print:px-0">
          <span className="text-suave">Obs.: </span>
          {v.observacao}
        </p>
      )}

      <Divisoria />

      <footer className="text-center">
        {loja.recibo_rodape && <p className="font-serif text-base break-words whitespace-pre-line text-tinta italic">{loja.recibo_rodape}</p>}
        <p className="mt-2 text-[0.6875rem] text-suave">Documento sem valor fiscal.</p>
      </footer>
    </article>
  );
}
