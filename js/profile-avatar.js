(function () {
    const STORAGE_KEY = 'ligeirinho-avatar-v1';
    const FALLBACK = 'img/app-icon-light-192.png';
    const MAX_EDGE = 512;
    const JPEG_QUALITY = 0.82;
    const MAX_BYTES = 900_000;

    const loadMap = () => {
        try {
            const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            return data && typeof data === 'object' ? data : {};
        } catch {
            return {};
        }
    };

    const saveMap = (map) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
        } catch {
            /* quota / private mode */
        }
    };

    const normalizeSub = (sub) => String(sub || '').trim();

    const getAvatar = (sub) => {
        const key = normalizeSub(sub);
        if (!key) return '';
        const value = String(loadMap()[key] || '').trim();
        return value.startsWith('data:image/') ? value : '';
    };

    const setAvatar = (sub, dataUrl) => {
        const key = normalizeSub(sub);
        if (!key) return false;
        const value = String(dataUrl || '').trim();
        if (!value.startsWith('data:image/')) return false;
        const map = loadMap();
        map[key] = value;
        saveMap(map);
        return true;
    };

    const clearAvatar = (sub) => {
        const key = normalizeSub(sub);
        if (!key) return;
        const map = loadMap();
        if (!(key in map)) return;
        delete map[key];
        saveMap(map);
    };

    const isUsablePicture = (value) => {
        const src = String(value || '').trim();
        return /^https?:\/\//i.test(src) || src.startsWith('data:image/');
    };

    const resolvePicture = (session) => {
        const custom = getAvatar(session?.sub);
        if (custom) return custom;
        if (isUsablePicture(session?.picture)) return String(session.picture).trim();
        return FALLBACK;
    };

    const readFileAsDataUrl = (file) =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
            reader.readAsDataURL(file);
        });

    const loadImage = (src) =>
        new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Imagem inválida.'));
            img.src = src;
        });

    const compressImageFile = async (file) => {
        if (!file || !String(file.type || '').startsWith('image/')) {
            throw new Error('Selecione um arquivo de imagem.');
        }
        if (file.size > 12 * 1024 * 1024) {
            throw new Error('A imagem é muito grande. Use até 12 MB.');
        }

        const original = await readFileAsDataUrl(file);
        const img = await loadImage(original);
        const scale = Math.min(1, MAX_EDGE / Math.max(img.width || 1, img.height || 1));
        const width = Math.max(1, Math.round((img.width || 1) * scale));
        const height = Math.max(1, Math.round((img.height || 1) * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Não foi possível processar a imagem.');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        let quality = JPEG_QUALITY;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > MAX_BYTES && quality > 0.45) {
            quality -= 0.1;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        if (dataUrl.length > MAX_BYTES) {
            throw new Error('Não foi possível reduzir a imagem. Tente outra foto.');
        }
        return dataUrl;
    };

    window.LigeirinhoProfileAvatar = {
        STORAGE_KEY,
        FALLBACK,
        getAvatar,
        setAvatar,
        clearAvatar,
        resolvePicture,
        isUsablePicture,
        compressImageFile,
    };
})();
