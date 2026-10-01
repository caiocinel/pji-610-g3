"use client";

import { useEffect, useTransition } from "react";
import { House, RotateCw, TriangleAlert } from "lucide-react";
import { Button, classesBotao } from "@/components/ui";
import { PaginaAvulsa } from "@/components/shell/pagina-avulsa";
import type { PropsErro } from "@/components/shell/erro";
import "./globals.css";

/** Último recurso: falha no layout raiz. Precisa do próprio <html>/<body> e do CSS global. */
export default function ErroGlobal({ error, retry }: PropsErro) {
  const [tentando, iniciar] = useTransition();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="min-h-full bg-creme font-sans text-tinta antialiased">
        <title>Algo deu errado · Velas Luamme</title>
        <div role="alert">
          <PaginaAvulsa
            icone={<TriangleAlert aria-hidden />}
            titulo="Algo deu errado"
            descricao="O sistema não conseguiu carregar. Tente de novo em alguns segundos. Nada do que você já salvou foi perdido."
            acoes={
              <>
                {/* Link comum (recarrega a página inteira), já que o app pode estar quebrado. */}
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a href="/" className={classesBotao({ variante: "secundario" })}>
                  <House aria-hidden className="size-4" />
                  Ir para o início
                </a>
                <Button onClick={() => iniciar(() => retry())} carregando={tentando} icone={<RotateCw />}>
                  Tentar de novo
                </Button>
              </>
            }
            rodape={error.digest ? `Código do erro: ${error.digest}` : undefined}
          />
        </div>
      </body>
    </html>
  );
}
