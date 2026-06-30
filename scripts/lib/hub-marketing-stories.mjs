import { hubConfig } from '../hub-auth.mjs';

const RAIZ_DRIVE_ID = '1XxmOF8ks5AUjMK5sC1y9fJ6f_sAWnhgo';

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

function stripExtension(name) {
    return String(name || '')
        .replace(/\.[^.]+$/, '')
        .trim();
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

export async function getHubMarketingStories(env = process.env) {
    const config = hubConfig(env);
    const token = config.serviceKey || config.anonKey;
    if (!config.url || !token) {
        throw new Error('Credenciais do Hub ausentes para carregar stories de promoções.');
    }

    const raizRows = await hubFetch(
        config,
        token,
        `marketing_drive_raiz?select=id,drive_folder_id,nome&drive_folder_id=eq.${RAIZ_DRIVE_ID}&ativo=eq.true&limit=1`
    );
    const raiz = Array.isArray(raizRows) ? raizRows[0] : null;
    if (!raiz?.id) {
        return {
            source: 'hub:marketing-drive',
            fetchedAt: new Date().toISOString(),
            stories: [],
        };
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

    const pastaList = Array.isArray(pastas) ? pastas : [];
    const arquivoList = Array.isArray(arquivos) ? arquivos : [];

    const arquivosByPastaId = new Map();
    arquivoList.forEach((arquivo) => {
        if (!arquivo?.pasta_id) return;
        const list = arquivosByPastaId.get(arquivo.pasta_id) || [];
        list.push(arquivo);
        arquivosByPastaId.set(arquivo.pasta_id, list);
    });

    const storyFolders = pastaList.filter((p) => p.parent_drive_folder_id === raiz.drive_folder_id);

    const buildStory = (pasta, index) => {
        const images = collectImagesForFolder(pasta, pastaList, arquivosByPastaId);
        if (!images.length) return null;

        const cta = ctaForFolder(pasta.nome);
        const slides = images.map((arquivo) => ({
            image: arquivo.imagem_url,
            title: stripExtension(arquivo.nome) || pasta.nome,
            cta,
            theme: 'yellow',
        }));

        return {
            id: `mkt-${pasta.id}`,
            label: pasta.nome,
            ringColor: ringColorForFolder(pasta.nome, index),
            thumbImage: images[0].imagem_url,
            slides,
        };
    };

    let stories = storyFolders.map(buildStory).filter(Boolean);

    if (!stories.length && arquivoList.length) {
        const pastasComImagem = new Set(arquivoList.map((a) => a.pasta_id).filter(Boolean));
        const fallbackFolders = pastaList.filter((p) => pastasComImagem.has(p.id));
        stories = fallbackFolders.map(buildStory).filter(Boolean);
    }

    return {
        source: 'hub:marketing-drive',
        fetchedAt: new Date().toISOString(),
        raiz: raiz.nome,
        stories,
    };
}
