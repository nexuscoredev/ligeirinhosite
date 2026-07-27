/** Proxy Nominatim — reverse geocode (lat/lng → endereço). */
import { gatedNominatim } from '../../scripts/lib/nominatim-gate.mjs';
import { mapNominatimAddress } from '../../scripts/lib/nominatim-address.mjs';

export const config = { maxDuration: 15 };

const UA = 'LigeirinhoParceiros/1.0 (parceiros@ligeirinho; delivery-address)';

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300, max-age=60');

    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const lat = Number(req.query?.lat);
    const lng = Number(req.query?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return res.status(400).json({ error: 'Informe lat e lng válidos.' });
    }

    const cacheKey = `rev:v2:${lat.toFixed(5)},${lng.toFixed(5)}`;

    try {
        const result = await gatedNominatim(cacheKey, async () => {
            const fetchReverse = async (withLayer) => {
                const url = new URL('https://nominatim.openstreetmap.org/reverse');
                url.searchParams.set('lat', String(lat));
                url.searchParams.set('lon', String(lng));
                url.searchParams.set('format', 'json');
                url.searchParams.set('addressdetails', '1');
                url.searchParams.set('zoom', '18');
                url.searchParams.set('accept-language', 'pt-BR');
                if (withLayer) url.searchParams.set('layer', 'address');

                const upstream = await fetch(url.toString(), {
                    headers: { Accept: 'application/json', 'User-Agent': UA },
                });
                if (!upstream.ok) {
                    throw new Error(`nominatim ${upstream.status}`);
                }
                return upstream.json();
            };

            let item;
            try {
                item = await fetchReverse(true);
            } catch {
                item = await fetchReverse(false);
            }
            return mapNominatimAddress(item, { lat, lng });
        });
        return res.status(200).json({ result });
    } catch (err) {
        console.error('[api/geo/reverse]', err);
        return res.status(502).json({ error: 'Falha ao localizar endereço.' });
    }
}
