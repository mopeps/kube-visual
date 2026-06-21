import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    base: './',
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            minSize: 20_000,
            maxSize: 400_000,
            groups: [
              { name: 'vendor', test: /node_modules/ },
            ],
          },
        },
      },
    },
    server: {
      host: true,
      port: 5173,
      allowedHosts: env.VITE_ALLOWED_HOSTS ? [env.VITE_ALLOWED_HOSTS] : [],
    },
  }
})
