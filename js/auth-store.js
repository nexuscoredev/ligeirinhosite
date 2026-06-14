(function () {
    const AUTH_KEY = 'ligeirinho-auth-v1';
    const HUB_SESSION_KEY = 'ligeirinho-hub-session-v1';
    const HUB_URL = 'https://liszpwocwvkytzyaxvit.supabase.co';
    const HUB_ANON_KEY =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxpc3pwd29jd3ZreXR6eWF4dml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjczNzUsImV4cCI6MjA5NTMwMzM3NX0.rMfpheVgAKQ4HelKB0ZoNDZXiU_3XQdv7ujLHxgdjEA';

    const parseJwt = (token) => {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const json = decodeURIComponent(
                atob(base64)
                    .split('')
                    .map((c) => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`)
                    .join('')
            );
            return JSON.parse(json);
        } catch {
            return null;
        }
    };

    const loadSession = () => {
        try {
            const data = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
            if (!data?.sub) return null;
            return data;
        } catch {
            return null;
        }
    };

    const TOTEM_ROLES = new Set(['TOTEM', 'TOTEM_DEVICE']);

    const saveSession = (user) => {
        const session = {
            sub: user.sub,
            email: user.email || '',
            name: user.name || '',
            phone: user.phone || '',
            picture: user.picture || '',
            provider: user.provider || 'google',
            role: user.role || 'PARCEIRO',
            cargo: user.cargo || '',
            login: user.login || '',
            hubUserId: user.hubUserId || '',
            totemUnitId: user.totemUnitId || '',
            totemLabel: user.totemLabel || '',
            loggedInAt: Date.now(),
        };
        localStorage.setItem(AUTH_KEY, JSON.stringify(session));
        window.dispatchEvent(new CustomEvent('ligeirinho-auth-changed', { detail: session }));
        return session;
    };

    const isTotemRole = (role) => TOTEM_ROLES.has(String(role || '').toUpperCase());

    const isTotemSession = (session) => isTotemRole(session?.role);

    const saveFromGoogleCredential = (credential) => {
        const payload = parseJwt(credential);
        if (!payload?.sub) return null;
        return saveSession({
            sub: payload.sub,
            email: payload.email,
            name: payload.name,
            picture: payload.picture,
            provider: 'google',
        });
    };

    const saveFromAppleAuthorization = (authorization, user) => {
        const idToken = authorization?.id_token;
        if (!idToken) return null;

        const payload = parseJwt(idToken);
        if (!payload?.sub) return null;

        const previous = loadSession();
        let name = '';
        if (user?.name) {
            name = [user.name.firstName, user.name.lastName].filter(Boolean).join(' ');
        }

        return saveSession({
            sub: payload.sub,
            email: payload.email || previous?.email || '',
            name: name || previous?.name || '',
            picture: '',
            provider: 'apple',
        });
    };

    const saveFromPhoneProfile = ({ phone, name }) => {
        const normalizedPhone = String(phone || '').trim();
        const normalizedName = String(name || '').trim().replace(/\s+/g, ' ');
        if (!normalizedPhone || normalizedName.length < 2) return null;

        return saveSession({
            sub: `phone:${normalizedPhone}`,
            email: '',
            name: normalizedName,
            phone: normalizedPhone,
            picture: '',
            provider: 'phone',
        });
    };

    const loadHubSession = () => {
        try {
            return JSON.parse(localStorage.getItem(HUB_SESSION_KEY) || 'null');
        } catch {
            return null;
        }
    };

    const saveHubSession = (session) => {
        if (!session?.accessToken) {
            localStorage.removeItem(HUB_SESSION_KEY);
            return null;
        }
        const payload = {
            accessToken: session.accessToken,
            refreshToken: session.refreshToken || '',
            expiresAt: session.expiresAt || Date.now() + 3600 * 1000,
        };
        localStorage.setItem(HUB_SESSION_KEY, JSON.stringify(payload));
        return payload;
    };

    const clearHubSession = () => {
        localStorage.removeItem(HUB_SESSION_KEY);
    };

    let refreshInflight = null;

    const refreshHubAccessToken = async () => {
        const hubSession = loadHubSession();
        if (!hubSession?.refreshToken) return null;

        if (refreshInflight) return refreshInflight;

        refreshInflight = (async () => {
            const res = await fetch(`${HUB_URL}/auth/v1/token?grant_type=refresh_token`, {
                method: 'POST',
                headers: {
                    apikey: HUB_ANON_KEY,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ refresh_token: hubSession.refreshToken }),
            });
            const data = await res.json();
            if (!res.ok) {
                clearHubSession();
                return null;
            }
            return saveHubSession({
                accessToken: data.access_token,
                refreshToken: data.refresh_token || hubSession.refreshToken,
                expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
            });
        })();

        try {
            return await refreshInflight;
        } finally {
            refreshInflight = null;
        }
    };

    const getHubAccessToken = async () => {
        const hubSession = loadHubSession();
        if (!hubSession?.accessToken) return null;
        if (Date.now() < hubSession.expiresAt - 60_000) return hubSession.accessToken;
        const refreshed = await refreshHubAccessToken();
        return refreshed?.accessToken || null;
    };

    const logout = () => {
        localStorage.removeItem(AUTH_KEY);
        clearHubSession();
        window.dispatchEvent(new CustomEvent('ligeirinho-auth-changed', { detail: null }));
        if (window.google?.accounts?.id) {
            window.google.accounts.id.disableAutoSelect();
        }
    };

    const isLoggedIn = () => Boolean(loadSession()?.sub);

    const firstName = (session) => {
        if (session?.name) return String(session.name).split(' ')[0];
        if (session?.phone) return 'Cliente';
        const name = session?.email || 'Cliente';
        return String(name).split(' ')[0];
    };

    const contactLabel = (session) => {
        const formatPhone = (phone) => {
            const digits = String(phone || '').replace(/\D/g, '');
            const local = digits.startsWith('55') ? digits.slice(2) : digits;
            if (local.length === 11) {
                return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
            }
            return phone || '';
        };

        if (session?.name && session?.phone) {
            return `${session.name} · ${formatPhone(session.phone)}`;
        }
        if (session?.name) return session.name;
        if (session?.email) return session.email;
        if (session?.phone) return formatPhone(session.phone);
        return '';
    };

    const applyProfile = (profile) => {
        if (!profile?.sub) return null;
        return saveSession({
            sub: profile.sub,
            email: profile.email,
            name: profile.name,
            phone: profile.phone,
            picture: profile.picture || '',
            provider: profile.provider,
            role: profile.role,
            cargo: profile.cargo,
            login: profile.login,
            hubUserId: profile.hubUserId,
            totemUnitId: profile.totemUnitId,
            totemLabel: profile.totemLabel,
        });
    };

    window.LigeirinhoAuth = {
        AUTH_KEY,
        HUB_SESSION_KEY,
        TOTEM_ROLES,
        loadHubSession,
        saveHubSession,
        clearHubSession,
        getHubAccessToken,
        parseJwt,
        loadSession,
        saveSession,
        applyProfile,
        saveFromGoogleCredential,
        saveFromAppleAuthorization,
        saveFromPhoneProfile,
        logout,
        isLoggedIn,
        isTotemRole,
        isTotemSession,
        firstName,
        contactLabel,
        providerLabel: (session) => {
            if (session?.provider === 'phone') return 'Conta por telefone';
            if (session?.provider === 'apple') return 'Conta Apple';
            if (session?.provider === 'google') return 'Conta Google';
            return 'Minha conta';
        },
    };
})();
