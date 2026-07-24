(function () {
    const ONBOARDING_KEY = 'ligeirinho-onboarding-v2';

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
            /* migra chave antiga */
            localStorage.removeItem('ligeirinho-onboarding-v1');
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

    let root;

    const buildPrefs = () => {
        const chips = categoryOptions
            .map(
                (cat) =>
                    `<label class="lig-pref-chip"><input type="checkbox" name="onboard-cat" value="${cat.id}">${cat.label}</label>`,
            )
            .join('');

        const el = document.createElement('div');
        el.id = 'lig-onboarding';
        el.className = 'lig-onboarding';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        el.setAttribute('aria-labelledby', 'lig-onboarding-title');
        el.innerHTML = `<div class="lig-onboarding__backdrop" data-onboard-skip tabindex="-1"></div>
<div class="lig-onboarding__panel">
<div class="text-center mb-4">
<img src="img/ligeirinhologo.png" alt="" width="56" height="56" class="mx-auto mb-3 lig-brand__logo" decoding="async">
<h2 id="lig-onboarding-title" class="text-lg font-bold lig-page-section-title">O que você mais pede?</h2>
<p class="text-sm lig-page-lead mt-2">Personalizamos a home com suas preferências.</p>
</div>
<div class="flex flex-wrap gap-2 mb-5">${chips}</div>
<button type="button" class="lig-btn-primary w-full" data-onboard-finish>Começar a pedir</button>
<button type="button" class="lig-onboarding__skip" data-onboard-skip>Pular</button>
</div>`;
        return el;
    };

    const finishPrefs = () => {
        const selected = [...root.querySelectorAll('input[name="onboard-cat"]:checked')].map((el) => el.value);
        window.LigeirinhoCart?.savePrefs?.({ categories: selected });
        markDone();
        root.setAttribute('hidden', '');
        document.body.style.overflow = '';
    };

    const showPrefs = () => {
        if (document.getElementById('lig-onboarding')) return;
        root = buildPrefs();
        document.body.appendChild(root);
        document.body.style.overflow = 'hidden';
        root.querySelector('[data-onboard-finish]')?.addEventListener('click', finishPrefs);
        root.querySelectorAll('[data-onboard-skip]').forEach((el) => {
            el.addEventListener('click', () => {
                markDone();
                root.setAttribute('hidden', '');
                document.body.style.overflow = '';
            });
        });
    };

    const startAddressThenPrefs = () => {
        let confirmed = false;
        const openPicker = () => {
            if (!window.LigeirinhoAddressPicker?.open) {
                showPrefs();
                return;
            }
            window.LigeirinhoAddressPicker.open({
                view: 'search',
                onConfirm: () => {
                    confirmed = true;
                    showPrefs();
                },
                onDismiss: () => {
                    if (!confirmed) showPrefs();
                },
            });
        };

        if (window.LigeirinhoAddressPicker?.open) {
            openPicker();
            return;
        }

        const script = document.createElement('script');
        script.src = 'js/address-picker.js';
        script.onload = openPicker;
        script.onerror = showPrefs;
        document.body.appendChild(script);
    };

    const init = () => {
        if (document.body.dataset.page !== 'inicio') return;
        if (isDone()) return;

        const checkout = window.LigeirinhoCart?.loadCheckout?.();
        if (checkout?.address?.trim()) {
            showPrefs();
            return;
        }
        startAddressThenPrefs();
    };

    window.LigeirinhoOnboarding = {
        init,
        reset: () => {
            try {
                localStorage.removeItem(ONBOARDING_KEY);
                localStorage.removeItem('ligeirinho-onboarding-v1');
            } catch {
                /* ignore */
            }
        },
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
