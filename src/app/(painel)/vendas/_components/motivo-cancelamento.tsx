"use client";

import { useState } from "react";
import { Textarea, cn } from "@/components/ui";

const SUGESTOES = ["Cliente desistiu", "Venda registrada por engano", "Produto com defeito", "Troca por outro produto"];

/** Campo "motivo" do diálogo de cancelamento, com sugestões de um toque (útil no celular). */
export function MotivoCancelamento() {
  const [motivo, setMotivo] = useState("");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Sugestões de motivo">
        {SUGESTOES.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={motivo === s}
            onClick={() => setMotivo(s)}
            className={cn(
              "inline-flex h-10 items-center rounded-full border px-3 text-xs font-medium transition sm:h-8",
              motivo === s
                ? "border-chama bg-chama-clara text-chama-escura"
                : "border-linha-forte bg-papel text-tinta hover:bg-areia",
            )}
          >
            {s}
          </button>
        ))}
      </div>
      <Textarea
        name="motivo"
        label="Motivo do cancelamento"
        required
        maxLength={300}
        rows={3}
        value={motivo}
        onChange={(e) => setMotivo(e.currentTarget.value)}
        placeholder="Ex.: cliente desistiu da compra"
        hint="Fica registrado no histórico da venda."
      />
    </div>
  );
}
