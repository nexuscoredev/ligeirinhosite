(function () {
    const auth = window.LigeirinhoAuth;
    const routing = window.LigeirinhoAuthRouting;
    const cartApi = window.LigeirinhoCart;
    const root = document.getElementById('totem-success-root');
    if (!root || !routing) return;

    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('order');

    const formatPrice = (value) =>
        Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const esc = (s) =>
        String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

    const receipt = window.LigeirinhoTotemReceipt;

    const goHome = () => {
        unbindActivity?.();
        homeTimeout?.cancel();
        cartApi?.clearTotemSession?.();
        window.location.replace('totem.html');
    };

    let homeTimeout = null;
    let unbindActivity = null;

    const updateHomeHint = (remaining, countdownSeconds) => {
        const hint = document.getElementById('totem-success-timeout-hint');
        if (!hint) return;
        if (remaining == null) {
            hint.hidden = true;
            hint.textContent = '';
            return;
        }
        hint.hidden = false;
        hint.textContent = `Nova tela em ${remaining}s`;
    };

    const armHomeTimer = (idleBeforeMs, countdownMs) => {
        const activity = window.LigeirinhoTotemActivity;
        homeTimeout?.cancel();
        homeTimeout = activity?.createCountdownTimeout?.({
            idleBeforeCountdownMs: idleBeforeMs,
            countdownMs,
            onReset: () => updateHomeHint(null),
            onCountdownStart: () => updateHomeHint(Math.ceil(countdownMs / 1000), countdownMs),
            onTick: (remaining) => updateHomeHint(remaining),
            onComplete: goHome,
        });
        homeTimeout?.arm();
        updateHomeHint(null);
        unbindActivity?.();
        unbindActivity = activity?.bind?.(() => homeTimeout?.bump(), document);
    };

    const init = async () => {
        if (!routing.guardPageAccess()) return;

        window.LigeirinhoTotemLoading?.mountPreset?.(root, 'success');

        let idleBeforeMs = 15000;
        let countdownMs = 10000;
        try {
            const cfg = await fetch('data/totem-units.json').then((r) => r.json());
            idleBeforeMs = Number(cfg?.defaults?.idleBeforeCountdownMs) || idleBeforeMs;
            countdownMs = Number(cfg?.defaults?.countdownMs) || countdownMs;
        } catch {
            /* ignore */
        }

        if (!orderId) {
            root.innerHTML = `<div class="lig-payment-card"><div class="totem-success-icon"><span class="material-symbols-outlined">check_circle</span></div><h1 class="lig-payment-title">Pedido confirmado</h1><p class="lig-payment-lead">Obrigado pela preferência.</p><p class="lig-payment-hint mt-4" id="totem-success-timeout-hint" hidden></p><button type="button" class="totem-btn totem-btn--primary totem-btn--xl w-full mt-6" id="totem-success-home">Novo pedido</button></div>`;
            document.getElementById('totem-success-home')?.addEventListener('click', goHome);
            armHomeTimer(idleBeforeMs, countdownMs);
            return;
        }

        try {
            const res = await fetch(`/api/orders/get?id=${encodeURIComponent(orderId)}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Pedido não encontrado');
            const order = data.order;
            const code = receipt?.formatCode?.(order.id) ?? order.id.replace(/[^a-fA-F0-9]/gi, '').slice(0, 4).toUpperCase();
            const copyCode = receipt?.compactCode?.(order.id) ?? code;

            root.innerHTML = `<div class="lig-payment-card lig-payment-card--success">
<div class="totem-success-icon"><span class="material-symbols-outlined">check_circle</span></div>
<h1 class="lig-payment-title">Pagamento confirmado</h1>
<p class="lig-payment-lead">Retire seu pedido no balcão. Mostre o código abaixo se solicitado.</p>
<button type="button" class="totem-success-code" data-totem-copy-code data-copy-text="${esc(copyCode)}" aria-label="Copiar código do pedido">${esc(code)}</button>
<p class="lig-payment-summary__total"><span>Total pago</span><strong>${formatPrice(order.total)}</strong></p>
<p class="lig-payment-hint mt-4" id="totem-success-timeout-hint" hidden></p>
<button type="button" class="totem-btn totem-btn--primary totem-btn--xl w-full mt-6" id="totem-success-home">Novo pedido</button>
</div>`;

            cartApi?.clearTotemSession?.();
            document.getElementById('totem-success-home')?.addEventListener('click', goHome);
            armHomeTimer(idleBeforeMs, countdownMs);
        } catch (err) {
            root.innerHTML = `<div class="lig-payment-card lig-payment-card--error"><h1 class="lig-payment-title">Pedido</h1><p class="lig-payment-lead">${esc(err.message)}</p><button type="button" class="totem-btn totem-btn--primary w-full mt-6" id="totem-success-home">Voltar ao início</button></div>`;
            document.getElementById('totem-success-home')?.addEventListener('click', goHome);
        }
    };

    init();
})();
