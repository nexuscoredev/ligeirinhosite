(function () {
    const STORAGE_KEY = 'ligeirinho-mkt-stories-v1';
    const CACHE_MS = 5 * 60_000;
    const HUB_STORAGE = 'liszpwocwvkytzyaxvit.supabase.co';

    let inflight = null;
    let memoryCache = null;
    let memoryAt = 0;

    const slideImage = (slide) => slide?.image || slide?.imageFull || '';

    const collectImageUrls = (stories, { display = true } = {}) => {
        const urls = [];
        (stories || []).forEach((story) => {
            (story.slides || []).forEach((slide) => {
                const url = display ? slideImage(slide) : slide?.imageFull || slideImage(slide);
                if (url && !urls.includes(url)) urls.push(url);
            });
        });
        return urls;
    };

    const collectThumbUrls = (stories) => {
        const urls = [];
        (stories || []).forEach((story) => {
            const url = story.thumbImage || story.slides?.[0]?.thumb || slideImage(story.slides?.[0]);
            if (url && !urls.includes(url)) urls.push(url);
        });
        return urls;
    };

    const readStorage = () => {
        try {
            const raw = sessionStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed?.payload?.stories || Date.now() - parsed.savedAt > CACHE_MS) return null;
            return parsed.payload;
        } catch {
            return null;
        }
    };

    const writeStorage = (payload) => {
        try {
            sessionStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                    savedAt: Date.now(),
                    payload,
                })
            );
        } catch {
            /* quota */
        }
    };

    const fetchStories = async () => {
        const res = await fetch('/api/marketing-stories');
        if (!res.ok) throw new Error(`marketing-stories HTTP ${res.status}`);
        return res.json();
    };

    const loadMarketingStories = async ({ force = false } = {}) => {
        const now = Date.now();
        if (!force && memoryCache?.stories?.length && now - memoryAt < CACHE_MS) {
            return memoryCache;
        }

        if (!force) {
            const stored = readStorage();
            if (stored?.stories?.length) {
                memoryCache = stored;
                memoryAt = now;
                return stored;
            }
        }

        if (!force && inflight) return inflight;

        inflight = fetchStories()
            .then((payload) => {
                const data = payload?.stories ? payload : { stories: [], ...payload };
                memoryCache = data;
                memoryAt = Date.now();
                if (data.stories?.length) writeStorage(data);
                return data;
            })
            .finally(() => {
                inflight = null;
            });

        return inflight;
    };

    const preloadImage = (url) =>
        new Promise((resolve) => {
            if (!url) {
                resolve(false);
                return;
            }
            const img = new Image();
            img.decoding = 'async';
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = url;
        });

    const preloadImages = async (urls, limit = 3) => {
        const list = (urls || []).slice(0, limit);
        await Promise.all(list.map((url) => preloadImage(url)));
    };

    const warmCache = async () => {
        try {
            const data = await loadMarketingStories();
            const thumbs = collectThumbUrls(data.stories);
            const displays = collectImageUrls(data.stories);
            void preloadImages(thumbs, 4);
            void preloadImages(displays, 2);
            return data;
        } catch {
            return { stories: [] };
        }
    };

    const clearCache = () => {
        memoryCache = null;
        memoryAt = 0;
        inflight = null;
        try {
            sessionStorage.removeItem(STORAGE_KEY);
        } catch {
            /* ignore */
        }
    };

    window.LigeirinhoMktPromos = {
        HUB_STORAGE,
        CACHE_MS,
        slideImage,
        collectImageUrls,
        collectThumbUrls,
        loadMarketingStories,
        preloadImage,
        preloadImages,
        warmCache,
        clearCache,
    };
})();
