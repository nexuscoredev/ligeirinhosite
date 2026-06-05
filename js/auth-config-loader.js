(function () {
    const STORAGE_KEY = 'ligeirinho-google-client-id';

    const loadAuthConfig = async () => {
        let config = { googleClientId: '', requireLogin: false };

        try {
            const res = await fetch('data/auth-config.json');
            if (res.ok) config = { ...config, ...(await res.json()) };
        } catch {
            /* offline / missing */
        }

        try {
            const local = await fetch('data/auth-config.local.json');
            if (local.ok) config = { ...config, ...(await local.json()) };
        } catch {
            /* optional local override */
        }

        const stored = String(localStorage.getItem(STORAGE_KEY) || '').trim();
        if (stored) config.googleClientId = stored;

        const urlId = new URLSearchParams(window.location.search).get('googleClientId');
        if (urlId?.trim()) config.googleClientId = urlId.trim();

        config.googleClientId = String(config.googleClientId || '').trim();
        return config;
    };

    const saveLocalClientId = (clientId) => {
        const id = String(clientId || '').trim();
        if (!id) {
            localStorage.removeItem(STORAGE_KEY);
            return '';
        }
        localStorage.setItem(STORAGE_KEY, id);
        return id;
    };

    const clearLocalClientId = () => {
        localStorage.removeItem(STORAGE_KEY);
    };

    window.LigeirinhoAuthConfig = {
        STORAGE_KEY,
        loadAuthConfig,
        saveLocalClientId,
        clearLocalClientId,
    };
})();
