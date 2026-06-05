(function () {
    const auth = window.LigeirinhoAuth;
    const phoneAuth = window.LigeirinhoPhoneAuth;
    if (!auth || !phoneAuth) return;

    const phoneInput = document.getElementById('login-phone-input');
    const nameInput = document.getElementById('login-phone-name');
    const submitBtn = document.getElementById('login-phone-submit');
    const statusEl = document.getElementById('login-status');

    const params = new URLSearchParams(window.location.search);
    const nextUrl = params.get('next') || 'contato.html#minha-conta';
    const safeNext = (() => {
        const base = nextUrl.split('#')[0];
        if (nextUrl.startsWith('//') || nextUrl.includes('://')) return 'contato.html#minha-conta';
        if (base.startsWith('/') || base.endsWith('.html')) return nextUrl;
        return 'contato.html#minha-conta';
    })();

    const setStatus = (msg, isError = false) => {
        if (!statusEl) return;
        statusEl.textContent = msg;
        statusEl.hidden = !msg;
        statusEl.classList.toggle('lig-login-status--error', isError);
        statusEl.classList.toggle('lig-login-status--ok', !isError && Boolean(msg));
    };

    phoneInput?.addEventListener('input', () => {
        if (!phoneInput) return;
        phoneInput.value = phoneAuth.maskPhoneInput(phoneInput.value);
        phoneInput.setSelectionRange(phoneInput.value.length, phoneInput.value.length);
    });

    const submit = () => {
        const phone = phoneAuth.normalizePhoneBR(phoneInput?.value || '');
        const name = phoneAuth.normalizeName(nameInput?.value || '');

        if (!phone) {
            setStatus('Informe um celular válido com DDD, ex.: (11) 97092-4909.', true);
            phoneInput?.focus();
            return;
        }

        if (!phoneAuth.isValidName(name)) {
            setStatus('Informe seu nome completo para identificarmos você nos pedidos.', true);
            nameInput?.focus();
            return;
        }

        const session = auth.saveFromPhoneProfile({ phone, name });
        if (!session) {
            setStatus('Não foi possível entrar. Tente novamente.', true);
            return;
        }

        setStatus('Entrada realizada! Redirecionando…', false);
        window.setTimeout(() => {
            window.location.href = safeNext;
        }, 400);
    };

    submitBtn?.addEventListener('click', submit);

    nameInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submit();
    });

    phoneInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') nameInput?.focus();
    });
})();
