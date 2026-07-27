(function () {
    const auth = window.LigeirinhoAuth;
    const phoneAuth = window.LigeirinhoPhoneAuth;
    const routing = window.LigeirinhoAuthRouting;
    if (!auth || !phoneAuth || !routing) return;

    const signupPanel = document.getElementById('login-mode-signup');
    const phoneToggle = document.getElementById('login-phone-toggle');
    const phoneInput = document.getElementById('login-phone-input');
    const nameInput = document.getElementById('login-phone-name');
    const submitBtn = document.getElementById('login-phone-submit');
    const statusEl = document.getElementById('login-phone-status');
    const params = new URLSearchParams(window.location.search);
    const nextUrl = params.get('next') || '';

    let step = 0;

    const setStatus = (msg, isError = false) => {
        if (!statusEl) return;
        statusEl.textContent = msg;
        statusEl.hidden = !msg;
        statusEl.classList.toggle('lig-login-status--error', isError);
        statusEl.classList.toggle('lig-login-status--ok', !isError && Boolean(msg));
    };

    const showStep = (index) => {
        step = index;
        signupPanel?.querySelectorAll('[data-signup-step]').forEach((el) => {
            el.hidden = Number(el.dataset.signupStep) !== index;
        });
        signupPanel?.querySelectorAll('[data-signup-bar]').forEach((bar) => {
            bar.classList.toggle('lig-signup-progress__bar--on', Number(bar.dataset.signupBar) <= index);
        });
        setStatus('');
        window.setTimeout(() => {
            if (index === 0) nameInput?.focus();
            else phoneInput?.focus();
        }, 60);
    };

    const resetSignup = () => {
        showStep(0);
        setStatus('');
        if (submitBtn) submitBtn.disabled = false;
    };

    const goNext = () => {
        if (step !== 0) return;
        const name = phoneAuth.normalizeName(nameInput?.value || '');
        if (!phoneAuth.isValidName(name)) {
            setStatus('Informe nome e sobrenome.', true);
            nameInput?.focus();
            return;
        }
        showStep(1);
    };

    const submit = async () => {
        const phone = phoneAuth.normalizePhoneBR(phoneInput?.value || '');
        const name = phoneAuth.normalizeName(nameInput?.value || '');

        if (!phoneAuth.isValidName(name)) {
            showStep(0);
            setStatus('Informe nome e sobrenome.', true);
            return;
        }
        if (!phone) {
            setStatus('Informe um celular válido com DDD, ex.: (11) 97092-4909.', true);
            phoneInput?.focus();
            return;
        }

        submitBtn && (submitBtn.disabled = true);
        setStatus('Criando conta…', false);

        try {
            const session = await routing.loginWithProfile({ type: 'phone', phone, name });
            setStatus('Conta criada! Redirecionando…', false);
            window.setTimeout(() => routing.redirectAfterLogin(session.role, nextUrl), 400);
        } catch {
            const fallback = auth.saveFromPhoneProfile({ phone, name });
            if (!fallback) {
                setStatus('Não foi possível concluir o cadastro. Tente novamente.', true);
                submitBtn && (submitBtn.disabled = false);
                return;
            }
            setStatus('Conta criada! Redirecionando…', false);
            window.setTimeout(() => routing.redirectAfterLogin('PARCEIRO', nextUrl), 400);
        }
    };

    phoneToggle?.addEventListener('click', () => {
        window.LigeirinhoLoginMode?.showMode?.('signup');
    });

    signupPanel?.querySelectorAll('[data-signup-next]').forEach((btn) => {
        btn.addEventListener('click', goNext);
    });

    window.addEventListener('lig-login-mode', (event) => {
        const mode = event.detail?.mode;
        if (mode === 'signup') {
            resetSignup();
            return;
        }
        if (mode === 'choose') resetSignup();
    });

    phoneInput?.addEventListener('input', () => {
        if (!phoneInput) return;
        phoneInput.value = phoneAuth.maskPhoneInput(phoneInput.value);
        phoneInput.setSelectionRange(phoneInput.value.length, phoneInput.value.length);
    });

    submitBtn?.addEventListener('click', submit);

    nameInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            goNext();
        }
    });
    phoneInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submit();
    });
})();
