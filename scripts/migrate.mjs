// Aplica as migrações pendentes de db/migrations (NNN_nome.sql) no banco de DATABASE_URL,
// em ordem, cada uma em sua própria transação, registrando em schema_migrations.
//
// Uso:
//   node --env-file=.env scripts/migrate.mjs           aplica o que estiver pendente
//   node --env-file=.env scripts/migrate.mjs --status  só lista aplicadas/pendentes
//   node scripts/migrate.mjs --gerar-schema            regenera db/schema.sql (todas as migrações juntas)
//
// Compatibilidade: se db/migrations não existir (pacote antigo que só copiava db/schema.sql),
// aplica db/schema.sql, que é idempotente.
import { readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import pg from "pg";

const DIR = new URL("../db/migrations/", import.meta.url);
const SCHEMA = new URL("../db/schema.sql", import.meta.url);
const args = new Set(process.argv.slice(2));
// Chave arbitrária do advisory lock: impede duas execuções simultâneas (ex.: deploys sobrepostos).
const LOCK_ID = 610_003;

async function listarMigracoes() {
  const nomes = (await readdir(DIR)).filter((n) => /^\d{3}_[\w-]+\.sql$/.test(n)).sort();
  return Promise.all(
    nomes.map(async (arquivo) => ({
      versao: arquivo.slice(0, 3),
      nome: arquivo.replace(/\.sql$/, ""),
      sql: await readFile(new URL(arquivo, DIR), "utf8"),
    })),
  );
}

if (args.has("--gerar-schema")) {
  const migracoes = await listarMigracoes();
  const partes = migracoes.map((m) => `-- ===== ${m.nome} =====\n${m.sql.trim()}\n`);
  await writeFile(
    SCHEMA,
    "-- GERADO por `node scripts/migrate.mjs --gerar-schema` a partir de db/migrations. Não edite à mão.\n" +
      "-- Esquema completo e idempotente (usado só como fallback quando db/migrations não é publicado).\n\n" +
      partes.join("\n"),
  );
  console.log(`db/schema.sql regenerado com ${migracoes.length} migração(ões).`);
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL não definida. Use: node --env-file=.env scripts/migrate.mjs");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  if (!existsSync(DIR)) {
    console.warn("Aviso: db/migrations não encontrado; aplicando db/schema.sql (modo compatível).");
    await client.query(await readFile(SCHEMA, "utf8"));
    console.log("Esquema aplicado com sucesso.");
  } else {
    await client.query("SELECT pg_advisory_lock($1)", [LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        versao      TEXT PRIMARY KEY,
        nome        TEXT NOT NULL,
        aplicada_em TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
    const { rows } = await client.query("SELECT versao FROM schema_migrations");
    const aplicadas = new Set(rows.map((r) => r.versao));
    const migracoes = await listarMigracoes();
    const pendentes = migracoes.filter((m) => !aplicadas.has(m.versao));

    if (args.has("--status")) {
      for (const m of migracoes) console.log(`${aplicadas.has(m.versao) ? "[x]" : "[ ]"} ${m.nome}`);
    } else if (pendentes.length === 0) {
      console.log("Banco atualizado: nenhuma migração pendente.");
    } else {
      for (const m of pendentes) {
        const inicio = Date.now();
        try {
          await client.query("BEGIN");
          await client.query(m.sql);
          await client.query("INSERT INTO schema_migrations (versao, nome) VALUES ($1, $2)", [m.versao, m.nome]);
          await client.query("COMMIT");
        } catch (erro) {
          await client.query("ROLLBACK");
          erro.message = `Falha ao aplicar ${m.nome} (nada desta migração foi gravado): ${erro.message}`;
          throw erro;
        }
        console.log(`Aplicada ${m.nome} (${Date.now() - inicio} ms).`);
      }
      console.log(`${pendentes.length} migração(ões) aplicada(s) com sucesso.`);
    }
  }
} catch (erro) {
  console.error(erro.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
