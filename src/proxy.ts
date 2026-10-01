import { NextResponse, type NextRequest } from "next/server";

// Verificação otimista: só checa a presença do cookie. A validação da assinatura
// acontece em requireAuth() em cada página e Server Action.
export function proxy(request: NextRequest) {
  if (!request.cookies.has("luamme_session")) {
    const url = new URL("/login", request.url);
    const { pathname, search } = request.nextUrl;
    // Guarda a página pedida para voltar a ela depois do login (só navegação de páginas).
    if (pathname !== "/" && request.method === "GET" && !pathname.startsWith("/api/")) {
      url.searchParams.set("de", pathname + search);
    }
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Ficam de fora: login, arquivos do Next, ícones/manifest do PWA e arquivos estáticos.
  matcher: [
    "/((?!login|_next/|favicon.ico|icon|apple-icon|manifest.webmanifest|robots.txt|.*\\.(?:png|svg|ico|jpg|jpeg|webp|webmanifest|txt)$).*)",
  ],
};
