// ---------------------------------------------------------------------------
// Reader route: the static shell. All behaviour lives in ./reader/.
//
// NOTE ON THE " " CHILDREN BELOW
// roost emits `closed: true` -> `<canvas/>` for any element with no children.
// Self-closing syntax is NOT valid for non-void HTML elements: the browser
// parses `<canvas/>` as an *opening* tag, so everything after it gets nested
// inside the canvas and getElementById("scroll-buffer") returns an element
// that is a child of the canvas. Verified in jsdom.
//
// A single space child forces roost to emit `<canvas> </canvas>`. Keep them.
// ---------------------------------------------------------------------------

import { startReader } from "./reader/index.js";

const SPACE = " "; // load-bearing - see note above

function ReadingModeSetting() {
    return (
        <div>
            <label htmlFor="selread">Reading mode:</label>
            <select id="selread">
                <option value="0">On two pages</option>
                <option value="1">Comic strip</option>
            </select>
        </div>
    );
}

function Toggle({ id, label }) {
    return (
        <div>
            <input type="checkbox" name={id} id={id} />
            <label htmlFor={id}>{label}</label>
        </div>
    );
}

function SettingsPanel() {
    return (
        <div id="settings" className="manga_panel" style={{ display: "none" }}>
            <h2>Settings</h2>
            <ReadingModeSetting />
            <hr />
            <h3>Other</h3>
            <Toggle id="chkwebgl" label="Enable WebGL (slow if disabled)" />
            <Toggle id="chkdebug" label="Debug mode" />
        </div>
    );
}

function ChapterNav() {
    return (
        <div id="nav-footer" className="chapterbtns" style={{ display: "none" }}>
            <button id="previous" className="chapter_button" style={{ display: "none" }}>
                Previous chapter
            </button>
            <button id="next" className="chapter_button" style={{ display: "none" }}>
                Next chapter
            </button>
        </div>
    );
}

function Viewport() {
    return (
        <div id="container">
            <canvas id="mangaCanvas">{SPACE}</canvas>
            <div id="scroll-buffer">{SPACE}</div>
        </div>
    );
}

export default {
    title: "reader",
    css: "./manga.css",

    render: () => (
        <>
            <div id="ui" className="manga_panel">loading...</div>
            <Viewport />
            <ChapterNav />
            <SettingsPanel />
        </>
    ),

    js: [
        "https://cdn.jsdelivr.net/gh/jagenjo/Canvas2DtoWebGL/src/gl-matrix-min.js",
        "https://cdn.jsdelivr.net/gh/jagenjo/Canvas2DtoWebGL/src/litegl.min.js",
        "https://cdn.jsdelivr.net/gh/jagenjo/Canvas2DtoWebGL/src/Canvas2DtoWebGL.js",
    ],

    // Runs after render(), once the shell is in the document.
    mount: () => {
        startReader();
    },

    // Called by the router (loadRoute._lastUnmount) right before the NEXT
    // route renders. This is what stops listeners/interval/worker from
    // piling up every time you revisit the reader without a full reload.
    unmount: () => {
        window.__readerCleanup?.();
        window.__readerCleanup = null;
    },
};
