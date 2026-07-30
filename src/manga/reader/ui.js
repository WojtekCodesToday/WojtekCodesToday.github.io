// ---------------------------------------------------------------------------
// Chrome around the canvas: chapter nav buttons, settings panel, tooltip node.
// ---------------------------------------------------------------------------

import { rowCount } from "./layout.js";

export function collectDom() {
    const tooltip = document.createElement("div");
    tooltip.id = "manga-tooltip";
    tooltip.className = "manga_panel";
    tooltip.style.display = "none";
    document.body.appendChild(tooltip);

    return {
        canvas: document.getElementById("mangaCanvas"),
        container: document.getElementById("container"),
        buffer: document.getElementById("scroll-buffer"),
        ui: document.getElementById("ui"),
        next: document.getElementById("next"),
        previous: document.getElementById("previous"),
        settingsEl: document.getElementById("settings"),
        selRead: document.getElementById("selread"),
        chkDebug: document.getElementById("chkdebug"),
        chkWebgl: document.getElementById("chkwebgl"),
        tooltip,
    };
}

export function updateNavigation(state, dom) {
    const hasList = state.currentChapterIdx !== -1;
    dom.previous.style.display =
        hasList && state.currentChapterIdx > 0 ? "block" : "none";
    dom.next.style.display =
        hasList && state.currentChapterIdx < state.chaptersList.length - 1 ? "block" : "none";
}

export function positionFooter(state, dom) {
    if (!state.mangaData) return;

    const first = state.mangaData.p[0];
    const contentHeight = rowCount(state.mangaData, state.settings) * first.h * state.scale;
    const { scrollTop } = dom.container;
    const top = scrollTop > 40 * state.scale ? contentHeight - scrollTop + 50 : 20;

    const bar = document.getElementsByClassName("chapterbtns")[0];
    if (bar) bar.style.display = "block";

    dom.previous.style.top = `${top}px`;
    dom.next.style.top = `${top}px`;
    dom.next.style.left = "65%";
    dom.previous.style.left = "30%";
}

export function setDocumentTitle(state) {
    const current = state.chaptersList[state.currentChapterIdx]
        ?? { n: "Unknown", v: state.volume, c: state.chapter };
    const label = `"${current.n}" Vol ${current.v} Ch ${current.c}`;
    document.title = label;
    return label;
}

export function mountSettingsToggle(dom) {
    dom.ui.innerHTML = '<button id="toggle-settings-btn">Settings</button>';
    const button = document.getElementById("toggle-settings-btn");
    let open = false;

    const onClick = () => {
        open = !open;
        dom.settingsEl.style.display = open ? "block" : "none";
    };

    button.addEventListener("click", onClick);
    return () => button.removeEventListener("click", onClick);
}
