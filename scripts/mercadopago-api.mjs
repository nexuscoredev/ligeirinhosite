export async function mpCreatePayment(accessToken, body, idempotencyKey) {
    const res = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error(data?.message || data?.error || 'Mercado Pago payment failed');
        err.status = res.status;
        err.details = data;
        throw err;
    }
    return data;
}

export async function mpGetPayment(accessToken, paymentId) {
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.message || 'Mercado Pago fetch payment failed');
    }
    return data;
}

export function mapMpStatusToOrder(mpStatus) {
    switch (mpStatus) {
        case 'approved':
            return 'paid';
        case 'pending':
        case 'in_process':
        case 'authorized':
            return 'pending_payment';
        case 'cancelled':
            return 'cancelled';
        case 'rejected':
        default:
            return 'failed';
    }
}

export function extractPixFromPayment(payment) {
    const tx = payment?.point_of_interaction?.transaction_data;
    if (!tx) return null;
    return {
        qr_code: tx.qr_code || null,
        qr_code_base64: tx.qr_code_base64 || null,
        ticket_url: tx.ticket_url || null,
    };
}

export function buildPaymentBody(order, formData, notificationUrl) {
    const amount = Number(order.total);
    const payer = formData?.payer || {};
    const email =
        String(payer.email || order.customer_email || '').trim() ||
        `pedido+${String(order.id).slice(0, 8)}@ligeirinho.app`;

    const body = {
        transaction_amount: amount,
        description: `Pedido Ligeirinho ${String(order.id).slice(0, 8)}`,
        payment_method_id: formData.payment_method_id,
        external_reference: order.id,
        notification_url: notificationUrl,
        payer: {
            ...payer,
            email,
            first_name: payer.first_name || order.customer_name?.split(' ')[0] || 'Cliente',
            last_name: payer.last_name || order.customer_name?.split(' ').slice(1).join(' ') || 'Ligeirinho',
        },
    };

    if (formData.token) body.token = formData.token;
    if (formData.installments) body.installments = Number(formData.installments) || 1;
    if (formData.issuer_id) body.issuer_id = formData.issuer_id;

    return body;
}

export async function mpCreatePixPayment(accessToken, order, notificationUrl, idempotencyKey) {
    const email =
        String(order.customer_email || '').trim() ||
        `pedido+${String(order.id).slice(0, 8)}@ligeirinho.app`;
    const body = {
        transaction_amount: Number(order.total),
        description: `Cobrança Ligeirinho #${String(order.id).slice(0, 8).toUpperCase()}`,
        payment_method_id: 'pix',
        external_reference: order.id,
        notification_url: notificationUrl,
        payer: {
            email,
            first_name: order.customer_name?.split(' ')[0] || 'Cliente',
            last_name: order.customer_name?.split(' ').slice(1).join(' ') || 'Ligeirinho',
        },
    };
    return mpCreatePayment(accessToken, body, idempotencyKey);
}

export async function mpCreatePreference(accessToken, { order, notificationUrl, successUrl, dueDateIso }) {
    const amount = Number(order.total);
    const shortId = String(order.id).slice(0, 8).toUpperCase();
    const body = {
        items: [
            {
                id: String(order.id),
                title: `Pedido Ligeirinho #${shortId}`,
                quantity: 1,
                unit_price: amount,
                currency_id: 'BRL',
            },
        ],
        external_reference: order.id,
        notification_url: notificationUrl,
        back_urls: {
            success: successUrl,
            failure: successUrl,
            pending: successUrl,
        },
        auto_return: 'approved',
        statement_descriptor: 'LIGEIRINHO',
        expires: Boolean(dueDateIso),
        expiration_date_to: dueDateIso || undefined,
        payer: order.customer_email
            ? { email: order.customer_email, name: order.customer_name || undefined }
            : undefined,
    };
    const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error(data?.message || data?.error || 'Mercado Pago preference failed');
        err.status = res.status;
        err.details = data;
        throw err;
    }
    return data;
}

export function mapMpStatusToFinancial(mpStatus) {
    switch (mpStatus) {
        case 'approved':
            return 'pago';
        case 'cancelled':
            return 'cancelado';
        case 'pending':
        case 'in_process':
        case 'authorized':
            return 'em_cobranca';
        default:
            return 'pendente';
    }
}
