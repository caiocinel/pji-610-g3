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
