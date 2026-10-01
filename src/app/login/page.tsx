import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Boxes, ChartColumn, ShieldCheck, ShoppingBag } from "lucide-react";
import { Card } from "@/components/ui";
import { Logo } from "@/components/logo";
import { isAuthenticated } from "@/lib/auth";
import { TIMEZONE } from "@/lib/format";
import { destinoInterno } from "./destino";
import { LoginForm } from "./login-form";
import { VelaIlustracao } from "./vela-ilustracao";

export const metadata: Metadata = { title: "Entrar" };

function saudacao(agora = new Date()) {
  const hora = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hourCycle: "h23", timeZone: TIMEZONE }).format(agora));
  if (hora >= 5 && hora < 12) return "Bom dia";
  if (hora >= 12 && hora < 18) return "Boa tarde";
  return "Boa noite";
}

const DESTAQUES = [
  { icone: <ShoppingBag />, titulo: "Vendas em poucos toques", texto: "Registre pedidos da loja, feira ou WhatsApp e envie o recibo." },
  { icone: <Boxes />, titulo: "Estoque sempre em dia", texto: "Saiba o que está acabando antes de faltar vela na prateleira." },
  { icone: <ChartColumn />, titulo: "Números claros", texto: "Faturamento, lucro e aromas preferidos sem planilha." },
];

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  // Só caminhos internos vindos do proxy (?de=/vendas); a action valida de novo antes de redirecionar.
  const destino = destinoInterno((await searchParams).de);
  if (await isAuthenticated()) redirect(destino ?? "/");

  return (
    <main className="relative isolate grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* Painel da marca (desktop) */}
      <section
        aria-hidden
        className="relative hidden overflow-hidden border-r border-linha bg-chama-clara/45 lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16"
      >
        <div className="flex items-center gap-2.5">
          <Logo className="size-9 text-chama" />
          <span className="font-serif text-2xl font-semibold">Velas Luamme</span>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-col items-center py-10">
          <VelaIlustracao className="h-64 w-auto xl:h-72" />
          <p className="mt-10 text-center font-serif text-3xl leading-snug font-semibold text-balance xl:text-4xl">
            Cada vela acesa começa com um bom controle.
          </p>
        </div>

        <ul className="grid gap-5 xl:grid-cols-3 xl:gap-6">
          {DESTAQUES.map((d) => (
            <li key={d.titulo} className="flex gap-3 xl:flex-col xl:gap-2">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-papel text-chama-escura shadow-suave [&_svg]:size-[18px]">
                {d.icone}
              </span>
              <div>
                <p className="text-sm font-semibold">{d.titulo}</p>
                <p className="mt-0.5 text-sm text-suave">{d.texto}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Formulário */}
      <section className="relative flex flex-col items-center justify-center px-4 py-10 sm:px-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(ellipse_at_top,var(--color-chama-clara),transparent_70%)] lg:hidden"
        />

        <div className="w-full max-w-sm animate-entrada">
          <div className="mb-8 text-center">
            <VelaIlustracao className="mx-auto h-32 w-auto lg:hidden" />
            <p className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-chama-escura lg:mt-0">
              <Logo className="size-5 text-chama lg:hidden" />
              <span className="lg:hidden">Velas Luamme</span>
              <span className="hidden lg:inline">Gestão da loja</span>
            </p>
            <h1 className="mt-2 font-serif text-3xl font-semibold sm:text-4xl">{saudacao()}!</h1>
            <p className="mt-2 text-sm text-suave">Entre para cuidar das vendas, do estoque e das clientes.</p>
          </div>

          <Card padding="lg" className="shadow-elevado">
            <LoginForm destino={destino} />
          </Card>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-suave">
            <ShieldCheck aria-hidden className="size-3.5 text-salvia" />
            Acesso restrito à equipe da Velas Luamme.
          </p>
        </div>
      </section>
    </main>
  );
}
