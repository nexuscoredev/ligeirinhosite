(function () {
    const auth = window.LigeirinhoAuth;
    const phoneAuth = window.LigeirinhoPhoneAuth;
    const routing = window.LigeirinhoAuthRouting;
    if (!auth || !phoneAuth || !routing) return;

    const phoneModal = document.getElementById('login-phone-modal');
    const phoneToggle = document.getElementById('login-phone-toggle');
    const phoneInput = document.getElementById('login-phone-input');
    const nameInput = document.getElementById('login-phone-name');
    const birthInput = document.getElementById('login-phone-birth');
    const submitBtn = document.getElementById('login-phone-submit');
    const backBtn = document.getElementById('login-signup-back');
    const statusEl = document.getElementById('login-phone-status');
    const params = new URLSearchParams(window.location.search);
    const nextUrl = params.get('next') || '';

    let step = 0;

    const closeTriggers = () => phoneModal?.querySelectorAll('[data-login-phone-close]') || [];

    const setStatus = (msg, isError = false) => {
        if (!statusEl) return;
        statusEl.textContent = msg;
        statusEl.hidden = !msg;
        statusEl.classList.toggle('lig-login-status--error', isError);
        statusEl.classList.toggle('lig-login-status--ok', !isError && Boolean(msg));
    };

    const maskBirth = (raw) => {
        const digits = String(raw || '')
            .replace(/\D/g, '')
            .slice(0, 8);
        if (digits.length <= 2) return digits;
        if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
        return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    };

    const isValidBirth = (value) => {
        const m = String(value || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (!m) return false;
        const day = Number(m[1]);
        const month = Number(m[2]);
        const year = Number(m[3]);
        if (month < 1 || month > 12 || day < 1 || day > 31) return false;
        if (year < 1920 || year > new Date().getFullYear() - 16) return false;
        const dt = new Date(year, month - 1, day);
        return dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day;
    };

    const showStep = (index) => {
        step = index;
        phoneModal?.querySelectorAll('[data-signup-step]').forEach((el) => {
            el.hidden = Number(el.dataset.signupStep) !== index;
        });
        phoneModal?.querySelectorAll('[data-signup-bar]').forEach((bar) => {
            bar.classList.toggle('lig-signup-progress__bar--on', Number(bar.dataset.signupBar) <= index);
        });
        if (backBtn) backBtn.hidden = index === 0;
        setStatus('');
        window.setTimeout(() => {
            if (index === 0) nameInput?.focus();
            else if (index === 1) birthInput?.focus();
            else phoneInput?.focus();
        }, 60);
    };

    const openPhoneModal = () => {
        if (!phoneModal) return;
        phoneModal.classList.add('lig-login-modal--open');
        phoneModal.setAttribute('aria-hidden', 'false');
        document.documentElement.classList.add('lig-login-modal-open');
        phoneToggle?.setAttribute('aria-expanded', 'true');
        showStep(0);
    };

    const closePhoneModal = () => {
        if (!phoneModal) return;
        phoneModal.classList.remove('lig-login-modal--open');
        phoneModal.setAttribute('aria-hidden', 'true');
        document.documentElement.classList.remove('lig-login-modal-open');
        phoneToggle?.setAttribute('aria-expanded', 'false');
        setStatus('');
        showStep(0);
        phoneToggle?.focus();
    };

    const goNext = () => {
        if (step === 0) {
            const name = phoneAuth.normalizeName(nameInput?.value || '');
            if (!phoneAuth.isValidName(name)) {
                setStatus('Informe nome e sobrenome.', true);
                nameInput?.focus();
                return;
            }
            showStep(1);
            return;
        }
        if (step === 1) {
            if (!isValidBirth(birthInput?.value || '')) {
                setStatus('Informe uma data válida (DD/MM/AAAA). É preciso ter 16 anos ou mais.', true);
                birthInput?.focus();
                return;
            }
            showStep(2);
        }
    };

    const submit = async () => {
        const phone = phoneAuth.normalizePhoneBR(phoneInput?.value || '');
        const name = phoneAuth.normalizeName(nameInput?.value || '');
        const birthDate = (birthInput?.value || '').trim();

        if (!phoneAuth.isValidName(name)) {
            showStep(0);
            setStatus('Informe nome e sobrenome.', true);
            return;
        }
        if (!isValidBirth(birthDate)) {
            showStep(1);
            setStatus('Informe uma data válida (DD/MM/AAAA).', true);
            return;
        }
        if (!phone) {
            setStatus('Informe um celular válido com DDD, ex.: (11) 97092-4909.', true);
            phoneInput?.focus();
            return;
        }

        window.LigeirinhoCart?.savePrefs?.({ birthDate });

        submitBtn && (submitBtn.disabled = true);
        setStatus('Criando conta…', false);

        try {
            const session = await routing.loginWithProfile({ type: 'phone', phone, name });
            setStatus('Conta pronta! Redirecionando…', false);
            window.setTimeout(() => routing.redirectAfterLogin(session.role, nextUrl), 400);
        } catch {
            const fallback = auth.saveFromPhoneProfile({ phone, name });
            if (!fallback) {
                setStatus('Não foi possível entrar. Tente novamente.', true);
                submitBtn && (submitBtn.disabled = false);
                return;
            }
            setStatus('Conta pronta! Redirecionando…', false);
            window.setTimeout(() => routing.redirectAfterLogin('PARCEIRO', nextUrl), 400);
        }
    };

    phoneToggle?.addEventListener('click', openPhoneModal);

    closeTriggers().forEach((el) => {
        el.addEventListener('click', closePhoneModal);
    });

    backBtn?.addEventListener('click', () => {
        if (step > 0) showStep(step - 1);
    });

    phoneModal?.querySelectorAll('[data-signup-next]').forEach((btn) => {
        btn.addEventListener('click', goNext);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && phoneModal?.classList.contains('lig-login-modal--open')) {
            e.preventDefault();
            closePhoneModal();
        }
    });

    if (params.get('metodo') === 'telefone') {
        openPhoneModal();
    }

    phoneInput?.addEventListener('input', () => {
        if (!phoneInput) return;
        phoneInput.value = phoneAuth.maskPhoneInput(phoneInput.value);
        phoneInput.setSelectionRange(phoneInput.value.length, phoneInput.value.length);
    });

    birthInput?.addEventListener('input', () => {
        if (!birthInput) return;
        birthInput.value = maskBirth(birthInput.value);
    });

    submitBtn?.addEventListener('click', submit);

    nameInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            goNext();
        }
    });
    birthInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            goNext();
        }
    });
    phoneInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submit();
    });
})();
