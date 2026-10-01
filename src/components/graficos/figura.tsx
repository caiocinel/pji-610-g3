import type { ReactNode } from "react";
import { Table, TableScroll, TBody, TD, TH, THead, TR, cn } from "@/components/ui";

export type TabelaFigura = {
  cabecalhos: string[];
  /** Células já formatadas (texto). A 1ª coluna é o rótulo; as demais ficam à direita. */
  linhas: string[][];
};

export type FiguraProps = {
  /** Nome acessível do gráfico, ex.: "Faturamento por dia". */
  rotulo: string;
  /** Resumo em texto (sempre visível): o que o gráfico mostra, em uma frase. */
  resumo?: ReactNode;
  /** Mesmos dados em tabela, para leitores de tela e para quem prefere números. */
  tabela?: TabelaFigura;
  children: ReactNode;
  className?: string;
};

/**
 * Envelope acessível dos gráficos: <figure> com nome, resumo textual e os dados em tabela
 * (dentro de um <details> "Ver em tabela"). Funciona em Server Components.
 */
export function Figura({ rotulo, resumo, tabela, children, className }: FiguraProps) {
  return (
    <figure aria-label={rotulo} className={cn("min-w-0", className)}>
      {children}
      {(resumo || tabela) && (
        <figcaption className="mt-3 space-y-2">
          {resumo && <p className="text-sm text-suave">{resumo}</p>}
          {tabela && tabela.linhas.length > 0 && (
            <details className="group rounded-lg print:hidden">
              <summary className="link inline-flex min-h-10 cursor-pointer items-center text-sm select-none sm:min-h-0">
                <span className="group-open:hidden">Ver em tabela</span>
                <span className="hidden group-open:inline">Esconder tabela</span>
              </summary>
              <div className="rolagem-fina mt-2 max-h-80 overflow-y-auto rounded-lg border border-linha">
                <TableScroll>
                  <Table aria-label={rotulo}>
                    <THead>
                      <tr>
                        {tabela.cabecalhos.map((c, i) => (
                          <TH key={c} alinhar={i === 0 ? "esquerda" : "direita"}>
                            {c}
                          </TH>
                        ))}
                      </tr>
                    </THead>
                    <TBody>
                      {tabela.linhas.map((linha, i) => (
                        <TR key={i}>
                          {linha.map((celula, j) => (
                            <TD key={j} alinhar={j === 0 ? "esquerda" : "direita"} className="py-2">
                              {celula}
                            </TD>
                          ))}
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </TableScroll>
              </div>
            </details>
          )}
        </figcaption>
      )}
    </figure>
  );
}
