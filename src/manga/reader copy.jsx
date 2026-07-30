export default {
    title: "reader",

    css: "./manga.css",

    render: () => {
        return (
            <>
                <div id="ui" className="manga_panel">loading...</div>

                <div id="container">
                    <canvas id="mangaCanvas"> {" "} </canvas>
                    <div id="scroll-buffer"> {" "}</div>
                </div>

                <div id="nav-footer" className="chapterbtns" style={{ display: "none" }}>
                    <button id="previous" className="chapter_button" style={{ display: "none" }}>
                        Previous chapter
                    </button>

                    <button id="next" className="chapter_button" style={{ display: "none" }}>
                        Next chapter
                    </button>
                </div>

                <div
                    id="settings"
                    className="manga_panel"
                    style={{ display: "none" }}
                >
                    <h2>Settings</h2>

                    <label htmlFor="selread">Reading mode:</label>

                    <select id="selread">
                        <option value="0">On two pages</option>
                        <option value="1">Comic strip</option>
                    </select>

                    <hr />

                    <h3>Other</h3>

                    <input type="checkbox" name="chkwebgl" id="chkwebgl" />
                    <label htmlFor="chkwebgl">
                        Enable WebGL slow if disabled
                    </label>

                    <br />

                    <input type="checkbox" name="chkdebug" id="chkdebug" />
                    <label htmlFor="chkdebug">Debug mode</label>
                </div>
            </>
        );
    },
    js: [
    "https://cdn.jsdelivr.net/gh/jagenjo/Canvas2DtoWebGL/src/gl-matrix-min.js",
    "https://cdn.jsdelivr.net/gh/jagenjo/Canvas2DtoWebGL/src/litegl.min.js",
    "https://cdn.jsdelivr.net/gh/jagenjo/Canvas2DtoWebGL/src/Canvas2DtoWebGL.js",
    { src: "/manga/reader_js.js", reload: true },
    ],

    // Called by the router (loadRoute._lastUnmount) right before the NEXT
    // route renders. This is what stops listeners/interval/worker from
    // piling up every time you revisit the reader without a full reload.
    unmount: () => {
        if (window.__readerCleanup) {
            window.__readerCleanup();
            window.__readerCleanup = null;
        }
    },
};