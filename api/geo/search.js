/** Proxy Nominatim — busca de endereço (Brasil) + CEP via ViaCEP. */
import { gatedNominatim } from '../../scripts/lib/nominatim-gate.mjs';
import { extractHouseNumber, mapNominatimAddress } from '../../scripts/lib/nominatim-address.mjs';
import { consultarEnderecoPorCep, formatarCep } from '../../scripts/lib/consultar-publicas.mjs';

export const config = { maxDuration: 15 };

const UA = 'LigeirinhoParceiros/1.0 (parceiros@ligeirinho; delivery-address)';

const onlyDigits = (value) => String(value || '').replace(/\D/g, '');

function isCepQuery(q) {
    const digits = onlyDigits(q);
    if (digits.length !== 8) return false;
    const compact = String(q || '').replace(/\s/g, '');
    return /^\d{8}$/.test(compact) || /^\d{5}-?\d{3}$/.test(compact);
}

function shortLabelFromParts(parts) {
    const street = [parts.street, parts.number].filter(Boolean).join(', ');
    return [street, parts.neighborhood, parts.city, parts.stateCode || parts.state]
        .filter(Boolean)
        .join(' - ');
}

async function nominatimSearch(q, { limit = 8 } = {}) {
    const queryNumber = extractHouseNumber(q);
    const cacheKey = `search:v3:${String(q).toLowerCase()}:l${limit}`;
    return gatedNominatim(cacheKey, async () => {
        const url = new URL('https://nominatim.openstreetmap.org/search');
        url.searchParams.set('q', q);
        url.searchParams.set('format', 'json');
        url.searchParams.set('addressdetails', '1');
        url.searchParams.set('countrycodes', 'br');
        url.searchParams.set('limit', String(limit));
        url.searchParams.set('accept-language', 'pt-BR');

        const upstream = await fetch(url.toString(), {
            headers: { Accept: 'application/json', 'User-Agent': UA },
        });
        if (!upstream.ok) {
            throw new Error(`nominatim ${upstream.status}`);
        }
        const raw = await upstream.json();
        return (Array.isArray(raw) ? raw : []).map((item) => {
            const mapped = mapNominatimAddress(item, {
                lat: Number(item.lat),
                lng: Number(item.lon),
                query: q,
            });
            if (!mapped.number && queryNumber) mapped.number = queryNumber;
            const short = shortLabelFromParts(mapped);
            if (short) mapped.label = short;
            return mapped;
        });
    });
}

async function searchByCep(digits) {
    const end = await consultarEnderecoPorCep(digits);
    const base = {
        id: `cep:${digits}`,
        street: end.logradouro || '',
        number: '',
        neighborhood: end.bairro || '',
        city: end.cidade || '',
        state: end.uf || '',
        stateCode: end.uf || '',
        postcode: formatarCep(end.cep || digits),
        lat: null,
        lng: null,
        label: '',
    };
    const display =
        shortLabelFromParts(base) ||
        [base.neighborhood, base.city, base.stateCode, base.postcode].filter(Boolean).join(' - ');
    // label de sugestão (UI); nickname do usuário fica vazio
    base.suggestionLabel = display;

    const geoQuery = [end.logradouro, end.bairro, end.cidade, end.uf, 'Brasil']
        .filter(Boolean)
        .join(', ');
    if (!geoQuery) return [{ ...base, suggestionLabel: display }];

    try {
        const geo = await nominatimSearch(geoQuery, { limit: 1 });
        const hit = geo[0];
        if (hit && Number.isFinite(hit.lat) && Number.isFinite(hit.lng)) {
            return [
                {
                    ...base,
                    lat: hit.lat,
                    lng: hit.lng,
                    street: base.street || hit.street,
                    neighborhood: base.neighborhood || hit.neighborhood,
                    city: base.city || hit.city,
                    state: base.state || hit.state,
                    stateCode: base.stateCode || hit.stateCode,
                    suggestionLabel: shortLabelFromParts({
                        ...base,
                        street: base.street || hit.street,
                    }),
                    label: '',
                },
            ];
        }
    } catch (err) {
        console.warn('[api/geo/search] cep geocode', err?.message || err);
    }
    return [{ ...base, label: '', suggestionLabel: display }];
}

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120, max-age=30');

    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const q = String(req.query?.q || '').trim();
    if (!q) {
        return res.status(400).json({ error: 'Informe CEP ou endereço.' });
    }

    try {
        if (isCepQuery(q)) {
            const results = await searchByCep(onlyDigits(q));
            return res.status(200).json({ results, source: 'cep' });
        }

        if (q.length < 3) {
            return res.status(400).json({ error: 'Informe ao menos 3 caracteres ou um CEP.' });
        }

        const results = await nominatimSearch(q, { limit: 8 });
        return res.status(200).json({ results, source: 'geo' });
    } catch (err) {
        console.error('[api/geo/search]', err);
        const msg = err?.message || '';
        if (/CEP não encontrado|8 dígitos/i.test(msg)) {
            return res.status(404).json({ error: msg, results: [] });
        }
        return res.status(502).json({ error: 'Falha ao buscar endereço.' });
    }
}
