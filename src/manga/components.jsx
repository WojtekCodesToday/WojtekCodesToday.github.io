import { list, qs, joinUrl } from "./util.js";
import { SELF_BASE } from "./providers.js";

// ---------------------------------------------------------------------------
// Presentational components. Each is a plain function returning JSX -
// roost.convertJSX calls them when it sees <Name />.
// ---------------------------------------------------------------------------

const PANEL = "manga_panel";

/** Link to the reader for a given chapter. */
export function readerHref({ code, chapter, sourceIdx, page }) {
    return `/manga/reader${qs({
        m: code,
        v: chapter.v,
        c: chapter.c,
        prov: sourceIdx > 0 ? sourceIdx : "",
        p: page && page !== "0" ? page : "",
    })}`;
}

function Field({ id, type = "text", placeholder, value, min }) {
    return (
        <input
            type={type}
            class={PANEL}
            id={id}
            placeholder={placeholder}
            value={value || ""}
            min={min || ""}
            style="padding: 8px;"
        />
    );
}

function SeriesOption({ code, name, selected }) {
    return selected ? (
        <option value={code} selected="selected">{name}</option>
    ) : (
        <option value={code}>{name}</option>
    );
}

export function SearchBar({ filters, series }) {
    const options = [<option value="">All Series</option>].concat(
        [...series].map(([code, meta]) => (
            <SeriesOption code={code} name={meta.n} selected={filters.m === code} />
        ))
    );

    return (
        <div class="search-grid">
            <Field id="searchQ" placeholder="Chapter name..." value={filters.q} />
            <Field id="searchV" type="number" placeholder="Volume" value={filters.v} min="1" />
            <Field id="searchC" type="number" placeholder="Chapter" value={filters.c} min="1" />
            <select class={PANEL} id="searchM" style="padding: 8px;">
                {list(options)}
            </select>
            <button class={PANEL} style="padding: 10px; cursor: pointer;" onclick="window.applySearch()">
                SEARCH
            </button>
            <button
                class={PANEL}
                style="padding: 10px; cursor: pointer;"
                onclick="loadRoute(window.location.pathname)"
            >
                CLEAR
            </button>
        </div>
    );
}

/** Cover + title block shown once per volume. */
export function VolumeHeader({ code, entry, chapter, imageBase, sourceIdx, isLatest }) {
    const cover = joinUrl(imageBase, code, `/v${chapter.v}.png`);
    const href = readerHref({ code, chapter, sourceIdx });

    return (
        <div class="vol-header">
            <img
                src={cover}
                onerror="this.style.display='none'"
                style="width: 120px; cursor: pointer; border: 1px solid #000; flex-shrink: 0;"
                onclick={`loadRoute('${href}')`}
            />
            <div style="display: flex; flex-direction: column;">
                <span style="font-size: 1.4rem; font-weight: bold; text-transform: uppercase;">
                    {isLatest ? entry.n : `Volume ${chapter.v}`}
                </span>
                {entry.d && isLatest ? (
                    <span style="font-size: 0.9rem; opacity: 0.8; margin-top: 5px; max-width: 400px;">
                        {entry.d}
                    </span>
                ) : null}
            </div>
        </div>
    );
}

/** One clickable chapter row. */
export function ChapterRow({ code, entry, chapter, sourceIdx, page }) {
    const href = readerHref({ code, chapter, sourceIdx, page });

    return (
        <div
            class={PANEL}
            style="margin-bottom:10px; cursor:pointer; display:flex; flex-direction:column; padding:12px; margin-left: 20px;"
            onclick={`loadRoute('${href}')`}
        >
            <span style="font-size: 0.75rem; opacity: 0.7; margin-bottom: 4px;">
                {`${entry.n} — vol ${chapter.v} ch ${chapter.c}`}
            </span>
            <span style="font-size: 1.1rem; font-weight: bold;">{chapter.n}</span>
        </div>
    );
}

/** A whole series: divider, then volume headers interleaved with chapters. */
export function SeriesSection({ code, entry, chapters, pickSource, bases, page }) {
    const maxVol = Math.max(...chapters.map((ch) => ch.v));
    const nodes = [<hr />];
    let lastVol = null;

    for (const chapter of chapters) {
        const sourceIdx = pickSource(chapter.sources);
        const imageBase = bases[sourceIdx] || SELF_BASE;

        if (chapter.v !== lastVol) {
            nodes.push(
                <VolumeHeader
                    code={code}
                    entry={entry}
                    chapter={chapter}
                    imageBase={imageBase}
                    sourceIdx={sourceIdx}
                    isLatest={chapter.v === maxVol}
                />
            );
            lastVol = chapter.v;
        }

        nodes.push(
            <ChapterRow
                code={code}
                entry={entry}
                chapter={chapter}
                sourceIdx={sourceIdx}
                page={page}
            />
        );
    }

    return <div>{list(nodes)}</div>;
}

export function QandA() {
    const entries = [
        {
            q: "Is this piracy?",
            a: "No, i make the content myself. Thanks for asking though. Also the mangas are provided through a repository/provider.",
        },
        { q: "Where can i donate to you?", a: "Currently nowhere, i will be thinking of that however :)" },
        { q: "The reader sucks!!", a: "I am aware of that, and i am trying to expand upon it, i know its a bit jank..." },
    ];

    return (
        <div class={PANEL}>
            <h2>Q&A:</h2>
            <dl>
                {list(
                    entries.map((e) => [<dt>{e.q}</dt>, <dd>{e.a}</dd>]).flat()
                )}
            </dl>
        </div>
    );
}
