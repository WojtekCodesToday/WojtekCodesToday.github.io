const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const DIST = path.join(__dirname, 'dist');

app.use(express.static(DIST, {
    extensions: false,   // don't auto-append .html
    index: false,        // don't auto-serve index.html for directories
    redirect: false      // don't redirect /foo -> /foo/
}));

app.use((req, res) => {
    res.status(404).sendFile(path.join(DIST, '404.html'));
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Serving on http://localhost:${PORT}`));