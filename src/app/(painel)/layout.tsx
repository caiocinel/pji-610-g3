import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { PaletaProvider } from "@/components/command-palette";
import { COOKIE_SIDEBAR } from "@/components/shell/navegacao";
import { BarraInferior, TopoMovel } from "@/components/shell/navegacao-movel";
import { Sidebar } from "@/components/shell/sidebar";
import { requireAuth } from "@/lib/auth";
import { contarAlertasEstoque } from "@/lib/consultas/busca";
import { CONFIGURACOES_PADRAO } from "@/lib/dominio";
import { getConfiguracoes } from "@/lib/dominio/configuracoes";

// Todas as telas do painel leem dados ao vivo do banco.
export const dynamic = "force-dynamic";

/** Nome da loja e alertas de estoque para o menu. Se o banco falhar, o menu continua funcionando. */
async function dadosDoMenu() {
  const [config, alertas] = await Promise.allSettled([getConfiguracoes(), contarAlertasEstoque()]);
  return {
    lojaNome: config.status === "fulfilled" ? config.value.loja_nome : CONFIGURACOES_PADRAO.loja_nome,
    alertasEstoque: alertas.status === "fulfilled" ? alertas.value : 0,
  };
}

/*
 * Estrutura: sidebar (md+) | barra superior + conteúdo + barra inferior fixa (celular).
 * A variável CSS --nav-inferior tem a altura da barra inferior no celular (0 no desktop):
 * use-a para fixar barras próprias acima dela, ex.: `bottom-[var(--nav-inferior)]`.
 */
export default async function PainelLayout({ children }: { children: ReactNode }) {
  await requireAuth();
  const [{ lojaNome, alertasEstoque }, jar] = await Promise.all([dadosDoMenu(), cookies()]);
  const compacta = jar.get(COOKIE_SIDEBAR)?.value === "compacta";

  return (
    <PaletaProvider>
      <div className="min-h-dvh [--nav-inferior:calc(4rem+env(safe-area-inset-bottom))] md:flex md:[--nav-inferior:0px] print:block print:[--nav-inferior:0px]">
        <a
          href="#conteudo"
          className="sr-only z-50 rounded-lg bg-chama px-4 py-2 font-medium text-sobre focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Pular para o conteúdo
        </a>
        <Sidebar lojaNome={lojaNome} alertasEstoque={alertasEstoque} compactaInicial={compacta} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopoMovel lojaNome={lojaNome} />
          <main
            id="conteudo"
            tabIndex={-1}
            className="mx-auto w-full max-w-7xl min-w-0 flex-1 px-4 pt-5 pb-[calc(var(--nav-inferior)+2rem)] outline-none sm:px-6 md:px-8 md:pt-8 md:pb-12 print:max-w-none print:p-0"
          >
            {children}
          </main>
        </div>
        <BarraInferior alertasEstoque={alertasEstoque} lojaNome={lojaNome} />
      </div>
    </PaletaProvider>
  );
}
