// Ponto de entrada seguro para cliente E servidor: enums/rótulos, tipos, cálculos puros,
// validações (zod) e o formato de retorno das actions.
// Server Actions: importe de "@/lib/dominio/acoes" (ou "@/lib/dominio/acoes/<modulo>").
// Leitura de configurações/senha (só servidor): "@/lib/dominio/configuracoes".
export * from "./enums";
export * from "./tipos";
export * from "./calculos";
export * from "./resultado";
export * from "./schemas";
