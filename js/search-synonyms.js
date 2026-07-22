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
        whisky: ['whiskey', 'uisque', 'wisky'],
        whiskey: ['whisky', 'uisque'],
        uisque: ['whisky', 'whiskey'],
        gelo: ['gelos', 'ice', 'cubos'],
        gelos: ['gelo', 'ice'],
        energetico: ['energetico', 'energy', 'redbull', 'monster'],
        energético: ['energetico', 'energy', 'redbull'],
        redbull: ['red bull', 'energetico'],
        'red bull': ['redbull', 'energetico'],
        refrigerante: ['refri', 'soda'],
        refri: ['refrigerante', 'soda'],
        coca: ['cocacola', 'coca cola', 'cola'],
        cola: ['coca', 'cocacola', 'coca cola'],
        cocacola: ['coca', 'coca cola', 'cola'],
        pepsi: ['refrigerante', 'refri'],
        guarana: ['guaraná', 'refrigerante'],
        guaraná: ['guarana', 'refrigerante'],
        combo: ['combos', 'kit', 'pacote'],
        combos: ['combo', 'kit'],
        vinho: ['vinhos', 'wine'],
        vinhos: ['vinho', 'wine'],
        agua: ['água', 'mineral'],
        água: ['agua', 'mineral'],
        salgadinho: ['snack', 'petisco', 'batata'],
        cigarro: ['cigarros', 'tabaco'],
        tabaco: ['cigarro', 'cigarros'],
        baly: ['energetico'],
        heineken: ['cerveja', 'breja'],
        brahma: ['cerveja', 'breja'],
        skol: ['cerveja', 'breja'],
        jack: ['whisky', 'jack daniels', 'jack daniel'],
        absolut: ['vodka'],
        smirnoff: ['vodka'],
        zero: ['zero', 'diet', 'light'],
        diet: ['zero', 'light'],
        light: ['zero', 'diet'],
    };

    const STOP_WORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'com', 'sem', 'para', 'por', 'em', 'no', 'na']);

    const normalizeText = (value) =>
        String(value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/\p{M}/gu, '')
            .replace(/[/_\-.,]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

    const compactText = (value) => normalizeText(value).replace(/\s+/g, '');

    const parseVolumeMl = (numStr, unitStr) => {
        const num = parseFloat(String(numStr).replace(',', '.'));
        if (!Number.isFinite(num)) return null;
        const unit = String(unitStr || 'ml')
            .toLowerCase()
            .replace(/\./g, '');
        if (unit === 'l' || unit === 'lt' || unit.startsWith('litro')) return Math.round(num * 1000);
        return Math.round(num);
    };

    const extractVolumesMl = (text) => {
        const normalized = normalizeText(text);
        const volumes = new Set();
        const re = /(\d+(?:[.,]\d+)?)\s*(ml|l|lt|litros?)\b/gi;
        let match;
        while ((match = re.exec(normalized))) {
            const ml = parseVolumeMl(match[1], match[2]);
            if (ml) volumes.add(ml);
        }
        return [...volumes];
    };

    const looksLikeVolumeNumber = (value) => {
        const n = parseInt(value, 10);
        return Number.isFinite(n) && n >= 50 && n <= 5000;
    };

    const expandWordVariants = (word) => {
        const variants = new Set([word]);
        (SYNONYMS[word] || []).forEach((syn) => variants.add(normalizeText(syn)));
        return [...variants].filter(Boolean);
    };

    /** Unifica volumes no texto: "2 L" / "2l" → "2l" (mesmo padrão do Hub). */
    const normalizeVolumeTokens = (text) =>
        normalizeText(text)
            .replace(/(\d+)\s*ml\b/gi, '$1ml')
            .replace(/(\d+(?:[.,]\d+)?)\s*l\b/gi, (_, n) => `${String(n).replace(',', '.')}l`);

    const buildHaystack = (text) => {
        const base = normalizeVolumeTokens(text);
        return {
            base,
            compact: base.replace(/\s+/g, ''),
            volumes: extractVolumesMl(text),
        };
    };

    const wordMatchesHaystack = (haystack, word) => {
        if (!word) return true;
        const variants = expandWordVariants(word);
        return variants.some((variant) => {
            const compactVariant = variant.replace(/\s+/g, '');
            return haystack.base.includes(variant) || haystack.compact.includes(compactVariant);
        });
    };

    const volumeMatchesHaystack = (haystack, targetMl) => {
        if (!targetMl) return true;
        if (haystack.volumes.includes(targetMl)) return true;
        return haystack.volumes.some((v) => Math.abs(v - targetMl) <= 1);
    };

    const expandSearchQuery = (query) => {
        const raw = String(query || '').trim();
        if (!raw) return { raw: '', words: [], volumes: [], phrase: '' };

        let working = normalizeText(raw);
        const volumes = [];

        // "coca2l" / "agua2l" → "coca 2l" para achar volume e marca.
        working = working.replace(
            /([a-zç]+)(\d+(?:[.,]\d+)?)(ml|l|lt|litros?)\b/gi,
            '$1 $2$3',
        );

        working = working.replace(/(\d+(?:[.,]\d+)?)\s*(ml|l|lt|litros?)\b/gi, (_, num, unit) => {
            const ml = parseVolumeMl(num, unit);
            if (ml) volumes.push(ml);
            return ' ';
        });

        working = working.replace(/\b(\d{2,4})\b/g, (match) => {
            if (looksLikeVolumeNumber(match)) {
                volumes.push(parseInt(match, 10));
                return ' ';
            }
            return match;
        });

        const words = working
            .split(/\s+/)
            .map((w) => w.trim())
            .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));

        return {
            raw,
            phrase: normalizeVolumeTokens(raw),
            words,
            volumes: [...new Set(volumes)],
        };
    };

    const matchesHaystack = (haystack, queryInfo) => {
        if (!queryInfo?.raw) return true;

        const phraseCompact = queryInfo.phrase.replace(/\s+/g, '');

        if (phraseCompact.length >= 4) {
            if (haystack.base.includes(queryInfo.phrase) || haystack.compact.includes(phraseCompact)) {
                return true;
            }
        }

        if (queryInfo.words.length) {
            const wordsOk = queryInfo.words.every((word) => wordMatchesHaystack(haystack, word));
            if (!wordsOk) return false;
        }

        if (queryInfo.volumes.length) {
            const volumesOk = queryInfo.volumes.every((ml) => volumeMatchesHaystack(haystack, ml));
            if (!volumesOk) return false;
        }

        return queryInfo.words.length > 0 || queryInfo.volumes.length > 0;
    };

    const scoreHaystack = (haystack, queryInfo) => {
        if (!queryInfo?.raw) return 0;

        let score = 0;
        const phraseCompact = queryInfo.phrase.replace(/\s+/g, '');

        if (phraseCompact.length >= 4) {
            if (haystack.compact === phraseCompact) score += 120;
            else if (haystack.compact.startsWith(phraseCompact)) score += 90;
            else if (haystack.compact.includes(phraseCompact)) score += 70;
            else if (haystack.base.includes(queryInfo.phrase)) score += 55;
        }

        queryInfo.words.forEach((word, index) => {
            if (!wordMatchesHaystack(haystack, word)) return;
            score += 18 - Math.min(index, 6);
            if (haystack.base.startsWith(word)) score += 8;
        });

        queryInfo.volumes.forEach((ml) => {
            if (volumeMatchesHaystack(haystack, ml)) score += 24;
        });

        if (queryInfo.words.length > 1) {
            const ordered = queryInfo.words.join(' ');
            if (haystack.base.includes(ordered)) score += 20;
        }

        return score;
    };

    const matchesSearch = (haystackText, queryInfo) => matchesHaystack(buildHaystack(haystackText), queryInfo);

    const scoreSearch = (haystackText, queryInfo) => scoreHaystack(buildHaystack(haystackText), queryInfo);

    window.LigeirinhoSearch = {
        expandSearchQuery,
        matchesSearch,
        scoreSearch,
        matchesHaystack,
        scoreHaystack,
        buildHaystack,
        SYNONYMS,
    };
})();
