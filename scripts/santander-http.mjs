import https from 'node:https';
import { URL } from 'node:url';

let cachedToken = null;
let tokenExpiresAt = 0;

export function santanderConfigFromEnv(env = process.env) {
    const envName = String(env.SANTANDER_ENV || 'sandbox').toLowerCase();
    const sandbox = envName !== 'production';
    const baseUrl =
        String(env.SANTANDER_BASE_URL || '').trim() ||
        (sandbox ? 'https://trust-sandbox.api.santander.com.br' : 'https://trust-open.api.santander.com.br');

    return {
        env: sandbox ? 'sandbox' : 'production',
        baseUrl: baseUrl.replace(/\/$/, ''),
        clientId: String(env.SANTANDER_CLIENT_ID || '').trim(),
        clientSecret: String(env.SANTANDER_CLIENT_SECRET || '').trim(),
        applicationKey: String(env.SANTANDER_APPLICATION_KEY || env.SANTANDER_CLIENT_ID || '').trim(),
        pixKey: String(env.SANTANDER_PIX_KEY || '').trim(),
        workspaceId: String(env.SANTANDER_WORKSPACE_ID || '').trim(),
        certPfxBase64: String(env.SANTANDER_CERT_PFX_BASE64 || '').trim(),
        certPassphrase: String(env.SANTANDER_CERT_PASSPHRASE || '').trim(),
        cobPathTemplate: String(
            env.SANTANDER_PIX_COB_PATH || '/payment_services/v1/pix/cob/{txid}'
        ).trim(),
        webhookSecret: String(env.SANTANDER_WEBHOOK_SECRET || '').trim(),
    };
}

export function assertSantanderPixConfig(cfg) {
    const missing = [];
    if (!cfg.clientId) missing.push('SANTANDER_CLIENT_ID');
    if (!cfg.clientSecret) missing.push('SANTANDER_CLIENT_SECRET');
    if (!cfg.pixKey) missing.push('SANTANDER_PIX_KEY');
    if (!cfg.certPfxBase64) missing.push('SANTANDER_CERT_PFX_BASE64');
    return missing;
}

function createAgent(cfg) {
    const pfx = Buffer.from(cfg.certPfxBase64, 'base64');
    return new https.Agent({
        pfx,
        passphrase: cfg.certPassphrase || undefined,
        rejectUnauthorized: true,
    });
}

function httpsRequest(url, options, body) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const req = https.request(
            {
                hostname: u.hostname,
                port: u.port || 443,
                path: `${u.pathname}${u.search}`,
                method: options.method || 'GET',
                headers: options.headers || {},
                agent: options.agent,
            },
            (res) => {
                const chunks = [];
                res.on('data', (chunk) => chunks.push(chunk));
                res.on('end', () => {
                    const text = Buffer.concat(chunks).toString('utf8');
                    let data;
                    try {
                        data = text ? JSON.parse(text) : {};
                    } catch {
                        data = { raw: text };
                    }
                    resolve({ status: res.statusCode, data, headers: res.headers });
                });
            }
        );
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

async function getAccessToken(cfg, agent) {
    const now = Date.now();
    if (cachedToken && tokenExpiresAt > now + 60_000) {
        return cachedToken;
    }

    const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
    }).toString();

    const url = `${cfg.baseUrl}/auth/oauth/v2/token`;
    const res = await httpsRequest(
        url,
        {
            method: 'POST',
            agent,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(body),
            },
        },
        body
    );

    if (res.status >= 400) {
        const err = new Error(
            res.data?.error_description || res.data?.message || 'Falha na autenticação Santander'
        );
        err.status = res.status;
        err.details = res.data;
        throw err;
    }

    cachedToken = res.data.access_token;
    const expiresIn = Number(res.data.expires_in) || 3600;
    tokenExpiresAt = now + expiresIn * 1000;
    return cachedToken;
}

export async function santanderFetch(cfg, path, { method = 'GET', body, headers = {} } = {}) {
    const agent = createAgent(cfg);
    const token = await getAccessToken(cfg, agent);
    const url = path.startsWith('http') ? path : `${cfg.baseUrl}${path}`;
    const payload = body ? JSON.stringify(body) : null;

    const res = await httpsRequest(
        url,
        {
            method,
            agent,
            headers: {
                Authorization: `Bearer ${token}`,
                'X-Application-Key': cfg.applicationKey,
                'Content-Type': 'application/json',
                ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
                ...headers,
            },
        },
        payload
    );

    if (res.status >= 400) {
        const err = new Error(
            res.data?.message || res.data?.error || res.data?.detail || `Santander HTTP ${res.status}`
        );
        err.status = res.status;
        err.details = res.data;
        throw err;
    }

    return res.data;
}
