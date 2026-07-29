import { requireHubSession } from '../../api/hub/_require-hub-session.mjs';

/**
 * Resolve distribuidora do Totem a partir do Bearer Hub.
 * Sem token / sessão inválida → null (mantém catálogo legado público).
 */
export async function resolveTotemDistribuidoraId(req) {
    const auth = String(req.headers.authorization || '');
    if (!auth.startsWith('Bearer ')) return null;

    const session = await requireHubSession(req);
    if (session.error || !session.usuario?.ativo) return null;

    const id = String(session.usuario.distribuidora_id || '').trim();
    return id || null;
}

export function totemCatalogCacheKey(distribuidoraId) {
    const id = String(distribuidoraId || '').trim();
    return id ? `catalog:totem:${id}` : 'catalog:totem';
}

export function totemPromocoesCacheKey(distribuidoraId) {
    const id = String(distribuidoraId || '').trim();
    return id ? `promocoes:totem:${id}` : 'promocoes:totem';
}
