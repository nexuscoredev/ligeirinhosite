(function () {
    const SYNONYMS = {
        breja: ['cerveja', 'cervejas', 'chopp', 'beer', 'lager', 'pilsen'],
        cerveja: ['breja', 'chopp', 'beer'],
        cervejas: ['breja', 'cerveja'],
        chopp: ['cerveja', 'breja'],
        vodka: ['vodca'],
        vodca: ['vodka'],
        gin: ['gim'],
        gim: ['gin'],
        whisky: ['whiskey', 'uísque', 'uisque', 'wisky'],
        whiskey: ['whisky', 'uísque'],
        uisque: ['whisky', 'whiskey'],
        gelo: ['gelos', 'ice', 'cubos'],
        gelos: ['gelo', 'ice'],
        energetico: ['energético', 'energy', 'redbull', 'red bull', 'monster'],
        energético: ['energetico', 'energy', 'redbull'],
        redbull: ['red bull', 'energetico', 'energético'],
        'red bull': ['redbull', 'energetico'],
        refrigerante: ['refri', 'soda', 'coca', 'pepsi', 'guaraná', 'guarana'],
        refri: ['refrigerante', 'soda'],
        coca: ['refrigerante', 'cola'],
        combo: ['combos', 'kit', 'pacote'],
        combos: ['combo', 'kit'],
        vinho: ['vinhos', 'wine'],
        vinhos: ['vinho', 'wine'],
        agua: ['água', 'mineral'],
        água: ['agua', 'mineral'],
        salgadinho: ['snack', 'petisco', 'batata'],
        cigarro: ['cigarros', 'tabaco'],
        tabaco: ['cigarro', 'cigarros'],
        baly: ['energetico', 'energético'],
        heineken: ['cerveja', 'breja'],
        brahma: ['cerveja', 'breja'],
        skol: ['cerveja', 'breja'],
        jack: ['whisky', 'jack daniel'],
        absolut: ['vodka'],
        smirnoff: ['vodka'],
    };

    const expandSearchQuery = (query) => {
        const raw = String(query || '').trim().toLowerCase();
        if (!raw) return { raw: '', terms: [] };

        const terms = new Set();
        const words = raw.split(/\s+/).filter(Boolean);

        words.forEach((word) => {
            terms.add(word);
            (SYNONYMS[word] || []).forEach((syn) => terms.add(syn));
        });

        Object.entries(SYNONYMS).forEach(([key, values]) => {
            if (raw.includes(key) || key.includes(raw)) {
                terms.add(key);
                values.forEach((syn) => terms.add(syn));
            }
        });

        terms.add(raw);
        return { raw, terms: [...terms] };
    };

    const matchesSearch = (haystack, queryInfo) => {
        if (!queryInfo?.raw) return true;
        const text = String(haystack || '').toLowerCase();
        return queryInfo.terms.some((term) => term && text.includes(term));
    };

    window.LigeirinhoSearch = {
        expandSearchQuery,
        matchesSearch,
        SYNONYMS,
    };
})();
