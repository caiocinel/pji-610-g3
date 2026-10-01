import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";

// O recibo vive fora do layout do painel (/recibo/[id]) para imprimir e compartilhar sem o menu.
// Esta rota só mantém links antigos funcionando; as telas apontam direto para /recibo/[id]
// (aqui o redirect sai em streaming, com atraso, por causa do loading.tsx de /vendas/[id]).
export default async function ReciboVendaPage({ params, searchParams }: PageProps<"/vendas/[id]/recibo">) {
  await requireAuth();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) notFound();
  redirect(sp.imprimir === "1" ? `/recibo/${n}?imprimir=1` : `/recibo/${n}`);
}
