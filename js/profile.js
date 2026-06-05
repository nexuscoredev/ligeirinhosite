(function () {

    const root = document.getElementById('profile-settings');

    if (!root) return;



    const cart = window.LigeirinhoCart;

    if (!cart) return;



    const auth = window.LigeirinhoAuth;

    const esc = (value) =>
        String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');

    const formatPrice = (value) =>

        value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });



    const prefillContactForm = (session) => {

        const nameInput = document.getElementById('name');

        const emailInput = document.getElementById('email');

        if (nameInput && session?.name && !nameInput.value) nameInput.value = session.name;

        if (emailInput && session?.email && !emailInput.value) emailInput.value = session.email;

        const phoneInput = document.getElementById('phone');

        if (phoneInput && session?.phone && !phoneInput.value) {
            const digits = String(session.phone).replace(/\D/g, '');
            const local = digits.startsWith('55') ? digits.slice(2) : digits;
            if (local.length === 11) {
                phoneInput.value = `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
            }
        }

    };



    const renderAuth = () => {

        const section = root.querySelector('#profile-auth');

        if (!section || !auth) return;

        const session = auth.loadSession();

        if (session?.sub) {

            const first = esc(auth.firstName(session));

            const contact = esc(auth.contactLabel(session) || auth.providerLabel(session));

            const avatar = /^https?:\/\//i.test(session.picture || '')
                ? esc(session.picture)
                : 'img/app-icon-192.png';

            section.innerHTML = `<div class="lig-profile-auth">

<img class="lig-profile-auth__avatar" src="${avatar}" alt="" width="56" height="56" loading="lazy" referrerpolicy="no-referrer">

<div class="lig-profile-auth__info">

<p class="lig-profile-auth__name">Olá, ${first}!</p>

<p class="lig-profile-auth__email">${contact}</p>

</div>

<div class="lig-profile-auth__actions">

<button type="button" id="profile-logout-btn" class="lig-profile-auth__btn lig-profile-auth__btn--ghost">Sair</button>

</div>

</div>`;

            section.querySelector('#profile-logout-btn')?.addEventListener('click', () => {

                auth.logout();

                renderAuth();

            });

            prefillContactForm(session);

            return;

        }

        section.innerHTML = `<div class="lig-profile-auth">

<div class="lig-profile-auth__avatar lig-profile-auth__avatar--guest" aria-hidden="true">

<span class="material-symbols-outlined">person</span>

</div>

<div class="lig-profile-auth__info">

<p class="lig-profile-auth__name">Entre na sua conta</p>

<p class="lig-profile-auth__email">Salve preferências e acesse mais rápido nos próximos pedidos.</p>

</div>

<div class="lig-profile-auth__actions">

<a href="login.html?next=contato.html%23minha-conta" class="lig-profile-auth__btn lig-profile-auth__btn--primary">

<span class="material-symbols-outlined text-[18px]">login</span>

Entrar

</a>

</div>

</div>`;

    };



    const categoryOptions = [

        { id: 'cervejas', label: 'Cervejas', icon: 'sports_bar' },

        { id: 'destilados', label: 'Destilados', icon: 'liquor' },

        { id: 'refrigerantes-sucos', label: 'Refrigerantes', icon: 'local_cafe' },

        { id: 'energeticos', label: 'Energéticos', icon: 'bolt' },

        { id: 'combos', label: 'Combos', icon: 'local_fire_department' },

        { id: 'gelos', label: 'Gelos', icon: 'ac_unit' },

        { id: 'whiskys', label: 'Whiskys', icon: 'wine_bar' },

        { id: 'vinhos', label: 'Vinhos', icon: 'wine_bar' },

    ];



    const renderReorder = () => {

        const section = root.querySelector('#profile-reorder');

        const summary = cart.lastOrderSummary();

        if (!section) return;

        if (!summary) {

            section.hidden = true;

            return;

        }

        section.hidden = false;

        section.querySelector('#profile-reorder-count').textContent =

            summary.count === 1 ? '1 item' : `${summary.count} itens`;

        section.querySelector('#profile-reorder-total').textContent = formatPrice(summary.total);

    };



    const renderPrefs = () => {

        const container = root.querySelector('#profile-prefs');

        if (!container) return;

        const prefs = cart.loadPrefs();

        container.innerHTML = categoryOptions

            .map((cat) => {

                const checked = prefs.categories.includes(cat.id);

                return `<label class="lig-pref-chip">

<input type="checkbox" name="profile-cat" value="${cat.id}"${checked ? ' checked' : ''}>

<span class="material-symbols-outlined text-[16px]">${cat.icon}</span>

${cat.label}

</label>`;

            })

            .join('');

        container.querySelectorAll('input[name="profile-cat"]').forEach((input) => {

            input.addEventListener('change', () => {

                const selected = [...container.querySelectorAll('input[name="profile-cat"]:checked')].map(

                    (el) => el.value

                );

                cart.savePrefs({ categories: selected });

            });

        });

    };



    root.querySelector('#profile-reorder-btn')?.addEventListener('click', () => {

        if (cart.restoreLastOrder()) {

            window.LigeirinhoCartUI?.render?.();

            window.LigeirinhoCartUI?.open?.();

        }

    });



    window.addEventListener('ligeirinho-cart-changed', renderReorder);

    window.addEventListener('ligeirinho-auth-changed', renderAuth);

    renderAuth();
    renderReorder();
    renderPrefs();
})();

