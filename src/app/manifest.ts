import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Velas Luamme",
    short_name: "Luamme",
    description: "Vendas, estoque, clientes e relatórios da Velas Luamme.",
    lang: "pt-BR",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#fbf7f1",
    theme_color: "#b0602f",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icone-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Nova venda", short_name: "Vender", url: "/vendas/nova", icons: [{ src: "/icone-192.png", sizes: "192x192" }] },
      { name: "Estoque", url: "/estoque", icons: [{ src: "/icone-192.png", sizes: "192x192" }] },
      { name: "Produtos", url: "/produtos", icons: [{ src: "/icone-192.png", sizes: "192x192" }] },
      { name: "Clientes", url: "/clientes", icons: [{ src: "/icone-192.png", sizes: "192x192" }] },
    ],
  };
}
