const DEFAULT_HUB_ORIGINS = [
    'https://ligeirinhohub.vercel.app',
    'http://localhost:5173',
    'http://localhost:4173',
    'http://127.0.0.1:5173',
];

function allowedOrigins(env = process.env) {
    const raw = String(env.HUB_PDV_ORIGINS || '').trim();
    const list = raw
        ? raw.split(',').map((s) => s.trim()).filter(Boolean)
        : DEFAULT_HUB_ORIGINS;
    const appOrigin = String(env.HUB_APP_ORIGIN || env.VITE_APP_ORIGIN || '').trim();
    if (appOrigin && !list.includes(appOrigin)) list.push(appOrigin);
    return list;
}

/** CORS para APIs chamadas pelo PDV do Ligeirinho Hub (cross-origin). */
export function applyHubPdvCors(req, res, env = process.env) {
    const origin = String(req.headers.origin || '').trim();
    const allowed = allowedOrigins(env);
    if (origin && allowed.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.setHeader('Vary', 'Origin');
}

export function handleHubPdvCorsPreflight(req, res, env = process.env) {
    applyHubPdvCors(req, res, env);
    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return true;
    }
    return false;
}
