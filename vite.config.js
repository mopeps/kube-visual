import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    base: './',
    server: {
      host: true,
      port: 5173,
      allowedHosts: env.VITE_ALLOWED_HOSTS ? [env.VITE_ALLOWED_HOSTS] : [],
    },
  }
})
