/**
 * Camada de integração de pagamentos desacoplada.
 * O Totem e o Parceiros consomem a mesma interface; provedores podem ser trocados sem alterar o fluxo da UI.
 */
(function () {
    const PROVIDERS = {
        mercadopago: {
            id: 'mercadopago',
            label: 'Mercado Pago',
            methods: ['pix', 'credit', 'debit'],
            async getConfig() {
                const res = await fetch('/api/payments/config');
                const data = await res.json();
                if (!res.ok || !data.enabled) {
                    throw new Error(data.error || 'Pagamento indisponível');
                }
                return data;
            },
            async createPayment(orderId, formData) {
                const res = await fetch('/api/payments/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId, formData, provider: 'mercadopago' }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Falha no pagamento');
                return data;
            },
            loadSdk() {
                if (window.MercadoPago) return Promise.resolve();
                return new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://sdk.mercadopago.com/js/v2';
                    script.onload = () => resolve();
                    script.onerror = () => reject(new Error('SDK Mercado Pago indisponível'));
                    document.head.appendChild(script);
                });
            },
            mountBrick(publicKey, containerId, order, handlers) {
                const mp = new MercadoPago(publicKey, { locale: 'pt-BR' });
                return mp.bricks().create('payment', containerId, {
                    initialization: {
                        amount: Number(order.total),
                        payer: { email: order.customerEmail || 'totem@ligeirinho.com.br' },
                    },
                    customization: {
                        paymentMethods: {
                            creditCard: 'all',
                            debitCard: 'all',
                            bankTransfer: 'all',
                            ticket: 'all',
                            maxInstallments: 12,
                        },
                    },
                    callbacks: {
                        onReady: handlers.onReady,
                        onSubmit: handlers.onSubmit,
                        onError: handlers.onError,
                    },
                });
            },
        },
        santander: {
            id: 'santander',
            label: 'Santander PIX',
            methods: ['pix'],
            async getConfig() {
                const res = await fetch('/api/payments/config');
                const data = await res.json();
                return {
                    enabled: Boolean(data.capabilities?.pix && data.pixProvider === 'santander'),
                    publicKey: null,
                };
            },
            async createPayment(orderId) {
                const res = await fetch('/api/payments/pix', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Falha ao gerar PIX');
                return data;
            },
            loadSdk() {
                return Promise.resolve();
            },
            mountBrick() {
                throw new Error('Santander suporta apenas PIX neste canal.');
            },
        },
    };

    const activeProviderId = () =>
        String(window.LIG_PAYMENT_PROVIDER || 'mercadopago').toLowerCase();

    const getProvider = (id) => PROVIDERS[id || activeProviderId()] || PROVIDERS.mercadopago;

    window.LigeirinhoPaymentProviders = {
        PROVIDERS,
        activeProviderId,
        getProvider,
        listProviders: () => Object.values(PROVIDERS),
    };
})();
