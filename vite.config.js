import { resolve, dirname } from 'path';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(dirname("./"), '404.html'),
      },
    },
  },
})
