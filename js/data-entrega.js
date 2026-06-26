(function () {
    const root = document.getElementById('data-entrega-app');
    if (!root) return;

    const cartApi = window.LigeirinhoCart;
    const deliveryApi = window.LigeirinhoDeliverySchedule;
    if (!cartApi || !deliveryApi) return;

    let schedule = null;
    let selectedDate = cartApi.loadCheckout().deliveryDate || '';

    const esc = (v) =>
        String(v ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');

    const slotHtml = (slot, active) => `<button type="button" class="delivery-slot${active ? ' delivery-slot--active' : ''}" data-date="${esc(slot.date)}" aria-pressed="${active ? 'true' : 'false'}">
<div class="delivery-slot__date">
<span class="delivery-slot__day">${slot.day}</span>
<span class="delivery-slot__month">${esc(slot.month)}</span>
</div>
<div class="delivery-slot__info">
<span class="delivery-slot__type">${esc(slot.type || 'Regular')}</span>
<strong class="delivery-slot__weekday">${esc(slot.weekday)}</strong>
</div>
<span class="delivery-slot__fee${Number(slot.fee) > 0 ? '' : ' delivery-slot__fee--free'}">${esc(slot.feeLabel || 'Grátis')}</span>
</button>`;

    const renderLoading = () => {
        root.innerHTML = `<div class="checkout-flow-shell checkout-flow-shell--plain">
<header class="checkout-flow-header checkout-flow-header--plain">
<button type="button" class="checkout-flow-header__back" id="data-entrega-back-btn" aria-label="Voltar">
<span class="material-symbols-outlined">arrow_back</span>
</button>
<h1 class="checkout-flow-header__title checkout-flow-header__title--solo">Data de Entrega</h1>
</header>
<div class="checkout-flow-content checkout-flow-content--center">
<p class="checkout-loading">Carregando datas disponíveis…</p>
</div>
</div>`;
        document.getElementById('data-entrega-back-btn')?.addEventListener('click', goBack);
    };

    const renderError = (message) => {
        root.innerHTML = `<div class="checkout-flow-shell checkout-flow-shell--plain">
<header class="checkout-flow-header checkout-flow-header--plain">
<button type="button" class="checkout-flow-header__back" id="data-entrega-back-btn" aria-label="Voltar">
<span class="material-symbols-outlined">arrow_back</span>
</button>
<h1 class="checkout-flow-header__title checkout-flow-header__title--solo">Data de Entrega</h1>
</header>
<div class="checkout-flow-content checkout-flow-content--center">
<p class="checkout-error" role="alert">${esc(message)}</p>
<button type="button" class="checkout-pill-btn" id="data-entrega-retry">Tentar novamente</button>
</div>
</div>`;
        document.getElementById('data-entrega-back-btn')?.addEventListener('click', goBack);
        document.getElementById('data-entrega-retry')?.addEventListener('click', init);
    };

    const goBack = () => {
        window.location.href = 'resumo.html';
    };

    const render = () => {
        const dates = schedule?.dates || [];
        if (!selectedDate && dates[0]) selectedDate = dates[0].date;

        root.innerHTML = `<div class="checkout-flow-shell checkout-flow-shell--plain">
<header class="checkout-flow-header checkout-flow-header--plain">
<button type="button" class="checkout-flow-header__back" id="data-entrega-back-btn" aria-label="Voltar">
<span class="material-symbols-outlined">arrow_back</span>
</button>
<h1 class="checkout-flow-header__title checkout-flow-header__title--solo">Data de Entrega</h1>
</header>

<div class="checkout-flow-content checkout-flow-content--slots">
${dates.length ? dates.map((slot) => slotHtml(slot, slot.date === selectedDate)).join('') : '<p class="checkout-error">Nenhuma data de entrega disponível no momento.</p>'}
</div>

<footer class="checkout-flow-footer checkout-flow-footer--plain">
<button type="button" id="data-entrega-confirm" class="checkout-confirm-btn checkout-confirm-btn--dark"${dates.length ? '' : ' disabled'}>
Confirmar data
</button>
</footer>
</div>`;

        document.getElementById('data-entrega-back-btn')?.addEventListener('click', goBack);

        root.querySelectorAll('.delivery-slot').forEach((btn) => {
            btn.addEventListener('click', () => {
                selectedDate = btn.dataset.date || '';
                render();
            });
        });

        document.getElementById('data-entrega-confirm')?.addEventListener('click', () => {
            const slot = deliveryApi.findSlot(schedule, selectedDate);
            if (!slot) return;
            cartApi.saveCheckout({
                deliveryDate: slot.date,
                deliveryDateLabel: deliveryApi.formatDeliveryDateLabel(slot.date),
            });
            goBack();
        });
    };

    const init = async () => {
        const checkout = cartApi.loadCheckout();
        if (checkout.deliveryType === 'retirada') {
            window.location.replace('resumo.html');
            return;
        }
        if (!cartApi.cartItemCount(cartApi.loadCart())) {
            window.location.replace('caminhao.html');
            return;
        }

        renderLoading();
        try {
            schedule = await deliveryApi.fetchSchedule();
            if (!schedule?.dates?.length) {
                renderError('Nenhuma data de entrega configurada. Tente mais tarde.');
                return;
            }
            if (selectedDate && !schedule.dates.some((d) => d.date === selectedDate)) {
                selectedDate = schedule.dates[0]?.date || '';
            }
            render();
        } catch (err) {
            renderError(err.message || 'Erro ao carregar datas.');
        }
    };

    init();
})();
