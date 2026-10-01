import { cn } from "@/components/ui";

/** Ilustração da vela acesa com a lua da marca. Cores por token (funciona no tema escuro). */
export function VelaIlustracao({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 240" fill="none" aria-hidden className={cn("overflow-visible", className)}>
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .vl-chama { transform-box: fill-box; transform-origin: 50% 100%; animation: vl-tremula 3.4s ease-in-out infinite; }
          .vl-miolo { transform-box: fill-box; transform-origin: 50% 100%; animation: vl-tremula 2.6s ease-in-out infinite reverse; }
          .vl-brilho { transform-box: fill-box; transform-origin: center; animation: vl-pulsa 3.4s ease-in-out infinite; }
          .vl-estrela { transform-box: fill-box; transform-origin: center; animation: vl-pisca 4s ease-in-out infinite; }
          .vl-estrela-2 { animation-delay: 1.6s; }
        }
        @keyframes vl-tremula {
          0%, 100% { transform: scale(1, 1) rotate(0deg); }
          25% { transform: scale(0.95, 1.05) rotate(-2.5deg); }
          50% { transform: scale(1.03, 0.97) rotate(1.5deg); }
          75% { transform: scale(0.98, 1.03) rotate(-1deg); }
        }
        @keyframes vl-pulsa {
          0%, 100% { opacity: 0.95; transform: scale(1); }
          50% { opacity: 0.65; transform: scale(0.93); }
        }
        @keyframes vl-pisca {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.35; transform: scale(0.7); }
        }
      `}</style>

      {/* Brilho da chama */}
      <circle className="vl-brilho fill-chama-clara" cx="100" cy="74" r="60" />

      {/* Lua e estrelas */}
      <path className="fill-grafico-3" d="M170 22a17 17 0 1 0 9 30 13 13 0 1 1-9-30Z" opacity="0.85" />
      <path className="vl-estrela fill-grafico-3" d="M34 58l2.6 6.4L43 67l-6.4 2.6L34 76l-2.6-6.4L25 67l6.4-2.6Z" />
      <path className="vl-estrela vl-estrela-2 fill-grafico-3" d="M158 92l1.8 4.2L164 98l-4.2 1.8L158 104l-1.8-4.2L152 98l4.2-1.8Z" />

      {/* Chama */}
      <path className="vl-chama fill-chama" d="M100 22c16 22 26 38 26 56a26 26 0 0 1-52 0c0-18 10-34 26-56Z" />
      <path className="vl-miolo fill-grafico-3" d="M100 54c8 11 12 19 12 27a12 12 0 0 1-24 0c0-8 4-16 12-27Z" />

      {/* Pavio */}
      <path className="stroke-tinta" d="M100 104v12" strokeWidth="3" strokeLinecap="round" />

      {/* Corpo da vela */}
      <rect className="fill-papel stroke-linha-forte" x="60" y="114" width="80" height="96" rx="10" strokeWidth="2" />
      <path
        className="fill-areia"
        d="M61 124c0-6 4-9 10-9h58c6 0 10 3 10 9v6c-4 6-9 6-12 0-3-5-8-5-10 2-3 10-10 10-12 0-2-7-8-8-12-1-4 8-10 7-12-1-2-6-8-6-11 0-3 5-7 4-9-1Z"
      />
      <rect className="fill-chama-clara" x="61" y="160" width="78" height="24" />
      <path className="fill-chama" d="M100 165c3 4 5 7 5 10a5 5 0 0 1-10 0c0-3 2-6 5-10Z" opacity="0.9" />

      {/* Base */}
      <ellipse className="fill-linha" cx="100" cy="216" rx="64" ry="8" />
    </svg>
  );
}
