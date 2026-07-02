import { hubConfig } from '../hub-auth.mjs';
import { enrichMarketingStories } from './mkt-image-url.mjs';

const RAIZ_DRIVE_ID = '1XxmOF8ks5AUjMK5sC1y9fJ6f_sAWnhgo';
const STORY_LABEL_PROMOCOES = 'Promoções';

const RING_COLORS = {
    ofertas: '#F7D53C',
    destilados: '#e91e63',
    refri: '#009ee3',
    refrigerantes: '#009ee3',
    combos: '#00c853',
    energetico: '#ff6d00',
    energético: '#ff6d00',
};

const DEFAULT_RING_COLORS = ['#F7D53C', '#e91e63', '#009ee3', '#00c853', '#ff6d00'];

const CTA_BY_FOLDER = {
    ofertas: { label: 'Ver ofertas', href: 'ofertas.html' },
    destilados: { label: 'Ver catálogo', href: 'pedidos.html?categoria=destilados' },
    refri: { label: 'Comprar', href: 'pedidos.html?categoria=refrigerantes' },
    refrigerantes: { label: 'Comprar', href: 'pedidos.html?categoria=refrigerantes' },
    combos: { label: 'Montar pedido', href: 'pedidos.html' },
    energetico: { label: 'Ver produtos', href: 'pedidos.html?categoria=energetico' },
    energético: { label: 'Ver produtos', href: 'pedidos.html?categoria=energetico' },
};

function hubHeaders(config, token) {
    return {
        apikey: config.anonKey,
        Authorization: `Bearer ${token || config.anonKey}`,
        'Content-Type': 'application/json',
    };
}

