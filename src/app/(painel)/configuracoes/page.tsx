import type { Metadata } from "next";
import { Boxes, KeyRound, LogOut, MonitorSmartphone, ShieldCheck, Smartphone, Store } from "lucide-react";
import { logout } from "@/app/actions";
import { Card, CardHeader, PageHeader, SubmitButton } from "@/components/ui";
import { requireAuth } from "@/lib/auth";
import { getConfiguracoes, getSenhaHash } from "@/lib/dominio/configuracoes";
import { ConfiguracoesForm } from "./configuracoes-form";
import { InstalarApp } from "./instalar-app";
import { sairDeTodosAparelhos } from "./acoes";
import { TrocarSenhaForm } from "./trocar-senha-form";

export const metadata: Metadata = { title: "Configurações" };

const SECOES = [
  { href: "#loja", rotulo: "Loja", icone: <Store /> },
  { href: "#estoque", rotulo: "Estoque", icone: <Boxes /> },
  { href: "#senha", rotulo: "Senha", icone: <KeyRound /> },
  { href: "#aplicativo", rotulo: "App", icone: <Smartphone /> },
];

export default async function ConfiguracoesPage() {
  await requireAuth();
  const [config, hash] = await Promise.all([getConfiguracoes(), getSenhaHash()]);

  return (
    <>
      <PageHeader titulo="Configurações" descricao="Dados da loja, padrões do estoque e segurança do acesso." />

      <nav aria-label="Seções das configurações" className="sem-barra -mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-2">
          {SECOES.map((s) => (
            <li key={s.href}>
              <a
                href={s.href}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-linha bg-papel px-4 text-sm font-medium text-suave shadow-suave transition hover:border-linha-forte hover:text-tinta [&_svg]:size-4"
              >
                {s.icone}
                {s.rotulo}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-6">
        <ConfiguracoesForm config={config} />

        <section aria-labelledby="titulo-seguranca" className="space-y-4 pt-2">
          <h2 id="titulo-seguranca" className="flex items-center gap-2 font-serif text-xl font-semibold">
            <ShieldCheck aria-hidden className="size-5 text-salvia" />
            Acesso e aparelho
          </h2>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
            <TrocarSenhaForm senhaPersonalizada={!!hash} />
            <div className="space-y-6">
              <InstalarApp />
              <Card>
                <CardHeader
                  icone={<LogOut />}
                  titulo="Sair"
                  descricao="Encerra o acesso neste aparelho. Para entrar de novo, use usuário e senha."
                />
                <form action={logout}>
                  <SubmitButton variante="secundario" icone={<LogOut />} pendente="Saindo…" larguraTotal>
                    Sair deste aparelho
                  </SubmitButton>
                </form>
                <div className="mt-4 border-t border-linha pt-4">
                  <p id="dica-sair-todos" className="mb-3 text-xs text-suave">
                    Usou o sistema num aparelho emprestado ou perdeu o celular? Desconecte todos de uma vez, inclusive
                    este. Trocar a senha também desconecta os outros aparelhos.
                  </p>
                  <form action={sairDeTodosAparelhos}>
                    <SubmitButton
                      variante="fantasma"
                      icone={<MonitorSmartphone />}
                      pendente="Desconectando…"
                      larguraTotal
                      aria-describedby="dica-sair-todos"
                    >
                      Sair de todos os aparelhos
                    </SubmitButton>
                  </form>
                </div>
              </Card>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
