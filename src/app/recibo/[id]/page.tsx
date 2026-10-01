import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { requireAuth } from "@/lib/auth";
import { obterVenda } from "@/lib/consultas/vendas";
import { getConfiguracoes } from "@/lib/dominio/configuracoes";
import { AcoesRecibo } from "@/app/(painel)/vendas/_components/acoes-recibo";
import { Recibo } from "@/app/(painel)/vendas/_components/recibo";
import { numeroRecibo, textoRecibo } from "@/app/(painel)/vendas/_components/recibo-texto";

// Recibo fora do layout do painel: sem menu, ótimo para imprimir ou tirar print no celular.
// /vendas/[id]/recibo redireciona para cá.

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/recibo/[id]">): Promise<Metadata> {
  const { id } = await params;
  const n = Number(id);
  return { title: Number.isInteger(n) && n > 0 ? `Recibo nº ${numeroRecibo(n)}` : "Recibo" };
}

export default async function ReciboPage({ params, searchParams }: PageProps<"/recibo/[id]">) {
  await requireAuth();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const venda = await obterVenda(Number(id));
  if (!venda) notFound();
  const loja = await getConfiguracoes();

  return (
    <div className="min-h-dvh bg-creme px-4 pt-4 pb-[max(2rem,env(safe-area-inset-bottom))] sm:pt-8 print:p-0">
      <nav
        aria-label="Navegação do recibo"
        className="mx-auto mb-4 flex max-w-sm items-center justify-between gap-2 print:hidden"
        data-nao-imprimir
      >
        <Link
          href={`/vendas/${venda.id}`}
          className="-ml-1 inline-flex h-10 items-center gap-1 rounded-lg px-1 text-sm text-suave hover:text-tinta"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Venda #{venda.id}
        </Link>
        <ButtonLink href="/vendas/nova" variante="fantasma" tamanho="sm" icone={<ShoppingBag />}>
          Nova venda
        </ButtonLink>
      </nav>

      <main>
        <Recibo venda={venda} loja={loja} />
      </main>

      <div className="mx-auto mt-5 max-w-sm print:hidden">
        <AcoesRecibo
          texto={textoRecibo(venda, loja)}
          titulo={`Recibo nº ${numeroRecibo(venda.id)} · ${loja.loja_nome}`}
          telefoneCliente={venda.cliente?.telefone}
          autoImprimir={sp.imprimir === "1"}
        />
        <p className="mt-3 text-center text-xs text-suave">
          Dica: no celular, tire um print desta tela para enviar o recibo como imagem.
        </p>
      </div>
    </div>
  );
}
