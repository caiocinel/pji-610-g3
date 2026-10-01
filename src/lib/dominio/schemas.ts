// Validações (zod) das entradas das Server Actions. Aceitam tanto strings vindas de FormData
// quanto números/objetos de chamadas diretas. Seguro para importar no cliente (validação prévia).
import { z } from "zod";
import {
  type Canal,
  type FormaPagamento,
  type MotivoEntrada,
  type MotivoSaida,
  type TipoDesconto,
  CANAIS,
  FORMAS_PAGAMENTO,
  MOTIVOS_ENTRADA,
  MOTIVOS_SAIDA,
  TIPOS_DESCONTO,
} from "./enums";
import { normalizarInstagram, normalizarSku, normalizarTelefone, parseDecimalBR, telefoneValido } from "./calculos";

const LIMITE_DINHEIRO = 9_999_999;
const LIMITE_QTD = 100_000;

/** "" e null viram undefined (campo não informado). */
const vazio = (v: unknown) => (v === "" || v === null ? undefined : typeof v === "string" && v.trim() === "" ? undefined : v);

/** Número decimal digitado ("39,90", "39.90", 39.9), sem arredondar. */
const decimal = (rotulo: string) =>
  z
    .union([z.number(), z.string()], { error: `${rotulo}: informe um valor.` })
    .transform((v) => parseDecimalBR(v))
    .pipe(
      z
        .number({ error: `${rotulo}: valor inválido.` })
        .refine(Number.isFinite, `${rotulo}: valor inválido.`)
        .min(0, `${rotulo} não pode ser negativo.`)
        .max(LIMITE_DINHEIRO, `${rotulo}: valor alto demais.`),
    );

/** Valor em R$ (aceita "39,90", "39.90", 39.9), arredondado aos centavos. */
export const dinheiro = (rotulo: string) => decimal(rotulo).transform((n) => Math.round(n * 100) / 100);

/** Valor em R$ opcional: vazio → null. */
export const dinheiroOpcional = (rotulo: string) =>
  z.preprocess(vazio, dinheiro(rotulo).nullable().optional()).transform((v) => v ?? null);

/** Inteiro (aceita "12" ou 12). */
export const inteiro = (rotulo: string, min = 0, max = 1_000_000) =>
  z
    .union([z.number(), z.string()], { error: `${rotulo}: informe um número.` })
    .transform((v) => (typeof v === "string" ? (v.trim() === "" ? NaN : Number(v.trim().replace(",", "."))) : v))
    .pipe(
      z
        .number({ error: `${rotulo}: número inválido.` })
        .int(`${rotulo} deve ser um número inteiro.`)
        .min(min, min === 1 ? `${rotulo} deve ser maior que zero.` : `${rotulo} não pode ser menor que ${min}.`)
        .max(max, `${rotulo} não pode passar de ${max.toLocaleString("pt-BR")}.`),
    );

/** Inteiro opcional: vazio → null. */
export const inteiroOpcional = (rotulo: string, min = 0, max = 1_000_000) =>
  z.preprocess(vazio, inteiro(rotulo, min, max).nullable().optional()).transform((v) => v ?? null);

/** Id obrigatório (> 0). */
export const id = (mensagem = "Registro inválido.") =>
  z.coerce.number({ error: mensagem }).int(mensagem).positive(mensagem);

/** Id opcional: vazio/0/null → null. */
export const idOpcional = () =>
  z
    .preprocess((v) => (v === "" || v === null || v === undefined || v === 0 || v === "0" ? null : v), id().nullable())
    .optional()
    .transform((v) => v ?? null);

/** Texto livre (trim), vazio permitido. */
export const texto = (rotulo: string, max: number) =>
  z
    .preprocess((v) => (v == null ? "" : v), z.string({ error: `${rotulo} inválido.` }))
    .transform((s) => s.trim())
    .pipe(z.string().max(max, `${rotulo}: no máximo ${max} caracteres.`));

/** Texto obrigatório (trim, não vazio). */
export const textoObrigatorio = (rotulo: string, max: number, mensagemVazio?: string) =>
  texto(rotulo, max).pipe(z.string().min(1, mensagemVazio ?? `Informe ${rotulo.toLowerCase()}.`));

