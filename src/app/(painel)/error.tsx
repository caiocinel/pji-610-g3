"use client";

import { Card, EmptyState } from "@/components/ui";
import { useConteudoErro, type PropsErro } from "@/components/shell/erro";

/** Erro dentro do painel: o menu continua disponível e só o conteúdo mostra a falha. */
export default function ErroPainel(props: PropsErro) {
  const { icone, titulo, descricao, acoes, codigo } = useConteudoErro(props);
  return (
    <Card role="alert" className="mx-auto mt-4 max-w-xl sm:mt-10">
      <EmptyState icone={icone} titulo={titulo} descricao={descricao} acao={acoes} />
      {codigo && <p className="pb-2 text-center text-xs text-suave">{codigo}</p>}
    </Card>
  );
}
