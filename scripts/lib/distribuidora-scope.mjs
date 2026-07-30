/** Filial padrão (Ligeirinho Distribuidora / legado) — catálogo Parceiros e Totem sem sessão. */
export const DISTRIBUIDORA_LEGADA_ID = '1cc4a2cd-e151-49f5-8838-d7d3fbf36547';

/** Ligeirinho Shopping — isolada do catálogo da Distribuidora. */
export const DISTRIBUIDORA_SHOPPING_ID = '979b915c-965c-42d5-b370-87505e2bcf00';

/**
 * Escopo de catálogo: se não houver filial explícita, usa a Distribuidora legada.
 * Evita misturar produtos de outras filiais (ex.: Gin do Shopping no Parceiros/Totem padrão).
 */
export function resolveCatalogDistribuidoraId(distribuidoraId) {
    const id = String(distribuidoraId || '').trim();
    return id || DISTRIBUIDORA_LEGADA_ID;
}
