import { PackageSearch } from "lucide-react";
import { Aviso, ButtonLink, calcularVariacao } from "@/components/ui";
import type { ResumoVendas } from "@/lib/consultas/relatorios";
import { formatBRL, formatPercent } from "@/lib/format";

// Vendas sem custo informado (as da v1 e as de velas sem custo cadastrado) ficam fora do lucro e da
// margem. Estes helpers mostram isso na tela em vez de exibir um lucro inflado.

type ResumoCusto = Pick<ResumoVendas, "lucro" | "margem" | "fracao_sem_custo" | "receita_sem_custo" | "faturamento">;

/** Acima disso, comparar lucro/margem entre períodos engana (a base de itens com custo muda). */
const LIMITE_COMPARACAO = 0.05;

export const textoLucro = (lucro: number | null) => (lucro == null ? "—" : formatBRL(lucro));

/** Pode comparar lucro e margem dos dois períodos? */
export function lucroComparavel(atual: ResumoCusto, anterior: ResumoCusto) {
  return (
    atual.lucro != null &&
    anterior.lucro != null &&
    atual.fracao_sem_custo <= LIMITE_COMPARACAO &&
    anterior.fracao_sem_custo <= LIMITE_COMPARACAO
  );
}

/** Props do StatCard de lucro bruto: valor, variação (quando comparável) ou aviso curto. */
export function propsCartaoLucro(atual: ResumoCusto, anterior: ResumoCusto, referencia: string) {
  const base = {
    valor: textoLucro(atual.lucro),
    destaque: atual.lucro != null && atual.lucro < 0 ? ("alerta" as const) : undefined,
  };
  if (atual.lucro == null) return { ...base, detalhe: "Sem custo informado nas vendas" };
  if (atual.fracao_sem_custo > LIMITE_COMPARACAO) {
    return { ...base, detalhe: `Só ${formatPercent(1 - atual.fracao_sem_custo, { casas: 0 })} das vendas com custo` };
  }
  if (!lucroComparavel(atual, anterior)) return { ...base, detalhe: "Período anterior sem custo completo" };
  return { ...base, variacao: calcularVariacao(atual.lucro, anterior.lucro ?? 0), referencia };
}

/** Aviso exibido quando parte do faturamento não tem custo informado. */
export function AvisoSemCusto({ resumo, className }: { resumo: ResumoCusto; className?: string }) {
  if (resumo.faturamento <= 0 || resumo.fracao_sem_custo < 0.005) return null;
  const tudo = resumo.lucro == null;
  return (
    <Aviso
      tipo="atencao"
      className={className}
      titulo={
        tudo
          ? "Lucro indisponível: nenhuma venda do período tem custo informado"
          : `${formatPercent(resumo.fracao_sem_custo, { casas: 0 })} do faturamento sem custo informado`
      }
      acao={
        <ButtonLink href="/produtos" tamanho="sm" variante="secundario" icone={<PackageSearch />}>
          Revisar custos
        </ButtonLink>
      }
    >
      {tudo
        ? "Vendas registradas antes do controle de custo ou de velas sem custo cadastrado não entram no lucro, para não parecer que todo o valor é lucro."
        : `${formatBRL(resumo.receita_sem_custo)} vieram de vendas antigas ou de velas sem custo cadastrado. O lucro bruto e a margem consideram só o restante.`}
    </Aviso>
  );
}
