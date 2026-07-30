// ---------------------------------------------------------------------------
// Reader state: URL params, view settings, chapter position, page cache.
// ---------------------------------------------------------------------------

const DEFAULT_MANGA = "wchan";
const DEFAULT_NUM = 1;
const MAX_CACHE_SIZE = 3;
const MOBILE_BREAKPOINT = 768;

export const MODE_SPREAD = 0; // two pages side by side
export const MODE_SINGLE = 1; // one page (mobile)

/** Free the canvases/object URLs held by one cache entry. */
function releaseEntry(entry) {
    if (!entry) return;
    for (const image of entry.images.values()) {
        if (image?.channels) {
            for (const canvas of image.channels) {
                if (canvas) {
                    canvas.width = 0;
                    canvas.height = 0;
                }
            }
        }
        if (image?.raw?.src) URL.revokeObjectURL(image.raw.src);
    }
}

function readSettings(params) {
    const settings = {
        mode: params.get("mobile") === "true" || window.innerWidth < MOBILE_BREAKPOINT
            ? MODE_SINGLE
            : MODE_SPREAD,
        debug: false,
        webgl: true,
    };

    const raw = params.get("settings");
    if (raw) {
        try {
            Object.assign(settings, JSON.parse(raw));
        } catch (err) {
            console.warn("Invalid settings payload string parameter.", err);
        }
    }
    return settings;
}

export function createMangaState() {
    const params = new URLSearchParams(window.location.search);

    let manga = params.get("m") || DEFAULT_MANGA;
    let volume = parseInt(params.get("v"), 10) || DEFAULT_NUM;
    let chapter = parseInt(params.get("c"), 10) || DEFAULT_NUM;
    let activeProvider = params.get("prov") || null;

    const startPage = parseInt(params.get("p"), 10) || 0;
    const settings = readSettings(params);
    const cache = new Map();

    const state = {
        // --- URL-backed identity -------------------------------------------
        get manga() { return manga; },
        get volume() { return volume; },
        get chapter() { return chapter; },
        get startPage() { return startPage; },
        get activeProvider() { return activeProvider; },
        set activeProvider(value) { activeProvider = value; },

        // --- view ----------------------------------------------------------
        isZoomed: false,
        scale: 1.0,
        settings,

        // --- loaded content --------------------------------------------------
        chaptersList: [],
        currentChapterIdx: -1,
        mangaData: null,
        imagePool: new Map(),

        get cacheKey() { return `${manga}_v${volume}_c${chapter}`; },

        changeChapter(target) {
            volume = target.v;
            chapter = target.c;
            state.mangaData = null;
            state.isZoomed = false;
        },

        /** URL for history.pushState - only non-default values are included. */
        getHistoryUrl() {
            const query = new URLSearchParams();
            if (manga !== DEFAULT_MANGA) query.set("m", manga);
            if (volume !== DEFAULT_NUM) query.set("v", volume);
            if (chapter !== DEFAULT_NUM) query.set("c", chapter);
            if (activeProvider !== null) query.set("prov", activeProvider);
            query.set("settings", JSON.stringify(settings));

            const s = query.toString();
            return `/manga/reader${s ? `?${s}` : ""}`;
        },

        addToCache(data, images) {
            const key = state.cacheKey;
            if (cache.has(key)) cache.delete(key);
            cache.set(key, { data, images });

            while (cache.size > MAX_CACHE_SIZE) {
                const oldestKey = cache.keys().next().value;
                releaseEntry(cache.get(oldestKey));
                cache.delete(oldestKey);
            }
        },

        getFromCache() {
            return cache.get(state.cacheKey) || null;
        },

        /** Drop everything - used when a setting invalidates decoded output. */
        clearCache() {
            for (const entry of cache.values()) releaseEntry(entry);
            cache.clear();
        },
    };

    return state;
}
