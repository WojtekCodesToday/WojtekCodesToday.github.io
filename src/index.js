let currentRouteName = null;
let currentStyleLink = null;
let navToken = 0;

// --- caches for browser reuse ---
const moduleCache = new Map(); // scriptPath -> imported module
const resolveCache = new Map(); // cleanPath -> scriptPath

function applyStyles(cssPath) {
    if (currentStyleLink) {
        currentStyleLink.remove();
        currentStyleLink = null;
    }
    if (cssPath) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = cssPath;
        document.head.appendChild(link);
        currentStyleLink = link;
    }
}

async function resolveScriptPath(path) {
    // cached -> instant, no HEAD fetch
    if (resolveCache.has(path)) return resolveCache.get(path);

    if (path === "" || path === "/") {
        resolveCache.set(path, "/root.js");
        return "/root.js";
    }

    const directPath = `${path}.js`;
    try {
        // browser will cache this HEAD if server sends cache headers,
        // but we only do it once per path thanks to resolveCache
        const response = await fetch(directPath, { method: 'HEAD', cache: 'force-cache' });
        if (response.ok && response.headers.get('content-type')?.includes('javascript')) {
            resolveCache.set(path, directPath);
            return directPath;
        }
    } catch {}

    const fallback = `${path}/root.js`;
    resolveCache.set(path, fallback);
    return fallback;
}

// loadRoute(rawPath, {push:true}) -> push = false when called from popstate
async function loadRoute(rawPath, { push = true } = {}) {
    let cleanPath = rawPath.split('?')[0].split('#')[0];
    if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
        cleanPath = cleanPath.slice(0, -1);
    }

    const thisNav = ++navToken;

    let scriptPath = await resolveScriptPath(cleanPath);

    // --- cache entire JS file in memory, reuse browser's module cache ---
    let mod;
    if (moduleCache.has(scriptPath)) {
        mod = moduleCache.get(scriptPath);
    } else {
        mod = await import(scriptPath);
        moduleCache.set(scriptPath, mod);
    }
    const route = mod.default;

    if (!route || typeof route.render !== 'function') {
        console.error(`Route export not found in ${scriptPath}`);
        document.getElementById("root").innerHTML = `<h1>404 - Page Not Found</h1>`;
        return;
    }

    let data;
    if (typeof route.load === 'function') {
        data = await route.load();
    }
    if (thisNav !== navToken) return; // cancelled by newer navigation

    if (route.title) document.title = route.title;
    applyStyles(route.css);

    let vdom = route.render(data);
    document.getElementById("root").innerHTML = roost.convert(vdom);

    // IMPORTANT: only push when it's a new navigation, not on popstate
    if (push) {
        const currentFull = window.location.pathname + window.location.search;
        if (currentFull !== rawPath) {
            window.history.pushState({ path: rawPath }, '', rawPath);
        }
    }

    currentRouteName = cleanPath;

    if (typeof route.mount === 'function') {
        await route.mount(data);
    }
    if (typeof route.unmount === 'function') {
        // store unmount for next route if you want cleanup
        loadRoute._lastUnmount = route.unmount;
    }
}

window["loadRoute"] = loadRoute;

function loadScript(src, { module = false } = {}) {
    return new Promise((resolve, reject) => {
        if (Array.from(document.scripts).some(script => script.src === src)) {
            resolve();
            return;
        }
        const script = document.createElement("script");
        script.src = src;
        script.async = false;
        if (module) script.type = "module";
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.body.appendChild(script);
    });
}

window["loadScript"] = loadScript;

document.addEventListener('click', function(e) {
    let target = e.target.closest('a');
    if (!target || !target.href) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (target.target === '_blank' || target.hasAttribute('download') || target.hasAttribute('data-external')) return;
    if (target.origin !== window.location.origin) return;

    let path = target.pathname + target.search;

    let lastSegment = target.pathname.substring(target.pathname.lastIndexOf('/') + 1);
    let hasExtension = lastSegment.includes('.');
    if (hasExtension) return;

    e.preventDefault();

    let currentFullPath = window.location.pathname + window.location.search;
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
    let expires = "expires=" + d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function getCookie(cname) {
    let name = cname + "=";
    let ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

if (document.cookie == "") {
    let dark = false;
    setCookie("dark", dark, 1);
}

function theme_run() {
    const isDark = getCookie("dark") === "true";
    document.documentElement.style.filter = `var(${isDark ? "--dark-mode" : "--light-mode"})`;
    //                                        .add() .remove()
    document.documentElement.classList[isDark?"add":"remove"]('dark-theme');

    if (mobile) {
        document.body.style.background = isDark ? "#000" : "#FFF" 
    };
}

function theme_toggle() {
    const currentlyDark = getCookie("dark") === "true";
    setCookie("dark", !currentlyDark, 1);
    theme_run();
}
window["theme_toggle"] = theme_toggle;

function mainload(){
    theme_run();
    const mbel = document.querySelectorAll('.mobile');
    mbel.forEach((el) => {
        el.style.display = mobile ? "block" : "none";
    });
    
    loadRoute(window.location.pathname + window.location.search);
}

document.addEventListener("DOMContentLoaded", () => mainload());