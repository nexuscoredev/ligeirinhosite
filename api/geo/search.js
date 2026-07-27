/** Proxy Nominatim — busca de endereço (Brasil). */
import { gatedNominatim } from '../../scripts/lib/nominatim-gate.mjs';
import { extractHouseNumber, mapNominatimAddress } from '../../scripts/lib/nominatim-address.mjs';

export const config = { maxDuration: 15 };

const UA = 'LigeirinhoParceiros/1.0 (parceiros@ligeirinho; delivery-address)';

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120, max-age=30');

    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const q = String(req.query?.q || '').trim();
    if (q.length < 3) {
        return res.status(400).json({ error: 'Informe ao menos 3 caracteres.' });
    }

    const queryNumber = extractHouseNumber(q);
    const cacheKey = `search:v2:${q.toLowerCase()}`;

    try {
        const results = await gatedNominatim(cacheKey, async () => {
            const url = new URL('https://nominatim.openstreetmap.org/search');
            url.searchParams.set('q', q);
            url.searchParams.set('format', 'json');
            url.searchParams.set('addressdetails', '1');
            url.searchParams.set('countrycodes', 'br');
            url.searchParams.set('limit', '8');
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
                return mapped;
            });
        });
        return res.status(200).json({ results });
    } catch (err) {
        console.error('[api/geo/search]', err);
        return res.status(502).json({ error: 'Falha ao buscar endereço.' });
    }
}
