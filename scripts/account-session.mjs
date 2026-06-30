import crypto from 'crypto';

const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function sessionSecret(env = process.env) {
    return (
        env.ACCOUNT_SESSION_SECRET ||
        env.HUB_SUPABASE_SERVICE_ROLE_KEY ||
        env.HUB_SUPABASE_ANON_KEY ||
        ''
    );
}

export function issueAccountSession(
    { userId, email, provider = 'google' },
    env = process.env,
    ttlMs = DEFAULT_TTL_MS,
) {
    const secret = sessionSecret(env);
    if (!secret || !userId || !email) return null;

    const exp = Date.now() + ttlMs;
    const payload = JSON.stringify({
        userId: String(userId),
        email: String(email).trim().toLowerCase(),
        provider: String(provider || 'google'),
        exp,
    });
    const payloadB64 = Buffer.from(payload, 'utf8').toString('base64url');
    const sig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
    return { token: `${payloadB64}.${sig}`, expiresAt: exp };
}

export function verifyAccountSession(token, env = process.env) {
    const secret = sessionSecret(env);
    if (!secret || !token) return null;

    const [payloadB64, sig] = String(token).split('.');
    if (!payloadB64 || !sig) return null;

    const expected = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
    try {
        const sigBuf = Buffer.from(sig);
        const expBuf = Buffer.from(expected);
        if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
            return null;
        }
    } catch {
        return null;
    }

    try {
        const data = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
        if (!data?.userId || !data?.email || !data?.exp) return null;
        if (Date.now() >= Number(data.exp) - 60_000) return null;
        return data;
    } catch {
        return null;
    }
}
