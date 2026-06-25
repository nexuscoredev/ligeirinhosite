(function () {
    const esc = (s) =>
        String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

    const PRESETS = {
        payment: {
            title: 'Preparando pagamento',
            lead: 'Carregando as formas de pagamento',
        },
        paymentConfirm: {
            title: 'Confirmando',
            lead: 'Registrando sua escolha',
        },
        caixa: {
            title: 'Quase pronto',
            lead: 'Preparando seu comprovante',
        },
        success: {
            title: 'Confirmando pagamento',
            lead: 'Validando seu pedido',
        },
        order: {
            title: 'Enviando pedido',
            lead: 'Aguarde um instante',
        },
    };

    const html = (title, lead = '') => `<div class="totem-loading lig-payment-card totem-pay-card" role="status" aria-live="polite" aria-busy="true">
<div class="totem-loading__ring" aria-hidden="true"><span></span></div>
<p class="totem-loading__title">${esc(title)}</p>
${lead ? `<p class="totem-loading__lead">${esc(lead)}</p>` : ''}
</div>`;

    const mount = (el, title, lead) => {
        if (!el) return;
        el.innerHTML = html(title, lead);
    };

    const mountPreset = (el, key) => {
        const preset = PRESETS[key];
        if (!preset || !el) return;
        mount(el, preset.title, preset.lead);
    };

    const bootPage = () => {
        const page = document.body?.dataset?.page;
        const map = {
            'totem-pagamento': ['payment-root', 'payment'],
            'totem-caixa': ['totem-caixa-root', 'caixa'],
            'totem-sucesso': ['totem-success-root', 'success'],
        };
        const cfg = map[page];
        if (!cfg) return;
        const el = document.getElementById(cfg[0]);
        if (!el || el.querySelector('.totem-loading')) return;
        mountPreset(el, cfg[1]);
    };

    window.LigeirinhoTotemLoading = {
        html,
        mount,
        mountPreset,
        PRESETS,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootPage, { once: true });
    } else {
        bootPage();
    }
})();
