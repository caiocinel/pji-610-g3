// Popula o banco com dados de demonstração de uma fábrica de velas (APAGA produtos, vendas,
// clientes, categorias e movimentações existentes). Determinístico: mesma saída a cada execução
// (exceto as datas, que são relativas a hoje).
//
// Uso: node --env-file=.env.local scripts/seed.mjs [--force]
// Recusa rodar se DATABASE_URL não contiver "staging" (use --force por sua conta e risco).
import pg from "pg";

const url = process.env.DATABASE_URL ?? "";
if (!url) {
  console.error("DATABASE_URL não definida. Use: node --env-file=.env.local scripts/seed.mjs");
  process.exit(1);
}
if (!url.includes("staging") && !process.argv.includes("--force")) {
  console.error("Recusado: DATABASE_URL não parece ser de staging. Este script APAGA dados. Use --force se tiver certeza.");
  process.exit(1);
}

// ---------- Aleatoriedade determinística ----------
let semente = 610_003;
function rnd() {
  semente |= 0;
  semente = (semente + 0x6d2b79f5) | 0;
  let t = Math.imul(semente ^ (semente >>> 15), 1 | semente);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const entre = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const chance = (p) => rnd() < p;
const escolher = (lista) => lista[Math.floor(rnd() * lista.length)];
function ponderado(itens, peso) {
  const total = itens.reduce((s, i) => s + peso(i), 0);
  let r = rnd() * total;
  for (const i of itens) {
    r -= peso(i);
    if (r <= 0) return i;
  }
  return itens[itens.length - 1];
}
const cent = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

// ---------- Datas (fuso de São Paulo, UTC−3 fixo desde 2019) ----------
const DIAS = 120;
const hojeSP = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
function diaRelativo(offset) {
  const [y, m, d] = hojeSP.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
}
function instante(ymd, hora, minuto = 0) {
  return new Date(`${ymd}T${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}:00-03:00`);
}
const agora = new Date();

// ---------- Cadastros ----------
const CATEGORIAS = [
  "Velas em pote",
  "Velas em lata",
  "Velas pilar",
  "Velas massageadoras",
  "Home spray e difusores",
  "Kits presente",
];

// [nome, aroma, categoria(índice), preço, custo, peso_g, queima_h, popularidade, destino]
// destino: "ok" | "baixo" | "esgotado"
const PRODUTOS = [
  ["Vela Pote Âmbar 200g", "Lavanda e Alecrim", 0, 59.9, 21.4, 200, 40, 10, "ok"],
  ["Vela Pote Âmbar 200g", "Baunilha com Canela", 0, 59.9, 21.9, 200, 40, 12, "ok"],
  ["Vela Pote Âmbar 200g", "Flor de Laranjeira", 0, 59.9, 22.3, 200, 40, 7, "baixo"],
  ["Vela Pote Âmbar 200g", "Capim-limão", 0, 54.9, 19.8, 200, 40, 8, "ok"],
  ["Vela Pote Vidro 120g", "Algodão Egípcio", 0, 39.9, 13.5, 120, 25, 9, "ok"],
  ["Vela Pote Vidro 120g", "Erva-doce", 0, 39.9, 13.2, 120, 25, 5, "ok"],
  ["Vela Pote Vidro 120g", "Maracujá", 0, 39.9, 13.8, 120, 25, 4, "esgotado"],
  ["Vela Lata Viagem 80g", "Lavanda", 1, 29.9, 9.6, 80, 18, 9, "ok"],
  ["Vela Lata Viagem 80g", "Café Torrado", 1, 29.9, 10.2, 80, 18, 6, "baixo"],
  ["Vela Lata Viagem 80g", "Chá Branco", 1, 29.9, 9.9, 80, 18, 5, "ok"],
  ["Vela Lata Viagem 80g", "Pitanga", 1, 29.9, 9.7, 80, 18, 3, "ok"],
  ["Vela Pilar Rústica P", "Sem aroma", 2, 34.9, 11.2, 250, 35, 4, "ok"],
  ["Vela Pilar Rústica G", "Sândalo", 2, 69.9, 27.5, 500, 70, 3, "ok"],
  ["Vela Pilar Rústica G", "Cedro e Musgo", 2, 69.9, 28.1, 500, 70, 3, "baixo"],
  ["Vela Massageadora 100g", "Amêndoas Doces", 3, 64.9, 24.0, 100, 15, 5, "ok"],
  ["Vela Massageadora 100g", "Coco e Baunilha", 3, 64.9, 24.6, 100, 15, 4, "ok"],
  ["Vela Massageadora 100g", "Rosas Brancas", 3, 64.9, 25.3, 100, 15, 3, "esgotado"],
  ["Home Spray 250ml", "Lavanda e Alecrim", 4, 49.9, 16.8, null, null, 6, "ok"],
  ["Home Spray 250ml", "Bambu", 4, 49.9, 16.2, null, null, 5, "ok"],
  ["Difusor de Varetas 250ml", "Flor de Algodão", 4, 79.9, 31.5, null, null, 5, "ok"],
  ["Difusor de Varetas 250ml", "Alecrim e Hortelã", 4, 79.9, 31.9, null, null, 3, "ok"],
  ["Kit Presente Mini (3 latas)", "Sortido", 5, 79.9, 30.5, 240, 54, 4, "ok"],
  ["Kit Presente Relax", "Lavanda e Alecrim", 5, 129.9, 52.0, 450, 55, 3, "ok"],
  ["Kit Presente Romance", "Rosas Brancas", 5, 149.9, 61.4, 400, 55, 2, "ok"],
  ["Vela Pote Natal 200g", "Cravo, Canela e Laranja", 0, 64.9, 23.8, 200, 40, 2, "ok"],
];

const DESCRICOES = {
  0: "Cera vegetal de soja, pavio de algodão e fragrância de alta fixação. Pote reutilizável.",
  1: "Lata com tampa, ideal para levar na bolsa ou presentear. Cera vegetal de soja.",
  2: "Vela pilar artesanal moldada à mão, acabamento rústico.",
  3: "Derrete em óleo morno para massagem. Com manteiga de karité e óleo de amêndoas.",
  4: "Perfume para ambientes com fragrância exclusiva Luamme.",
  5: "Embalagem presente com laço e cartão escrito à mão.",
};

const NOMES = [
  ["Ana Carolina Souza", "11"], ["Beatriz Lima", "11"], ["Camila Ferreira", "11"], ["Daniela Rocha", "19"],
  ["Eduarda Martins", "11"], ["Fernanda Alves", "11"], ["Gabriela Ribeiro", "21"], ["Helena Duarte", "11"],
  ["Isabela Gomes", "11"], ["Juliana Pereira", "11"], ["Larissa Barbosa", "19"], ["Mariana Costa", "11"],
  ["Natália Mendes", "11"], ["Patrícia Cardoso", "11"], ["Renata Teixeira", "13"], ["Sabrina Moreira", "11"],
  ["Tatiane Araújo", "11"], ["Vanessa Nunes", "11"], ["Lucas Oliveira", "11"], ["Rafael Santos", "11"],
  ["Thiago Carvalho", "19"], ["Bruno Almeida", "11"], ["Marcos Vieira", "11"], ["Paula Fernandes", "11"],
  ["Cláudia Monteiro", "11"], ["Luciana Prado", "12"], ["Aline Castro", "11"], ["Priscila Dias", "11"],
  ["Rosana Freitas", "11"], ["Simone Azevedo", "15"],
];
const OBS_CLIENTES = [
  "Prefere aromas florais.",
  "Compra para presentear a mãe.",
  "Revende no salão de beleza.",
  "Alérgica a canela.",
  "Sempre pede embalagem de presente.",
  "Conheceu na feira do bairro.",
];

const sem = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

// ---------- Montagem dos dados em memória ----------
const categorias = CATEGORIAS.map((nome, i) => ({
  id: i + 1,
  nome,
  criado_em: instante(diaRelativo(-DIAS - 5), 10),
}));

const produtos = PRODUTOS.map(([nome, aroma, cat, preco, custo, peso, queima, pop, destino], i) => {
  const sigla = sem(aroma).replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).map((p) => p[0]).join("").toUpperCase();
  return {
    id: i + 1,
    nome,
    aroma,
    descricao: DESCRICOES[cat],
    categoria_id: cat + 1,
    preco,
    custo,
    sku: `LU-${String(cat + 1).padStart(2, "0")}${String(i + 1).padStart(2, "0")}-${sigla.slice(0, 3)}`,
    peso_g: peso,
    tempo_queima_h: queima,
    estoque: 0,
    estoque_minimo: cat === 5 ? 3 : cat === 2 ? 4 : 6,
    ativo: true,
    criado_em: instante(diaRelativo(-DIAS - 1), 9, i),
    atualizado_em: agora,
    pop,
    destino,
  };
});
// Um produto descontinuado (inativo), para testar filtros.
produtos.push({
  ...produtos[10],
  id: produtos.length + 1,
  nome: "Vela Lata Viagem 80g (edição antiga)",
  aroma: "Melancia",
  sku: null,
  pop: 0,
  destino: "inativo",
});

