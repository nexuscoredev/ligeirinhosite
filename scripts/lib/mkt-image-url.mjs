/**
 * URLs otimizadas e cache client-side para encartes MKT (Supabase Storage).
 */
export function mktImageUrl(url, { width, quality = 80 } = {}) {
    if (!url || typeof url !== 'string') return url;
    if (!url.includes('/storage/v1/object/public/marketing-artes/')) return url;
    const renderUrl = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
    const params = new URLSearchParams();
    if (width) params.set('width', String(width));
    params.set('quality', String(quality));
    params.set('resize', 'contain');
    return `${renderUrl}?${params}`;
}

function applySlideImageVariants(slide) {
    const full = slide.imageFull || slide.image;
    if (!full) return slide;
    return {
        ...slide,
        imageFull: full,
        image: mktImageUrl(full, { width: 1080, quality: 82 }),
        thumb: mktImageUrl(full, { width: 360, quality: 75 }),
    };
}

export function enrichMarketingStories(payload) {
    if (!payload?.stories?.length) return payload;
    const stories = payload.stories.map((story) => {
        const slides = (story.slides || []).map((slide) => applySlideImageVariants(slide));
        const firstFull = slides[0]?.imageFull || story.thumbImage;
        return {
            ...story,
            thumbImage: firstFull ? mktImageUrl(firstFull, { width: 360, quality: 75 }) : story.thumbImage,
            slides,
        };
    });
    return { ...payload, stories };
}
