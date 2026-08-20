import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  // Determine base path:
  // 1. Explicit BASE_PATH or BASE_URL env var (e.g. from GitHub Actions / configure-pages)
  // 2. GITHUB_REPOSITORY (e.g. "user/repo" -> "/repo/")
  // 3. Fallback to "./" for local dev and standard containers
  let base = './';
  if (process.env.BASE_PATH) {
    base = process.env.BASE_PATH.endsWith('/') ? process.env.BASE_PATH : `${process.env.BASE_PATH}/`;
  } else if (process.env.BASE_URL) {
    base = process.env.BASE_URL.endsWith('/') ? process.env.BASE_URL : `${process.env.BASE_URL}/`;
  } else if (process.env.GITHUB_REPOSITORY && !process.env.GITHUB_REPOSITORY.endsWith('.github.io')) {
    const parts = process.env.GITHUB_REPOSITORY.split('/');
    if (parts.length > 1 && parts[1]) {
      base = `/${parts[1]}/`;
    }
  }

  return {
    base,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