const clientes = NOMES.map(([nome, ddd], i) => {
  const primeiro = sem(nome.split(" ")[0]).toLowerCase();
  const ultimo = sem(nome.split(" ").at(-1)).toLowerCase();
  const tel = `${ddd}9${String(entre(6000, 9999))}${String(entre(1000, 9999))}`;
  return {
    id: i + 1,
    nome,
    telefone: chance(0.92) ? tel : "",
    email: chance(0.6) ? `${primeiro}.${ultimo}@${escolher(["gmail.com", "hotmail.com", "outlook.com", "yahoo.com.br"])}` : "",
    instagram: chance(0.5) ? `${primeiro}${escolher(["", ".", "_"])}${ultimo}${chance(0.3) ? entre(1, 99) : ""}` : "",
    observacoes: chance(0.25) ? escolher(OBS_CLIENTES) : "",
    ativo: i !== 29,
    criado_em: instante(diaRelativo(-DIAS + Math.floor((i / NOMES.length) * (DIAS - 10))), entre(9, 19), entre(0, 59)),
    atualizado_em: agora,
    // clientes fiéis compram mais
    peso: i < 6 ? 6 : i < 15 ? 3 : 1,
  };
});

const vendas = [];
const itens = [];
const movs = [];

function mover(p, tipo, quantidade, motivo, quando, observacao = "", vendaId = null) {
  p.estoque += tipo === "entrada" ? quantidade : -quantidade;
  if (p.estoque < 0) throw new Error(`Estoque negativo em ${p.nome}`);
  movs.push({
    id: movs.length + 1,
    produto_id: p.id,
    tipo,
    quantidade,
    observacao,
    venda_id: vendaId,
    criado_em: quando,
    motivo,
    saldo_apos: p.estoque,
  });
}

