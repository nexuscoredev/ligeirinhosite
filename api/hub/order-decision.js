import { paymentEnv, assertOrderBackend } from '../../scripts/payment-env.mjs';
import { applyHubPdvCors, handleHubPdvCorsPreflight } from '../../scripts/api-cors.mjs';
import { requireHubSession } from './_require-hub-session.mjs';
import { dbFromPaymentConfig } from '../../scripts/supabase-orders.mjs';
import {
    applyHubOrderDecision,
    assertPodeAlterarPedidoHub,
} from '../../scripts/hub-order-decision.mjs';

export const config = { maxDuration: 20 };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
    if (handleHubPdvCorsPreflight(req, res)) return;
    applyHubPdvCors(req, res);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store');

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST, OPTIONS');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const session = await requireHubSession(req);
    if (session.error) {
        return res.status(session.status).json({ error: session.error });
    }

    const pode = await assertPodeAlterarPedidoHub(session.config, session.token);
    if (!pode) {
        return res.status(403).json({
            error: 'Sem permissão para validar pedidos Parceiros.',
        });
    }

    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const origin = host ? `${proto}://${host}` : null;
    const payConfig = paymentEnv(process.env, origin);
    const missing = assertOrderBackend(payConfig);
    if (missing.length) {
        return res.status(503).json({ error: 'Backend indisponível', missing });
    }

    const body = req.body || {};
    const acao = String(body.acao || body.action || '').trim().toLowerCase();
    if (acao !== 'aceitar' && acao !== 'recusar') {
        return res.status(400).json({ error: 'Informe acao: aceitar ou recusar.' });
    }

    const orderId = String(body.order_id || body.orderId || body.id || '').trim();
    const hubPedidoId = String(body.hub_pedido_id || body.hubPedidoId || body.pedido_id || '').trim();
    if (!UUID_RE.test(orderId) && !UUID_RE.test(hubPedidoId)) {
        return res.status(400).json({ error: 'Informe order_id ou hub_pedido_id válido.' });
    }

    const hubPedidoNumeroRaw = body.numero ?? body.hub_pedido_numero ?? body.hubPedidoNumero;
    const hubPedidoNumero =
        hubPedidoNumeroRaw != null && Number.isFinite(Number(hubPedidoNumeroRaw))
            ? Number(hubPedidoNumeroRaw)
            : null;

    try {
        const db = dbFromPaymentConfig(payConfig);
        const result = await applyHubOrderDecision(
            {
                acao,
                orderId: UUID_RE.test(orderId) ? orderId : null,
                hubPedidoId: UUID_RE.test(hubPedidoId) ? hubPedidoId : null,
                hubPedidoNumero,
                justificativa: body.justificativa || body.motivo || '',
                senderUserId: session.userId,
            },
            db,
            process.env,
        );
        return res.status(200).json({ ok: true, ...result });
    } catch (err) {
        console.error('hub/order-decision', err);
        return res.status(err.status || 500).json({
            error: err.message || 'Falha ao sincronizar decisão do pedido.',
        });
    }
}
