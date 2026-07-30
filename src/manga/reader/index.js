// ---------------------------------------------------------------------------
// Reader entry point. Wires the modules together and owns teardown.
// ---------------------------------------------------------------------------

import { createMangaState } from "./state.js";
import { createProviderManager } from "./providers.js";
import { createMangaRenderer } from "./renderer.js";
import { createInteractionHandler } from "./interaction.js";
import { createEventBus } from "./events.js";
import { fitScale, rowCount, TOP_MARGIN } from "./layout.js";
import {
    collectDom, updateNavigation, positionFooter, setDocumentTitle, mountSettingsToggle,
} from "./ui.js";

const WORKER_URL = "/manga/loader/index.js";
const REFRESH_INTERVAL = 500;

/** Elements the shell (reader.jsx) must provide before the reader can start. */
const REQUIRED_IDS = [
    "ui", "container", "mangaCanvas", "scroll-buffer",
    "next", "previous", "settings", "selread", "chkdebug", "chkwebgl",
];

export function startReader() {
    // If a previous instance's unmount was skipped (uncaught error mid-route),
    // tear it down first so listeners/worker/interval never double up.
    if (window.__readerCleanup) {
        window.__readerCleanup();
        window.__readerCleanup = null;
    }

    const controller = new AbortController();
    const { signal } = controller;

    const dom = collectDom();

    // startReader() must run AFTER the route's render() has put the shell in
    // the document - i.e. from mount(), never at module scope. If it runs too
    // early every getElementById returns null and the first symptom is an
    // unhelpful "dom.canvas is null" inside the renderer.
    const missing = REQUIRED_IDS.filter((id) => !document.getElementById(id));
    if (missing.length) {
        throw new Error(
            `Reader shell not in the document - missing #${missing.join(", #")}. `
            + "startReader() must be called from the route's mount(), after render()."
        );
    }

    const events = createEventBus();
    const state = createMangaState();
    const renderer = createMangaRenderer(state, dom);
    const network = createProviderManager(state);
    const interaction = createInteractionHandler(state, renderer, dom, events);

    let providerBase = "";
    let worker = null;
    let disposeSettings = null;

    // --- layout ------------------------------------------------------------

    function applyLayout() {
        if (!state.mangaData) return;

        const { clientWidth: vw, clientHeight: vh } = dom.container;
        state.scale = fitScale(state.mangaData, state.settings, state.isZoomed, vw, vh);

        const first = state.mangaData.p[0];
        const rows = rowCount(state.mangaData, state.settings);
        dom.buffer.style.height = (180* state.scale + rows * first.h * state.scale) + "px";
        dom.buffer.style.width = `${first.w * (state.settings.mode === 0 ? 2 : 1) * state.scale}px`;

        renderer.invalidateSize();
        renderer.requestRender();
    }

    events.on("layoutChange", applyLayout);

    const syncHistory = () => {
        window.history.pushState?.("", "", state.getHistoryUrl());
    };

    // --- chapter loading ----------------------------------------------------

    function findChapterIndex() {
        return state.chaptersList.findIndex(
            (item) => Number(item.v) === Number(state.volume)
                && Number(item.c) === Number(state.chapter)
        );
    }

    function showLoadedChapter() {
        dom.container.style.display = "block";
        applyLayout();
        dom.container.scrollTop = state.mangaData.p[0].h * state.scale * state.startPage;
        renderer.requestRender();

        setDocumentTitle(state);
        disposeSettings?.();
        disposeSettings = mountSettingsToggle(dom);
        positionFooter(state, dom);
    }

    async function loadChapter() {
        if (state.chaptersList.length === 0) {
            try {
                const res = await fetch(`${providerBase}${state.manga}/ch.json`);
                state.chaptersList = await res.json();
            } catch (err) {
                console.error("Chapter manifest failed to load.", err);
            }
        }

        state.currentChapterIdx = findChapterIndex();
        updateNavigation(state, dom);

        const cached = state.getFromCache();
        if (cached) {
            state.mangaData = cached.data;
            state.imagePool = cached.images;
            showLoadedChapter();
            return;
        }

        const fileUrl = `${providerBase}${state.manga}/v${state.volume}_c${state.chapter}.mps`;
        worker?.postMessage({ fileUrl });
    }

    async function goToChapter(target) {
        state.changeChapter(target);
        syncHistory();
        state.currentChapterIdx = findChapterIndex();
        updateNavigation(state, dom);
        dom.container.scrollTop = 0;
        dom.container.scrollLeft = 0;
        await loadChapter();
    }

    // --- settings controls ---------------------------------------------------

    dom.selRead.selectedIndex = state.settings.mode;
    dom.selRead.addEventListener("change", () => {
        state.settings.mode = parseInt(dom.selRead.value, 10);
        syncHistory();
        applyLayout();
    });

    function bindCheckbox(element, key, onChange) {
        element.checked = state.settings[key];
        element.addEventListener("change", () => {
            state.settings[key] = element.checked;
            syncHistory();
            onChange?.();
            renderer.requestRender();
        });
    }

    bindCheckbox(dom.chkDebug, "debug");
    bindCheckbox(dom.chkWebgl, "webgl", () => {
        // Rebuilding the canvas drops the old element, so re-run layout.
        renderer.reloadEngineContext();
        applyLayout();
    });

    dom.previous.onclick = () => {
        if (state.currentChapterIdx > 0) {
            goToChapter(state.chaptersList[state.currentChapterIdx - 1]);
        }
    };
    dom.next.onclick = () => {
        if (state.currentChapterIdx < state.chaptersList.length - 1) {
            goToChapter(state.chaptersList[state.currentChapterIdx + 1]);
        }
    };

    interaction.bindEvents(() => positionFooter(state, dom), signal);

    const refreshTimer = setInterval(() => renderer.requestRender(), REFRESH_INTERVAL);

    // --- worker ---------------------------------------------------------------

    try {
        worker = new Worker(WORKER_URL, { type: "module" });
        worker.onmessage = async (event) => {
            if (!event.data.success) {
                console.error("Worker pipeline failed.", event.data.error);
                return;
            }
            state.mangaData = event.data.data;
            state.imagePool = await renderer.preparePayload(event.data.blobs);
            state.addToCache(state.mangaData, state.imagePool);
            showLoadedChapter();
        };
    } catch (err) {
        console.error("Web Worker creation blocked.", err);
    }

    window.__readerCleanup = () => {
        controller.abort(); // removes every { signal } listener at once
        clearInterval(refreshTimer);
        worker?.terminate();
        disposeSettings?.();
        events.clear();
        state.clearCache();
        dom.tooltip?.remove();
    };

    network.resolveBase()
        .then((base) => {
            providerBase = base;
            return loadChapter();
        })
        .catch((err) => {
            console.error("Provider resolution failed.", err);
            dom.ui.innerHTML = `<b>Provider error:</b> ${String(err.message || err)}`;
        });

    return window.__readerCleanup;
}
