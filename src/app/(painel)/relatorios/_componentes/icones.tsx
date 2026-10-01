import type { ReactNode } from "react";
import { AtSign, Banknote, Coins, CreditCard, Ellipsis, Globe, MessageCircle, QrCode, Store, Tent } from "lucide-react";
import type { Canal, FormaPagamento } from "@/lib/dominio";

// Ícones de forma de pagamento e canal (elementos, não componentes: atravessam Server → Client).

const FORMA: Record<FormaPagamento, ReactNode> = {
  pix: <QrCode aria-hidden />,
  dinheiro: <Banknote aria-hidden />,
  cartao_credito: <CreditCard aria-hidden />,
  cartao_debito: <CreditCard aria-hidden />,
  outro: <Coins aria-hidden />,
};

const CANAL: Record<Canal, ReactNode> = {
  loja: <Store aria-hidden />,
  whatsapp: <MessageCircle aria-hidden />,
  instagram: <AtSign aria-hidden />,
  feira: <Tent aria-hidden />,
  site: <Globe aria-hidden />,
  outro: <Ellipsis aria-hidden />,
};

export const iconeForma = (f: FormaPagamento) => FORMA[f] ?? FORMA.outro;
export const iconeCanal = (c: Canal) => CANAL[c] ?? CANAL.outro;
