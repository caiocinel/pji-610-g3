import {
  ArrowLeftRight,
  ChartColumn,
  ClipboardList,
  KeyRound,
  Layers,
  LogOut,
  PackageMinus,
  PackagePlus,
  Plus,
  Receipt,
  ShoppingBag,
  Tags,
  TriangleAlert,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { TODOS_ITENS_NAV } from "@/components/shell/navegacao";

export type AcaoRapida = {
  id: string;
  titulo: string;
  subtitulo?: string;
  icone: LucideIcon;
  /** Destino; sem href, a ação é tratada pelo componente (ex.: sair). */
  href?: string;
  palavras?: string;
};

/** Atalhos de tarefas frequentes. A ordem é a de exibição com a busca vazia. */
export const ACOES_RAPIDAS: AcaoRapida[] = [
  { id: "nova-venda", titulo: "Nova venda", subtitulo: "Abrir o caixa", icone: ShoppingBag, href: "/vendas/nova", palavras: "vender pdv caixa registrar" },
  { id: "entrada", titulo: "Dar entrada no estoque", subtitulo: "Produção ou compra", icone: PackagePlus, href: "/estoque?acao=entrada", palavras: "producao compra repor adicionar fabricar" },
  { id: "nova-vela", titulo: "Cadastrar vela", subtitulo: "Novo produto", icone: Plus, href: "/produtos/novo", palavras: "novo produto criar" },
  { id: "novo-cliente", titulo: "Cadastrar cliente", icone: UserPlus, href: "/clientes/novo", palavras: "novo cliente contato criar" },
  { id: "repor", titulo: "Velas para repor", subtitulo: "Estoque baixo ou esgotado", icone: TriangleAlert, href: "/estoque?situacao=atencao", palavras: "baixo esgotado acabando alerta faltando" },
  { id: "vendas-hoje", titulo: "Vendas de hoje", icone: Receipt, href: "/vendas?periodo=hoje", palavras: "historico dia" },
  { id: "relatorio-mes", titulo: "Relatório deste mês", icone: ChartColumn, href: "/relatorios?periodo=mes", palavras: "faturamento lucro mes" },
  { id: "saida", titulo: "Registrar perda ou saída", subtitulo: "Perda, avaria, brinde", icone: PackageMinus, href: "/estoque?acao=saida", palavras: "perda avaria quebrou brinde uso interno baixa" },
  { id: "inventario", titulo: "Conferir estoque (inventário)", subtitulo: "Informe a contagem real", icone: ClipboardList, href: "/estoque?acao=inventario", palavras: "contagem ajuste inventario conferir" },
  { id: "lote", titulo: "Entrada em lote", subtitulo: "Várias velas de uma vez", icone: Layers, href: "/estoque/lote", palavras: "producao varios fornada" },
  { id: "movimentacoes", titulo: "Movimentações do estoque", icone: ArrowLeftRight, href: "/estoque/movimentacoes", palavras: "historico entradas saidas perdas" },
  { id: "categorias", titulo: "Categorias de produtos", icone: Tags, href: "/produtos/categorias", palavras: "organizar grupos" },
  { id: "senha", titulo: "Trocar senha", icone: KeyRound, href: "/configuracoes#senha", palavras: "seguranca acesso" },
  { id: "sair", titulo: "Sair", subtitulo: "Encerrar a sessão", icone: LogOut, palavras: "logout desconectar" },
];

/** Quantas ações mostrar com a busca vazia. */
export const ACOES_INICIAIS = 5;

export const PAGINAS = TODOS_ITENS_NAV;

/** Minúsculas e sem acentos, para comparar "relatorios" com "Relatórios". */
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/** Todas as palavras do termo aparecem no texto? */
export function combina(termo: string, ...textos: (string | undefined)[]): boolean {
  const alvo = normalizar(textos.filter(Boolean).join(" "));
  return normalizar(termo)
    .split(/\s+/)
    .filter(Boolean)
    .every((p) => alvo.includes(p));
}

/* ---------- Recentes (só neste navegador) ---------- */

export type Recente = { tipo: "produto" | "cliente" | "venda"; href: string; titulo: string; subtitulo?: string };

const CHAVE_RECENTES = "luamme:paleta:recentes";
const MAX_RECENTES = 5;

export function lerRecentes(): Recente[] {
  try {
    const bruto = window.localStorage.getItem(CHAVE_RECENTES);
    const lista = bruto ? (JSON.parse(bruto) as unknown) : [];
    return Array.isArray(lista)
      ? lista.filter((r): r is Recente => !!r && typeof r.href === "string" && typeof r.titulo === "string").slice(0, MAX_RECENTES)
      : [];
  } catch {
    return [];
  }
}

export function salvarRecente(item: Recente) {
  try {
    const lista = [item, ...lerRecentes().filter((r) => r.href !== item.href)].slice(0, MAX_RECENTES);
    window.localStorage.setItem(CHAVE_RECENTES, JSON.stringify(lista));
  } catch {
    // armazenamento indisponível (aba privada): ignora
  }
}

export function limparRecentes() {
  try {
    window.localStorage.removeItem(CHAVE_RECENTES);
  } catch {
    // ignora
  }
}
