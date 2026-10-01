-- GERADO por `node scripts/migrate.mjs --gerar-schema` a partir de db/migrations. Não edite à mão.
-- Esquema completo e idempotente (usado só como fallback quando db/migrations não é publicado).

-- ===== 001_inicial =====
-- 001: esquema da v1 (produtos, vendas, itens_venda, movimentacoes_estoque).
-- Idempotente: seguro em bancos que já têm essas tabelas.

CREATE TABLE IF NOT EXISTS produtos (
  id              SERIAL PRIMARY KEY,
  nome            TEXT NOT NULL,
  aroma           TEXT NOT NULL,
  descricao       TEXT NOT NULL DEFAULT '',
  preco           NUMERIC(10, 2) NOT NULL CHECK (preco >= 0),
  estoque         INTEGER NOT NULL DEFAULT 0 CHECK (estoque >= 0),
  estoque_minimo  INTEGER NOT NULL DEFAULT 5 CHECK (estoque_minimo >= 0),
  ativo           BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vendas (
  id         SERIAL PRIMARY KEY,
  data       TIMESTAMPTZ NOT NULL DEFAULT now(),
  total      NUMERIC(12, 2) NOT NULL CHECK (total >= 0),
  observacao TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS vendas_data_idx ON vendas (data DESC);

CREATE TABLE IF NOT EXISTS itens_venda (
  id              SERIAL PRIMARY KEY,
  venda_id        INTEGER NOT NULL REFERENCES vendas (id) ON DELETE CASCADE,
  produto_id      INTEGER NOT NULL REFERENCES produtos (id),
  -- Nome e preço copiados no momento da venda para preservar o histórico.
  produto_nome    TEXT NOT NULL,
  quantidade      INTEGER NOT NULL CHECK (quantidade > 0),
  preco_unitario  NUMERIC(10, 2) NOT NULL,
  subtotal        NUMERIC(12, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS itens_venda_venda_idx ON itens_venda (venda_id);

CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
  id          SERIAL PRIMARY KEY,
  produto_id  INTEGER NOT NULL REFERENCES produtos (id),
  tipo        TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  quantidade  INTEGER NOT NULL CHECK (quantidade > 0),
  observacao  TEXT NOT NULL DEFAULT '',
  venda_id    INTEGER REFERENCES vendas (id) ON DELETE SET NULL,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS movimentacoes_produto_idx ON movimentacoes_estoque (produto_id, criado_em DESC);

-- ===== 002_v2 =====
-- 002: v2 — categorias, clientes, custos/margem, pagamento e canal das vendas, cancelamento,
-- motivos e saldo nas movimentações, configurações da loja.
-- Aditiva e idempotente: pode rodar em produção com dados (e mais de uma vez).

-- ---------- Categorias ----------
CREATE TABLE IF NOT EXISTS categorias (
  id         SERIAL PRIMARY KEY,
  nome       TEXT NOT NULL CHECK (btrim(nome) <> ''),
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Único sem diferenciar maiúsculas ("Florais" = "florais").
CREATE UNIQUE INDEX IF NOT EXISTS categorias_nome_key ON categorias (lower(nome));

-- ---------- Produtos ----------
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS categoria_id INTEGER REFERENCES categorias (id) ON DELETE SET NULL;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS custo NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (custo >= 0);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS peso_g INTEGER CHECK (peso_g IS NULL OR peso_g > 0);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS tempo_queima_h INTEGER CHECK (tempo_queima_h IS NULL OR tempo_queima_h > 0);

CREATE UNIQUE INDEX IF NOT EXISTS produtos_sku_key ON produtos (upper(sku)) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS produtos_categoria_idx ON produtos (categoria_id);
CREATE INDEX IF NOT EXISTS produtos_ativo_nome_idx ON produtos (ativo, nome);

-- ---------- Clientes ----------
CREATE TABLE IF NOT EXISTS clientes (
  id             SERIAL PRIMARY KEY,
  nome           TEXT NOT NULL CHECK (btrim(nome) <> ''),
  telefone       TEXT NOT NULL DEFAULT '',  -- só dígitos, com DDD (ex.: 11987654321)
  email          TEXT NOT NULL DEFAULT '',
  instagram      TEXT NOT NULL DEFAULT '',  -- sem o "@"
  observacoes    TEXT NOT NULL DEFAULT '',
  ativo          BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clientes_nome_idx ON clientes (lower(nome));
CREATE INDEX IF NOT EXISTS clientes_telefone_idx ON clientes (telefone);

-- ---------- Vendas ----------
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS cliente_id INTEGER REFERENCES clientes (id) ON DELETE SET NULL;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS forma_pagamento TEXT NOT NULL DEFAULT 'pix'
  CHECK (forma_pagamento IN ('pix', 'dinheiro', 'cartao_credito', 'cartao_debito', 'outro'));
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS canal TEXT NOT NULL DEFAULT 'loja'
  CHECK (canal IN ('loja', 'whatsapp', 'instagram', 'feira', 'site', 'outro'));
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12, 2);
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS desconto NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (desconto >= 0);
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS valor_recebido NUMERIC(12, 2) CHECK (valor_recebido IS NULL OR valor_recebido >= 0);
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'concluida'
  CHECK (status IN ('concluida', 'cancelada'));
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS cancelada_em TIMESTAMPTZ;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT;

-- Backfill: vendas antigas não tinham desconto, então subtotal = total.
UPDATE vendas SET subtotal = total WHERE subtotal IS NULL;
-- Sem DEFAULT de propósito: o código da v1 (ainda no ar durante o deploy, ou de volta num rollback)
-- faz INSERT só com total/observacao; o gatilho abaixo completa subtotal = total + desconto,
-- senão subtotal viraria 0 e a venda violaria vendas_total_confere.
ALTER TABLE vendas ALTER COLUMN subtotal DROP DEFAULT;
CREATE OR REPLACE FUNCTION vendas_completar_subtotal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.subtotal IS NULL THEN
    NEW.subtotal := NEW.total + coalesce(NEW.desconto, 0);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS vendas_completar_subtotal ON vendas;
CREATE TRIGGER vendas_completar_subtotal BEFORE INSERT ON vendas
  FOR EACH ROW EXECUTE FUNCTION vendas_completar_subtotal();
ALTER TABLE vendas ALTER COLUMN subtotal SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendas_total_confere') THEN
    ALTER TABLE vendas ADD CONSTRAINT vendas_total_confere
      CHECK (desconto <= subtotal AND total = subtotal - desconto);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendas_cancelamento_confere') THEN
    ALTER TABLE vendas ADD CONSTRAINT vendas_cancelamento_confere
      CHECK ((status = 'cancelada') = (cancelada_em IS NOT NULL));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS vendas_status_data_idx ON vendas (status, data DESC);
CREATE INDEX IF NOT EXISTS vendas_cliente_idx ON vendas (cliente_id, data DESC);

-- ---------- Itens de venda ----------
ALTER TABLE itens_venda ADD COLUMN IF NOT EXISTS custo_unitario NUMERIC(10, 2) NOT NULL DEFAULT 0
  CHECK (custo_unitario >= 0);
CREATE INDEX IF NOT EXISTS itens_venda_produto_idx ON itens_venda (produto_id);

-- ---------- Movimentações de estoque ----------
ALTER TABLE movimentacoes_estoque ADD COLUMN IF NOT EXISTS motivo TEXT
  CHECK (motivo IS NULL OR motivo IN ('estoque_inicial', 'producao', 'compra', 'venda', 'cancelamento_venda',
                                      'perda', 'avaria', 'uso_interno', 'ajuste_inventario', 'outro'));
ALTER TABLE movimentacoes_estoque ADD COLUMN IF NOT EXISTS saldo_apos INTEGER;

-- Backfill do motivo das linhas da v1.
UPDATE movimentacoes_estoque SET motivo = 'estoque_inicial'
 WHERE motivo IS NULL AND observacao = 'Estoque inicial' AND venda_id IS NULL;
UPDATE movimentacoes_estoque SET motivo = 'venda'
 WHERE motivo IS NULL AND venda_id IS NOT NULL;
UPDATE movimentacoes_estoque SET motivo = CASE WHEN tipo = 'entrada' THEN 'producao' ELSE 'outro' END
 WHERE motivo IS NULL;

-- Backfill do saldo: na v1 toda alteração de estoque gerava movimentação, então o saldo após
-- cada linha = estoque atual − efeito das movimentações posteriores. Só grava se fizer sentido (>= 0).
WITH calculado AS (
  SELECT m.id,
         p.estoque - coalesce(sum(CASE WHEN m.tipo = 'entrada' THEN m.quantidade ELSE -m.quantidade END)
           OVER (PARTITION BY m.produto_id ORDER BY m.criado_em DESC, m.id DESC
                 ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS saldo
  FROM movimentacoes_estoque m
  JOIN produtos p ON p.id = m.produto_id
)
UPDATE movimentacoes_estoque m SET saldo_apos = c.saldo
  FROM calculado c
 WHERE m.id = c.id AND m.saldo_apos IS NULL AND c.saldo >= 0;

CREATE INDEX IF NOT EXISTS movimentacoes_criado_idx ON movimentacoes_estoque (criado_em DESC, id DESC);
CREATE INDEX IF NOT EXISTS movimentacoes_motivo_idx ON movimentacoes_estoque (motivo, criado_em DESC);
CREATE INDEX IF NOT EXISTS movimentacoes_venda_idx ON movimentacoes_estoque (venda_id) WHERE venda_id IS NOT NULL;

-- ---------- Configurações ----------
CREATE TABLE IF NOT EXISTS configuracoes (
  chave  TEXT PRIMARY KEY,
  valor  TEXT NOT NULL DEFAULT ''
);

INSERT INTO configuracoes (chave, valor) VALUES
  ('loja_nome', 'Velas Luamme'),
  ('loja_telefone', ''),
  ('loja_instagram', ''),
  ('loja_endereco', ''),
  ('recibo_rodape', 'Obrigada pela preferência! Acenda com carinho e nunca deixe a vela sem supervisão.'),
  ('estoque_minimo_padrao', '5')
ON CONFLICT (chave) DO NOTHING;

-- ===== 003_idempotencia_custos =====
-- 003: chave de idempotência das vendas, compatibilidade do INSERT da v1 e custo das vendas antigas.
-- Aditiva e idempotente (pode rodar mais de uma vez).

-- ---------- Vendas: chave de idempotência ----------
-- O PDV gera um UUID por venda e reenvia o mesmo se a resposta se perder (rede do celular):
-- a segunda tentativa encontra a venda já gravada em vez de registrar outra.
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS chave_idempotencia UUID;
CREATE UNIQUE INDEX IF NOT EXISTS vendas_chave_idempotencia_key
  ON vendas (chave_idempotencia) WHERE chave_idempotencia IS NOT NULL;

-- ---------- Vendas: compatibilidade com o código da v1 ----------
-- (Repete o ajuste que a 002 já faz, para bancos que aplicaram a versão antiga da 002.)
-- A v1 faz `INSERT INTO vendas (total, observacao)`; com subtotal DEFAULT 0 a venda violaria
-- vendas_total_confere. Isso valia durante o deploy (v1 no ar após a migração) e num rollback.
ALTER TABLE vendas ALTER COLUMN subtotal DROP DEFAULT;
CREATE OR REPLACE FUNCTION vendas_completar_subtotal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.subtotal IS NULL THEN
    NEW.subtotal := NEW.total + coalesce(NEW.desconto, 0);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS vendas_completar_subtotal ON vendas;
CREATE TRIGGER vendas_completar_subtotal BEFORE INSERT ON vendas
  FOR EACH ROW EXECUTE FUNCTION vendas_completar_subtotal();

-- ---------- Itens de venda: custo das vendas antigas ----------
-- custo_unitario = 0 significa "custo não informado" (vendas da v1 e vendas feitas antes de a
-- dona cadastrar o custo da vela). Usa o custo atual do produto como melhor estimativa, para o
-- lucro bruto e a margem não aparecerem como 100%. Editar o custo de um produto repete isto
-- para as vendas dele (ver editarProduto).
UPDATE itens_venda i SET custo_unitario = p.custo
  FROM produtos p
 WHERE p.id = i.produto_id AND i.custo_unitario = 0 AND p.custo > 0;
