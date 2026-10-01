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
