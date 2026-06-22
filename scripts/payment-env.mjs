export function paymentEnv(env = process.env, requestOrigin = null) {
    const baseUrl =
        String(env.APP_BASE_URL || '').trim() ||
        (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : '') ||
        String(requestOrigin || '').trim();

    return {
        mpAccessToken: String(env.MP_ACCESS_TOKEN || '').trim(),
        mpPublicKey: String(env.MP_PUBLIC_KEY || '').trim(),
        supabaseUrl: String(env.SUPABASE_URL || '').trim().replace(/\/$/, ''),
        supabaseServiceKey: String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
        appBaseUrl: baseUrl.replace(/\/$/, ''),
    };
}

/** Pedidos no Supabase (totem e parceiros). */
export function assertOrderBackend(config) {
    const missing = [];
    if (!config.supabaseUrl) missing.push('SUPABASE_URL');
    if (!config.supabaseServiceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    return missing;
}

/** Pix server-side (não exige chave pública / Brick). */
export function assertPixBackend(config) {
    const missing = assertOrderBackend(config);
    if (!config.mpAccessToken) missing.push('MP_ACCESS_TOKEN');
    return missing;
}

/** Cartão via Brick (ainda usa token + chave pública do adquirente). */
export function assertCardBackend(config) {
    const missing = assertPixBackend(config);
    if (!config.mpPublicKey) missing.push('MP_PUBLIC_KEY');
    return missing;
}

export function paymentCapabilities(config) {
    const orderMissing = assertOrderBackend(config);
    const pixMissing = assertPixBackend(config);
    const cardMissing = assertCardBackend(config);
    return {
        order: orderMissing.length === 0,
        pix: pixMissing.length === 0,
        card: cardMissing.length === 0,
        missing: {
            order: orderMissing,
            pix: pixMissing,
            card: cardMissing,
        },
    };
}

/** Legado: Brick completo (parceiros). */
export function assertPaymentBackend(config) {
    return assertCardBackend(config);
}