function normalizeKey(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function isVerticalParceirosPasta(pasta) {
    const key = normalizeKey(`${pasta?.nome || ''} ${pasta?.caminho || ''}`);
    return key.includes('vertical') && (key.includes('tablet') || key.includes('parceiros'));
}

function isPastaWithinVerticalScope(pasta, verticalRoots) {
    return verticalRoots.some((root) => {
        if (pasta.id === root.id) return true;
        const rootPath = String(root.caminho || root.nome || '').trim();
        const pastaPath = String(pasta.caminho || pasta.nome || '').trim();
        if (!rootPath || !pastaPath) return false;
        return pastaPath === rootPath || pastaPath.startsWith(`${rootPath}/`);
    });
}

function ringColorForFolder(nome, index) {
    const key = normalizeKey(nome);
    return RING_COLORS[key] || DEFAULT_RING_COLORS[index % DEFAULT_RING_COLORS.length];
}

function ctaForFolder(nome) {
    const key = normalizeKey(nome);
    return CTA_BY_FOLDER[key] || { label: 'Ver promoções', href: 'ofertas.html' };
}

async function hubFetch(config, token, path) {
    const res = await fetch(`${config.url}/rest/v1/${path}`, { headers: hubHeaders(config, token) });
    const text = await res.text();
    if (!res.ok) {
        throw new Error(text || `Hub HTTP ${res.status}`);
    }
    return text ? JSON.parse(text) : [];
}

async function hubRpc(config, token, name) {
    const res = await fetch(`${config.url}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: hubHeaders(config, token),
        body: '{}',
    });
    const text = await res.text();
    if (!res.ok) {
        throw new Error(text || `RPC ${name} HTTP ${res.status}`);
    }
    return text ? JSON.parse(text) : null;
}

function collectImagesForFolder(pasta, pastas, arquivosByPastaId) {
    const direct = arquivosByPastaId.get(pasta.id) || [];
    if (direct.length) return direct;

    const descendants = [];
    const queue = pastas.filter((p) => p.parent_drive_folder_id === pasta.drive_folder_id);
    const visited = new Set();

    while (queue.length) {
        const current = queue.shift();
        if (!current || visited.has(current.id)) continue;
        visited.add(current.id);

        const files = arquivosByPastaId.get(current.id) || [];
        descendants.push(...files);

        pastas
            .filter((p) => p.parent_drive_folder_id === current.drive_folder_id)
            .forEach((child) => queue.push(child));
    }

    return descendants.sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
}

function filterVerticalDriveScope(pastaList, arquivoList) {
    const verticalRoots = pastaList.filter(isVerticalParceirosPasta);
    if (!verticalRoots.length) {
        return { verticalRoots: [], pastas: [], arquivos: [] };
    }

    const pastas = pastaList.filter((pasta) => isPastaWithinVerticalScope(pasta, verticalRoots));
    const pastaIds = new Set(pastas.map((p) => p.id));
    const arquivos = arquivoList.filter((arquivo) => pastaIds.has(arquivo.pasta_id));

    return { verticalRoots, pastas, arquivos };
}

function buildStoryFromImages(pasta, images, index) {
    const cta = ctaForFolder(pasta.nome);
    const slides = images.map((arquivo) => ({
        image: arquivo.imagem_url,
        imageFull: arquivo.imagem_url,
        cta,
        theme: 'photo',
    }));

    return {
        id: `mkt-${pasta.id}`,
        label: pasta.nome,
        ringColor: ringColorForFolder(pasta.nome, index),
        thumbImage: images[0].imagem_url,
        slides,
    };
}

function buildStoriesFromDriveData(_raiz, pastaList, arquivoList) {
    const { verticalRoots, pastas, arquivos } = filterVerticalDriveScope(pastaList, arquivoList);
    if (!verticalRoots.length || !arquivos.length) {
        return [];
    }

    const arquivosByPastaId = new Map();
    arquivos.forEach((arquivo) => {
        if (!arquivo?.pasta_id) return;
        const list = arquivosByPastaId.get(arquivo.pasta_id) || [];
        list.push(arquivo);
        arquivosByPastaId.set(arquivo.pasta_id, list);
    });

    const verticalRoot = verticalRoots[0];
    const categoryFolders = pastas.filter(
        (pasta) =>
            pasta.id !== verticalRoot.id &&
            (pasta.parent_drive_folder_id === verticalRoot.drive_folder_id ||
                String(pasta.caminho || '').startsWith(`${verticalRoot.caminho}/`))
    );

    const categoryStories = categoryFolders
        .map((pasta, index) => {
            const images = collectImagesForFolder(pasta, pastas, arquivosByPastaId);
            if (!images.length) return null;
            return buildStoryFromImages(pasta, images, index);
        })
        .filter(Boolean);

    if (categoryStories.length) {
        return categoryStories;
    }

    const directImages = (arquivosByPastaId.get(verticalRoot.id) || []).sort((a, b) =>
        String(a.nome).localeCompare(String(b.nome), 'pt-BR')
    );

    if (!directImages.length) {
        return [];
    }

    const storyLabel =
        verticalRoot.nome && !isVerticalParceirosPasta({ nome: verticalRoot.nome, caminho: verticalRoot.caminho })
            ? verticalRoot.nome
            : STORY_LABEL_PROMOCOES;

    return [
        {
            id: `mkt-${verticalRoot.id}`,
            label: storyLabel,
            ringColor: ringColorForFolder(storyLabel, 0),
            thumbImage: directImages[0].imagem_url,
            slides: directImages.map((arquivo) => ({
                image: arquivo.imagem_url,
                imageFull: arquivo.imagem_url,
                cta: ctaForFolder(storyLabel),
                theme: 'photo',
            })),
        },
    ];
}

async function fetchDriveDataViaRpc(config, token) {
    const payload = await hubRpc(config, token, 'rpc_list_marketing_drive_stories');
    if (!payload || typeof payload !== 'object') {
        return null;
    }

    const raiz = payload.raiz || null;
    const pastaList = Array.isArray(payload.pastas) ? payload.pastas : [];
    const arquivoList = Array.isArray(payload.arquivos) ? payload.arquivos : [];

    return { raiz, pastaList, arquivoList, via: 'rpc' };
}

async function fetchDriveDataViaRest(config, token) {
    const raizRows = await hubFetch(
        config,
        token,
        `marketing_drive_raiz?select=id,drive_folder_id,nome&drive_folder_id=eq.${RAIZ_DRIVE_ID}&ativo=eq.true&limit=1`
    );
    const raiz = Array.isArray(raizRows) ? raizRows[0] : null;
    if (!raiz?.id) {
        return { raiz: null, pastaList: [], arquivoList: [], via: 'rest' };
    }

    const [pastas, arquivos] = await Promise.all([
        hubFetch(
            config,
            token,
            `marketing_drive_pastas?select=id,drive_folder_id,parent_drive_folder_id,nome,caminho&raiz_id=eq.${raiz.id}&order=caminho.asc`
        ),
        hubFetch(
            config,
            token,
            `marketing_drive_arquivos?select=id,pasta_id,nome,imagem_url,drive_modified_at&raiz_id=eq.${raiz.id}&ativo_no_drive=eq.true&order=nome.asc`
        ),
    ]);

    return {
        raiz,
        pastaList: Array.isArray(pastas) ? pastas : [],
        arquivoList: Array.isArray(arquivos) ? arquivos : [],
        via: 'rest',
    };
}

export async function getHubMarketingStories(env = process.env) {
    const config = hubConfig(env);
    const token = config.serviceKey || config.anonKey;
    if (!config.url || !token) {
        throw new Error('Credenciais do Hub ausentes para carregar stories de promoções.');
    }

    let driveData = null;

    try {
        driveData = await fetchDriveDataViaRpc(config, config.anonKey);
    } catch {
        driveData = null;
    }

    if (!driveData && config.serviceKey) {
        driveData = await fetchDriveDataViaRest(config, config.serviceKey);
    }

    if (!driveData) {
        return enrichMarketingStories({
            source: 'hub:marketing-drive:vertical-parceiros',
            fetchedAt: new Date().toISOString(),
            stories: [],
        });
    }

    const stories = buildStoriesFromDriveData(driveData.raiz, driveData.pastaList, driveData.arquivoList);

    return enrichMarketingStories({
        source: 'hub:marketing-drive:vertical-parceiros',
        fetchedAt: new Date().toISOString(),
        raiz: driveData.raiz?.nome || null,
        canal: 'vertical-tablet-parceiros',
        via: driveData.via,
        stories,
    });
}
