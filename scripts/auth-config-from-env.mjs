/**
 * Monta auth-config a partir de variáveis de ambiente (Vercel / .env.local).
 */
export function authConfigFromEnv(env = process.env, requestOrigin = null) {
    const baseUrl =
        String(env.APP_BASE_URL || '').trim() ||
        (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : '') ||
        String(requestOrigin || '').trim();

    const normalizedBase = baseUrl.replace(/\/$/, '');

    return {
        googleClientId: String(env.GOOGLE_CLIENT_ID || '').trim(),
        appleClientId: String(env.APPLE_CLIENT_ID || '').trim(),
        appleRedirectUri:
            String(env.APPLE_REDIRECT_URI || '').trim() ||
            (normalizedBase ? `${normalizedBase}/login.html` : ''),
        requireLogin: String(env.REQUIRE_LOGIN || '').toLowerCase() === 'true',
    };
}
