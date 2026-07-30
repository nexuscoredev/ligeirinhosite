import { hubConfig } from './hub-auth.mjs';

function hubHeaders(config) {
    return {
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
        'Content-Type': 'application/json',
    };
}

export async function fetchHubPedidoById(hubPedidoId, env = process.env) {
    const hub = hubConfig(env);
    if (!hub.serviceKey || !hubPedidoId) return null;
    const res = await fetch(
        `${hub.url}/rest/v1/pedidos?select=id,numero,status,aceito_em,pagamento_recebido_em,observacoes&id=eq.${encodeURIComponent(hubPedidoId)}&limit=1`,
        { headers: hubHeaders(hub) },
    );
    const data = await res.json().catch(() => null);
    if (!res.ok || !Array.isArray(data) || !data[0]) return null;
    return data[0];
}

export async function fetchHubPedidoByParceirosOrderId(parceirosOrderId, env = process.env) {
    const hub = hubConfig(env);
    if (!hub.serviceKey || !parceirosOrderId) return null;
    const res = await fetch(
        `${hub.url}/rest/v1/pedidos?select=id,numero,status,aceito_em,pagamento_recebido_em,observacoes&parceiros_order_id=eq.${encodeURIComponent(parceirosOrderId)}&limit=1`,
        { headers: hubHeaders(hub) },
    );
    const data = await res.json().catch(() => null);
    if (!res.ok || !Array.isArray(data) || !data[0]) return null;
    return data[0];
}

async function fetchHubPedidosByFilter(hub, filterQuery) {
    const res = await fetch(
        `${hub.url}/rest/v1/pedidos?select=id,numero,status,aceito_em,pagamento_recebido_em,observacoes,parceiros_order_id&${filterQuery}`,
        { headers: hubHeaders(hub) },
    );
    const data = await res.json().catch(() => null);
    if (!res.ok || !Array.isArray(data)) return [];
    return data;
}

async function fetchHubPedidosInColumn(hub, column, ids) {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return [];
    const chunkSize = 40;
    const rows = [];
    for (let i = 0; i < unique.length; i += chunkSize) {
        const chunk = unique.slice(i, i + chunkSize);
        const filter = `${column}=in.(${chunk.map((id) => encodeURIComponent(id)).join(',')})`;
        rows.push(...(await fetchHubPedidosByFilter(hub, filter)));
    }
    return rows;
}

/** Mapa order.id (Parceiros) → pedido Hub. */
export async function fetchHubPedidosMapForOrders(orders, env = process.env) {
    const hub = hubConfig(env);
    const map = new Map();
    if (!hub.serviceKey || !orders?.length) return map;

    const views = orders.filter(Boolean);
    const hubIds = views.map((o) => o.hubPedidoId).filter(Boolean);
    const parceirosIds = views.filter((o) => !o.hubPedidoId && o.id).map((o) => o.id);

    const [byHubId, byParceirosId] = await Promise.all([
        fetchHubPedidosInColumn(hub, 'id', hubIds),
        fetchHubPedidosInColumn(hub, 'parceiros_order_id', parceirosIds),
    ]);

    for (const row of byHubId) {
        const view = views.find((o) => o.hubPedidoId === row.id);
        if (view?.id) map.set(view.id, row);
    }
    for (const row of byParceirosId) {
        const pid = row.parceiros_order_id;
        if (pid && !map.has(pid)) map.set(pid, row);
    }

    return map;
}

export async function enrichOrdersWithTracking(orders, env = process.env) {
    const views = (orders || []).filter(Boolean);
    if (!views.length) return [];
    const hubMap = await fetchHubPedidosMapForOrders(views, env);
    return views.map((view) => ({
        ...view,
        tracking: buildOrderTracking(view, hubMap.get(view.id) || null),
    }));
}

const ROUTE_STATUSES = new Set([
    'em_rota',
    'a_caminho',
    'saiu_entrega',
    'em_entrega',
    'proximo_entrega',
    'com_ocorrencia',
]);

/** Separação concluída — aguardando NF / conferência (não voltar ao Aceite). */
const SEPARATED_STATUSES = new Set(['separado', 'aguardando_emissao_nf']);

const STOCK_ISSUE_STATUSES = new Set(['falta_estoque']);

/** Pronto para retirada/entrega (pós-NF, antes ou na fila de rota). */
const READY_STATUSES = new Set([
    'aguardando_retirada',
    'aguardando_entrega',
    'aguardando_roteirizacao',
]);

const PREP_STATUSES = new Set([
    'aguardando_separacao',
    'em_separacao',
    'separacao_pausada',
    'refazer_separacao',
    'separando',
    'aceito',
    'em_preparacao',
]);

const ACCEPTED_STATUSES = new Set(['em_andamento']);

const DONE_STATUSES = new Set([
    'entregue',
    'concluido',
    'finalizado',
    'entrega_concluida',
    'retirado',
]);

const CANCEL_STATUSES = new Set(['cancelado', 'cancelado_cliente', 'cancelled', 'cancelada']);

