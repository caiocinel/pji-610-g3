"use client";

import { Bar, BarChart, CartesianGrid, Cell, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { CaixaDica, EIXO, LinhaDica, formatar, formatarEixo, useMovimentoReduzido, type FormatoValor } from "./comum";

export type PontoColuna = {
  /** Rótulo curto do eixo (ex.: "Seg"). */
  rotulo: string;
  /** Rótulo completo do tooltip (ex.: "Segunda-feira"). */
  rotuloLongo?: string;
  valor: number;
  /** Linhas extras do tooltip (ex.: ["12 vendas", "Média de R$ 80,00 por dia"]). */
  detalhes?: string[];
};

export type GraficoColunasProps = {
  dados: PontoColuna[];
  /** Nome da medida (tooltip), ex.: "Faturamento". */
  rotuloSerie: string;
  formato?: FormatoValor;
  altura?: number;
  /** Destaca a maior coluna na cor cheia e deixa as outras mais suaves. */
  destacarMaior?: boolean;
};

const COR = "var(--color-grafico-1)";

type DicaProps = TooltipContentProps & { rotuloSerie: string; formato: FormatoValor };

function Dica({ active, payload, rotuloSerie, formato }: DicaProps) {
  const p = payload?.[0]?.payload as PontoColuna | undefined;
  if (!active || !p) return null;
  return (
    <CaixaDica titulo={p.rotuloLongo ?? p.rotulo}>
      <LinhaDica cor={COR} rotulo={rotuloSerie} valor={formatar(p.valor, formato)} />
      {p.detalhes?.map((d) => (
        <p key={d} className="text-xs text-suave">
          {d}
        </p>
      ))}
    </CaixaDica>
  );
}

/** Colunas verticais de uma série só (ex.: faturamento por dia da semana). */
export function GraficoColunas({ dados, rotuloSerie, formato = "brl", altura = 220, destacarMaior }: GraficoColunasProps) {
  const semAnimacao = useMovimentoReduzido();
  const maior = Math.max(...dados.map((d) => d.valor), 0);

  return (
    <BarChart
      responsive
      data={dados}
      style={{ width: "100%", height: altura }}
      margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
      barCategoryGap="22%"
    >
      <CartesianGrid vertical={false} stroke="var(--color-linha)" />
      <XAxis dataKey="rotulo" {...EIXO} tickMargin={8} interval={0} />
      <YAxis
        {...EIXO}
        width={formato === "brl" ? 68 : 36}
        tickCount={4}
        allowDecimals={false}
        tickFormatter={(v: number) => formatarEixo(v, formato)}
      />
      <Tooltip
        content={(props) => <Dica {...props} rotuloSerie={rotuloSerie} formato={formato} />}
        cursor={{ fill: "var(--color-areia)", opacity: 0.7 }}
        isAnimationActive={false}
      />
      <Bar dataKey="valor" name={rotuloSerie} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={!semAnimacao}>
        {dados.map((d) => (
          <Cell
            key={d.rotulo}
            fill={COR}
            fillOpacity={destacarMaior && maior > 0 && d.valor < maior ? 0.45 : 1}
          />
        ))}
      </Bar>
    </BarChart>
  );
}
