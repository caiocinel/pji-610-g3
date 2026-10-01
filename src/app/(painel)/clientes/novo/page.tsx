import type { Metadata } from "next";
import { PageHeader, param } from "@/components/ui";
import { ClienteForm } from "../_componentes/cliente-form";
import { requireAuth } from "@/lib/auth";

export const metadata: Metadata = { title: "Novo cliente" };

export default async function NovoClientePage({ searchParams }: PageProps<"/clientes/novo">) {
  await requireAuth();
  const sp = await searchParams;
  const inicial = {
    nome: (param(sp, "nome") ?? "").slice(0, 120),
    telefone: (param(sp, "telefone") ?? "").replace(/\D/g, "").slice(0, 13),
  };
  return (
    <>
      <PageHeader
        breadcrumb={[{ rotulo: "Clientes", href: "/clientes" }, { rotulo: "Novo cliente" }]}
        titulo="Novo cliente"
        descricao="Cadastre para acompanhar as compras e chamar no WhatsApp quando quiser."
      />
      <ClienteForm inicial={inicial} />
    </>
  );
}
