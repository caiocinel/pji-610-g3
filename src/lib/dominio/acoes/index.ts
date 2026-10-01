// Todas as Server Actions de escrita da v2 (cada módulo é "use server").
export { criarProduto, editarProduto, duplicarProduto, desativarProduto, reativarProduto } from "./produtos";
export { criarCategoria, renomearCategoria, excluirCategoria } from "./categorias";
export { registrarEntrada, registrarSaida, ajustarInventario, entradaEmLote } from "./estoque";
export type { DadosMovimentacao } from "./estoque";
export { registrarVenda, cancelarVenda } from "./vendas";
export type { DadosVenda } from "./vendas";
export { criarCliente, editarCliente, desativarCliente, reativarCliente } from "./clientes";
export type { ClienteCriado } from "./clientes";
export { salvarConfiguracoes, trocarSenha } from "./configuracoes";
