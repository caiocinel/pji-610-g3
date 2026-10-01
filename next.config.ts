import path from "node:path";
import type { NextConfig } from "next";

const producao = process.env.NODE_ENV === "production";

// Cabeçalhos de segurança aplicados a todas as respostas. A CSP aqui é só a parte que não
// depende de nonce (scripts/estilos inline do Next continuam funcionando): bloqueia o app dentro de
// iframes de outros sites (iframes do próprio app, ex.: impressão do recibo, continuam valendo),
// plugins, <base> e envio de formulários para outros domínios.
const cabecalhosSeguranca = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
  ...(producao ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Gera um servidor autocontido em .next/standalone para rodar com PM2 na VPS.
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname),
  turbopack: { root: path.join(import.meta.dirname) },
  poweredByHeader: false,
  // Em produção o nginx fica na frente e comprime (gzip, ver README). A compressão do próprio Next
  // em respostas RSC em streaming gerava "MaxListenersExceededWarning ... drain listeners added to
  // [Gzip]" no log e comprimia tudo duas vezes à toa.
  compress: false,
  async headers() {
    return [{ source: "/:path*", headers: cabecalhosSeguranca }];
  },
};

export default nextConfig;
