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

    let cnpjLookupTimer = null;
    let cnpjLookupInflight = '';
    let lastAutofillCnpj = '';

    const setStatus = (msg, isError = false) => {
        if (!statusEl) return;
        statusEl.textContent = msg;
        statusEl.hidden = !msg;
        statusEl.classList.toggle('lig-login-status--error', isError);
        statusEl.classList.toggle('lig-login-status--ok', !isError && Boolean(msg));
    };

    const resetSignup = () => {
        signupForm?.reset();
        cnpjLookupInflight = '';
        lastAutofillCnpj = '';
        setStatus('');
        if (submitBtn) submitBtn.disabled = false;
        window.setTimeout(() => cnpjInput?.focus(), 60);
    };

    const applySignupAutofill = (data) => {
        if (data.company && companyInput) companyInput.value = data.company;
        if (data.phone && phoneInput) {
            phoneInput.value = phoneAuth.maskPhoneInput(data.phone);
        }
        lastAutofillCnpj = phoneAuth.normalizeCnpj(cnpjInput?.value || '');
        setStatus('Dados preenchidos automaticamente.', false);
    };

    const lookupSignupCnpj = async (digits) => {
        if (!digits || digits === cnpjLookupInflight) return;
        cnpjLookupInflight = digits;
        setStatus('Consultando CNPJ…', false);
        try {
            const res = await fetch('/api/auth/signup-cnpj-lookup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cnpj: digits }),
            });
            const data = await res.json().catch(() => ({}));
            if (phoneAuth.normalizeCnpj(cnpjInput?.value || '') !== digits) return;
            if (!res.ok) {
                setStatus(data.error || 'CNPJ não encontrado. Preencha manualmente.', true);
                companyInput?.focus();
                return;
            }
            applySignupAutofill(data);
            if (!phoneAuth.normalizeCompanyName(companyInput?.value || '')) {
                companyInput?.focus();
            } else if (!phoneAuth.normalizePhoneBR(phoneInput?.value || '')) {
                phoneInput?.focus();
            }
        } catch {
            if (phoneAuth.normalizeCnpj(cnpjInput?.value || '') === digits) {
                setStatus('Falha ao consultar CNPJ. Preencha manualmente.', true);
            }
        } finally {
            if (cnpjLookupInflight === digits) cnpjLookupInflight = '';
        }
    };

    const scheduleCnpjLookup = () => {
        window.clearTimeout(cnpjLookupTimer);
        const digits = phoneAuth.normalizeCnpj(cnpjInput?.value || '');
        if (digits.length < 14) {
            if (lastAutofillCnpj && digits !== lastAutofillCnpj) {
                lastAutofillCnpj = '';
            }
            return;
        }
        if (!phoneAuth.isValidCnpj(digits)) return;
        if (digits === lastAutofillCnpj) return;
        cnpjLookupTimer = window.setTimeout(() => {
            void lookupSignupCnpj(digits);
        }, 450);
    };

    const submit = async (event) => {
        event?.preventDefault();

        const company = phoneAuth.normalizeCompanyName(companyInput?.value || '');
        const cnpj = phoneAuth.normalizeCnpj(cnpjInput?.value || '');
        const phone = phoneAuth.normalizePhoneBR(phoneInput?.value || '');

        if (!phoneAuth.isValidCnpj(cnpj)) {
            setStatus('Informe um CNPJ válido com 14 dígitos.', true);
            cnpjInput?.focus();
            return;
        }
        if (!phoneAuth.isValidCompanyName(company)) {
            setStatus('Informe o nome da empresa.', true);
            companyInput?.focus();
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
        if (statusEl?.classList.contains('lig-login-status--ok')) setStatus('');
        scheduleCnpjLookup();
    });

    phoneInput?.addEventListener('input', () => {
        if (!phoneInput) return;
        phoneInput.value = phoneAuth.maskPhoneInput(phoneInput.value);
        phoneInput.setSelectionRange(phoneInput.value.length, phoneInput.value.length);
    });

    companyInput?.addEventListener('input', () => {
        companyInput?.classList.remove('lig-login-setup__input--error');
    });

    signupForm?.addEventListener('submit', submit);
})();
