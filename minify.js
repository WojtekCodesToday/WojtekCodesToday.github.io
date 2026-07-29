const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

const targetDir = path.join(__dirname, 'dist');

async function processDirectory(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      await processDirectory(fullPath);
    } else if (file.endsWith('.js')) {
      const code = fs.readFileSync(fullPath, 'utf8');
      
      try {
        const result = await minify(code, {
          compress: true,
          mangle: false
        });

        fs.writeFileSync(fullPath, result.code, 'utf8');
        console.log(`minified: ${path.relative(targetDir, fullPath)}`);
      } catch (err) {
        console.error(`err minified ${file}:`, err.message);
      }
    }
  }
}

processDirectory(targetDir).then(() => console.log('minify success'));