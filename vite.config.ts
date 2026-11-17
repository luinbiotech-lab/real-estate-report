import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const includeLocalBootstrap = mode === 'development' || mode === 'cutover' || env.VITE_CUTOVER_MODE === 'true';
  const localBootstrapBoundary = {
    name: 'daon-local-bootstrap-boundary',
    enforce: 'pre' as const,
    resolveId(id: string) {
      if (!includeLocalBootstrap && id === './services/localBootstrapService') return '\0daon-local-bootstrap-stub';
      return null;
    },
    load(id: string) {
      if (id === '\0daon-local-bootstrap-stub') {
        return 'export const localBootstrapService = { ensure: async () => undefined };';
      }
      return null;
    },
  };
  return {
    plugins: [localBootstrapBoundary, react()],
    // render.html: fixed-engine report PDF page (2026-11-16), loaded only by api/_lib/reportPdf.mjs.
    build: { rollupOptions: { input: { main: 'index.html', render: 'render.html' } } },
    define: {
      __DAON_INCLUDE_LOCAL_BOOTSTRAP__: JSON.stringify(includeLocalBootstrap),
    },
    server: {
      host: 'localhost',
      port: 5174,
      strictPort: true,
      proxy: {
        '/api': { target: 'http://localhost:5175', changeOrigin: true },
      },
    },
  };
});
