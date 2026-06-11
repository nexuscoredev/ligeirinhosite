/**
 * Aplica a migração financeira no Supabase Parceiros.
 *
 * Opção A — URL direta do Postgres (recomendado):
 *   set SUPABASE_DB_URL=postgresql://postgres.[ref]:[SENHA]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
 *   npm run migrate:finance
 *
 * Opção B — Senha do banco:
 *   set SUPABASE_DB_PASSWORD=sua_senha
 *   npm run migrate:finance
 *
 * Dashboard SQL Editor (manual):
 *   https://supabase.com/dashboard/project/tugbsnjyvfhyvtivfhea/sql/new
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_REF = 'tugbsnjyvfhyvtivfhea';
const SQL_PATH = resolve(__dirname, 'finance-schema-migration.sql');

function buildDbUrl() {
    if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;
    const password = process.env.SUPABASE_DB_PASSWORD || process.env.POSTGRES_PASSWORD;
    if (!password) return null;
    const host = process.env.SUPABASE_DB_HOST || `aws-0-sa-east-1.pooler.supabase.com`;
    return `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(password)}@${host}:6543/postgres`;
}

async function main() {
    const dbUrl = buildDbUrl();
    if (!dbUrl) {
        console.error('Defina SUPABASE_DB_URL ou SUPABASE_DB_PASSWORD para rodar a migração.');
        console.error(`Ou execute o SQL manualmente: https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`);
        process.exit(1);
    }

    let pg;
    try {
        pg = await import('pg');
    } catch {
        console.error('Instale pg: npm install pg');
        process.exit(1);
    }

    const sql = readFileSync(SQL_PATH, 'utf8');
    const client = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    await client.connect();
    try {
        await client.query(sql);
        const { rows } = await client.query(
            "select table_name from information_schema.tables where table_schema='public' and table_name in ('customers','mp_charges','wallet','finance_settings') order by 1"
        );
        console.log('Migração financeira aplicada com sucesso.');
        console.log('Tabelas:', rows.map((r) => r.table_name).join(', '));
    } finally {
        await client.end();
    }
}

main().catch((err) => {
    console.error('Falha na migração:', err.message);
    process.exit(1);
});
