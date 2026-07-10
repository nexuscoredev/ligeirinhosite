(function () {
    const MODAL_ID = 'lig-promo-entry-notice';

    const ensureModal = (variant) => {
        let modal = document.getElementById(MODAL_ID);
        if (modal) {
            modal.classList.toggle('lig-promo-entry-notice--totem', variant === 'totem');
            return modal;
        }

        modal = document.createElement('div');
        modal.id = MODAL_ID;
        modal.className = `lig-promo-entry-notice${variant === 'totem' ? ' lig-promo-entry-notice--totem' : ''}`;
        modal.hidden = true;
        modal.innerHTML = `<div class="lig-promo-entry-notice__backdrop" aria-hidden="true"></div>
<div class="lig-promo-entry-notice__sheet" role="alertdialog" aria-modal="true" aria-labelledby="lig-promo-entry-notice-title" aria-describedby="lig-promo-entry-notice-lead">
<div class="lig-promo-entry-notice__icon-wrap" aria-hidden="true">
<span class="material-symbols-outlined lig-promo-entry-notice__icon">warning</span>
</div>
<h2 class="lig-promo-entry-notice__title" id="lig-promo-entry-notice-title">Atenção!</h2>
<p class="lig-promo-entry-notice__lead" id="lig-promo-entry-notice-lead">Promoções são válidas para pagamento apenas em PIX e Dinheiro</p>
<button type="button" class="lig-promo-entry-notice__proceed" data-promo-notice-proceed>Prosseguir</button>
</div>`;
        document.body.appendChild(modal);
        return modal;
    };

    const show = (options = {}) => {
        const variant = options.variant === 'totem' ? 'totem' : 'site';
        const modal = ensureModal(variant);
        const proceedBtn = modal.querySelector('[data-promo-notice-proceed]');

        return new Promise((resolve) => {
            if (modal.classList.contains('lig-promo-entry-notice--open')) {
                resolve();
                return;
            }

            const finish = () => {
                modal.classList.remove('lig-promo-entry-notice--open');
                document.documentElement.classList.remove('lig-promo-notice-open');
                window.setTimeout(() => {
                    modal.hidden = true;
                }, 220);
                resolve();
            };

            const onProceed = () => {
                proceedBtn?.removeEventListener('click', onProceed);
                finish();
            };

            modal.hidden = false;
            window.requestAnimationFrame(() => {
                modal.classList.add('lig-promo-entry-notice--open');
                document.documentElement.classList.add('lig-promo-notice-open');
                proceedBtn?.focus();
            });
            proceedBtn?.addEventListener('click', onProceed);
        });
    };

    window.LigeirinhoPromoEntryNotice = { show };
})();
