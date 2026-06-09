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
