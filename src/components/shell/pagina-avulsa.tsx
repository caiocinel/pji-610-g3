import type { ReactNode } from "react";
import { Logo } from "@/components/logo";

/**
 * Página centralizada fora do painel (404 geral, erro geral): marca no topo e um cartão.
 * Server-safe: pode ser usada em Server e Client Components.
 */
export function PaginaAvulsa({
  icone,
  titulo,
  descricao,
  acoes,
  rodape,
}: {
  icone: ReactNode;
  titulo: ReactNode;
  descricao?: ReactNode;
  acoes?: ReactNode;
  rodape?: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="mb-6 flex items-center gap-2 text-chama">
        <Logo className="size-8" />
        <span className="font-serif text-xl font-semibold text-tinta">Velas Luamme</span>
      </div>
      <div className="cartao animate-entrada w-full max-w-md p-6 text-center sm:p-8">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-chama-clara text-chama-escura [&_svg]:size-7">
          {icone}
        </span>
        <h1 className="mt-4 font-serif text-2xl font-semibold text-tinta">{titulo}</h1>
        {descricao && <div className="mt-2 text-sm text-suave">{descricao}</div>}
        {acoes && <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">{acoes}</div>}
        {rodape && <div className="mt-5 text-xs text-suave">{rodape}</div>}
      </div>
    </main>
  );
}
