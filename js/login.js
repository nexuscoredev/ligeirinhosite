(function () {
    const auth = window.LigeirinhoAuth;
    const configApi = window.LigeirinhoAuthConfig;
    if (!auth || !configApi) return;

    const params = new URLSearchParams(window.location.search);
    const nextUrl = params.get('next') || 'contato.html#minha-conta';
    const safeNext = (() => {
        const base = nextUrl.split('#')[0];
        if (nextUrl.startsWith('//') || nextUrl.includes('://')) return 'contato.html#minha-conta';
        if (base.startsWith('/') || base.endsWith('.html')) return nextUrl;
        return 'contato.html#minha-conta';
    })();

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

    const redirect = () => {
        window.location.href = safeNext;
    };

    const handleCredential = (response) => {
        if (!response?.credential) {
            setStatus('Não foi possível entrar com Google. Tente novamente.', true);
            return;
        }
        auth.saveFromGoogleCredential(response.credential);
        setStatus('Entrada realizada! Redirecionando…', false);
        window.setTimeout(redirect, 400);
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
                    type: 'standard',
                    theme: 'outline',
                    size: 'large',
                    text: 'continue_with',
                    shape: 'pill',
                    width: Math.min(360, googleMount.offsetWidth || 360),
                    locale: 'pt-BR',
                });
                googleBtn?.classList.add('hidden');
                return;
            }

            googleBtn?.classList.remove('hidden');
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
        redirect();
        return;
    }

    configApi.loadAuthConfig().then((config) => {
        const googleId = String(config.googleClientId || '').trim();

        if (isValidGoogleClientId(googleId)) {
            initGoogle(googleId);
            return;
        }

        googleBtn?.classList.remove('hidden');
        googleMount && (googleMount.hidden = true);
    });
})();
