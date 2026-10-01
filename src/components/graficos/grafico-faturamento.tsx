"use client";

import { useId } from "react";
import { Area, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { formatDateShort } from "@/lib/format";
import { CaixaDica, EIXO, LinhaDica, MarcaSerie, formatar, formatarEixo, useMovimentoReduzido, type FormatoValor } from "./comum";
import { rotuloBalde, rotuloEixoBalde, type AgrupamentoSerie } from "./dados";

export type PontoFaturamento = {
  /** Dia AAAA-MM-DD (fuso de SP). Em séries por semana/mês, o 1º dia do balde dentro do período. */
  dia: string;
  /** Último dia do balde (séries por semana/mês). */
  ate?: string | null;
  valor: number;
  /** Nº de vendas do dia (aparece no tooltip). */
  vendas?: number;
  /** Valor no dia equivalente do período anterior (linha de comparação). */
  anterior?: number | null;
  /** Dia equivalente do período anterior (AAAA-MM-DD), para o tooltip. */
  diaAnterior?: string | null;
  ateAnterior?: string | null;
};

export type GraficoFaturamentoProps = {
  dados: PontoFaturamento[];
  /** Nome da série principal (legenda/tooltip). */
  rotuloSerie?: string;
  /** Nome da série de comparação. Sem ele (ou sem `anterior` nos dados), só a série principal. */
  rotuloAnterior?: string;
  formato?: FormatoValor;
  altura?: number;
  /** Cada ponto é um dia (padrão), uma semana ou um mês. */
  agrupamento?: AgrupamentoSerie;
};

const COR = "var(--color-grafico-1)";
const COR_ANTERIOR = "var(--color-suave)";

const diaSemanaCurto = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "America/Sao_Paulo" });
function rotuloDia(ymd: string) {
  const sem = diaSemanaCurto.format(new Date(`${ymd}T12:00:00-03:00`)).replace(".", "");
  return `${sem.charAt(0).toUpperCase()}${sem.slice(1)}, ${formatDateShort(ymd)}`;
}

type DicaProps = TooltipContentProps & {
  rotuloSerie: string;
  rotuloAnterior?: string;
  comparar: boolean;
  formato: FormatoValor;
  agrupamento: AgrupamentoSerie;
};

function Dica({ active, payload, rotuloSerie, rotuloAnterior, comparar, formato, agrupamento }: DicaProps) {
  const p = payload?.[0]?.payload as PontoFaturamento | undefined;
  if (!active || !p) return null;
  const diario = agrupamento === "dia";
  return (
    <CaixaDica titulo={diario ? rotuloDia(p.dia) : rotuloBalde(p.dia, p.ate, agrupamento)}>
      <LinhaDica cor={COR} rotulo={rotuloSerie} valor={formatar(p.valor, formato)} />
      {p.vendas != null && <p className="text-xs text-suave">{p.vendas === 1 ? "1 venda" : `${p.vendas} vendas`}</p>}
      {comparar && p.anterior != null && (
        <LinhaDica
          cor={COR_ANTERIOR}
          tracejado
          rotulo={
            p.diaAnterior
              ? `${rotuloAnterior} (${diario ? formatDateShort(p.diaAnterior) : rotuloBalde(p.diaAnterior, p.ateAnterior, agrupamento)})`
              : (rotuloAnterior ?? "")
          }
          valor={formatar(p.anterior, formato)}
        />
      )}
    </CaixaDica>
  );
}

/** Faturamento por dia: área na cor de destaque + linha fina do período anterior para comparar. */
export function GraficoFaturamento({
  dados,
  rotuloSerie = "Faturamento",
  rotuloAnterior,
  formato = "brl",
  altura = 260,
  agrupamento = "dia",
}: GraficoFaturamentoProps) {
  const semAnimacao = useMovimentoReduzido();
  const comparar = !!rotuloAnterior && dados.some((d) => d.anterior != null);
  const idGradiente = `grad-${useId().replace(/:/g, "")}`;

  return (
    <div>
      {comparar && (
        <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-suave" aria-label="Legenda">
          <li className="flex items-center gap-1.5">
            <MarcaSerie cor={COR} />
            {rotuloSerie}
          </li>
          <li className="flex items-center gap-1.5">
            <MarcaSerie cor={COR_ANTERIOR} linha />
            {rotuloAnterior}
          </li>
        </ul>
      )}
      <ComposedChart
        responsive
        data={dados}
        style={{ width: "100%", height: altura }}
        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
      >
        <defs>
          <linearGradient id={idGradiente} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COR} stopOpacity={0.22} />
            <stop offset="100%" stopColor={COR} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--color-linha)" />
        <XAxis
          dataKey="dia"
          {...EIXO}
          tickFormatter={(d: string) => rotuloEixoBalde(d, agrupamento)}
          interval="preserveStartEnd"
          minTickGap={28}
          tickMargin={8}
        />
        <YAxis
          {...EIXO}
          width={formato === "brl" ? 68 : 40}
          tickCount={4}
          allowDecimals={false}
          tickFormatter={(v: number) => formatarEixo(v, formato)}
        />
        <Tooltip
          content={(props) => (
            <Dica
              {...props}
              rotuloSerie={rotuloSerie}
              rotuloAnterior={rotuloAnterior}
              comparar={comparar}
              formato={formato}
              agrupamento={agrupamento}
            />
          )}
          cursor={{ stroke: "var(--color-linha-forte)", strokeWidth: 1 }}
          isAnimationActive={false}
        />
        {comparar && (
          <Line
            type="monotone"
            dataKey="anterior"
            name={rotuloAnterior}
            stroke={COR_ANTERIOR}
            strokeOpacity={0.55}
            strokeWidth={1.5}
            dot={false}
            activeDot={false}
            isAnimationActive={!semAnimacao}
          />
        )}
        <Area
          type="monotone"
          dataKey="valor"
          name={rotuloSerie}
          stroke={COR}
          strokeWidth={2}
          fill={`url(#${idGradiente})`}
          dot={false}
          activeDot={{ r: 5, stroke: "var(--color-papel)", strokeWidth: 2, fill: COR }}
          isAnimationActive={!semAnimacao}
        />
      </ComposedChart>
    </div>
  );
}
