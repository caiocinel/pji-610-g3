// Compartilhado entre flash-server.ts (servidor) e toast.tsx (cliente).
export const COOKIE_FLASH = "luamme_flash";

export type MensagemFlash = { tipo: "sucesso" | "erro" | "info"; mensagem: string };
