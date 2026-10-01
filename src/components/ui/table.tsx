import Link from "next/link";
import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "./cn";

/* ---------- Primitivas (tabela "rolável dentro do cartão") ---------- */

/**
 * Contêiner que rola horizontalmente DENTRO do cartão (a página nunca rola de lado).
 * Use dentro de <Card padding="none">.
 */
export function TableScroll({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rolagem-fina w-full overflow-x-auto", className)}>{children}</div>;
}

export function Table({ className, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full border-collapse text-left text-sm", className)} {...rest} />;
}

export function THead({ className, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn("border-b border-linha bg-areia/60 text-xs font-semibold tracking-wide text-suave uppercase", className)}
      {...rest}
    />
  );
}

export function TBody({ className, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-linha", className)} {...rest} />;
}

export function TFoot({ className, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tfoot className={cn("border-t-2 border-linha bg-areia/40 font-semibold", className)} {...rest} />;
}

export function TR({ className, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("transition-colors hover:bg-areia/40", className)} {...rest} />;
}

type Alinhamento = "esquerda" | "direita" | "centro";
const ALINHAR: Record<Alinhamento, string> = { esquerda: "text-left", direita: "text-right", centro: "text-center" };

export function TH({
  className,
  alinhar = "esquerda",
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement> & { alinhar?: Alinhamento }) {
  return (
    <th
      scope="col"
      className={cn("px-4 py-3 whitespace-nowrap first:pl-5 last:pr-5", ALINHAR[alinhar], className)}
      {...rest}
    />
  );
}

export function TD({
  className,
  alinhar = "esquerda",
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement> & { alinhar?: Alinhamento }) {
  return (
    <td
      className={cn(
        "px-4 py-3 align-middle first:pl-5 last:pr-5",
        alinhar === "direita" && "tabular whitespace-nowrap",
        ALINHAR[alinhar],
        className,
      )}
      {...rest}
    />
  );
}

/* ---------- DataTable: tabela no desktop, cartões no celular ---------- */

export type PapelMobile = "titulo" | "subtitulo" | "valor" | "badge" | "detalhe" | "acoes" | "oculto";

export type Coluna<T> = {
  /** Identificador único da coluna. */
  id: string;
  cabecalho: ReactNode;
  /** Conteúdo da célula. Pode retornar JSX (Badge, Link, valor formatado…). */
  celula: (linha: T) => ReactNode;
  alinhar?: Alinhamento;
  /** Classe extra no <th>/<td> (ex.: "w-32", "hidden lg:table-cell"). */
  classe?: string;
  /**
   * Como a coluna aparece no cartão do celular:
   * titulo (destaque, 1ª linha à esquerda) · valor (1ª linha à direita) · subtitulo (2ª linha) ·
   * badge (2ª linha à direita) · detalhe (pares rótulo/valor) · acoes (rodapé) · oculto.
   * Padrão: "detalhe".
   */
  mobile?: PapelMobile;
  /** Rótulo no cartão do celular (padrão: o cabeçalho, se for texto). */
  rotuloMobile?: string;
};

export type DataTableProps<T> = {
  colunas: Coluna<T>[];
  linhas: T[];
  /** Chave única de cada linha (ex.: (p) => p.id). */
  chave: (linha: T) => string | number;
  /** Torna a linha navegável: o título vira link no desktop e o cartão inteiro vira link no celular. */
  hrefLinha?: (linha: T) => string;
  /** Mostrado quando `linhas` está vazio (ex.: <EmptyState …/>). */
  vazio?: ReactNode;
  /** Linha de totais no rodapé da tabela (desktop) – passe as células por coluna. */
  rodape?: Partial<Record<string, ReactNode>>;
  /**
   * "cartoes" (padrão): lista de cartões abaixo de md, tabela a partir de md.
   * "rolar": sempre tabela; no celular rola horizontalmente dentro do cartão.
   */
  modoMobile?: "cartoes" | "rolar";
  /** Rótulo acessível da tabela (ex.: "Lista de produtos"). */
  rotulo?: string;
  /** Classe da linha (ex.: destacar canceladas). */
  classeLinha?: (linha: T) => string | undefined;
  className?: string;
};

function textoCabecalho<T>(c: Coluna<T>): string | undefined {
  return c.rotuloMobile ?? (typeof c.cabecalho === "string" ? c.cabecalho : undefined);
}

/**
 * Tabela de dados responsiva. Funciona em Server Components (as funções `celula` rodam no servidor).
 * Coloque dentro de <Card padding="none">.
 */
export function DataTable<T>({
  colunas,
  linhas,
  chave,
  hrefLinha,
  vazio,
  rodape,
  modoMobile = "cartoes",
  rotulo,
  classeLinha,
  className,
}: DataTableProps<T>) {
  if (linhas.length === 0) return <>{vazio ?? null}</>;
  const papel = (c: Coluna<T>): PapelMobile => c.mobile ?? "detalhe";
  const colunaTitulo = colunas.find((c) => papel(c) === "titulo") ?? colunas[0];

  const tabela = (
    <TableScroll>
      <Table aria-label={rotulo}>
        <THead>
          <tr>
            {colunas.map((c) => (
              <TH key={c.id} alinhar={c.alinhar} className={c.classe}>
                {c.cabecalho}
              </TH>
            ))}
          </tr>
        </THead>
        <TBody>
          {linhas.map((l) => (
            <TR key={chave(l)} className={classeLinha?.(l)}>
              {colunas.map((c) => (
                <TD key={c.id} alinhar={c.alinhar} className={c.classe}>
                  {hrefLinha && c.id === colunaTitulo.id ? (
                    <Link href={hrefLinha(l)} className="font-medium text-tinta hover:text-chama-escura hover:underline">
                      {c.celula(l)}
                    </Link>
                  ) : (
                    c.celula(l)
                  )}
                </TD>
              ))}
            </TR>
          ))}
        </TBody>
        {rodape && (
          <TFoot>
            <tr>
              {colunas.map((c) => (
                <TD key={c.id} alinhar={c.alinhar} className={c.classe}>
                  {rodape[c.id]}
                </TD>
              ))}
            </tr>
          </TFoot>
        )}
      </Table>
    </TableScroll>
  );

  if (modoMobile === "rolar") return <div className={className}>{tabela}</div>;

  const por = (p: PapelMobile) => colunas.filter((c) => papel(c) === p);
  const titulo = por("titulo")[0] ?? colunas[0];
  const valores = por("valor");
  const subtitulos = por("subtitulo");
  const badges = por("badge");
  const detalhes = por("detalhe").filter((c) => c.id !== titulo.id);
  const acoes = por("acoes");

  return (
    <div className={className}>
      <div className="hidden md:block">{tabela}</div>
      <ul className="divide-y divide-linha md:hidden" aria-label={rotulo}>
        {linhas.map((l) => {
          const corpo = (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 font-medium text-tinta">{titulo.celula(l)}</div>
                {valores.length > 0 && (
                  <div className="tabular shrink-0 text-right font-semibold text-tinta">
                    {valores.map((c) => (
                      <div key={c.id}>{c.celula(l)}</div>
                    ))}
                  </div>
                )}
              </div>
              {(subtitulos.length > 0 || badges.length > 0) && (
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-sm text-suave">
                  <div className="min-w-0">
                    {subtitulos.map((c) => (
                      <div key={c.id} className="truncate">
                        {c.celula(l)}
                      </div>
                    ))}
                  </div>
                  {badges.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {badges.map((c) => (
                        <span key={c.id}>{c.celula(l)}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {detalhes.length > 0 && (
                <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  {detalhes.map((c) => (
                    <div key={c.id} className="min-w-0">
                      <dt className="text-xs text-suave">{textoCabecalho(c)}</dt>
                      <dd className="truncate text-tinta">{c.celula(l)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </>
          );
          return (
            <li key={chave(l)} className={classeLinha?.(l)}>
              {hrefLinha ? (
                <Link
                  href={hrefLinha(l)}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-areia/50 active:bg-areia"
                >
                  <div className="min-w-0 flex-1">{corpo}</div>
                  <ChevronRight aria-hidden className="size-4 shrink-0 text-suave" />
                </Link>
              ) : (
                <div className="px-4 py-3.5">{corpo}</div>
              )}
              {acoes.length > 0 && (
                <div className="flex flex-wrap justify-end gap-2 px-4 pb-3">
                  {acoes.map((c) => (
                    <span key={c.id}>{c.celula(l)}</span>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
