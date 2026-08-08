(function () {
    const auth = window.LigeirinhoAuth;
    const phoneAuth = window.LigeirinhoPhoneAuth;
    const routing = window.LigeirinhoAuthRouting;
    if (!auth || !phoneAuth || !routing) return;

    const signupForm = document.getElementById('login-signup-form');
    const companyInput = document.getElementById('signup-company');
    const cnpjInput = document.getElementById('signup-cnpj');
    const phoneInput = document.getElementById('signup-phone');
    const submitBtn = document.getElementById('login-phone-submit');
    const statusEl = document.getElementById('login-phone-status');
    const params = new URLSearchParams(window.location.search);
    const nextUrl = params.get('next') || '';

    const setStatus = (msg, isError = false) => {
        if (!statusEl) return;
        statusEl.textContent = msg;
        statusEl.hidden = !msg;
        statusEl.classList.toggle('lig-login-status--error', isError);
        statusEl.classList.toggle('lig-login-status--ok', !isError && Boolean(msg));
    };

    const resetSignup = () => {
        signupForm?.reset();
        setStatus('');
        if (submitBtn) submitBtn.disabled = false;
        window.setTimeout(() => companyInput?.focus(), 60);
    };

    const submit = async (event) => {
        event?.preventDefault();

        const company = phoneAuth.normalizeCompanyName(companyInput?.value || '');
        const cnpj = phoneAuth.normalizeCnpj(cnpjInput?.value || '');
        const phone = phoneAuth.normalizePhoneBR(phoneInput?.value || '');

        if (!phoneAuth.isValidCompanyName(company)) {
            setStatus('Informe o nome da empresa.', true);
            companyInput?.focus();
            return;
        }
        if (!phoneAuth.isValidCnpj(cnpj)) {
            setStatus('Informe um CNPJ válido com 14 dígitos.', true);
            cnpjInput?.focus();
            return;
        }
        if (!phone) {
            setStatus('Informe um telefone válido com DDD, ex.: (11) 97092-4909.', true);
            phoneInput?.focus();
            return;
        }

        submitBtn && (submitBtn.disabled = true);
        setStatus('Criando conta…', false);

        try {
            const { session } = await routing.loginWithProfile({
                type: 'phone',
                phone,
                name: company,
                cnpj,
            });
            setStatus('Conta criada! Redirecionando…', false);
            window.setTimeout(() => routing.redirectAfterLogin(session.role, nextUrl, session), 400);
        } catch {
            const fallback = auth.saveFromPhoneProfile({ phone, name: company, cnpj });
            if (!fallback) {
                setStatus('Não foi possível concluir o cadastro. Tente novamente.', true);
                submitBtn && (submitBtn.disabled = false);
                return;
            }
            setStatus('Conta criada! Redirecionando…', false);
            window.setTimeout(() => routing.redirectAfterLogin('PARCEIRO', nextUrl, fallback), 400);
        }
    };

    window.addEventListener('lig-login-mode', (event) => {
        const mode = event.detail?.mode;
        if (mode === 'signup') {
            resetSignup();
            return;
        }
        if (mode === 'choose') resetSignup();
    });

    cnpjInput?.addEventListener('input', () => {
        if (!cnpjInput) return;
        cnpjInput.value = phoneAuth.maskCnpjInput(cnpjInput.value);
    });

    phoneInput?.addEventListener('input', () => {
        if (!phoneInput) return;
        phoneInput.value = phoneAuth.maskPhoneInput(phoneInput.value);
        phoneInput.setSelectionRange(phoneInput.value.length, phoneInput.value.length);
    });

    signupForm?.addEventListener('submit', submit);
})();
