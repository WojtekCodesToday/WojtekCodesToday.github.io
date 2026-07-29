let currentRouteName = null;
let currentStyleLinks = [];   // was: currentStyleLink (single)
let navToken = 0;

// --- caches for browser reuse ---
const moduleCache = new Map();  // scriptPath -> imported module
const resolveCache = new Map(); // cleanPath  -> scriptPath | null  (null = known 404)
const scriptPromises = new Map(); // absolute src -> Promise (dedupe in-flight loads)
const inFlight = new Map();     // cleanPath -> Promise (dedupe concurrent resolves)

// file extensions to try, in order, for each candidate location
const ROUTE_EXTS = ['.js', '.jsx'];

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

// null/undefined -> [], "a.css" -> ["a.css"], ["a","b"] -> ["a","b"]
function toList(value) {
    if (value == null || value === false) return [];
    return (Array.isArray(value) ? value : [value]).filter(Boolean);
}

function absUrl(src) {
    return new URL(src, document.baseURI).href;
}

// <link rel=preload> so the network fetch overlaps with route.load(),
// without executing anything early
function prefetchScripts(js) {
    for (const entry of toList(js)) {
        const src = typeof entry === 'string' ? entry : entry.src;
        const url = absUrl(src);
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

function applyStyles(cssPath) {
    const wanted = toList(cssPath).map(absUrl);

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

async function applyScripts(js) {
    const list = toList(js);
    if (!list.length) return;

    // script.async = false keeps execution order = insertion order,
    // so we can fetch them all in parallel and still run them in order.
    // NOTE: the map() below calls loadScript synchronously in array order,
    // which is what guarantees appendChild order === array order.
    await Promise.all(
        list.map(entry =>
            typeof entry === 'string'
                ? loadScript(entry)
                : loadScript(entry.src, { module: !!entry.module, reload: !!entry.reload })
        )
    );
}

// reload:true -> re-execute on every navigation (page scripts).
// default     -> fetch+execute once per page load (vendor libs).
function loadScript(src, { module = false, reload = false } = {}) {
    const url = absUrl(src);

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
        show404(cleanPath);
        return;
    }

    let mod;
    if (moduleCache.has(scriptPath)) {
        mod = moduleCache.get(scriptPath);
        if (mod === null) { show404(scriptPath); return; }
    } else {
        try {
            mod = await import(scriptPath);
        } catch (err) {
            console.error(`Failed to import ${scriptPath}`, err);
            moduleCache.set(scriptPath, null);
            if (thisNav === navToken) {
                if (push) window.history.pushState({ path: rawPath }, '', rawPath);
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
        show404(scriptPath);
        return;
    }

    prefetchScripts(route.js);

    const data = typeof route.load === 'function' ? await route.load() : undefined;
    if (thisNav !== navToken) return;

    if (typeof loadRoute._lastUnmount === 'function') {
        try { await loadRoute._lastUnmount(); } catch (e) { console.error('unmount failed', e); }
        loadRoute._lastUnmount = null;
        if (thisNav !== navToken) return;
    }

    if (route.title) document.title = route.title;
    applyStyles(route.css);

    const vdom = route.render(data);
    document.getElementById('root').innerHTML = roost.convert(vdom);

    clearReloadScripts();
    await applyScripts(route.js);
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


let mobile = false;
(function (a) { if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4))) mobile = true; })(navigator.userAgent || navigator.vendor || window.opera);

function setCookie(cname, cvalue, exdays) {
    const d = new Date();
    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    document.cookie = `${cname}=${cvalue};expires=${d.toUTCString()};path=/;SameSite=Lax`;
}

function getCookie(cname) {
    const name = cname + '=';
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1);
        if (c.indexOf(name) === 0) return c.substring(name.length, c.length);
    }
    return '';
}

if (getCookie('dark') === '') {
    setCookie('dark', false, 1);
}

function theme_run() {
    const isDark = getCookie('dark') === 'true';
    document.documentElement.style.filter = `var(${isDark ? '--dark-mode' : '--light-mode'})`;
    document.documentElement.classList[isDark ? 'add' : 'remove']('dark-theme');
    if (mobile) document.body.style.background = isDark ? '#000' : '#FFF';
}

function theme_toggle() {
    const currentlyDark = getCookie('dark') === 'true';
    setCookie('dark', !currentlyDark, 1);
    theme_run();
}
window['theme_toggle'] = theme_toggle;

function mainload() {
    theme_run();
    document.querySelectorAll('.mobile').forEach((el) => {
        el.style.display = mobile ? 'block' : 'none';
    });
    loadRoute(window.location.pathname + window.location.search, { push: false });
}

document.addEventListener('DOMContentLoaded', mainload);
