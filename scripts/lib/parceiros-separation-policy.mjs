import {
    isOrderDeliveryDayToday,
    orderDeliveryDateIso,
    todayIsoInSaoPaulo,
} from './order-edit-policy.mjs';

/** Fila de separação no Hub. */
export const HUB_STATUS_SEPARATION_QUEUE = 'aguardando_separacao';

/** Aceito, aguardando o dia de entrega/retirada para entrar na separação. */
export const HUB_STATUS_ACCEPTED_HELD = 'aceito';

export const HUB_STATUSES_HELD_BEFORE_SEPARATION = new Set(['aceito', 'em_andamento']);

const HUB_STATUSES_ENFORCEABLE = new Set([
    'pendente',
    'aguardando_aceite',
    '',
    HUB_STATUS_SEPARATION_QUEUE,
    HUB_STATUS_ACCEPTED_HELD,
    'em_andamento',
]);

const HUB_STATUSES_IN_SEPARATION = new Set([
    'em_separacao',
    'separacao_pausada',
    'refazer_separacao',
    'separando',
    'separado',
    'aguardando_emissao_nf',
    'aguardando_retirada',
    'aguardando_entrega',
    'aguardando_roteirizacao',
    'em_rota',
    'a_caminho',
    'saiu_entrega',
    'em_entrega',
    'proximo_entrega',
    'com_ocorrencia',
    'entregue',
    'concluido',
    'finalizado',
    'entrega_concluida',
    'retirado',
    'cancelado',
    'cancelado_cliente',
]);

export function shouldParceirosEnterSeparationToday(order, today = todayIsoInSaoPaulo()) {
    const deliveryDate = orderDeliveryDateIso(order);
    if (!deliveryDate) return true;
    return deliveryDate === today;
}

export function targetHubStatusAfterParceirosAccept(order, today = todayIsoInSaoPaulo()) {
    return shouldParceirosEnterSeparationToday(order, today)
        ? HUB_STATUS_SEPARATION_QUEUE
        : HUB_STATUS_ACCEPTED_HELD;
}

export function shouldPromoteParceirosToSeparation(order, hubStatus, today = todayIsoInSaoPaulo()) {
    if (!shouldParceirosEnterSeparationToday(order, today)) return false;
    return HUB_STATUSES_HELD_BEFORE_SEPARATION.has(String(hubStatus || '').toLowerCase());
}

export function shouldDemoteParceirosFromSeparation(order, hubStatus, today = todayIsoInSaoPaulo()) {
    if (shouldParceirosEnterSeparationToday(order, today)) return false;
    return String(hubStatus || '').toLowerCase() === HUB_STATUS_SEPARATION_QUEUE;
}

export function canEnforceParceirosSeparationPolicy(hubPedido) {
    const status = String(hubPedido?.status || '').toLowerCase();
    if (HUB_STATUSES_IN_SEPARATION.has(status)) return false;
    return HUB_STATUSES_ENFORCEABLE.has(status);
}

export function isParceirosHubPedido(hubPedido, order) {
    if (String(order?.channel || 'parceiros').toLowerCase() === 'totem') return false;
    const origem = String(hubPedido?.origem || 'app').toLowerCase();
    return origem === 'app' || Boolean(hubPedido?.parceiros_order_id || order?.id);
}

export { isOrderDeliveryDayToday, orderDeliveryDateIso, todayIsoInSaoPaulo };
