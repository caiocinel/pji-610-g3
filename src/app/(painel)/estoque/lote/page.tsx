import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { produtosMovimentaveis } from "@/lib/consultas/estoque";
import { AbasEstoque } from "../_components/abas-estoque";
import { LoteForm } from "./lote-form";
import { requireAuth } from "@/lib/auth";

export const metadata: Metadata = { title: "Entrada em lote" };

export default async function EntradaLotePage() {
  await requireAuth();
  const produtos = await produtosMovimentaveis();
  return (
    <>
      <PageHeader
        titulo="Entrada em lote"
        descricao="Terminou uma produção? Informe quantas unidades de cada vela ficaram prontas e registre tudo de uma vez."
        breadcrumb={[{ rotulo: "Estoque", href: "/estoque" }, { rotulo: "Entrada em lote" }]}
      />
      <AbasEstoque ativa="lote" />
      <LoteForm produtos={produtos} />
    </>
  );
}
