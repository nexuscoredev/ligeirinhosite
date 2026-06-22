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
        cartApi?.clearTotemSession?.();
        window.location.replace('totem.html');
    };

    const init = async () => {
        if (!routing.guardPageAccess()) return;

        let timeoutMs = 18000;
        try {
            const cfg = await fetch('data/totem-units.json').then((r) => r.json());
            timeoutMs = Number(cfg?.defaults?.successTimeoutMs) || timeoutMs;
        } catch {
            /* ignore */
        }

        if (!orderId) {
            root.innerHTML = `<div class="lig-payment-card"><div class="totem-success-icon"><span class="material-symbols-outlined">check_circle</span></div><h1 class="lig-payment-title">Pedido confirmado</h1><p class="lig-payment-lead">Obrigado pela preferência.</p><button type="button" class="totem-btn totem-btn--primary totem-btn--xl w-full mt-6" id="totem-success-home">Novo pedido</button></div>`;
            document.getElementById('totem-success-home')?.addEventListener('click', goHome);
            window.setTimeout(goHome, timeoutMs);
            return;
        }

        try {
            const res = await fetch(`/api/orders/get?id=${encodeURIComponent(orderId)}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Pedido não encontrado');
            const order = data.order;
            const code = receipt?.formatCode?.(order.id) ?? order.id.slice(0, 8).toUpperCase();
            const copyCode = receipt?.compactCode?.(order.id) ?? code;

            root.innerHTML = `<div class="lig-payment-card lig-payment-card--success">
<div class="totem-success-icon"><span class="material-symbols-outlined">check_circle</span></div>
<h1 class="lig-payment-title">Pagamento confirmado</h1>
<p class="lig-payment-lead">Retire seu pedido no balcão. Mostre o código abaixo se solicitado.</p>
<button type="button" class="totem-success-code" data-totem-copy-code data-copy-text="${esc(copyCode)}" aria-label="Copiar código do pedido">${esc(code)}</button>
<p class="lig-payment-summary__total"><span>Total pago</span><strong>${formatPrice(order.total)}</strong></p>
<p class="lig-payment-hint mt-4">A tela reinicia automaticamente em alguns segundos.</p>
<button type="button" class="totem-btn totem-btn--primary totem-btn--xl w-full mt-6" id="totem-success-home">Novo pedido</button>
</div>`;

            cartApi?.clearTotemSession?.();
            document.getElementById('totem-success-home')?.addEventListener('click', goHome);
            window.setTimeout(goHome, timeoutMs);
        } catch (err) {
            root.innerHTML = `<div class="lig-payment-card lig-payment-card--error"><h1 class="lig-payment-title">Pedido</h1><p class="lig-payment-lead">${esc(err.message)}</p><button type="button" class="totem-btn totem-btn--primary w-full mt-6" id="totem-success-home">Voltar ao início</button></div>`;
            document.getElementById('totem-success-home')?.addEventListener('click', goHome);
        }
    };

    init();
})();
