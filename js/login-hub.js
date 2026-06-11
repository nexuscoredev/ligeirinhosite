(function () {
    const auth = window.LigeirinhoAuth;
    const routing = window.LigeirinhoAuthRouting;
    if (!auth || !routing) return;

    const loginInput = document.getElementById('login-hub-user');
    const passwordInput = document.getElementById('login-hub-password');
    const submitBtn = document.getElementById('login-hub-submit');
    const statusEl = document.getElementById('login-status');

    const params = new URLSearchParams(window.location.search);
    const nextUrl = params.get('next') || '';

    const setStatus = (msg, isError = false) => {
        if (!statusEl) return;
        statusEl.textContent = msg;
        statusEl.hidden = !msg;
        statusEl.classList.toggle('lig-login-status--error', isError);
        statusEl.classList.toggle('lig-login-status--ok', !isError && Boolean(msg));
    };

    const submit = async () => {
        const login = String(loginInput?.value || '').trim();
        const password = String(passwordInput?.value || '');
        if (!login || !password) {
            setStatus('Informe usuário e senha do Hub.', true);
            return;
        }

        submitBtn && (submitBtn.disabled = true);
        setStatus('Validando acesso…', false);

        try {
            const session = await routing.loginWithProfile({ type: 'hub', login, password });
            setStatus('Entrada realizada! Redirecionando…', false);
            window.setTimeout(() => routing.redirectAfterLogin(session.role, nextUrl), 400);
        } catch (err) {
            setStatus(err.message || 'Usuário ou senha incorretos.', true);
            submitBtn && (submitBtn.disabled = false);
        }
    };

    submitBtn?.addEventListener('click', submit);
    passwordInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submit();
    });
    loginInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') passwordInput?.focus();
    });
})();
