import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { buscarCliente } from "@/lib/consultas/clientes";
import { ClienteForm } from "../../_componentes/cliente-form";
import { requireAuth } from "@/lib/auth";

export async function generateMetadata({ params }: PageProps<"/clientes/[id]/editar">): Promise<Metadata> {
  await requireAuth();
  const { id } = await params;
  const cliente = await buscarCliente(Number(id));
  return { title: cliente ? `Editar ${cliente.nome}` : "Cliente não encontrado" };
}

export default async function EditarClientePage({ params }: PageProps<"/clientes/[id]/editar">) {
  await requireAuth();
  const { id } = await params;
  const cliente = await buscarCliente(Number(id));
  if (!cliente) notFound();

  return (
    <>
      <PageHeader
        breadcrumb={[
          { rotulo: "Clientes", href: "/clientes" },
          { rotulo: cliente.nome, href: `/clientes/${cliente.id}` },
          { rotulo: "Editar" },
        ]}
        titulo="Editar cliente"
        descricao={cliente.nome}
      />
      <ClienteForm cliente={cliente} />
    </>
  );
}
