import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const includeLocalBootstrap = mode === 'development' || env.VITE_CUTOVER_MODE === 'true';
  return {
    plugins: [react()],
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
