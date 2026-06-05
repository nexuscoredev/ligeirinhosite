(function () {
    const AUTH_KEY = 'ligeirinho-auth-v1';

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

    const saveSession = (user) => {
        const session = {
            sub: user.sub,
            email: user.email || '',
            name: user.name || '',
            picture: user.picture || '',
            provider: user.provider || 'google',
            loggedInAt: Date.now(),
        };
        localStorage.setItem(AUTH_KEY, JSON.stringify(session));
        window.dispatchEvent(new CustomEvent('ligeirinho-auth-changed', { detail: session }));
        return session;
    };

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

    const logout = () => {
        localStorage.removeItem(AUTH_KEY);
        window.dispatchEvent(new CustomEvent('ligeirinho-auth-changed', { detail: null }));
        if (window.google?.accounts?.id) {
            window.google.accounts.id.disableAutoSelect();
        }
    };

    const isLoggedIn = () => Boolean(loadSession()?.sub);

    const firstName = (session) => {
        const name = session?.name || session?.email || 'Cliente';
        return String(name).split(' ')[0];
    };

    window.LigeirinhoAuth = {
        AUTH_KEY,
        parseJwt,
        loadSession,
        saveSession,
        saveFromGoogleCredential,
        logout,
        isLoggedIn,
        firstName,
    };
})();
