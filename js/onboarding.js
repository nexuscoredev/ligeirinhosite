(function () {
    const ONBOARDING_KEY = 'ligeirinho-onboarding-v1';

    const isDone = () => {
        try {
            return localStorage.getItem(ONBOARDING_KEY) === '1';
        } catch {
            return true;
        }
    };

    const markDone = () => {
        try {
            localStorage.setItem(ONBOARDING_KEY, '1');
        } catch {
            /* ignore */
        }
    };

    const categoryOptions = [
        { id: 'cervejas', label: 'Cervejas' },
        { id: 'destilados', label: 'Destilados' },
        { id: 'refrigerantes-sucos', label: 'Refrigerantes' },
        { id: 'energeticos', label: 'Energéticos' },
        { id: 'gelos', label: 'Gelos' },
    ];

    const build = () => {
        const chips = categoryOptions
            .map(
                (cat) =>
                    `<label class="lig-pref-chip"><input type="checkbox" name="onboard-cat" value="${cat.id}">${cat.label}</label>`
            )
            .join('');

        const el = document.createElement('div');
        el.id = 'lig-onboarding';
        el.className = 'lig-onboarding';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        el.setAttribute('aria-labelledby', 'lig-onboarding-title');
        el.innerHTML = `<div class="lig-onboarding__backdrop" data-onboard-close tabindex="-1"></div>
<div class="lig-onboarding__panel">
<div class="lig-onboarding__step lig-onboarding__step--active" data-step="0">
<div class="text-center mb-4">
<img src="img/ligeirinhologo.png" alt="" width="56" height="56" class="mx-auto rounded-xl mb-3" decoding="async">
<h2 id="lig-onboarding-title" class="text-lg font-bold lig-page-section-title">Bem-vindo ao Ligeirinho</h2>
<p class="text-sm lig-page-lead mt-2">Caixas e pallets para o seu negócio — peça em poucos toques.</p>
</div>
<label class="lig-page-label" for="onboard-address">Onde entregamos?</label>
<input class="lig-page-input mb-4" id="onboard-address" type="text" placeholder="Rua, número, bairro" autocomplete="street-address">
<button type="button" class="lig-btn-primary w-full" data-onboard-next>Continuar</button>
</div>
<div class="lig-onboarding__step" data-step="1">
<h2 class="text-lg font-bold lig-page-section-title mb-2">O que você mais pede?</h2>
<p class="text-sm lig-page-lead mb-4">Personalizamos a home com suas preferências.</p>
<div class="flex flex-wrap gap-2 mb-5">${chips}</div>
<button type="button" class="lig-btn-primary w-full" data-onboard-finish>Começar a pedir</button>
</div>
<div class="lig-onboarding__dots" aria-hidden="true">
<span class="lig-onboarding__dot lig-onboarding__dot--active" data-dot="0"></span>
<span class="lig-onboarding__dot" data-dot="1"></span>
</div>
</div>`;
        return el;
    };

    let currentStep = 0;
    let root;

    const showStep = (index) => {
        currentStep = index;
        root.querySelectorAll('.lig-onboarding__step').forEach((step) => {
            step.classList.toggle('lig-onboarding__step--active', Number(step.dataset.step) === index);
        });
        root.querySelectorAll('.lig-onboarding__dot').forEach((dot) => {
            dot.classList.toggle('lig-onboarding__dot--active', Number(dot.dataset.dot) === index);
        });
    };

    const finish = () => {
        const address = root.querySelector('#onboard-address')?.value?.trim();
        if (address && window.LigeirinhoCart) {
            window.LigeirinhoCart.saveCheckout({ address, deliveryType: 'entrega' });
        }
        const selected = [...root.querySelectorAll('input[name="onboard-cat"]:checked')].map((el) => el.value);
        window.LigeirinhoCart?.savePrefs?.({ categories: selected });
        markDone();
        root.setAttribute('hidden', '');
        document.body.style.overflow = '';
    };

    const bind = () => {
        root.querySelectorAll('[data-onboard-next]').forEach((btn) => {
            btn.addEventListener('click', () => {
                if (currentStep < 1) showStep(currentStep + 1);
            });
        });
        root.querySelector('[data-onboard-finish]')?.addEventListener('click', finish);
        root.querySelector('[data-onboard-close]')?.addEventListener('click', () => {
            markDone();
            root.setAttribute('hidden', '');
            document.body.style.overflow = '';
        });
    };

    const init = () => {
        if (document.body.dataset.page !== 'inicio') return;
        if (isDone()) return;
        if (document.getElementById('lig-onboarding')) return;

        root = build();
        document.body.appendChild(root);
        document.body.style.overflow = 'hidden';
        bind();
    };

    window.LigeirinhoOnboarding = { init, reset: () => localStorage.removeItem(ONBOARDING_KEY) };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
