import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/components/ui";

export type ItemBarra = {
  chave: string | number;
  rotulo: string;
  /** Valor numérico que define o tamanho da barra. */
  valor: number;
  /** Valor já formatado (ex.: "R$ 1.234,00"). */
  valorTexto: string;
  /** Linha secundária (ex.: "12 vendas · 34%"). */
  detalhe?: string;
  /** Ícone pequeno antes do rótulo, ex.: <QrCode />. */
  icone?: ReactNode;
  href?: string;
};

export type BarrasHorizontaisProps = {
  itens: ItemBarra[];
  /** Nome acessível da lista. */
  rotulo: string;
  /** Mostra só os N primeiros e soma o resto em "Outros". */
  limite?: number;
  /** Formata o valor somado de "Outros" (padrão: só o número). */
  outrosTexto?: (valor: number, quantidade: number) => { valorTexto: string; detalhe?: string };
  className?: string;
};

/**
 * Barras horizontais em HTML puro: rótulo e valor sempre legíveis (nada cortado no celular),
 * texto real para leitores de tela. Uma série só, na cor de destaque dos gráficos.
 */
export function BarrasHorizontais({ itens, rotulo, limite, outrosTexto, className }: BarrasHorizontaisProps) {
  let lista = itens;
  if (limite && itens.length > limite + 1) {
    const resto = itens.slice(limite);
    const valor = resto.reduce((s, i) => s + i.valor, 0);
    const extra = outrosTexto?.(valor, resto.length) ?? { valorTexto: String(valor) };
    lista = [...itens.slice(0, limite), { chave: "__outros", rotulo: `Outros (${resto.length})`, valor, ...extra }];
  }
  const max = Math.max(...lista.map((i) => i.valor), 0);

  return (
    <ul aria-label={rotulo} className={cn("space-y-3.5", className)}>
      {lista.map((item) => {
        const pct = max > 0 ? Math.max((item.valor / max) * 100, item.valor > 0 ? 1.5 : 0) : 0;
        const outros = item.chave === "__outros";
        const corpo = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2 text-tinta">
                {item.icone && (
                  <span aria-hidden className="shrink-0 text-suave [&_svg]:size-4">
                    {item.icone}
                  </span>
                )}
                <span className="truncate font-medium">{item.rotulo}</span>
                {item.href && <ChevronRight aria-hidden className="size-3.5 shrink-0 text-suave" />}
              </span>
              <span className="tabular shrink-0 font-semibold text-tinta">{item.valorTexto}</span>
            </div>
            <div aria-hidden className="mt-1.5 h-2 overflow-hidden rounded-full bg-areia">
              <div
                className={cn("h-full rounded-full", outros ? "bg-linha-forte" : "bg-grafico-1")}
                style={{ width: `${pct}%` }}
              />
            </div>
            {item.detalhe && <p className="tabular mt-1 text-xs text-suave">{item.detalhe}</p>}
          </>
        );
        return (
          <li key={item.chave}>
            {item.href ? (
              <Link
                href={item.href}
                className="-mx-2 block rounded-lg px-2 py-1 transition-colors hover:bg-areia/60 focus-visible:bg-areia/60"
              >
                {corpo}
              </Link>
            ) : (
              corpo
            )}
          </li>
        );
      })}
    </ul>
  );
}
