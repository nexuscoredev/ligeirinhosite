import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { hubConfig } from './hub-auth.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv(file) {
    const env = {};
    if (!fs.existsSync(file)) return env;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m) env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
    }
    return env;
}

const hubEnv = loadEnv(path.resolve(__dirname, '../../ligeirinhohub/.env.local'));
const hub = hubConfig({
    HUB_SUPABASE_URL: hubEnv.NEXT_PUBLIC_SUPABASE_URL,
    HUB_SUPABASE_SERVICE_ROLE_KEY: hubEnv.SUPABASE_SERVICE_ROLE_KEY,
});

const since = new Date();
since.setHours(0, 0, 0, 0);
const params = new URLSearchParams({
    select: 'parceiros_order_id,numero',
    parceiros_order_id: 'not.is.null',
    created_at: `gte.${since.toISOString()}`,
    order: 'created_at.desc',
    limit: '50',
});

const res = await fetch(`${hub.url}/rest/v1/pedidos?${params}`, {
    headers: { apikey: hub.serviceKey, Authorization: `Bearer ${hub.serviceKey}` },
});
const rows = await res.json();
const ids = rows.map((r) => r.parceiros_order_id).filter(Boolean);
const out = path.resolve(__dirname, '.order-ids-today.json');
fs.writeFileSync(out, JSON.stringify({ ids }, null, 2));
console.log(`Gravado ${ids.length} ID(s) em ${out}`);
rows.forEach((r) => console.log(`#${r.numero} ${r.parceiros_order_id}`));
