// ---------------------------------------------------------------------------
// Provider resolution + library fetching
//
// All the "are we local or on wjgm.pl" logic lives HERE and nowhere else.
// The rest of the app just consumes the result.
// ---------------------------------------------------------------------------

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]", "0.0.0.0"];
const FALLBACK_PROVIDERS = ["self", "assets.wjgm.pl"];

export const isLocal = () => LOCAL_HOSTS.includes(window.location.hostname);

/**
 * Fetch JSON, returning null instead of throwing.
 * GitHub Pages' SPA fallback serves index.html with 200 OK for missing files,
 * so a leading "<" means "this route doesn't exist", not "here's your data".
 */
async function fetchJson(url) {
    try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return null;
        const text = await res.text();
        if (!text || text.trimStart().startsWith("<")) return null;
        return JSON.parse(text);
    } catch {
        return null;
    }
}

/** Turn a provider name into a base URL. "self" means the local /manga dir. */
export const SELF_BASE = "manga/";

function toBaseUrl(provider) {
    if (!provider || provider === "self") return SELF_BASE;
    let url = String(provider).trim();
    if (!url.startsWith("http")) url = `https://${url}`;
    return url.endsWith("/") ? url : `${url}/`;
}

/**
 * Resolve the provider list for the current environment.
 * On production "self" is dropped - that directory only exists locally.
 */
export async function resolveProviders(extraProvider) {
    let providers =
        (await fetchJson("/manga/providers.json")) ||
        (await fetchJson("./providers.json")) ||
        FALLBACK_PROVIDERS;

    if (!isLocal()) {
        providers = providers.filter((p) => String(p).toLowerCase() !== "self");
        if (providers.length === 0) providers = ["assets.wjgm.pl"];
    }

    if (extraProvider && !providers.includes(extraProvider)) {
        providers.push(extraProvider);
    }

    return providers.map(toBaseUrl);
}

/** Fetch every series manifest from one provider. Returns null if unusable. */
async function loadProvider(base, id) {
    const registry = await fetchJson(`${base}mangas.json`);
    if (!Array.isArray(registry)) {
        console.warn(`[manga] skipping provider ${base}`);
        return null;
    }

    const manifests = await Promise.all(
        registry.map(async (entry) => {
            const chapters = await fetchJson(`${base}${entry.c}/ch.json`);
            return chapters ? { code: entry.c, meta: entry, chapters } : null;
        })
    );

    return { id, base, manifests: manifests.filter(Boolean) };
}

/**
 * Load and merge every provider into:
 *   series:  Map<code, meta>
 *   library: Map<code, Map<"vol_ch", {...chapter, sources: number[]}>>
 *   bases:   string[]  (index == source id)
 */
export async function loadLibrary(extraProvider) {
    const bases = await resolveProviders(extraProvider);
    const loaded = (await Promise.all(bases.map(loadProvider))).filter(Boolean);

    const series = new Map();
    const library = new Map();

    for (const provider of loaded) {
        for (const { code, meta, chapters } of provider.manifests) {
            if (!series.has(code)) series.set(code, meta);
            if (!library.has(code)) library.set(code, new Map());

            const seriesChapters = library.get(code);
            for (const chapter of chapters) {
                const key = `${chapter.v}_${chapter.c}`;
                if (!seriesChapters.has(key)) {
                    seriesChapters.set(key, { ...chapter, sources: [] });
                }
                seriesChapters.get(key).sources.push(provider.id);
            }
        }
    }

    return { series, library, bases };
}

/**
 * Choose which provider to load a chapter's images from.
 * Locally: whatever has it. On production: a remote, never "self".
 */
export function makeSourcePicker(bases) {
    const remotes = bases
        .map((base, i) => (base === SELF_BASE ? -1 : i))
        .filter((i) => i !== -1);

    return (sources = []) => {
        if (!isLocal()) {
            const remote = sources.find((id) => remotes.includes(id));
            if (remote !== undefined) return remote;
            if (remotes.length) return remotes[0];
        }
        return sources[0] ?? 0;
    };
}