const enumComPadrao = <T extends readonly [string, ...string[]]>(valores: T, padrao: T[number], erro: string) =>
  z.preprocess(vazio, z.enum(valores, { error: erro }).optional()).transform((v) => (v ?? padrao) as T[number]);

/** Array (ou JSON de array, vindo de FormData) com tamanho mínimo/máximo. */
const lista = <T extends z.ZodType>(item: T, min: number, max: number, msgVazia: string) =>
  z.preprocess(
    (v) => {
      if (typeof v !== "string") return v;
      try {
        return JSON.parse(v);
      } catch {
        return v;
      }
    },
    z.array(item, { error: "Lista de itens inválida." }).min(min, msgVazia).max(max, `No máximo ${max} itens.`),
  );

// ---------- Produtos ----------

export const produtoCampos = {
  nome: textoObrigatorio("Nome", 120, "Informe o nome da vela."),
  aroma: textoObrigatorio("Aroma", 120, "Informe o aroma."),
  descricao: texto("Descrição", 2000),
  categoria_id: idOpcional(),
  preco: dinheiro("Preço").refine((v) => v > 0, "Informe um preço maior que zero."),
  custo: dinheiro("Custo"),
  sku: texto("SKU", 40).transform(normalizarSku),
  peso_g: inteiroOpcional("Peso (g)", 1, 100_000),
  tempo_queima_h: inteiroOpcional("Tempo de queima (h)", 1, 10_000),
  estoque_minimo: inteiro("Estoque mínimo", 0, 1_000_000),
};

export const criarProdutoSchema = z.object({
  ...produtoCampos,
  custo: z.preprocess((v) => vazio(v) ?? 0, produtoCampos.custo),
  // Ausente → usa o "estoque mínimo padrão" das configurações.
  estoque_minimo: z.preprocess(vazio, produtoCampos.estoque_minimo.optional()),
  estoque_inicial: z.preprocess((v) => vazio(v) ?? 0, inteiro("Estoque inicial", 0, 1_000_000)),
});

/** Edição parcial: campo AUSENTE mantém o valor atual; campo presente e vazio limpa (nos opcionais). */
export const editarProdutoSchema = z.object({ id: id("Produto inválido.") }).extend(
  Object.fromEntries(Object.entries(produtoCampos).map(([k, s]) => [k, s.optional()])) as {
    [K in keyof typeof produtoCampos]: z.ZodOptional<(typeof produtoCampos)[K]>;
  },
);

// ---------- Categorias ----------

export const categoriaNome = textoObrigatorio("Nome da categoria", 60, "Informe o nome da categoria.");
export const criarCategoriaSchema = z.object({ nome: categoriaNome });
export const renomearCategoriaSchema = z.object({ id: id("Categoria inválida."), nome: categoriaNome });

// ---------- Estoque ----------

const produtoId = id("Selecione um produto.");
const quantidade = inteiro("Quantidade", 1, LIMITE_QTD);

export const entradaEstoqueSchema = z.object({
  produto_id: produtoId,
  quantidade,
  motivo: enumComPadrao(MOTIVOS_ENTRADA, "producao", "Motivo de entrada inválido."),
  observacao: texto("Observação", 300),
});

export const saidaEstoqueSchema = z.object({
  produto_id: produtoId,
  quantidade,
  motivo: z.enum(MOTIVOS_SAIDA, { error: "Escolha o motivo da saída." }),
  observacao: texto("Observação", 300),
});

export const ajusteInventarioSchema = z.object({
  produto_id: produtoId,
  contagem: inteiro("Contagem", 0, 1_000_000),
  observacao: texto("Observação", 300),
});

const itemQtd = z.object({ produto_id: produtoId, quantidade });

export const entradaLoteSchema = z.object({
  itens: lista(itemQtd, 1, 500, "Informe a quantidade de pelo menos um produto."),
  motivo: enumComPadrao(MOTIVOS_ENTRADA, "producao", "Motivo de entrada inválido."),
  observacao: texto("Observação", 300),
});

