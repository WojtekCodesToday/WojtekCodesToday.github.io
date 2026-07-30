import { list } from "./util.js";
import { loadLibrary, makeSourcePicker } from "./providers.js";
import { SearchBar, SeriesSection, QandA } from "./components.js";

const STYLES = `
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
`;

/** Read the filters this page understands out of the URL. */
function readFilters() {
    const params = new URLSearchParams(window.location.search);
    return {
        q: params.get("q")?.toLowerCase() || "",
        v: params.get("v") || "",
        c: params.get("c") || "",
        m: params.get("m") || "",
        p: params.get("p") || "0",
        prov: params.get("prov") || "",
    };
}

/** Apply search-box values to the URL and re-route. */
function installSearchHandler() {
    window.applySearch = () => {
        const url = new URL(window.location.href);
        for (const [key, id] of [["q", "searchQ"], ["v", "searchV"], ["c", "searchC"], ["m", "searchM"]]) {
            const value = document.getElementById(id)?.value;
            if (value) url.searchParams.set(key, value);
            else url.searchParams.delete(key);
        }
        loadRoute(url.pathname + url.search);
    };
}

/** Filter one series' chapters, newest first. Returns [] if nothing matches. */
function selectChapters(library, code, filters) {
    let chapters = [...library.get(code).values()];

    if (filters.v) chapters = chapters.filter((ch) => String(ch.v) === filters.v);
    if (filters.c) chapters = chapters.filter((ch) => String(ch.c) === filters.c);
    if (filters.q) chapters = chapters.filter((ch) => ch.n.toLowerCase().includes(filters.q));

    return chapters.sort((a, b) => b.v - a.v || b.c - a.c);
}

export default {
    title: "Manga",
    css: "/blog.css",

    render: () => (
        <>
            <style>{STYLES}</style>
            <div id="page">
                <main id="content" class="manga_panel blog_post">
                    <p style="padding: 15px;">Loading...</p>
                </main>
                <br />
                <QandA />
            </div>
        </>
    ),

    mount: async () => {
        const content = document.getElementById("content");
        if (!content) return;

        const filters = readFilters();
        installSearchHandler();

        try {
            const { series, library, bases } = await loadLibrary(filters.prov);
            const pickSource = makeSourcePicker(bases);

            const sections = [...series]
                .filter(([code]) => !filters.m || code === filters.m)
                .map(([code, entry]) => ({ code, entry, chapters: selectChapters(library, code, filters) }))
                .filter(({ chapters }) => chapters.length > 0)
                .map(({ code, entry, chapters }) => (
                    <SeriesSection
                        code={code}
                        entry={entry}
                        chapters={chapters}
                        pickSource={pickSource}
                        bases={bases}
                        page={filters.p}
                    />
                ));

            content.innerHTML = roost.convert(
                <>
                    <SearchBar filters={filters} series={series} />
                    <div id="results">
                        {sections.length ? list(sections) : <p>Nothing found.</p>}
                    </div>
                </>
            );
        } catch (err) {
            content.innerHTML = roost.convert(<h2>Library Error</h2>);
            console.error(err);
        }
    },
};
