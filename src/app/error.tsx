"use client";

import { PaginaAvulsa } from "@/components/shell/pagina-avulsa";
import { useConteudoErro, type PropsErro } from "@/components/shell/erro";

/** Erro fora do painel (ex.: login). */
export default function Erro(props: PropsErro) {
  const { icone, titulo, descricao, acoes, codigo } = useConteudoErro(props);
  return (
    <div role="alert">
      <PaginaAvulsa icone={icone} titulo={titulo} descricao={descricao} acoes={acoes} rodape={codigo} />
    </div>
  );
}