function isPickupOrder(order) {
    const type = String(order?.deliveryType || order?.delivery_type || '').toLowerCase();
    return type === 'retirada';
}

function pickupReadyCopy() {
    return {
        step: 3,
        stepLabel: 'Aguardando retirada',
        headerTitle: 'Pronto para retirada',
        message: 'Seu pedido está pronto. Você já pode retirar no ponto Ligeirinho.',
    };
}

function resolveTrackingFilterKey(order, { cancelled, step, hubStatus, isPickup }) {
    if (cancelled) return 'cancelled';
    if (order?.status === 'pending_payment' || hubStatus === 'aguardando_pagamento') {
        return 'pending_payment';
    }
    if (step >= 4 || DONE_STATUSES.has(hubStatus)) return 'done';
    if (ROUTE_STATUSES.has(hubStatus) || READY_STATUSES.has(hubStatus) || step >= 3) {
        return isPickup ? 'pickup' : 'route';
    }
    // Retirada: pós-separação já conta como aguardando retirada (sem fila de NF no app).
    if (isPickup && SEPARATED_STATUSES.has(hubStatus)) return 'pickup';
    if (SEPARATED_STATUSES.has(hubStatus) || STOCK_ISSUE_STATUSES.has(hubStatus)) {
        return 'separated';
    }
    if (ACCEPTED_STATUSES.has(hubStatus)) return 'accepted';
    if (PREP_STATUSES.has(hubStatus)) return 'separation';
    if (
        order?.status === 'confirmed' &&
        (hubStatus === 'pendente' || hubStatus === 'aguardando_aceite' || !hubStatus)
    ) {
        return 'accepted';
    }
    if (step <= 1 || order?.status === 'pending') return 'pending';
    if (order?.status === 'paid') return 'paid';
    return 'progress';
}

function trackingCopyForHubStatus(hubStatus, { isPickup = false } = {}) {
    // Parceiros retirada: após separar, já mostra aguardando retirada (sem texto de NF).
    if (isPickup && SEPARATED_STATUSES.has(hubStatus)) {
        return pickupReadyCopy();
    }
    if (hubStatus === 'aguardando_emissao_nf') {
        return {
            step: 2,
            stepLabel: 'Separado',
            headerTitle: 'Pedido separado',
            message: 'Separação concluída. Seu pedido segue para a próxima etapa.',
        };
    }
    if (hubStatus === 'separado') {
        return {
            step: 2,
            stepLabel: 'Separado',
            headerTitle: 'Pedido separado',
            message: 'Seu pedido foi separado e segue para a próxima etapa.',
        };
    }
    if (hubStatus === 'falta_estoque') {
        return {
            step: 2,
            stepLabel: 'Ajuste de estoque',
            headerTitle: 'Pedido com ajuste',
            message:
                'Alguns itens ficaram indisponíveis na separação. A loja está ajustando seu pedido.',
        };
    }
    if (
        hubStatus === 'aguardando_retirada' ||
        (isPickup &&
            (hubStatus === 'aguardando_entrega' || hubStatus === 'aguardando_roteirizacao'))
    ) {
        return pickupReadyCopy();
    }
    if (hubStatus === 'aguardando_entrega' || hubStatus === 'aguardando_roteirizacao') {
        return {
            step: 3,
            stepLabel: 'Aguardando entrega',
            headerTitle: 'Pronto para entrega',
            message: 'Seu pedido está separado e aguarda a saída para entrega.',
        };
    }
    if (hubStatus === 'com_ocorrencia') {
        return {
            step: 3,
            stepLabel: 'Em acompanhamento',
            headerTitle: 'Pedido em acompanhamento',
            message: 'Há uma ocorrência no pedido. Estamos resolvendo e já atualizamos você.',
        };
    }
    if (hubStatus === 'retirado') {
        return {
            step: 4,
            stepLabel: 'Retirado',
            headerTitle: 'Pedido retirado',
            message: 'Pedido retirado com sucesso. Obrigado pela preferência!',
        };
    }
    if (hubStatus === 'separacao_pausada') {
        return {
            step: 2,
            stepLabel: 'Separação pausada',
            headerTitle: 'Separação pausada',
            message: 'A separação do seu pedido foi pausada temporariamente e será retomada em breve.',
        };
    }
    if (hubStatus === 'refazer_separacao') {
        return {
            step: 2,
            stepLabel: 'Em separação',
            headerTitle: 'Em separação',
            message: 'Seu pedido voltou para separação para conferência dos itens.',
        };
    }
    if (hubStatus === 'aguardando_separacao') {
        return {
            step: 2,
            stepLabel: 'Aguardando separação',
            headerTitle: 'Aguardando separação',
            message: 'Seu pedido foi aceito e entra na fila de separação.',
        };
    }
    return null;
}

