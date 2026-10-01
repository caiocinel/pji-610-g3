import {
  Boxes,
  ChartColumn,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  ShoppingBag,
  Users,
  type LucideIcon,
} from "lucide-react";

export type ItemNav = {
  href: string;
  rotulo: string;
  /** Rótulo curto para a barra inferior do celular. */
  rotuloCurto?: string;
  icone: LucideIcon;
  /** Palavras extras para a busca da paleta de comandos. */
  palavras?: string;
  /** Mostra a contagem de alertas de estoque ao lado. */
  alertaEstoque?: boolean;
  destaque?: boolean;
};

export type GrupoNav = { titulo: string; itens: ItemNav[] };

export const NAV_DASHBOARD: ItemNav = {
  href: "/",
  rotulo: "Dashboard",
  rotuloCurto: "Início",
  icone: LayoutDashboard,
  palavras: "inicio painel resumo home",
};
export const NAV_RELATORIOS: ItemNav = {
  href: "/relatorios",
  rotulo: "Relatórios",
  icone: ChartColumn,
  palavras: "graficos faturamento lucro ranking",
};
export const NAV_NOVA_VENDA: ItemNav = {
  href: "/vendas/nova",
  rotulo: "Nova venda",
  rotuloCurto: "Vender",
  icone: ShoppingBag,
  palavras: "vender pdv caixa",
  destaque: true,
};
export const NAV_VENDAS: ItemNav = {
  href: "/vendas",
  rotulo: "Vendas",
  icone: Receipt,
  palavras: "historico pedidos recibos",
};
export const NAV_ESTOQUE: ItemNav = {
  href: "/estoque",
  rotulo: "Estoque",
  icone: Boxes,
  palavras: "entrada saida inventario",
  alertaEstoque: true,
};
export const NAV_PRODUTOS: ItemNav = {
  href: "/produtos",
  rotulo: "Produtos",
  icone: Package,
  palavras: "velas catalogo precos",
};
export const NAV_CLIENTES: ItemNav = {
  href: "/clientes",
  rotulo: "Clientes",
  icone: Users,
  palavras: "contatos compradores",
};
export const NAV_CONFIGURACOES: ItemNav = {
  href: "/configuracoes",
  rotulo: "Configurações",
  icone: Settings,
  palavras: "loja senha recibo ajustes",
};

/** Grupos da barra lateral (o "Sair" fica no fim do grupo Sistema). */
export const GRUPOS_NAV: GrupoNav[] = [
  { titulo: "Visão geral", itens: [NAV_DASHBOARD, NAV_RELATORIOS] },
  { titulo: "Operação", itens: [NAV_NOVA_VENDA, NAV_VENDAS, NAV_ESTOQUE] },
  { titulo: "Cadastros", itens: [NAV_PRODUTOS, NAV_CLIENTES] },
  { titulo: "Sistema", itens: [NAV_CONFIGURACOES] },
];

export const TODOS_ITENS_NAV: ItemNav[] = GRUPOS_NAV.flatMap((g) => g.itens);

/** Barra inferior do celular: Início, Vendas, [Nova venda], Estoque + "Mais". */
export const NAV_INFERIOR_ESQUERDA: ItemNav[] = [NAV_DASHBOARD, NAV_VENDAS];
export const NAV_INFERIOR_DIREITA: ItemNav[] = [NAV_ESTOQUE];
/** Itens que ficam no menu "Mais" do celular. */
export const NAV_MAIS: ItemNav[] = [NAV_PRODUTOS, NAV_CLIENTES, NAV_RELATORIOS, NAV_CONFIGURACOES];

/** O item está ativo na rota atual? "/vendas" não acende em "/vendas/nova". */
export function itemAtivo(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/vendas") return pathname === "/vendas" || (/^\/vendas\/\d/.test(pathname));
  return pathname === href || pathname.startsWith(`${href}/`);
}

export const COOKIE_SIDEBAR = "luamme_sidebar";
