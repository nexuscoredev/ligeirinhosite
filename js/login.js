(function () {
    const auth = window.LigeirinhoAuth;
    const configApi = window.LigeirinhoAuthConfig;
    const routing = window.LigeirinhoAuthRouting;
    if (!auth || !configApi || !routing) return;

    const params = new URLSearchParams(window.location.search);
    const nextUrl = params.get('next') || '';

    const statusEl = document.getElementById('login-status');
    const googleBtn = document.getElementById('login-google-btn');
    const googleMount = document.getElementById('google-signin-mount');

    const isValidGoogleClientId = (id) => id.includes('.apps.googleusercontent.com');

    const setStatus = (msg, isError = false) => {
        if (!statusEl) return;
        statusEl.textContent = msg;
        statusEl.hidden = !msg;
        statusEl.classList.toggle('lig-login-status--error', isError);
        statusEl.classList.toggle('lig-login-status--ok', !isError && Boolean(msg));
    };

    const redirect = (role) => {
        routing.redirectAfterLogin(role, nextUrl);
    };

    const handleCredential = async (response) => {
        if (!response?.credential) {
            setStatus('Não foi possível entrar com Google. Tente novamente.', true);
            return;
        }
        try {
            setStatus('Validando perfil…', false);
            const payload = auth.parseJwt(response.credential);
            const profile = await routing.resolveProfile({
                type: 'google',
                credential: response.credential,
            });
            const session = auth.applyProfile({
                ...profile,
                picture: payload?.picture || '',
            });
            setStatus('Entrada realizada! Redirecionando…', false);
            window.setTimeout(() => redirect(session.role), 400);
        } catch {
            const session = auth.saveFromGoogleCredential(response.credential);
            setStatus('Entrada realizada! Redirecionando…', false);
            window.setTimeout(() => redirect(session?.role || 'PARCEIRO'), 400);
        }
    };

    const initGoogle = (clientId) => {
        const boot = () => {
            if (!window.google?.accounts?.id) {
                window.setTimeout(boot, 200);
                return;
            }

            window.google.accounts.id.initialize({
                client_id: clientId,
                callback: handleCredential,
                auto_select: false,
                cancel_on_tap_outside: true,
                locale: 'pt-BR',
                use_fedcm_for_prompt: true,
            });

            if (googleMount) {
                googleMount.innerHTML = '';
                googleMount.hidden = false;
                window.google.accounts.id.renderButton(googleMount, {
                    type: 'icon',
                    theme: 'outline',
                    size: 'medium',
                    shape: 'circle',
                    locale: 'pt-BR',
                });
                googleBtn?.setAttribute('hidden', '');
                return;
            }

            googleBtn?.removeAttribute('hidden');
            googleBtn?.addEventListener(
                'click',
                () => {
                    window.google.accounts.id.prompt();
                },
                { once: false }
            );
        };

        boot();
    };

    if (auth.isLoggedIn()) {
        const session = auth.loadSession();
        redirect(session?.role || 'PARCEIRO');
        return;
    }

    configApi.loadAuthConfig().then((config) => {
        const googleId = String(config.googleClientId || '').trim();

        if (isValidGoogleClientId(googleId)) {
            initGoogle(googleId);
            return;
        }

        googleBtn?.removeAttribute('hidden');
        googleMount && (googleMount.hidden = true);
    });
})();
