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
        } catch (err) {
            setStatus(err.message || 'Não foi possível validar o perfil no Hub. Use CNPJ e senha ou contate o comercial.', true);
        }
    };

    const disableGoogleBtn = (title) => {
        googleBtn?.classList.add('lig-login-google-btn--disabled');
        googleBtn?.setAttribute('aria-disabled', 'true');
        if (title) googleBtn?.setAttribute('title', title);
    };

    const renderGoogleButton = (clientId) => {
        const boot = () => {
            if (!window.google?.accounts?.id) {
                window.setTimeout(boot, 200);
                return;
            }

            if (!googleMount) {
                disableGoogleBtn('Login com Google indisponível');
                return;
            }

            window.google.accounts.id.initialize({
                client_id: clientId,
                callback: handleCredential,
                auto_select: false,
                cancel_on_tap_outside: true,
                locale: 'pt-BR',
                use_fedcm_for_prompt: false,
            });

            googleMount.innerHTML = '';
            googleMount.removeAttribute('aria-hidden');

            window.google.accounts.id.renderButton(googleMount, {
                type: 'icon',
                theme: 'outline',
                size: 'large',
                shape: 'circle',
                locale: 'pt-BR',
            });

            googleBtn?.classList.add('lig-login-google-btn--ready');
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
            renderGoogleButton(googleId);
            return;
        }

        disableGoogleBtn('Login com Google indisponível');
        setStatus('Login com Google não configurado neste ambiente.', true);
    });
})();
