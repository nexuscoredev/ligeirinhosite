(function () {
    const CARTAO_IDS = new Set(['cartao', 'cartao_debito', 'cartao_credito', 'credit', 'debit', 'credito', 'debito']);

    function itemEhPromocional(item) {
        if (!item || typeof item !== 'object') return false;
        if (item.promoId || item.isPromo) return true;
        const discount = Number(item.discountPct ?? item.discount_pct);
        if (Number.isFinite(discount) && discount > 0) return true;
        const original = Number(item.originalPrice ?? item.original_price);
        const price = Number(item.price);
        return Number.isFinite(original) && Number.isFinite(price) && original > price + 0.009;
    }

    function pedidoTemItemPromocional(order) {
        const items = order?.items;
        if (!Array.isArray(items) || !items.length) return false;
        return items.some(itemEhPromocional);
    }

    function metodoUsaCartao(methodId) {
        return CARTAO_IDS.has(String(methodId || '').toLowerCase().trim());
    }

    function pagamentoUsaCartao(methodOrIds, paymentSplits) {
        if (Array.isArray(paymentSplits) && paymentSplits.length) {
            return paymentSplits.some((entry) => metodoUsaCartao(entry?.method || entry?.id));
        }
        if (Array.isArray(methodOrIds)) {
            return methodOrIds.some((id) => metodoUsaCartao(id));
        }
        const raw = String(methodOrIds || '').toLowerCase();
        if (!raw) return false;
        return raw.split('+').some((part) => metodoUsaCartao(part.trim()));
    }

    function metodosPermitidosTotem(order, allMethods) {
        const list = Array.isArray(allMethods) ? allMethods : [];
        if (!pedidoTemItemPromocional(order)) return list;
        return list.filter((m) => !metodoUsaCartao(m?.id || m));
    }

    function mensagemCartaoBloqueadoPromo() {
        return 'Pedidos com promoção não aceitam cartão. Use Pix ou dinheiro.';
    }

    window.LigeirinhoTotemPromoPayment = {
        itemEhPromocional,
        pedidoTemItemPromocional,
        metodoUsaCartao,
        pagamentoUsaCartao,
        metodosPermitidosTotem,
        mensagemCartaoBloqueadoPromo,
    };
})();