const FORMAS = [
  ["pix", 45],
  ["cartao_credito", 20],
  ["cartao_debito", 15],
  ["dinheiro", 15],
  ["outro", 5],
];
const CANAIS_SEMANA = [
  ["loja", 32],
  ["whatsapp", 28],
  ["instagram", 22],
  ["site", 12],
  ["outro", 6],
];
const OBS_VENDA = ["Embalagem para presente", "Retirada no ateliê", "Entregar na portaria", "Pediu cartão escrito à mão", ""];

function registrarVenda(quando, linhas, opcoes = {}) {
  const id = vendas.length + 1;
  const cliente = opcoes.cliente !== undefined ? opcoes.cliente : chance(0.62) ? ponderado(clientes.filter((c) => c.criado_em <= quando), (c) => c.peso) : null;
  const forma = opcoes.forma ?? ponderado(FORMAS, (f) => f[1])[0];
  const canal = opcoes.canal ?? ponderado(CANAIS_SEMANA, (c) => c[1])[0];
  const subtotal = cent(linhas.reduce((s, l) => s + cent(l.p.preco * l.q), 0));
  let desconto = 0;
  if (opcoes.semDesconto !== true && chance(0.14)) {
    const tipo = escolher(["p5", "p10", "v5", "v10"]);
    desconto = tipo === "p5" ? cent(subtotal * 0.05) : tipo === "p10" ? cent(subtotal * 0.1) : tipo === "v5" ? 5 : 10;
    if (desconto >= subtotal) desconto = 0;
  }
  const total = cent(subtotal - desconto);
  let valorRecebido = null;
  if (forma === "dinheiro") {
    const notas = [total, Math.ceil(total / 10) * 10, Math.ceil(total / 50) * 50, Math.ceil(total / 100) * 100];
    valorRecebido = cent(escolher(notas));
  }
  vendas.push({
    id,
    data: quando,
    total,
    observacao: chance(0.2) ? escolher(OBS_VENDA) : "",
    cliente_id: cliente?.id ?? null,
    forma_pagamento: forma,
    canal,
    subtotal,
    desconto,
    valor_recebido: valorRecebido,
    status: "concluida",
    cancelada_em: null,
    motivo_cancelamento: null,
  });
  for (const l of linhas) {
    itens.push({
      id: itens.length + 1,
      venda_id: id,
      produto_id: l.p.id,
      produto_nome: l.p.nome,
      quantidade: l.q,
      preco_unitario: l.p.preco,
      subtotal: cent(l.p.preco * l.q),
      custo_unitario: l.p.custo,
    });
    mover(l.p, "saida", l.q, "venda", quando, `Venda #${id}`, id);
  }
  return vendas[id - 1];
}

