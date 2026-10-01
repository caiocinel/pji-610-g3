"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle, LogOut } from "lucide-react";
import { logout } from "@/app/actions";
import { cn } from "@/components/ui";

function Botao({ className, compacto, extra }: { className?: string; compacto?: boolean; extra?: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-label={compacto ? "Sair" : undefined} className={className}>
      {pending ? <LoaderCircle aria-hidden className="animate-spin" /> : <LogOut aria-hidden />}
      <span className={cn(compacto && "sr-only")}>{pending ? "Saindo…" : "Sair"}</span>
      {extra}
    </button>
  );
}

/** Botão "Sair" (encerra a sessão e volta para o login). Estilo vem do chamador. */
export function BotaoSair({
  className,
  formClassName,
  compacto,
  extra,
}: {
  className?: string;
  formClassName?: string;
  compacto?: boolean;
  /** Conteúdo extra dentro do botão (ex.: dica do menu recolhido). */
  extra?: ReactNode;
}) {
  return (
    <form action={logout} className={formClassName}>
      <Botao className={className} compacto={compacto} extra={extra} />
    </form>
  );
}
