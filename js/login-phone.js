(function () {
    const auth = window.LigeirinhoAuth;
    const phoneAuth = window.LigeirinhoPhoneAuth;
    const routing = window.LigeirinhoAuthRouting;
    if (!auth || !phoneAuth || !routing) return;

    const phoneModal = document.getElementById('login-phone-modal');
    const phoneToggle = document.getElementById('login-phone-toggle');
    const phoneInput = document.getElementById('login-phone-input');
    const nameInput = document.getElementById('login-phone-name');
    const submitBtn = document.getElementById('login-phone-submit');
    const statusEl = document.getElementById('login-phone-status');
    const params = new URLSearchParams(window.location.search);
    const nextUrl = params.get('next') || '';

    const closeTriggers = () => phoneModal?.querySelectorAll('[data-login-phone-close]') || [];

    const setStatus = (msg, isError = false) => {
        if (!statusEl) return;
        statusEl.textContent = msg;
        statusEl.hidden = !msg;
        statusEl.classList.toggle('lig-login-status--error', isError);
        statusEl.classList.toggle('lig-login-status--ok', !isError && Boolean(msg));
    };

    const openPhoneModal = () => {
        if (!phoneModal) return;
        phoneModal.classList.add('lig-login-modal--open');
        phoneModal.setAttribute('aria-hidden', 'false');
        document.documentElement.classList.add('lig-login-modal-open');
        phoneToggle?.setAttribute('aria-expanded', 'true');
        window.setTimeout(() => phoneInput?.focus(), 80);
    };

    const closePhoneModal = () => {
        if (!phoneModal) return;
        phoneModal.classList.remove('lig-login-modal--open');
        phoneModal.setAttribute('aria-hidden', 'true');
        document.documentElement.classList.remove('lig-login-modal-open');
        phoneToggle?.setAttribute('aria-expanded', 'false');
        setStatus('');
        phoneToggle?.focus();
    };

    phoneToggle?.addEventListener('click', openPhoneModal);

    closeTriggers().forEach((el) => {
        el.addEventListener('click', closePhoneModal);
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

    const submit = async () => {
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

        submitBtn && (submitBtn.disabled = true);
        setStatus('Validando perfil…', false);

        try {
            const session = await routing.loginWithProfile({ type: 'phone', phone, name });
            setStatus('Entrada realizada! Redirecionando…', false);
            window.setTimeout(() => routing.redirectAfterLogin(session.role, nextUrl), 400);
        } catch {
            const fallback = auth.saveFromPhoneProfile({ phone, name });
            if (!fallback) {
                setStatus('Não foi possível entrar. Tente novamente.', true);
                submitBtn && (submitBtn.disabled = false);
                return;
            }
            setStatus('Entrada realizada! Redirecionando…', false);
            window.setTimeout(() => routing.redirectAfterLogin('PARCEIRO', nextUrl), 400);
        }
    };

    submitBtn?.addEventListener('click', submit);

    nameInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submit();
    });

    phoneInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') nameInput?.focus();
    });
})();
