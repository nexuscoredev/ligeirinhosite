(function () {
    const heroTitle = document.querySelector('.lig-login-title');
    const heroSub = document.querySelector('.lig-login-sub');
    const panels = {
        choose: document.getElementById('login-mode-choose'),
        signin: document.getElementById('login-mode-signin'),
        signup: document.getElementById('login-mode-signup'),
    };

    const copy = {
        choose: {
            title: 'Entre ou crie sua conta!',
            sub: 'Pedidos em caixa e pallet para o seu negócio',
        },
        signin: {
            title: 'Fazer login',
            sub: 'Entre com Google ou usuário e senha',
        },
        signup: {
            title: 'Cadastro',
            sub: 'Preencha seus dados para criar sua conta',
        },
    };

    let mode = 'choose';

    const showMode = (next) => {
        if (!panels[next]) return;
        mode = next;
        Object.entries(panels).forEach(([key, el]) => {
            if (!el) return;
            const active = key === next;
            el.hidden = !active;
            el.classList.toggle('lig-login-mode--active', active);
        });
        const text = copy[next] || copy.choose;
        if (heroTitle) heroTitle.textContent = text.title;
        if (heroSub) heroSub.textContent = text.sub;
        document.body.dataset.loginMode = next;
        window.dispatchEvent(new CustomEvent('lig-login-mode', { detail: { mode: next } }));
    };

    document.getElementById('login-go-signin')?.addEventListener('click', () => showMode('signin'));
    document.getElementById('login-go-signup')?.addEventListener('click', () => showMode('signup'));

    document.querySelectorAll('[data-login-mode]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-login-mode');
            if (target) showMode(target);
        });
    });

    const params = new URLSearchParams(window.location.search);
    if (params.get('cadastro') === '1') showMode('signup');
    else if (params.get('login') === '1' || params.get('metodo') === 'telefone') showMode('signin');

    window.LigeirinhoLoginMode = { showMode, getMode: () => mode };
})();
