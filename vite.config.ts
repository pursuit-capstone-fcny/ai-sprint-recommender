import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import { projectLibraryOrigin } from './library/project.ts';

export default defineConfig(({ mode }) => {
  const origin = projectLibraryOrigin({
    ...loadEnv(mode, process.cwd(), ''),
    ...process.env,
  });
  return {
    define: origin
      ? {
          'import.meta.env.VITE_LIBRARY_ORIGIN': JSON.stringify(origin),
          'import.meta.env.VITE_CATALOG_SOURCE': JSON.stringify('static'),
        }
      : {},
    plugins: [react()],
    test: {
      environment: 'jsdom',
    },
  };
});
