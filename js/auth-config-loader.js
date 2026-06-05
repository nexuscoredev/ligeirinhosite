(function () {
    const GOOGLE_STORAGE_KEY = 'ligeirinho-google-client-id';
    const APPLE_STORAGE_KEY = 'ligeirinho-apple-client-id';
    const APPLE_REDIRECT_STORAGE_KEY = 'ligeirinho-apple-redirect-uri';

    const mergeAuthConfig = (base, patch) => {
        const next = { ...base };
        if (!patch || typeof patch !== 'object') return next;

        ['googleClientId', 'appleClientId', 'appleRedirectUri'].forEach((key) => {
            const value = String(patch[key] ?? '').trim();
            if (value) next[key] = value;
        });

        if (typeof patch.requireLogin === 'boolean') {
            next.requireLogin = patch.requireLogin;
        }

        return next;
    };

    const loadAuthConfig = async () => {
        let config = {
            googleClientId: '',
            appleClientId: '',
            appleRedirectUri: '',
            requireLogin: false,
        };

        try {
            const res = await fetch('data/auth-config.json');
            if (res.ok) config = mergeAuthConfig(config, await res.json());
        } catch {
            /* offline / missing */
        }

        try {
            const local = await fetch('data/auth-config.local.json');
            if (local.ok) config = mergeAuthConfig(config, await local.json());
        } catch {
            /* optional local override */
        }

        try {
            const remote = await fetch('/api/auth-config');
            if (remote.ok) config = mergeAuthConfig(config, await remote.json());
        } catch {
            /* Vercel API indisponível (ex.: file://) */
        }

        const storedGoogle = String(localStorage.getItem(GOOGLE_STORAGE_KEY) || '').trim();
        if (storedGoogle) config.googleClientId = storedGoogle;

        const storedApple = String(localStorage.getItem(APPLE_STORAGE_KEY) || '').trim();
        if (storedApple) config.appleClientId = storedApple;

        const storedAppleRedirect = String(localStorage.getItem(APPLE_REDIRECT_STORAGE_KEY) || '').trim();
        if (storedAppleRedirect) config.appleRedirectUri = storedAppleRedirect;

        const params = new URLSearchParams(window.location.search);
        const urlGoogleId = params.get('googleClientId');
        if (urlGoogleId?.trim()) config.googleClientId = urlGoogleId.trim();

        const urlAppleId = params.get('appleClientId');
        if (urlAppleId?.trim()) config.appleClientId = urlAppleId.trim();

        const urlAppleRedirect = params.get('appleRedirectUri');
        if (urlAppleRedirect?.trim()) config.appleRedirectUri = urlAppleRedirect.trim();

        config.googleClientId = String(config.googleClientId || '').trim();
        config.appleClientId = String(config.appleClientId || '').trim();
        config.appleRedirectUri = String(config.appleRedirectUri || '').trim();
        return config;
    };

    const saveLocalClientId = (clientId) => {
        const id = String(clientId || '').trim();
        if (!id) {
            localStorage.removeItem(GOOGLE_STORAGE_KEY);
            return '';
        }
        localStorage.setItem(GOOGLE_STORAGE_KEY, id);
        return id;
    };

    const saveLocalAppleClientId = (clientId) => {
        const id = String(clientId || '').trim();
        if (!id) {
            localStorage.removeItem(APPLE_STORAGE_KEY);
            return '';
        }
        localStorage.setItem(APPLE_STORAGE_KEY, id);
        return id;
    };

    const saveLocalAppleRedirectUri = (redirectUri) => {
        const uri = String(redirectUri || '').trim();
        if (!uri) {
            localStorage.removeItem(APPLE_REDIRECT_STORAGE_KEY);
            return '';
        }
        localStorage.setItem(APPLE_REDIRECT_STORAGE_KEY, uri);
        return uri;
    };

    const clearLocalClientId = () => {
        localStorage.removeItem(GOOGLE_STORAGE_KEY);
    };

    const clearLocalAppleClientId = () => {
        localStorage.removeItem(APPLE_STORAGE_KEY);
        localStorage.removeItem(APPLE_REDIRECT_STORAGE_KEY);
    };

    window.LigeirinhoAuthConfig = {
        GOOGLE_STORAGE_KEY,
        APPLE_STORAGE_KEY,
        APPLE_REDIRECT_STORAGE_KEY,
        loadAuthConfig,
        saveLocalClientId,
        saveLocalAppleClientId,
        saveLocalAppleRedirectUri,
        clearLocalClientId,
        clearLocalAppleClientId,
        STORAGE_KEY: GOOGLE_STORAGE_KEY,
    };
})();
