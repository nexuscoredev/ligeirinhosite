(function () {

    const root = document.getElementById('resumo-app');

    if (!root) return;



    const cartApi = window.LigeirinhoCart;

    const cartUi = window.LigeirinhoCartUI;

    const deliveryApi = window.LigeirinhoDeliverySchedule;

    const methods = window.LigeirinhoPaymentMethods;

    if (!cartApi) return;



    const esc = (v) =>

        String(v ?? '')

            .replace(/&/g, '&amp;')

            .replace(/</g, '&lt;')

            .replace(/"/g, '&quot;');



    const formatPrice = (value) => cartApi.formatMoney(value);



    const paymentLabel = (checkoutOrId) => {
        if (checkoutOrId && typeof checkoutOrId === 'object') {
            const checkout = checkoutOrId;
            const splitsApi = window.LigeirinhoPaymentSplits;
            if (splitsApi?.isMultiPayment?.(checkout)) {
                return splitsApi.formatSplitSummary(
                    checkout.paymentSplits,
                    (id) => methods?.label?.(id) || id || '',
                    formatPrice,
                );
            }
            return methods?.label?.(checkout.paymentMethod || checkout.payment) || checkout.paymentMethod || '';
        }
        return methods?.label?.(checkoutOrId) || checkoutOrId || '';
    };



    const ensureCart = () => {

        if (!cartApi.cartItemCount(cartApi.loadCart())) {

            window.location.replace('caminhao.html');

            return false;

        }

        return true;

    };



    const canConfirm = (checkout) => {

        const needsAddress = checkout.deliveryType === 'entrega';

        const addressOk = !needsAddress || Boolean(checkout.address?.trim());

        const dateOk = checkout.deliveryType === 'retirada' || Boolean(checkout.deliveryDate);

        const paymentOk = (() => {
            const splitsApi = window.LigeirinhoPaymentSplits;
            const total = cartApi.cartSummary(cartApi.loadCart()).subtotal;
            return splitsApi?.validateCheckoutPayment?.(checkout, total, (id) => methods?.label?.(id))?.ok;
        })();

        return addressOk && dateOk && paymentOk;

    };



    const productLineHtml = (item) => {

        const lineKey = item.cartKey || item.id;

        const meta = cartApi.itemMetaText(item);

        const thumb =

            cartUi?.lineThumbHtml?.(item, 'checkout-product__thumb') ||

            '<span class="checkout-product__thumb checkout-product__thumb--placeholder" aria-hidden="true"><span class="material-symbols-outlined">liquor</span></span>';

        const lineTotal = formatPrice(cartApi.lineSubtotal(item));

        return `<article class="checkout-product" data-cart-line="${esc(lineKey)}">

${thumb}

<div class="checkout-product__body">

<p class="checkout-product__name">${esc(item.name)}</p>

<p class="checkout-product__meta">${esc(meta)}</p>

</div>

<div class="checkout-product__side">

<span class="checkout-product__qty">x${item.qty}</span>

<strong class="checkout-product__total">${lineTotal}</strong>

</div>

</article>`;

    };



    const render = () => {

        if (!ensureCart()) return;



        const cart = cartApi.loadCart();

        const checkout = cartApi.loadCheckout();

        const items = cartApi.cartEntries(cart);

        const { units, subtotal } = cartApi.cartSummary(cart);

        const unitsLabel = units === 1 ? '1 produto' : `${units} produtos`;

        const paymentId = checkout.paymentMethod || checkout.payment || '';

        const paymentDisplay = paymentLabel(checkout);

        const deliveryLabel =
            checkout.deliveryType === 'retirada'

                ? 'Retirada no depósito'

                : checkout.deliveryDate

                  ? deliveryApi?.formatDeliveryDateLabel?.(checkout.deliveryDate) || checkout.deliveryDateLabel || checkout.deliveryDate

                  : '';

        const confirmReady = canConfirm(checkout);



        root.innerHTML = `<div class="checkout-flow-shell">

<header class="checkout-flow-header">

<button type="button" class="checkout-flow-header__back" id="resumo-back-btn" aria-label="Voltar">

<span class="material-symbols-outlined">arrow_back</span>

</button>

<div class="checkout-flow-header__main">

<h1 class="checkout-flow-header__title">Resumo do pedido</h1>

<p class="checkout-flow-header__sub">LIGEIRINHO PARCEIROS</p>

</div>

</header>



<div class="checkout-flow-content">

<section class="checkout-card checkout-card--vendor">

<img src="img/ligeirinhologo.png" alt="" class="checkout-vendor__logo" width="40" height="40" decoding="async">

<span class="checkout-vendor__name">Ligeirinho</span>

</section>



<section class="checkout-card">

<div class="checkout-card__head">

<div>

<h2 class="checkout-card__title">Data de entrega</h2>

<p class="checkout-card__hint">Campo obrigatório.</p>

</div>

</div>

${

    checkout.deliveryType === 'retirada'

        ? `<p class="checkout-card__value">Retirada no depósito — sem agendamento</p>`

        : deliveryLabel

          ? `<p class="checkout-card__value">${esc(deliveryLabel)}</p>

<button type="button" class="checkout-pill-btn" id="resumo-change-date">Alterar data</button>`

          : `<button type="button" class="checkout-pill-btn" id="resumo-select-date">Selecionar data</button>`

}

</section>



<section class="checkout-card">

<div class="checkout-card__head">

<div>

<h2 class="checkout-card__title">Método de pagamento</h2>

<p class="checkout-card__hint">Campo obrigatório.</p>

</div>

</div>

${

    paymentId

        ? `<p class="checkout-card__value">${esc(paymentDisplay)}</p>

<button type="button" class="checkout-pill-btn" id="resumo-change-payment">Alterar método</button>`

        : `<button type="button" class="checkout-pill-btn" id="resumo-select-payment">Selecionar método</button>`

}

</section>



<section class="checkout-card checkout-card--products">

<div class="checkout-card__head checkout-card__head--row">

<h2 class="checkout-card__title">Produtos</h2>

<span class="checkout-badge">${units}</span>

</div>

<div class="checkout-products">${items.map(productLineHtml).join('')}</div>

</section>



<section class="checkout-card checkout-card--summary">

<h2 class="checkout-card__title">Resumo do pedido</h2>

<div class="checkout-summary-row"><span>Subtotal (${unitsLabel})</span><span>${formatPrice(subtotal)}</span></div>

<div class="checkout-summary-row"><span>Taxa de entrega</span><strong class="checkout-summary-free">Grátis</strong></div>

<p class="checkout-summary-note">O total inclui impostos aplicáveis. Valores finais podem variar conforme legislação estadual.</p>

</section>

</div>



<footer class="checkout-flow-footer">

<button type="button" id="resumo-confirm-btn" class="checkout-confirm-btn${confirmReady ? '' : ' checkout-confirm-btn--disabled'}" ${confirmReady ? '' : 'disabled'}>

Confirmar pedido

</button>

</footer>

</div>`;



        bindActions();

    };



    const goSelectDate = () => {

        window.location.href = 'data-entrega.html';

    };



    const goSelectPayment = () => {

        window.location.href = 'metodo-pagamento.html';

    };



    const bindActions = () => {

        document.getElementById('resumo-back-btn')?.addEventListener('click', () => {

            if (window.history.length > 1) window.history.back();

            else window.location.href = 'caminhao.html';

        });



        ['resumo-select-date', 'resumo-change-date'].forEach((id) => {

            document.getElementById(id)?.addEventListener('click', goSelectDate);

        });



        ['resumo-select-payment', 'resumo-change-payment'].forEach((id) => {

            document.getElementById(id)?.addEventListener('click', goSelectPayment);

        });



        document.getElementById('resumo-confirm-btn')?.addEventListener('click', () => {

            const checkout = cartApi.loadCheckout();

            if (!canConfirm(checkout)) return;

            if (checkout.deliveryType === 'entrega' && !checkout.address?.trim()) {

                window.alert('Informe o endereço de entrega na barra superior.');

                return;

            }

            cartUi?.startPayment?.(['resumo-confirm-btn']);

        });

    };



    window.addEventListener('ligeirinho-cart-changed', render);

    window.addEventListener('ligeirinho-checkout-changed', render);

    render();

})();

