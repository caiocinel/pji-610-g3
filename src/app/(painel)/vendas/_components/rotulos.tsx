import type { ReactNode } from "react";
import { AtSign, Ban, Banknote, CircleCheck, Coins, CreditCard, Ellipsis, Globe, MessageCircle, QrCode, Store, Tent } from "lucide-react";
import { Badge } from "@/components/ui";
import { ROTULO_CANAL, ROTULO_FORMA_PAGAMENTO, type Canal, type FormaPagamento, type StatusVenda } from "@/lib/dominio";

// Ícones e selos das vendas (server-safe: devolvem elementos, não componentes).

const ICONE_FORMA: Record<FormaPagamento, ReactNode> = {
  pix: <QrCode aria-hidden />,
  dinheiro: <Banknote aria-hidden />,
  cartao_credito: <CreditCard aria-hidden />,
  cartao_debito: <CreditCard aria-hidden />,
  outro: <Coins aria-hidden />,
};

const ICONE_CANAL: Record<Canal, ReactNode> = {
  loja: <Store aria-hidden />,
  whatsapp: <MessageCircle aria-hidden />,
  instagram: <AtSign aria-hidden />,
  feira: <Tent aria-hidden />,
  site: <Globe aria-hidden />,
  outro: <Ellipsis aria-hidden />,
};

export function iconeForma(forma: FormaPagamento): ReactNode {
  return ICONE_FORMA[forma] ?? ICONE_FORMA.outro;
}

export function iconeCanal(canal: Canal): ReactNode {
  return ICONE_CANAL[canal] ?? ICONE_CANAL.outro;
}

/** "Pix" com ícone, para tabelas e detalhes. */
export function FormaPagamentoTexto({ forma }: { forma: FormaPagamento }) {
  return (
    <span className="inline-flex items-center gap-1.5 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-suave">
      {iconeForma(forma)}
      {ROTULO_FORMA_PAGAMENTO[forma] ?? forma}
    </span>
  );
}

export function CanalTexto({ canal }: { canal: Canal }) {
  return (
    <span className="inline-flex items-center gap-1.5 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-suave">
      {iconeCanal(canal)}
      {ROTULO_CANAL[canal] ?? canal}
    </span>
  );
}

export function StatusVendaBadge({ status, tamanho }: { status: StatusVenda; tamanho?: "sm" | "md" }) {
  return status === "cancelada" ? (
    <Badge tom="alerta" icone={<Ban />} tamanho={tamanho}>
      Cancelada
    </Badge>
  ) : (
    <Badge tom="salvia" icone={<CircleCheck />} tamanho={tamanho}>
      Concluída
    </Badge>
  );
}
