import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `vite build` → production site that talks to the API.
// `vite build --mode preview` → one self-contained HTML file running on in-browser demo data.
export default defineConfig(({ mode }) => {
  const preview = mode === 'preview';
  return {
    plugins: [react(), tailwindcss(), ...(preview ? [viteSingleFile({ removeViteModuleLoader: true })] : [])],
    build: preview
      ? { outDir: 'dist-preview', assetsInlineLimit: 100_000_000, cssCodeSplit: false, chunkSizeWarningLimit: 5000 }
      : { outDir: 'dist', assetsInlineLimit: 4096, chunkSizeWarningLimit: 900 },
    server: { port: 5173, proxy: { '/api': 'http://localhost:8787' } },
  };
});
