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

export function assertPaymentBackend(config) {
    const missing = [];
    if (!config.mpAccessToken) missing.push('MP_ACCESS_TOKEN');
    if (!config.mpPublicKey) missing.push('MP_PUBLIC_KEY');
    if (!config.supabaseUrl) missing.push('SUPABASE_URL');
    if (!config.supabaseServiceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    return missing;
}
