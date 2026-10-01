import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, FolderOpen, Tags } from "lucide-react";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { resumoCategorias } from "@/lib/consultas/produtos";
import { formatInt, plural } from "@/lib/format";
import { AcoesCategoria, NovaCategoriaForm } from "./categorias-cliente";
import { requireAuth } from "@/lib/auth";

export const metadata: Metadata = { title: "Categorias" };

export default async function CategoriasPage() {
  await requireAuth();
  const { categorias, semCategoria } = await resumoCategorias();

  return (
    <>
      <PageHeader
        breadcrumb={[{ rotulo: "Produtos", href: "/produtos" }, { rotulo: "Categorias" }]}
        titulo="Categorias"
        descricao="Agrupe suas velas (pote, lata, kits…) para achar mais rápido e comparar vendas."
      />

      <div className="max-w-3xl space-y-6">
        <Card>
          <NovaCategoriaForm />
        </Card>

        <Card as="section" padding="none">
          <CardHeader
            inset
            divisoria
            titulo="Suas categorias"
            descricao={categorias.length ? plural(categorias.length, "categoria") : undefined}
            icone={<Tags />}
          />
          {categorias.length === 0 ? (
            <EmptyState
              compacto
              icone={<Tags />}
              titulo="Nenhuma categoria ainda"
              descricao="Crie a primeira no campo acima. Você também pode criar direto no cadastro da vela."
            />
          ) : (
            <ul className="divide-y divide-linha">
              {categorias.map((c) => (
                <li key={c.id} className="flex items-center gap-2 px-4 py-3 sm:px-5">
                  <Link
                    href={`/produtos?categoria=${c.id}`}
                    className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg py-1"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-chama-clara font-serif text-sm font-semibold text-chama-escura">
                      {formatInt(c.ativos)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-tinta group-hover:text-chama-escura group-hover:underline">
                        {c.nome}
                      </span>
                      <span className="block text-xs text-suave">
                        {c.ativos ? plural(c.ativos, "vela ativa", "velas ativas") : "Nenhuma vela ativa"}
                        {c.inativos > 0 && ` · ${plural(c.inativos, "desativada")}`}
                        {c.ativos > 0 && ` · ${formatInt(c.unidades)} un. em estoque`}
                        {c.vendidos_30d > 0 && ` · ${formatInt(c.vendidos_30d)} vendidas em 30 dias`}
                      </span>
                    </span>
                  </Link>
                  <AcoesCategoria id={c.id} nome={c.nome} ativos={c.ativos} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        {semCategoria > 0 && (
          <Link
            href="/produtos?categoria=sem"
            className="cartao flex items-center gap-3 p-4 transition hover:border-linha-forte hover:shadow-elevado"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-areia text-suave">
              <FolderOpen aria-hidden className="size-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-tinta">Sem categoria</span>
              <span className="block text-xs text-suave">
                {plural(semCategoria, "vela ativa ainda não tem", "velas ativas ainda não têm")} categoria.
              </span>
            </span>
            <ChevronRight aria-hidden className="size-4 text-suave" />
          </Link>
        )}
      </div>
    </>
  );
}
