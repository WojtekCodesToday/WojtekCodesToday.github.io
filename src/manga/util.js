// ---------------------------------------------------------------------------
// roost helpers
// ---------------------------------------------------------------------------

/**
 * roost's convertJSX cannot handle an array passed as a single child:
 *   <ul>{items.map(...)}</ul>  ->  <0 li-0="[object Object]">
 * because keys collide and the array is stringified.
 *
 * list() flattens an array of JHTML nodes into ONE JHTML object with unique
 * keys, so it can be dropped in as a child:
 *   <ul>{list(items.map(...))}</ul>
 */
export function list(items) {
    const out = {};
    let i = 0;
    for (const item of [].concat(items).flat(Infinity)) {
        if (item === null || item === undefined || item === false || item === "") continue;
        if (typeof item !== "object") {
            out[`-${i++}`] = { child: String(item) };
            continue;
        }
        for (const key in item) {
            const [tag] = key.split("-");
            out[`${tag}-${i++}`] = item[key];
        }
    }
    return out;
}

/** Build a query string, skipping empty values. */
export function qs(params) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== "" && v !== null && v !== undefined) p.set(k, String(v));
    }
    const s = p.toString();
    return s ? `?${s}` : "";
}

/** Collapse accidental double slashes in a URL path (but keep "https://"). */
export function joinUrl(...parts) {
    return parts.join("").replace(/([^:]\/)\/+/g, "$1");
}
