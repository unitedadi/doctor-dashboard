import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_API_PROXY_TARGET

  return {
    plugins: [react()],
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    server: {
      proxy: proxyTarget
        ? {
            '/api': {
              target: proxyTarget,
              changeOrigin: true,
              headers: {
                'ngrok-skip-browser-warning': 'true',
              },
              rewrite: (path) => path.replace(/^\/api/, ''),
            },
          }
        : undefined,
    },
    preview: {
      allowedHosts: true,
    },
  }
})
