import "./util.js"
let currentRouteName = null;
let currentStyleLinks = [];   // was: currentStyleLink (single)
let navToken = 0;

// --- caches for browser reuse ---
const moduleCache = new Map();  // scriptPath -> imported module
const resolveCache = new Map(); // cleanPath  -> scriptPath | null  (null = known 404)
const scriptPromises = new Map(); // absolute src -> Promise (dedupe in-flight loads)
const inFlight = new Map();     // cleanPath -> Promise (dedupe concurrent resolves)

// file extensions to try, in order, for each candidate location
const ROUTE_EXTS = ['.js'];

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

// null/undefined -> [], "a.css" -> ["a.css"], ["a","b"] -> ["a","b"]
function toList(value) {
    if (value == null || value === false) return [];
    return (Array.isArray(value) ? value : [value]).filter(Boolean);
}

function absUrl(src, base) {
    // base defaults to document.baseURI for backwards compatibility,
    // but callers should pass the route's own scriptPath so that
    // relative css/js paths resolve the same way whether you arrive
    // via a full reload or a client-side navigation.
    return new URL(src, base || document.baseURI).href;
}

// <link rel=preload> so the network fetch overlaps with route.load(),
// without executing anything early
function prefetchScripts(js, base) {
    for (const entry of toList(js)) {
        const src = typeof entry === 'string' ? entry : entry.src;
        const url = absUrl(src, base);
        if (document.querySelector(`link[rel="preload"][href="${CSS.escape(url)}"]`)) continue;
        const l = document.createElement('link');
        l.rel = 'preload';
        l.as = 'script';
        l.href = url;
        if (new URL(url).origin !== location.origin) l.crossOrigin = 'anonymous';
        document.head.appendChild(l);
    }
}

/* ------------------------------------------------------------------ */
/* styles: accepts a string OR an array of strings                     */
/* ------------------------------------------------------------------ */

function applyStyles(cssPath, base) {
    const wanted = toList(cssPath).map(src => absUrl(src, base));

    // keep links that are already correct -> no re-download, no flash of unstyled content
    const keep = [];
    for (const link of currentStyleLinks) {
        if (wanted.includes(link.href)) keep.push(link);
        else link.remove();
    }

    const have = keep.map(l => l.href);

    for (const href of wanted) {
        if (have.includes(href)) continue;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.dataset.route = 'true';
        document.head.appendChild(link);
        keep.push(link);
    }

    currentStyleLinks = keep;
}

// optional: await this instead if you want to render only once CSS is in
function applyStylesAndWait(cssPath) {
    applyStyles(cssPath);
    return Promise.all(
        currentStyleLinks.map(link =>
            link.sheet
                ? Promise.resolve()
                : new Promise(res => {
                      link.addEventListener('load', res, { once: true });
                      link.addEventListener('error', res, { once: true });
                  })
        )
    );
}

/* ------------------------------------------------------------------ */
/* scripts: accepts a string, {src, module}, or an array of either     */
/* ------------------------------------------------------------------ */

async function applyScripts(js, base) {
    const list = toList(js);
    if (!list.length) return;

    // script.async = false keeps execution order = insertion order,
    // so we can fetch them all in parallel and still run them in order.
    // NOTE: the map() below calls loadScript synchronously in array order,
    // which is what guarantees appendChild order === array order.
    await Promise.all(
        list.map(entry =>
            typeof entry === 'string'
                ? loadScript(entry, {}, base)
                : loadScript(entry.src, { module: !!entry.module, reload: !!entry.reload }, base)
        )
    );
}

// reload:true -> re-execute on every navigation (page scripts).
// default     -> fetch+execute once per page load (vendor libs).
function loadScript(src, { module = false, reload = false } = {}, base) {
    const url = absUrl(src, base);

    if (!reload) {
        // already loaded (or loading) -> reuse, never inject twice
        if (scriptPromises.has(url)) return scriptPromises.get(url);
        if (Array.from(document.scripts).some(s => s.src === url)) {
            const done = Promise.resolve();
            scriptPromises.set(url, done);
            return done;
        }
    }

    const promise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.async = false;
        if (module) script.type = 'module';
        if (reload) script.dataset.reload = 'true';
        script.onload = () => resolve();
        script.onerror = () => {
            scriptPromises.delete(url); // allow a retry later
            reject(new Error(`Failed to load ${url}`));
        };
        document.body.appendChild(script);
    });

    if (!reload) scriptPromises.set(url, promise);
    return promise;
}

function clearReloadScripts() {
    document.querySelectorAll('script[data-reload="true"]').forEach(s => s.remove());
}

window['loadScript'] = loadScript;

async function probe(url) {
    try {
        const res = await fetch(url, { method: 'HEAD', cache: 'force-cache' });
        return res.ok && !!res.headers.get('content-type')?.includes('javascript');
    } catch {
        return false;
    }
}

