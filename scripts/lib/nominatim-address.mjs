/** Normaliza resultado Nominatim → campos de endereço do Parceiros. */

/**
 * Extrai número aproximado do display_name / query quando house_number veio vazio.
 * Exemplos BR: "123, Rua X, …" | "Rua X, 123 - Bairro"
 */
export function extractHouseNumber(...texts) {
    for (const raw of texts) {
        const text = String(raw || '').trim();
        if (!text) continue;
        const leading = text.match(/^(\d+[A-Za-z]?)\s*,/);
        if (leading) return leading[1];
        const numbered = text.match(/,\s*n[ºo°.]*\s*(\d+[A-Za-z]?)\b/i);
        if (numbered) return numbered[1];
        const explicit = text.match(/\bn[ºo°.]*\s*(\d+[A-Za-z]?)\b/i);
        if (explicit) return explicit[1];
        const trailingComma = text.match(/,\s*(\d+[A-Za-z]?)\s*(?:[-–—,…]|$)/);
        if (trailingComma) return trailingComma[1];
        /* "Rua Exemplo 123" no fim — evita ruas tipo "9 de Julho" (número no começo do nome). */
        const trailingSpace = text.match(/(?:[A-Za-zÀ-ÿ.]|\d+[ªº]?)\s+(\d+[A-Za-z]?)\s*$/);
        if (trailingSpace && !/^\d+\s/.test(text)) return trailingSpace[1];
    }
    return '';
}

export function mapNominatimAddress(item, { lat, lng, query = '' } = {}) {
    const a = item?.address || {};
    const street =
        a.road || a.pedestrian || a.residential || a.street || a.path || a.neighbourhood || '';
    const number =
        String(a.house_number || '').trim() ||
        extractHouseNumber(item?.display_name, query);
    return {
        id: String(item?.place_id || `${lat},${lng}`),
        label: item?.display_name || '',
        lat: Number.isFinite(lat) ? lat : Number(item?.lat),
        lng: Number.isFinite(lng) ? lng : Number(item?.lon),
        street,
        number,
        neighborhood: a.suburb || a.neighbourhood || a.quarter || a.city_district || '',
        city: a.city || a.town || a.municipality || a.village || a.county || '',
        state: a.state || '',
        stateCode: (a['ISO3166-2-lvl4'] || '').replace(/^BR-/, '') || '',
        postcode: a.postcode || '',
    };
}
