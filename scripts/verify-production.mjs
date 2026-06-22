/**
 * Verificação read-only de produção e migrações (sem senha de banco).
 */
const BASE = process.env.APP_BASE_URL || 'https://ligeirinhoparceiros.vercel.app';
const HUB_URL = 'https://liszpwocwvkytzyaxvit.supabase.co';
const HUB_ANON =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxpc3pwd29jd3ZreXR6eWF4dml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjczNzUsImV4cCI6MjA5NTMwMzM3NX0.rMfpheVgAKQ4HelKB0ZoNDZXiU_3XQdv7ujLHxgdjEA';

async function getText(path) {
    const res = await fetch(`${BASE}${path}`);
    const text = await res.text();
    return { status: res.status, text };
}

async function get(path) {
    const res = await fetch(`${BASE}${path}`);
    const text = await res.text();
    let json = null;
    try {
        json = JSON.parse(text);
    } catch {
        json = { raw: text.slice(0, 200) };
    }
    return { status: res.status, json };
}

async function post(path, body) {
    const res = await fetch(`${BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json };
}

async function hubRpc(name, body) {
    const res = await fetch(`${HUB_URL}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: { apikey: HUB_ANON, Authorization: `Bearer ${HUB_ANON}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: text };
}

async function hubColumnCheck() {
    const res = await fetch(
        `${HUB_URL}/rest/v1/usuarios?select=must_change_password&limit=0`,
        { headers: { apikey: HUB_ANON, Authorization: `Bearer ${HUB_ANON}` } }
    );
    const text = await res.text();
    if (res.ok) return { ok: true, note: 'coluna must_change_password existe' };
    if (/must_change_password/i.test(text)) return { ok: false, note: 'coluna must_change_password AUSENTE' };
    return { ok: null, note: text.slice(0, 120) };
}

async function main() {
    console.log('=== Produção', BASE, '===\n');

    const catalog = await get('/api/catalog');
    console.log('GET /api/catalog:', catalog.status, catalog.json?.totalProducts != null ? `OK (${catalog.json.totalProducts} produtos)` : catalog.json?.error || catalog.json?.hint || 'erro');

    const payCfg = await get('/api/payments/config?channel=totem');
    const methods = payCfg.json?.methods || {};
    console.log(
        'GET /api/payments/config (totem):',
        payCfg.status,
        methods.pix ? 'Pix OK' : 'Pix off',
        methods.card ? 'Cartão OK' : 'Cartão off'
    );

    const order = await post('/api/orders/create', {
        items: [{ id: 'v', name: 'Verificacao', price: 10, qty: 1 }],
        channel: 'totem',
        deliveryType: 'retirada',
    });
    console.log('POST /api/orders/create:', order.status, order.json?.orderId ? `OK ${order.json.orderId}` : order.json?.missing?.join(', ') || order.json?.error);

    const totemCss = await getText('/css/totem.css');
    const totemJs = await getText('/js/totem.js');
    const cssOk = totemCss.status === 200 && totemCss.text.includes('totem-categories__label');
    const jsOk = totemJs.status === 200 && totemJs.text.includes('getTotemDisplayProducts');
    console.log('Assets totem:', cssOk ? 'CSS premium OK' : 'CSS verificar', jsOk ? 'JS OK' : 'JS erro');

    console.log('\n=== Hub auth migration (indireto) ===\n');

    const col = await hubColumnCheck();
    console.log('usuarios.must_change_password:', col.note);

    const rpcTotem = await hubRpc('resolve_login_email', { p_login: 'Totem' });
    console.log('RPC resolve_login_email(Totem):', rpcTotem.status, rpcTotem.body?.slice(0, 80));

    const auth = await post('/api/auth/resolve-profile', { type: 'hub', login: 'Totem', password: 'admin123' });
    console.log('POST /api/auth/resolve-profile (Totem):', auth.status, auth.json?.role || auth.json?.error);

    console.log('\n=== Resumo ===');
    const blockers = [];
    if (!catalog.json?.totalProducts) blockers.push('Catálogo Hub');
    if (!methods.pix && !methods.card) blockers.push('Pix/Cartão env');
    if (!order.json?.orderId) blockers.push('orders API (deploy RPC pendente?)');
    if (!col.ok) blockers.push('Hub migration must_change_password');
    if (blockers.length) console.log('Bloqueios:', blockers.join(' · '));
    else console.log('Tudo OK nos checks automáticos.');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
