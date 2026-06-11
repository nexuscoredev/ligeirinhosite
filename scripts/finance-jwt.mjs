import crypto from 'crypto';

const b64url = (buf) => Buffer.from(buf).toString('base64url');

const fromB64url = (str) => Buffer.from(str, 'base64url');

export function signFinanceToken(payload, secret, ttlSec = 28800) {
    if (!secret) throw new Error('FINANCE_JWT_SECRET não configurado');
    const exp = Math.floor(Date.now() / 1000) + ttlSec;
    const body = b64url(JSON.stringify({ ...payload, exp }));
    const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
    return `${body}.${sig}`;
}

export function verifyFinanceToken(token, secret) {
    if (!token || !secret) return null;
    const parts = String(token).split('.');
    if (parts.length !== 2) return null;
    const [body, sig] = parts;
    const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
    const sigBuf = fromB64url(sig);
    const expBuf = fromB64url(expected);
    if (sigBuf.length !== expBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
    try {
        const payload = JSON.parse(fromB64url(body).toString('utf8'));
        if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
        return payload;
    } catch {
        return null;
    }
}

export function financeJwtSecret(env = process.env) {
    return String(env.FINANCE_JWT_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
}
