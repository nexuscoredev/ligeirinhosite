(function () {
    const STORAGE_KEY = 'ligeirinho-mkt-stories-v3';
    const CACHE_MS = 5 * 60_000;
    const HUB_STORAGE = 'liszpwocwvkytzyaxvit.supabase.co';
    const DISABLED_SOURCE = 'disabled:marketing-drive';

    const EMPTY_PAYLOAD = () => ({ stories: [], source: DISABLED_SOURCE });

    let inflight = null;
    let memoryCache = EMPTY_PAYLOAD();
    let memoryAt = Date.now();

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

    const clearCache = () => {
        memoryCache = EMPTY_PAYLOAD();
        memoryAt = Date.now();
        inflight = null;
        try {
            sessionStorage.removeItem(STORAGE_KEY);
            sessionStorage.removeItem('ligeirinho-mkt-stories-v2');
        } catch {
            /* ignore */
        }
    };

    const loadMarketingStories = async () => EMPTY_PAYLOAD();

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

    const warmCache = async () => EMPTY_PAYLOAD();

    clearCache();

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