function cancelar(venda, quando, motivo) {
  venda.status = "cancelada";
  venda.cancelada_em = quando;
  venda.motivo_cancelamento = motivo;
  for (const it of itens.filter((i) => i.venda_id === venda.id)) {
    const p = produtos[it.produto_id - 1];
    mover(p, "entrada", it.quantidade, "cancelamento_venda", quando, `Cancelamento da venda #${venda.id}`, venda.id);
  }
}

// Estoque inicial
const dia0 = diaRelativo(-DIAS);
for (const p of produtos) {
  if (p.destino === "inativo") {
    mover(p, "entrada", 6, "estoque_inicial", instante(dia0, 8, 30), "Estoque inicial");
    continue;
  }
  mover(p, "entrada", entre(12, 30), "estoque_inicial", instante(dia0, 8, 30 + (p.id % 25)), "Estoque inicial");
}

const MOTIVOS_CANCEL = [
  "Cliente desistiu da compra",
  "Pagamento não confirmado",
  "Produto com defeito na entrega",
  "Venda lançada em duplicidade",
  "Troca por outro aroma",
];

// Fila de eventos em ordem cronológica: garante que saldo_apos e os ids sigam o tempo.
const fila = [];
const agendar = (t, fn) => fila.push({ t, fn });
function processarAte(limite) {
  for (;;) {
    fila.sort((x, y) => x.t - y.t);
    if (fila.length === 0 || fila[0].t >= limite) return;
    const ev = fila.shift();
    ev.fn(ev.t);
  }
}

