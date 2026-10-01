import Link from "next/link";
import type { ReactNode } from "react";
import { ClipboardList, PackageMinus, PackagePlus, ShoppingBag, Undo2 } from "lucide-react";
import { Badge, cn, type TomBadge } from "@/components/ui";
import { ROTULO_MOTIVO, rotulo, type MotivoMovimentacao, type TipoMovimentacao } from "@/lib/dominio";
import { formatInt } from "@/lib/format";

type Mov = { tipo: TipoMovimentacao; motivo: MotivoMovimentacao | null; quantidade: number };

function visual(m: Pick<Mov, "tipo" | "motivo">): { tom: TomBadge; icone: ReactNode; circulo: string } {
  if (m.motivo === "ajuste_inventario")
    return { tom: "info", icone: <ClipboardList aria-hidden />, circulo: "bg-info-clara text-info" };
  if (m.motivo === "venda") return { tom: "neutro", icone: <ShoppingBag aria-hidden />, circulo: "bg-areia text-suave" };
  if (m.motivo === "cancelamento_venda")
    return { tom: "mel", icone: <Undo2 aria-hidden />, circulo: "bg-mel-clara text-mel" };
  return m.tipo === "entrada"
    ? { tom: "salvia", icone: <PackagePlus aria-hidden />, circulo: "bg-salvia-clara text-salvia" }
    : { tom: "alerta", icone: <PackageMinus aria-hidden />, circulo: "bg-alerta-clara text-alerta" };
}

/** Selo com o motivo (ícone + texto; a cor segue o tipo). */
export function BadgeMotivo({ mov }: { mov: Pick<Mov, "tipo" | "motivo"> }) {
  const v = visual(mov);
  return (
    <Badge tom={v.tom} icone={v.icone}>
      {rotulo(ROTULO_MOTIVO, mov.motivo) || (mov.tipo === "entrada" ? "Entrada" : "Saída")}
    </Badge>
  );
}

/** Ícone redondo para listas/linhas do tempo. */
export function IconeMovimentacao({ mov, className }: { mov: Pick<Mov, "tipo" | "motivo">; className?: string }) {
  const v = visual(mov);
  return (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full [&_svg]:size-4", v.circulo, className)}>
      {v.icone}
    </span>
  );
}

/** "+12" verde ou "−3" vermelho, com texto acessível. */
export function QuantidadeMov({ mov, className }: { mov: Mov; className?: string }) {
  const entrada = mov.tipo === "entrada";
  return (
    <span className={cn("tabular font-semibold", entrada ? "text-salvia" : "text-alerta", className)}>
      <span aria-hidden>{entrada ? "+" : "−"}</span>
      <span className="sr-only">{entrada ? "entrada de " : "saída de "}</span>
      {formatInt(mov.quantidade)}
      <span className="sr-only"> unidades</span>
    </span>
  );
}

/** Link para a venda de origem, quando houver. */
export function LinkVenda({ vendaId }: { vendaId: number | null }) {
  if (!vendaId) return null;
  return (
    <Link href={`/vendas/${vendaId}`} className="link whitespace-nowrap">
      Venda #{vendaId}
    </Link>
  );
}
