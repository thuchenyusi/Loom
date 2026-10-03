import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: { entry: 'src/index.ts', name: 'Diagram', formats: ['es', 'iife'], fileName: format => format === 'es' ? 'diagram.js' : 'diagram.min.js' },
    target: 'es2022',
    // Both artifacts are self-contained for static hosting, including G6.
  },
});