for (let d = -DIAS; d <= 0; d++) {
  const ymd = diaRelativo(d);
  const dow = new Date(`${ymd}T12:00:00Z`).getUTCDay(); // 0 = domingo
  // Produtos que vão terminar esgotados param de ser produzidos 40 dias antes; os de estoque baixo, 12 dias antes.
  const parouProducao = (p) => (p.destino === "esgotado" && d > -40) || (p.destino === "baixo" && d > -12);

  // Produção semanal (segunda, fim da tarde).
  if (dow === 1 && d < 0) {
    agendar(instante(ymd, 16, 30), (t) => {
      for (const p of produtos) {
        if (p.categoria_id === 5 || p.destino === "inativo") continue;
        if (parouProducao(p)) continue;
        if (p.estoque < p.estoque_minimo + 8) {
          mover(p, "entrada", entre(10, 24), "producao", t, escolher(["Lote da semana", "Produção", "Fim da produção de segunda", ""]));
        }
      }
    });
  }
  // Sprays e difusores são comprados de fornecedor (dias 1 e 15).
  if ((ymd.endsWith("-01") || ymd.endsWith("-15")) && d < 0) {
    agendar(instante(ymd, 11, 15), (t) => {
      for (const p of produtos.filter((x) => x.categoria_id === 5)) {
        if (p.estoque < 15) mover(p, "entrada", entre(12, 20), "compra", t, "Pedido ao fornecedor");
      }
    });
  }

  // Vendas do dia
  const base = dow === 0 ? 1 : dow === 6 ? 3.4 : dow === 5 ? 2.6 : 1.8;
  const sazonal = d > -20 ? 1.25 : 1; // movimento crescente perto do fim do período
  let n = Math.max(0, Math.round(base * sazonal + (rnd() - 0.5) * 2.2));
  if (d === 0) n = Math.min(n, 2);
  for (let k = 0; k < n; k++) {
    const quando = instante(ymd, dow === 6 ? entre(9, 17) : entre(9, 20), entre(0, 59));
    if (quando > agora) continue;
    agendar(quando, (t) => {
      const disponiveis = produtos.filter((p) => p.ativo && p.estoque > 0 && p.destino !== "inativo");
      if (disponiveis.length === 0) return;
      const qtdItens = ponderado([1, 2, 3], (x) => (x === 1 ? 6 : x === 2 ? 3 : 1));
      const linhas = [];
      for (let j = 0; j < qtdItens; j++) {
        const restantes = disponiveis.filter((x) => !linhas.some((l) => l.p === x));
        if (restantes.length === 0) break;
        const p = ponderado(restantes, (x) => x.pop);
        const q = Math.min(p.estoque, ponderado([1, 2, 3], (x) => (x === 1 ? 7 : x === 2 ? 3 : 1)));
        if (q > 0) linhas.push({ p, q });
      }
      if (linhas.length === 0) return;
      const canal = dow === 6 && chance(0.55) ? "feira" : undefined;
      const venda = registrarVenda(t, linhas, { canal });
      if (d < -5 && chance(0.05)) {
        agendar(new Date(t.getTime() + entre(20, 600) * 60_000), (tc) => cancelar(venda, tc, escolher(MOTIVOS_CANCEL)));
      }
    });
  }

  // Perdas, avarias e uso interno ocasionais
  if (chance(0.07) && d < 0) {
    agendar(instante(ymd, 18, entre(0, 59)), (t) => {
      const candidatos = produtos.filter((x) => x.estoque > 2 && x.destino !== "inativo");
      if (candidatos.length === 0) return;
      const p = escolher(candidatos);
      const motivo = escolher(["perda", "avaria", "avaria", "uso_interno"]);
      const obs = { perda: "Quebrou no transporte", avaria: "Pavio torto / superfície rachada", uso_interno: "Brinde para cliente fiel" }[motivo];
      mover(p, "saida", entre(1, 2), motivo, t, obs);
    });
  }

  // Inventário no último dia de cada mês: pequenas diferenças em alguns produtos.
  if (diaRelativo(d + 1).endsWith("-01") && d < 0) {
    agendar(instante(ymd, 21, 30), (t) => {
      for (const p of produtos.filter((x) => x.estoque > 3 && x.destino !== "inativo" && chance(0.15))) {
        const dif = escolher([-2, -1, 1]);
        mover(p, dif > 0 ? "entrada" : "saida", Math.abs(dif), "ajuste_inventario", t, `Contagem: ${p.estoque + dif}`);
      }
    });
  }

  // Três dias atrás: garante produtos esgotados e com estoque baixo para a demonstração.
  if (d === -3) {
    agendar(instante(ymd, 15, 10), (t) => {
      for (const p of produtos) {
        const alvo = p.destino === "esgotado" ? 0 : p.destino === "baixo" ? Math.max(1, p.estoque_minimo - 3) : null;
        if (alvo == null || p.estoque <= alvo) continue;
        registrarVenda(new Date(t.getTime() + p.id * 60_000), [{ p, q: p.estoque - alvo }], {
          canal: "whatsapp",
          forma: "pix",
          semDesconto: true,
          cliente: clientes[entre(0, 5)],
        });
      }
    });
  }

  // O produto antigo vendeu o que restava e foi desativado.
  if (d === -DIAS + 10) {
    agendar(instante(ymd, 14, 0), (t) => {
      const p = produtos.at(-1);
      if (p.estoque > 0) registrarVenda(t, [{ p, q: p.estoque }], { semDesconto: true });
      p.ativo = false;
    });
  }

  processarAte(instante(diaRelativo(d + 1), 0));
}
processarAte(new Date(8.64e15));

