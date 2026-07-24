/** Proxy Nominatim — busca de endereço (Brasil). */
export const config = { maxDuration: 15 };

const UA = 'LigeirinhoParceiros/1.0 (parceiros@ligeirinho; delivery-address)';

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=60');

    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const q = String(req.query?.q || '').trim();
    if (q.length < 3) {
        return res.status(400).json({ error: 'Informe ao menos 3 caracteres.' });
    }

    try {
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
            return res.status(502).json({ error: 'Falha ao buscar endereço.' });
        }
        const raw = await upstream.json();
        const results = (Array.isArray(raw) ? raw : []).map((item) => {
            const a = item.address || {};
            const street =
                a.road || a.pedestrian || a.residential || a.street || a.path || a.neighbourhood || '';
            return {
                id: String(item.place_id || `${item.lat},${item.lon}`),
                label: item.display_name || '',
                lat: Number(item.lat),
                lng: Number(item.lon),
                street,
                number: a.house_number || '',
                neighborhood: a.suburb || a.neighbourhood || a.quarter || a.city_district || '',
                city: a.city || a.town || a.municipality || a.village || a.county || '',
                state: a.state || '',
                stateCode: (a['ISO3166-2-lvl4'] || '').replace(/^BR-/, '') || '',
                postcode: a.postcode || '',
            };
        });
        return res.status(200).json({ results });
    } catch (err) {
        console.error('[api/geo/search]', err);
        return res.status(502).json({ error: 'Falha ao buscar endereço.' });
    }
}