async function resolveScriptPath(path) {
    if (resolveCache.has(path)) return resolveCache.get(path);      // may be null
    if (inFlight.has(path)) return inFlight.get(path);              // dedupe double-clicks

    const job = (async () => {
        // candidates: /foo.js, /foo.jsx, /foo/root.js, /foo/root.jsx
        const base = (path === '' || path === '/') ? '' : path;
        const candidates = [
            ...(base ? ROUTE_EXTS.map(ext => `${base}${ext}`) : []),
            ...ROUTE_EXTS.map(ext => `${base}/root${ext}`),
        ];

        for (const url of candidates) {
            if (await probe(url)) {
                resolveCache.set(path, url);
                return url;
            }
        }

        resolveCache.set(path, null);
        return null;
    })();

    inFlight.set(path, job);
    try {
        return await job;
    } finally {
        inFlight.delete(path);
    }
}

function forgetRoute(path) {
    if (path == null) {
        resolveCache.clear();
        moduleCache.clear();
    } else {
        const hit = resolveCache.get(path);
        if (hit) moduleCache.delete(hit);
        resolveCache.delete(path);
    }
}
window['forgetRoute'] = forgetRoute;

function show404(scriptPath) {
    document.getElementById('root').innerHTML = `<center><h1>404</h1></center>`;
    document.title = '404';
    if (scriptPath) console.warn(`No route module at ${scriptPath}`);
}

async function loadRoute(rawPath, { push = true } = {}) {
    let cleanPath = rawPath.split('?')[0].split('#')[0];
    if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
        cleanPath = cleanPath.slice(0, -1);
    }

    const thisNav = ++navToken;

    const scriptPath = await resolveScriptPath(cleanPath);
    if (thisNav !== navToken) return;

    if (scriptPath === null) {
        if (push) window.history.pushState({ path: rawPath }, '', rawPath);
        console.log("script path is null");
        show404(cleanPath);
        return;
    }

    // scriptPath is root-relative (e.g. "/manga/root.js"), but the URL()
    // constructor requires its `base` argument to itself be an absolute
    // URL. Resolve it once against document.baseURI here, then use THAT
    // as the base for every relative css/js path below.
    const scriptBase = absUrl(scriptPath);

    let mod;
    if (moduleCache.has(scriptPath)) {
        mod = moduleCache.get(scriptPath);
        if (mod === null) { console.log("mod script path is null"); show404(scriptPath); return; }
    } else {
        try {
            mod = await import(scriptPath);
        } catch (err) {
            console.error(`Failed to import ${scriptPath}`, err);
            moduleCache.set(scriptPath, null);
            if (thisNav === navToken) {
                if (push) window.history.pushState({ path: rawPath }, '', rawPath);
                console.log("thisnav is the same as navtoken");
                show404(scriptPath);
            }
            return;
        }
        moduleCache.set(scriptPath, mod);
    }
    if (thisNav !== navToken) return;

    const route = mod.default;

    if (!route || typeof route.render !== 'function') {
        console.error(`Route export not found in ${scriptPath}`);
        moduleCache.set(scriptPath, null);
        if (push) window.history.pushState({ path: rawPath }, '', rawPath);
        console.log("render is not a function");
        show404(scriptPath);
        return;
    }

    prefetchScripts(route.js, scriptBase);

    const data = typeof route.load === 'function' ? await route.load() : undefined;
    if (thisNav !== navToken) return;

    if (typeof loadRoute._lastUnmount === 'function') {
        try { await loadRoute._lastUnmount(); } catch (e) { console.error('unmount failed', e); }
        loadRoute._lastUnmount = null;
        if (thisNav !== navToken) return;
    }

    if (route.title) document.title = route.title;
    applyStyles(route.css, scriptBase);

    const vdom = route.render(data);
    document.getElementById('root').innerHTML = roost.convert(vdom);

    clearReloadScripts();
    await applyScripts(route.js, scriptBase);
    if (thisNav !== navToken) return;

    if (push) {
        const currentFull = window.location.pathname + window.location.search;
        if (currentFull !== rawPath) {
            window.history.pushState({ path: rawPath }, '', rawPath);
        }
    }

    currentRouteName = cleanPath;
    loadRoute._lastUnmount = typeof route.unmount === 'function' ? route.unmount : null;

    if (typeof route.mount === 'function') {
        await route.mount(data);
    }
}

window['loadRoute'] = loadRoute;

/* ------------------------------------------------------------------ */
/* link interception / history                                         */
/* ------------------------------------------------------------------ */

document.addEventListener('click', function (e) {
    const target = e.target.closest('a');
    if (!target || !target.href) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (target.target === '_blank' || target.hasAttribute('download') || target.hasAttribute('data-external')) return;
    if (target.origin !== window.location.origin) return;

    const path = target.pathname + target.search;

    const lastSegment = target.pathname.substring(target.pathname.lastIndexOf('/') + 1);
    if (lastSegment.includes('.')) return; // has extension -> let the browser handle it

    e.preventDefault();

    const currentFullPath = window.location.pathname + window.location.search;
    if (path !== currentFullPath) {
        loadRoute(path, { push: true });
    }
});

window.addEventListener('popstate', (e) => {
    // back/forward -> load without pushing a new entry
    const path = e.state?.path || window.location.pathname + window.location.search;
    loadRoute(path, { push: false });
});

function mainload() {
    document.querySelectorAll('.mobile').forEach((el) => {
        el.style.display = mobile ? 'block' : 'none';
    });
    loadRoute(window.location.pathname + window.location.search, { push: false });
}

document.addEventListener('DOMContentLoaded', mainload);