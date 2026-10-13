/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// GitHub Pages serves a project site under /<repository>/. The deploy workflow
// passes that path through BASE_PATH; otherwise the repo name is used, so dev,
// preview and production all run under the same subpath.
const base = process.env.BASE_PATH ?? '/3d-model-lab/';

export default defineConfig({
  base,
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 800,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
