import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const PARCEIROS_REF = 'tugbsnjyvfhyvtivfhea';
export const HUB_REF = 'liszpwocwvkytzyaxvit';

export function readSql(filename) {
    return readFileSync(resolve(__dirname, filename), 'utf8');
}

export function buildDbUrl(projectRef, env = process.env) {
    const direct = env.SUPABASE_DB_URL || env[`SUPABASE_DB_URL_${projectRef.toUpperCase()}`];
    if (direct) return direct;

    const password =
        env.SUPABASE_DB_PASSWORD ||
        env.POSTGRES_PASSWORD ||
        (projectRef === HUB_REF ? env.HUB_SUPABASE_DB_PASSWORD : null);

    if (!password) return null;

    const host = env.SUPABASE_DB_HOST || 'aws-0-sa-east-1.pooler.supabase.com';
    return `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@${host}:6543/postgres`;
}

export async function connectPg(dbUrl) {
    let pg;
    try {
        pg = await import('pg');
    } catch {
        throw new Error('Instale pg: npm install pg --save-dev');
    }
    const client = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    await client.connect();
    return client;
}

export async function runSqlFile(client, sqlPath) {
    const sql = readSql(sqlPath);
    await client.query(sql);
}
