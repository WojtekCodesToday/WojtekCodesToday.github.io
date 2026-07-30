const express = require('express');
const path = require('path');

const app = express();
const DIST = path.join(__dirname, 'dist');

// Extensions that are fetched by code (modules, workers, data) rather than
// typed into the address bar. A missing one of these must NOT come back as
// an HTML 404 page: the browser applies strict MIME checking to module
// scripts and reports the misleading NS_ERROR_CORRUPTED_CONTENT instead of
// a plain 404.
const ASSET_EXT = new Set([
    '.js', '.mjs', '.cjs', '.jsx', '.ts', '.mts', '.json', '.map',
    '.css', '.mps', '.wasm', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.ico',
]);

app.use(express.static(DIST, {
    extensions: false,   // don't auto-append .html
    index: false,        // don't auto-serve index.html for directories
    redirect: false,     // don't redirect /foo -> /foo/
    setHeaders(res, filePath) {
        // Dev only: stop the browser serving a stale copy of a module you
        // just edited. Module scripts are cached per-URL and a normal
        // refresh will happily reuse them.
        if (ASSET_EXT.has(path.extname(filePath))) {
            res.setHeader('Cache-Control', 'no-store');
        }
    },
}));

app.use((req, res) => {
    const ext = path.extname(req.path).toLowerCase();

    if (ASSET_EXT.has(ext)) {
        console.warn(`404 asset: ${req.method} ${req.originalUrl}`);
        return res
            .status(404)
            .type('text/plain')
            .send(`404 Not Found: ${req.path}\n`);
    }

    res.status(404).sendFile(path.join(DIST, '404.html'));
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Serving on http://localhost:${PORT}`));