// ---------- Gravação ----------
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const { rows } = await client.query(`SELECT to_regclass('public.categorias') IS NOT NULL AS ok`);
  if (!rows[0].ok) throw new Error("Esquema v2 ausente. Rode antes: node --env-file=.env.local scripts/migrate.mjs");

  const semExtras = (lista, extras) => lista.map((o) => Object.fromEntries(Object.entries(o).filter(([k]) => !extras.includes(k))));
  const inserir = (tabela, lista) =>
    client.query(`INSERT INTO ${tabela} SELECT * FROM json_populate_recordset(NULL::${tabela}, $1::json)`, [
      JSON.stringify(lista),
    ]);

  await client.query("BEGIN");
  await client.query(
    `TRUNCATE itens_venda, movimentacoes_estoque, vendas, produtos, categorias, clientes RESTART IDENTITY CASCADE`,
  );
  await inserir("categorias", categorias);
  await inserir("produtos", semExtras(produtos, ["pop", "destino"]));
  await inserir("clientes", semExtras(clientes, ["peso"]));
  await inserir("vendas", vendas);
  await inserir("itens_venda", itens);
  await inserir("movimentacoes_estoque", movs);
  for (const t of ["categorias", "produtos", "clientes", "vendas", "itens_venda", "movimentacoes_estoque"]) {
    await client.query(`SELECT setval(pg_get_serial_sequence('${t}', 'id'), coalesce((SELECT max(id) FROM ${t}), 0) + 1, false)`);
  }
  const config = {
    loja_nome: "Velas Luamme",
    loja_telefone: "11987650000",
    loja_instagram: "velasluamme",
    loja_endereco: "Rua das Acácias, 120 — Vila Mariana, São Paulo/SP",
    recibo_rodape: "Obrigada pela preferência! Acenda com carinho e nunca deixe a vela sem supervisão.",
    estoque_minimo_padrao: "5",
  };
  for (const [chave, valor] of Object.entries(config)) {
    await client.query(
      `INSERT INTO configuracoes (chave, valor) VALUES ($1, $2) ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor`,
      [chave, valor],
    );
  }
  await client.query("COMMIT");

  const canceladas = vendas.filter((v) => v.status === "cancelada").length;
  const esgotados = produtos.filter((p) => p.ativo && p.estoque === 0).length;
  const baixos = produtos.filter((p) => p.ativo && p.estoque > 0 && p.estoque <= p.estoque_minimo).length;
  console.log(
    `Seed concluído: ${categorias.length} categorias, ${produtos.length} produtos (${esgotados} esgotados, ${baixos} com estoque baixo), ` +
      `${clientes.length} clientes, ${vendas.length} vendas (${canceladas} canceladas), ${itens.length} itens, ${movs.length} movimentações.`,
  );
} catch (erro) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(erro.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