// ---------- Vendas ----------

const itemVenda = z.preprocess(
  // Compatibilidade com o formato da v1 ({ produtoId }).
  (v) => (v && typeof v === "object" && "produtoId" in v && !("produto_id" in v) ? { ...v, produto_id: (v as { produtoId: unknown }).produtoId } : v),
  // preco_esperado: preço que a tela mostrou (opcional); se mudou no banco, a venda é recusada.
  itemQtd.extend({ preco_esperado: dinheiroOpcional("Preço") }),
);

export const registrarVendaSchema = z
  .object({
    itens: lista(itemVenda, 1, 200, "Adicione pelo menos um produto à venda."),
    /** Total que a usuária confirmou (opcional); se o recalculado divergir, a venda é recusada. */
    total_esperado: dinheiroOpcional("Total"),
    cliente_id: idOpcional(),
    forma_pagamento: enumComPadrao(FORMAS_PAGAMENTO, "pix", "Forma de pagamento inválida."),
    canal: enumComPadrao(CANAIS, "loja", "Canal de venda inválido."),
    desconto_tipo: enumComPadrao(TIPOS_DESCONTO, "valor", "Tipo de desconto inválido."),
    // Sem arredondar aqui: em "percentual" o % vale como digitado (igual à prévia do PDV, que chama
    // calcularDesconto com o mesmo número); em "valor" arredonda aos centavos no transform abaixo.
    desconto_valor: z.preprocess((v) => vazio(v) ?? 0, decimal("Desconto")),
    valor_recebido: dinheiroOpcional("Valor recebido"),
    observacao: texto("Observação", 300),
    /** UUID gerado pelo PDV para esta venda: reenviar o mesmo não registra a venda de novo. */
    chave_idempotencia: z
      .preprocess(vazio, z.uuid("Identificador da venda inválido. Recarregue a página.").optional())
      .transform((v) => v?.toLowerCase() ?? null),
  })
  .transform((v) => ({
    ...v,
    desconto_valor: v.desconto_tipo === "valor" ? Math.round(v.desconto_valor * 100) / 100 : v.desconto_valor,
  }));

export const cancelarVendaSchema = z.object({
  id: id("Venda inválida."),
  motivo: textoObrigatorio("Motivo", 300, "Informe o motivo do cancelamento."),
});

// ---------- Clientes ----------

export const clienteCampos = {
  nome: textoObrigatorio("Nome", 120, "Informe o nome do cliente."),
  telefone: texto("Telefone", 30)
    .refine(telefoneValido, "Telefone inválido: informe DDD + número (ex.: 11 98765-4321).")
    .transform(normalizarTelefone),
  email: texto("E-mail", 160).pipe(z.union([z.literal(""), z.email("E-mail inválido.")])),
  instagram: texto("Instagram", 60).transform(normalizarInstagram),
  observacoes: texto("Observações", 1000),
};

export const criarClienteSchema = z.object(clienteCampos);

export const editarClienteSchema = z.object({ id: id("Cliente inválido.") }).extend(
  Object.fromEntries(Object.entries(clienteCampos).map(([k, s]) => [k, s.optional()])) as {
    [K in keyof typeof clienteCampos]: z.ZodOptional<(typeof clienteCampos)[K]>;
  },
);

// ---------- Configurações ----------

export const configuracoesSchema = z.object({
  loja_nome: textoObrigatorio("Nome da loja", 80, "Informe o nome da loja."),
  loja_telefone: texto("Telefone", 30)
    .refine(telefoneValido, "Telefone inválido: informe DDD + número.")
    .transform(normalizarTelefone),
  loja_instagram: texto("Instagram", 60).transform(normalizarInstagram),
  loja_endereco: texto("Endereço", 200),
  recibo_rodape: texto("Rodapé do recibo", 300),
  estoque_minimo_padrao: inteiro("Estoque mínimo padrão", 0, 100_000),
});

