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
