// ---------------------------------------------------------------------------
// Works out which provider actually serves the requested chapter.
// ---------------------------------------------------------------------------

const localBase = () => `${window.location.origin}/manga/`;

function normalize(url) {
    if (!url || url === "self") return localBase();

    let text = String(url).trim();
    if (!text) return localBase();
    if (!/^https?:\/\//i.test(text)) text = `https://${text}`;
    return text.endsWith("/") ? text : `${text}/`;
}

/**
 * Does this URL exist? HEAD is enough and cheap; some CDNs reject it, so for
 * small manifests fall back to GET rather than assume a miss.
 */
async function exists(url) {
    try {
        const head = await fetch(url, { method: "HEAD", cache: "no-store" });
        if (head.ok) return true;
    } catch {
        // HEAD blocked (CORS preflight, CDN policy) - fall through.
    }

    if (!/\/ch\.json(?:\?|$)/.test(url)) return false;

    try {
        const get = await fetch(url, { method: "GET", cache: "no-store" });
        return get.ok;
    } catch {
        return false;
    }
}

export function createProviderManager(state) {
    const chapterFile = (base) =>
        `${base}${state.manga}/v${state.volume}_c${state.chapter}.mps`;
    const manifestFile = (base) => `${base}${state.manga}/ch.json`;

    const hasChapter = async (base) =>
        (await exists(manifestFile(base))) || (await exists(chapterFile(base)));

    async function fetchProviderList() {
        try {
            const res = await fetch(`${localBase()}providers.json`, { cache: "no-store" });
            if (res.ok) {
                const list = await res.json();
                if (Array.isArray(list) && list.length) return list;
            }
        } catch (err) {
            console.warn("Could not load providers.json.", err);
        }
        return ["self"];
    }

    return {
        /**
         * Returns the base URL to load from.
         * ?prov= accepts an index into providers.json, "self", or a hostname.
         */
        async resolveBase() {
            const providers = await fetchProviderList();

            if (state.activeProvider !== null) {
                const index = parseInt(state.activeProvider, 10);
                const raw = !isNaN(index) && providers[index]
                    ? providers[index]
                    : state.activeProvider;
                const base = normalize(raw);

                if (await hasChapter(base)) return base;
                throw new Error(
                    `Selected provider does not contain manga/chapter: ${raw} -> ${base}`
                );
            }

            for (let i = 0; i < providers.length; i++) {
                const raw = providers[i];
                const base = normalize(raw);

                if (await hasChapter(base)) {
                    state.activeProvider = raw === "self" ? null : String(i);
                    console.log("Using provider:", raw, base);
                    return base;
                }
                console.warn("Provider lacks requested chapter:", raw, base);
            }

            throw new Error(
                `No provider has ${state.manga}/v${state.volume}_c${state.chapter}.mps`
            );
        },
    };
}