export const trocarSenhaSchema = z
  .object({
    senha_atual: z.string({ error: "Informe a senha atual." }).min(1, "Informe a senha atual."),
    nova_senha: z
      .string({ error: "Informe a nova senha." })
      .min(8, "A nova senha precisa ter pelo menos 8 caracteres.")
      .max(128, "A nova senha pode ter no máximo 128 caracteres."),
    confirmacao: z.string({ error: "Confirme a nova senha." }),
  })
  .refine((d) => d.nova_senha === d.confirmacao, { message: "A confirmação não confere com a nova senha.", path: ["confirmacao"] })
  .refine((d) => d.nova_senha !== d.senha_atual, { message: "A nova senha deve ser diferente da atual.", path: ["nova_senha"] });

// ---------- Tipos de entrada para chamadas diretas ----------
// (FormData também é aceito: os mesmos nomes de campo, valores em texto.)

/** Números podem vir como number ou texto digitado ("39,90"). */
type Num = number | string;
type NumOpcional = Num | null | undefined;

export type CriarProdutoInput = {
  nome: string;
  aroma: string;
  descricao?: string;
  categoria_id?: number | string | null;
  preco: Num;
  custo?: NumOpcional;
  sku?: string | null;
  peso_g?: NumOpcional;
  tempo_queima_h?: NumOpcional;
  /** Ausente → estoque mínimo padrão das configurações. */
  estoque_minimo?: NumOpcional;
  estoque_inicial?: NumOpcional;
};

/** Só `id` é obrigatório; campos ausentes mantêm o valor atual; "" ou null limpa os opcionais. */
export type EditarProdutoInput = { id: number | string } & Partial<Omit<CriarProdutoInput, "estoque_inicial">>;

export type EntradaEstoqueInput = {
  produto_id: number | string;
  quantidade: Num;
  /** Padrão: "producao". */
  motivo?: MotivoEntrada;
  observacao?: string;
};

export type SaidaEstoqueInput = {
  produto_id: number | string;
  quantidade: Num;
  motivo: MotivoSaida;
  observacao?: string;
};

export type AjusteInventarioInput = {
  produto_id: number | string;
  /** Quantidade contada fisicamente. */
  contagem: Num;
  observacao?: string;
};

export type ItemQuantidade = { produto_id: number; quantidade: number };

export type EntradaLoteInput = {
  /** Array ou JSON.stringify do array. */
  itens: ItemQuantidade[] | string;
  motivo?: MotivoEntrada;
  observacao?: string;
};

export type RegistrarVendaInput = {
  /** Array ou JSON.stringify do array. Produtos repetidos são somados. */
  itens: (ItemQuantidade & { preco_esperado?: NumOpcional })[] | string;
  /** Total visto na confirmação; divergência do recalculado no servidor → recusa com aviso. */
  total_esperado?: NumOpcional;
  cliente_id?: number | string | null;
  /** Padrão: "pix". */
  forma_pagamento?: FormaPagamento;
  /** Padrão: "loja". */
  canal?: Canal;
  /** Padrão: "valor" (R$). Em "percentual", desconto_valor vai de 0 a 100. */
  desconto_tipo?: TipoDesconto;
  desconto_valor?: NumOpcional;
  /** Só considerado quando forma_pagamento = "dinheiro"; deve ser >= total. */
  valor_recebido?: NumOpcional;
  observacao?: string;
  /**
   * UUID desta venda (ex.: crypto.randomUUID()): mantenha o mesmo enquanto a venda não muda (inclusive
   * ao tentar de novo após erro de rede) e gere outro depois do sucesso. Chave repetida devolve a venda
   * já registrada, sem duplicar.
   */
  chave_idempotencia?: string | null;
};

export type CancelarVendaInput = { id: number | string; motivo: string };

export type CriarClienteInput = {
  nome: string;
  telefone?: string;
  email?: string;
  instagram?: string;
  observacoes?: string;
};

export type EditarClienteInput = { id: number | string } & Partial<CriarClienteInput>;

export type ConfiguracoesInput = {
  loja_nome: string;
  loja_telefone: string;
  loja_instagram: string;
  loja_endereco: string;
  recibo_rodape: string;
  estoque_minimo_padrao: Num;
};

export type TrocarSenhaInput = { senha_atual: string; nova_senha: string; confirmacao: string };
