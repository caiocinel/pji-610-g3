"use client";

import { useEffect, useRef } from "react";
import { CircleCheck, Eye, MessageCircle, Plus, ReceiptText } from "lucide-react";
import { Button, ButtonLink, Card, Kbd, classesBotao } from "@/components/ui";
import { ROTULO_FORMA_PAGAMENTO } from "@/lib/dominio";
import { formatBRL, linkWhatsApp, plural } from "@/lib/format";
import type { VendaConcluida } from "./tipos";

/** Mensagem pronta para mandar o resumo da compra para o cliente pelo WhatsApp. */
function mensagemWhatsApp(v: VendaConcluida, lojaNome: string) {
  const primeiroNome = v.cliente?.nome.split(/\s+/)[0] ?? "";
  const linhas = [
    `Olá${primeiroNome ? `, ${primeiroNome}` : ""}! Obrigada pela compra na ${lojaNome}.`,
    "",
    `Pedido nº ${v.id}`,
    ...v.itens.map((i) => `• ${i.quantidade}x ${i.nome} (${i.aroma}) — ${formatBRL(i.preco * i.quantidade)}`),
  ];
  if (v.desconto > 0) linhas.push(`Desconto: −${formatBRL(v.desconto)}`);
  linhas.push(`Total: ${formatBRL(v.total)} (${ROTULO_FORMA_PAGAMENTO[v.forma]})`);
  return linhas.join("\n");
}

export function VendaSucesso({
  venda,
  lojaNome,
  onNovaVenda,
}: {
  venda: VendaConcluida;
  lojaNome: string;
  onNovaVenda: () => void;
}) {
  const novaRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    novaRef.current?.focus();
    window.scrollTo({ top: 0 });
  }, []);

  const unidades = venda.itens.reduce((s, i) => s + i.quantidade, 0);
  const whatsapp = venda.cliente ? linkWhatsApp(venda.cliente.telefone, mensagemWhatsApp(venda, lojaNome)) : null;

  return (
    <div className="mx-auto max-w-lg">
      <Card as="section" padding="lg" className="animate-entrada text-center" aria-labelledby="pdv-sucesso-titulo">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-salvia-clara text-salvia">
          <CircleCheck aria-hidden className="size-9" />
        </span>
        <h2 id="pdv-sucesso-titulo" className="mt-4 font-serif text-2xl font-semibold text-tinta">
          Venda #{venda.id} registrada
        </h2>
        <p className="mt-1 text-sm text-suave">
          {plural(unidades, "vela")} · {ROTULO_FORMA_PAGAMENTO[venda.forma]}
          {venda.cliente ? ` · ${venda.cliente.nome}` : ""}
        </p>

        <p className="tabular mt-5 font-serif text-4xl font-semibold text-tinta">{formatBRL(venda.total)}</p>
        {venda.desconto > 0 && (
          <p className="tabular mt-1 text-sm text-suave">
            {formatBRL(venda.subtotal)} com {formatBRL(venda.desconto)} de desconto
          </p>
        )}

        {venda.troco != null && venda.troco > 0 && (
          <div className="mt-5 rounded-xl bg-salvia-clara px-4 py-3 text-salvia">
            <p className="text-sm font-medium">Troco a devolver</p>
            <p className="tabular font-serif text-3xl font-semibold">{formatBRL(venda.troco)}</p>
          </div>
        )}

        <ul className="mt-5 divide-y divide-linha rounded-xl border border-linha text-left text-sm">
          {venda.itens.map((i, n) => (
            <li key={n} className="flex items-baseline justify-between gap-3 px-3 py-2">
              <span className="min-w-0">
                <span className="tabular text-suave">{i.quantidade}×</span> {i.nome}{" "}
                <span className="text-suave">· {i.aroma}</span>
              </span>
              <span className="tabular shrink-0 font-medium">{formatBRL(i.preco * i.quantidade)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <Button ref={novaRef} tamanho="lg" icone={<Plus />} onClick={onNovaVenda} className="sm:col-span-2">
            Nova venda
          </Button>
          <ButtonLink href={`/recibo/${venda.id}`} variante="secundario" icone={<ReceiptText />} prefetch={false}>
            Ver recibo
          </ButtonLink>
          <ButtonLink href={`/vendas/${venda.id}`} variante="secundario" icone={<Eye />} prefetch={false}>
            Detalhes da venda
          </ButtonLink>
          {whatsapp && (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className={classesBotao({ variante: "fantasma" }) + " sm:col-span-2"}
            >
              <MessageCircle aria-hidden />
              Enviar resumo no WhatsApp
            </a>
          )}
        </div>
        <p className="mt-4 hidden text-xs text-suave lg:block">
          <Kbd>Enter</Kbd> começa uma nova venda
        </p>
      </Card>
    </div>
  );
}