export function buildOrderTracking(order, hubPedido = null) {
    const hubStatus = String(hubPedido?.status || '').toLowerCase();
    const isPickup = isPickupOrder(order);
    let step = 1;
    let stepLabel = 'Aguardando confirmação';
    let headerTitle = 'Aguardando confirmação';
    let message = 'Seu pedido foi recebido e está aguardando confirmação no Ligeirinho Hub.';
    let cancelled = false;

    const statusCopy = trackingCopyForHubStatus(hubStatus, { isPickup });

    if (
        order?.status === 'cancelled' ||
        CANCEL_STATUSES.has(hubStatus) ||
        order?.financialStatus === 'cancelado'
    ) {
        cancelled = true;
        step = 0;
        stepLabel = 'Pedido cancelado';
        headerTitle = 'Pedido cancelado';
        message = 'Esta solicitação foi cancelada.';
    } else if (DONE_STATUSES.has(hubStatus) && hubStatus !== 'retirado') {
        step = 4;
        if (isPickup) {
            stepLabel = 'Retirado';
            headerTitle = 'Pedido retirado';
            message = 'Pedido retirado com sucesso. Obrigado pela preferência!';
        } else {
            stepLabel = 'Entrega concluída';
            headerTitle = 'Pedido entregue';
            message = 'Seu pedido foi entregue. Obrigado pela preferência!';
        }
    } else if (statusCopy) {
        step = statusCopy.step;
        stepLabel = statusCopy.stepLabel;
        headerTitle = statusCopy.headerTitle;
        message = statusCopy.message;
    } else if (ROUTE_STATUSES.has(hubStatus)) {
        if (isPickup) {
            ({ step, stepLabel, headerTitle, message } = pickupReadyCopy());
        } else {
            step = 3;
            stepLabel = 'A caminho';
            headerTitle = 'Saiu para entrega';
            message =
                hubStatus === 'proximo_entrega'
                    ? 'Seu pedido é o próximo a ser entregue!'
                    : 'Seu pedido saiu para entrega.';
        }
    } else if (ACCEPTED_STATUSES.has(hubStatus)) {
        step = 1;
        stepLabel = 'Aceito';
        headerTitle = 'Pedido aceito';
        message = 'Seu pedido foi aceito e já está em andamento no Ligeirinho.';
    } else if (PREP_STATUSES.has(hubStatus)) {
        step = 2;
        stepLabel = 'Em separação';
        headerTitle = 'Em separação';
        message = 'Seu pedido foi aceito e está em separação no depósito.';
    } else if (
        order?.status === 'confirmed' &&
        (hubStatus === 'pendente' || hubStatus === 'aguardando_aceite' || !hubStatus)
    ) {
        step = 1;
        stepLabel = 'Aceito';
        headerTitle = 'Pedido aceito';
        message = 'Seu pedido foi aceito e já está em andamento no Ligeirinho.';
    } else if (hubStatus === 'pendente' || hubStatus === 'aguardando_aceite' || !hubStatus) {
        step = 1;
        stepLabel = 'Aguardando confirmação';
        headerTitle = 'Aguardando confirmação';
        message = 'Seu pedido foi recebido e está aguardando confirmação no Ligeirinho Hub.';
    } else if (order?.status === 'paid') {
        step = 1;
        stepLabel = 'Confirmado';
        headerTitle = 'Pedido confirmado';
        message = 'Pagamento confirmado. Em breve iniciamos a separação.';
    } else {
        // Status Hub desconhecido: não regredir para Aceite; manter em andamento.
        step = 2;
        stepLabel = 'Em andamento';
        headerTitle = 'Pedido em andamento';
        message = 'Seu pedido está em andamento no Ligeirinho.';
    }

    if (!cancelled && (order?.status === 'pending_payment' || hubStatus === 'aguardando_pagamento')) {
        step = 0;
        stepLabel = 'Aguardando pagamento';
        headerTitle = 'Aguardando pagamento';
        message = 'Assim que o pagamento for confirmado, seguimos com o pedido.';
    }

    const filterKey = resolveTrackingFilterKey(order, {
        cancelled,
        step,
        hubStatus,
        isPickup,
    });

    return {
        hubStatus: hubStatus || null,
        hubNumero: hubPedido?.numero ?? null,
        hubPedidoId: hubPedido?.id ?? order?.hubPedidoId ?? null,
        step,
        stepLabel,
        filterKey,
        headerTitle,
        message,
        cancelled,
        canCancel:
            !cancelled &&
            (order?.channel || 'parceiros') === 'parceiros' &&
            order?.status === 'pending' &&
            (hubStatus === 'pendente' || hubStatus === 'aguardando_aceite' || !hubStatus),
        steps: [
            { id: 'sent', icon: 'send', label: 'Enviado' },
            { id: 'accept', icon: 'check_circle', label: 'Aceite' },
            { id: 'prep', icon: 'package_2', label: 'Separação' },
            {
                id: 'route',
                icon: isPickup ? 'storefront' : 'local_shipping',
                label: isPickup ? 'Aguardando retirada' : 'Rota',
            },
            {
                id: 'done',
                icon: 'home',
                label: isPickup ? 'Retirado' : 'Entregue',
            },
        ],
    };
}
