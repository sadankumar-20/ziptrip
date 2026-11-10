import { defineConfig } from 'tsup';
// The shared package is TypeScript source, so it is bundled into the server build.
export default defineConfig({ entry: ['src/server.ts'], format: ['esm'], target: 'node20', outDir: 'dist', clean: true, noExternal: ['@jzt/shared'], sourcemap: true });
