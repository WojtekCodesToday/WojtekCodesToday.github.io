import { page } from "../_page.js";

export default {
    title: "Manga",
    css: "/blog.css",
    render: () => {
        return (
            <>
                <style>{`
                    .search-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 10px;
                        margin-bottom: 20px;
                        padding: 15px;
                    }
                    #searchQ, #searchM { grid-column: span 2; }
                    .vol-header {
                        display: flex;
                        flex-wrap: wrap;
                        align-items: center;
                        margin: 20px 0 20px 20px;
                        gap: 20px;
                    }
                    @media (max-width: 700px) {
                        .search-grid { grid-template-columns: 1fr; }
                        #searchQ, #searchM { grid-column: span 1; }
                        .vol-header {
                            margin-left: 10px !important;
                            gap: 10px;
                            flex-direction: column;
                            align-items: flex-start;
                        }
                    }
                `}</style>

                <div id="page">
                    <main id="content" class="manga_panel blog_post">
                        <p style="padding: 15px;">Loading...</p>
                    </main>
                    <br />
                    <div class="manga_panel">
                        <h2>Q&A:</h2>
                        <ul>
                            <li>Is this piracy?
                                <ul>No, i make the content myself.<br/>thanks for asking though.<br/>Also the mangas are provided through a repository/provider.</ul>
                            </li>
                            <br />
                            <li>Where can i donate to you?
                                <ul>Currently nowhere, i will be thinking of that however :)</ul>
                            </li>
                            <br />
                            <li>The reader sucks!!
                                <ul>I am aware of that, and i am trying to expand upon it, i know its a bit jank...</ul>
                            </li>
                        </ul>
                    </div>
                </div>
            </>
        );
    },

    mount: async () => {
        const content = document.getElementById('content');
        if (!content) return;

        const params = new URLSearchParams(window.location.search);
        const filterQ = params.get("q")?.toLowerCase() || "";
        const filterV = params.get("v") || "";
        const filterC = params.get("c") || "";
        const filterM = params.get("m") || "";
        const startPage = params.get("p") || "0";
        const isLocalHost = ['localhost','127.0.0.1'].includes(window.location.hostname);

        const searchUI = {
            "div-search": {
                class: "search-grid",
                child: {
                    "input-q": { type: "text", class: "manga_panel", placeholder: "Chapter name...", id: "searchQ", value: filterQ, style: "padding: 8px;" },
                    "input-v": { type: "number", class: "manga_panel", placeholder: "Volume", id: "searchV", value: filterV, min: "1", style: "padding: 8px;" },
                    "input-c": { type: "number", class: "manga_panel", placeholder: "Chapter", id: "searchC", value: filterC, min: "1", style: "padding: 8px;" },
                    "select-m": { class: "manga_panel", id: "searchM", style: "padding: 8px;", child: { "option-0": { value: "", child: "All Series" } } },
                    "button-exec": {
                        class: "manga_panel",
                        style: "padding: 10px; cursor: pointer;",
                        child: "SEARCH",
                        onclick: "window.applySearch()"
                    },
                    "button-clear": {
                        class: "manga_panel",
                        style: "padding: 10px; cursor: pointer;",
                        child: "CLEAR",
                        onclick: "loadRoute(window.location.pathname)"
                    }
                }
            }
        };

        window.applySearch = () => {
            const q = document.getElementById('searchQ')?.value;
            const v = document.getElementById('searchV')?.value;
            const c = document.getElementById('searchC')?.value;
            const m = document.getElementById('searchM')?.value;

            const url = new URL(window.location.href);
            if (q) url.searchParams.set("q", q); else url.searchParams.delete("q");
            if (v) url.searchParams.set("v", v); else url.searchParams.delete("v");
            if (c) url.searchParams.set("c", c); else url.searchParams.delete("c");
            if (m) url.searchParams.set("m", m); else url.searchParams.delete("m");

            loadRoute(url.pathname + url.search);
        };

        try {
            const tryFetchJson = async (url) => {
                try {
                    const r = await fetch(url, { cache: 'no-store' });
                    if (!r.ok) return null;
                    const text = await r.text();
                    // GitHub Pages SPA fallback returns HTML with 200 OK - detect it
                    if (!text || text.trim().startsWith('<') || text.trim().startsWith('<!DOCTYPE')) return null;
                    const j = JSON.parse(text);
                    return j;
                } catch { return null; }
            };

            let jsonProviders = null;
            // fetch providers.json from same dir as this jsx
            try {
                const localUrl = new URL('./providers.json', import.meta.url);
                jsonProviders = await tryFetchJson(localUrl);
            } catch {}
            if (!jsonProviders) jsonProviders = await tryFetchJson('/manga/providers.json');
            if (!jsonProviders) jsonProviders = await tryFetchJson('./providers.json');
            if (!jsonProviders) jsonProviders = await tryFetchJson('providers.json');
            if (!jsonProviders) jsonProviders = ["self", "assets.wjgm.pl"];

            // PRODUCTION FIX: on wjgm.pl never use self, it doesn't exist
            if (!isLocalHost) {
                const before = jsonProviders.length;
                jsonProviders = jsonProviders.filter(p => String(p).toLowerCase() !== 'self');
                if (before !== jsonProviders.length) console.log('[manga] filtered out self on production');
                if (jsonProviders.length === 0) jsonProviders = ["assets.wjgm.pl"];
            }

            const urlProv = params.get("prov");

            const norm = (u) => {
                if (!u || u === "self") return "manga/";
                let t = u.trim();
                if (!t.startsWith('http')) t = 'https://' + t;
                return t.endsWith('/') ? t : t + '/';
            };

            const uniqueProviders = [...jsonProviders];
            if (urlProv && !uniqueProviders.includes(urlProv)) uniqueProviders.push(urlProv);
            const allBaseUrls = uniqueProviders.map(norm);

            // only need mangas.json, if fails or not JSON -> skip
            const providerData = await Promise.all(allBaseUrls.map(async (base, pIdx) => {
                try {
                    const regReq = await fetch(`${base}mangas.json`, { cache: 'no-store' });
                    if (!regReq.ok) {
                        console.warn(`[manga] skipping provider ${base} - mangas.json ${regReq.status}`);
                        return null;
                    }
                    const text = await regReq.text();
                    if (!text || text.trim().startsWith('<')) {
                        console.warn(`[manga] skipping provider ${base} - returned HTML not JSON (SPA fallback)`);
                        return null;
                    }
                    let registry;
                    try { registry = JSON.parse(text); } catch { return null; }
                    if (!Array.isArray(registry)) return null;

                    let provID = pIdx; // 0=self (filtered on prod), 1=assets

                    const manifests = await Promise.all(registry.map(async (manga) => {
                        try {
                            const chReq = await fetch(`${base}${manga.c}/ch.json`);
                            if (!chReq.ok) return null;
                            const chText = await chReq.text();
                            if (chText.trim().startsWith('<')) return null;
                            return { manga: manga.c, chapters: JSON.parse(chText), meta: manga };
                        } catch { return null; }
                    }));

                    return { provID, base, manifests: manifests.filter(m => m) };
                } catch (e) {
                    console.warn(`[manga] provider ${base} error, skipping`, e);
                    return null;
                }
            }));

            const activeData = providerData.filter(p => p);

            const masterRegistry = new Map();
            const mergedLibrary = new Map();

            activeData.forEach(prov => {
                prov.manifests.forEach(m => {
                    if (!masterRegistry.has(m.manga)) masterRegistry.set(m.manga, m.meta);
                    if (!mergedLibrary.has(m.manga)) mergedLibrary.set(m.manga, new Map());
                    const seriesMap = mergedLibrary.get(m.manga);
                    m.chapters.forEach(ch => {
                        const key = `${ch.v}_${ch.c}`;
                        if (!seriesMap.has(key)) {
                            seriesMap.set(key, { ...ch, sources: [] });
                        }
                        seriesMap.get(key).sources.push(prov.provID);
                    });
                });
            });

            masterRegistry.forEach((entry, code) => {
                searchUI["div-search"].child["select-m"].child[`option-${code}`] = {
                    value: code,
                    child: entry.n,
                    ...(filterM === code ? { selected: "selected" } : {})
                };
            });

            const remoteIndices = allBaseUrls.map((b,i) => (b !== 'manga/' && b !== '/manga/' ? i : -1)).filter(i=>i!==-1);
            // on wjgm.pl remotes = [1] (assets)

            const pickPreferred = (sources) => {
                if (!isLocalHost) {
                    // 1. prefer remote that actually has this chapter
                    if (sources?.length) {
                        const inSrc = sources.filter(id => remoteIndices.includes(id));
                        if (inSrc.length) return inSrc[0];
                    }
                    // 2. if no remote in sources (assets failed CORS or self only), force first remote anyway
                    if (remoteIndices.length) return remoteIndices[0];
                }
                return sources?.[0] ?? 0;
            };

            let listObj = {};
            let seriesIndex = 0;
            masterRegistry.forEach((entry, code) => {
                if (filterM && code !== filterM) return;

                let chapters = Array.from(mergedLibrary.get(code).values());

                if (filterV) chapters = chapters.filter(ch => String(ch.v) === filterV);
                if (filterC) chapters = chapters.filter(ch => String(ch.c) === filterC);
                if (filterQ) chapters = chapters.filter(ch => ch.n.toLowerCase().includes(filterQ));

                if (chapters.length > 0) {
                    chapters.sort((a, b) => b.v - a.v || b.c - a.c);
                    const maxVol = Math.max(...chapters.map(ch => ch.v));
                    listObj[`hr-${seriesIndex}`] = {};
                    let lastVol = null;

                    chapters.forEach((chapter, j) => {
                        if (chapter.v !== lastVol) {
                            const isLatest = chapter.v === maxVol;
                            const primarySourceIdx = pickPreferred(chapter.sources);
                            let imageBase = allBaseUrls[primarySourceIdx] || "manga/";

                            listObj[`div-vol-header-${seriesIndex}-${chapter.v}`] = {
                                class: "vol-header",
                                child: {
                                    [`img-v-${seriesIndex}-${chapter.v}`]: {
                                        src: `${imageBase}${code}/v${chapter.v}.png`.replace(/([^:]\/)\/+/g, "$1"),
                                        onerror: "this.style.display='none'",
                                        style: "width: 120px; cursor: pointer; border: 1px solid #000; flex-shrink: 0;",
                                        onclick: `loadRoute('/manga/reader?m=${code}&v=${chapter.v}&c=${chapter.c}${imageBase !== 'manga/' ? (primarySourceIdx==0) ? '' : `&prov=${primarySourceIdx}` : ''}')`
                                    },
                                    [`div-vol-info-${seriesIndex}-${chapter.v}`]: {
                                        style: "display: flex; flex-direction: column;",
                                        child: {
                                            [`span-vol-name-${seriesIndex}-${chapter.v}`]: {
                                                child: isLatest ? entry.n : `Volume ${chapter.v}`,
                                                style: "font-size: 1.4rem; font-weight: bold; text-transform: uppercase;"
                                            },
                                            ...(entry.d && isLatest ? {
                                                [`span-vol-desc-${seriesIndex}-${chapter.v}`]: {
                                                    child: entry.d,
                                                    style: "font-size: 0.9rem; opacity: 0.8; margin-top: 5px; max-width: 400px;"
                                                }
                                            } : {})
                                        }
                                    }
                                }
                            };
                            lastVol = chapter.v;
                        }

                        const primarySourceIdx = pickPreferred(chapter.sources);
                        let imageBase = allBaseUrls[primarySourceIdx] || "manga/";
                        let provParam = "";
                        if (imageBase !== 'manga/' && imageBase !== '/manga/') {
                            provParam = primarySourceIdx == 0 ? '' : `&prov=${primarySourceIdx}`;
                        }
                        

                        const qStr = `?m=${code}&v=${chapter.v}&c=${chapter.c}${provParam}${startPage == "0" ? "" : `&p=${startPage}`}`;

                        listObj[`div-ch-${seriesIndex}-${j}`] = {
                            class: "manga_panel",
                            style: "margin-bottom:10px; cursor:pointer; display:flex; flex-direction:column; padding:12px; margin-left: 20px;",
                            onclick: `loadRoute('/manga/reader${qStr}')`,
                            child: {
                                [`span-meta-${seriesIndex}-${j}`]: {
                                    child: `${entry.n} — vol ${chapter.v} ch ${chapter.c}`,
                                    style: "font-size: 0.75rem; opacity: 0.7; margin-bottom: 4px;"
                                },
                                [`span-title-${seriesIndex}-${j}`]: {
                                    child: chapter.n,
                                    style: "font-size: 1.1rem; font-weight: bold;"
                                }
                            }
                        };
                    });
                    seriesIndex++;
                }
            });

            content.innerHTML = roost.convert(searchUI) + `<div id="results">${roost.convert(listObj) || "<p>Nothing found.</p>"}</div>`;

        } catch (err) {
            content.innerHTML = "<h2>Library Error</h2>";
            console.error(err);
        }
    }
};
