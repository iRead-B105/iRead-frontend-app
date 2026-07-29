import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { resolveLearnerEnvironment } from './src/config/env'

export default defineConfig(({ command, mode }) => {
  const projectRoot = fileURLToPath(new URL('.', import.meta.url))
  const rawEnvironment = loadEnv(mode, projectRoot, 'VITE_')
  const environment = resolveLearnerEnvironment(rawEnvironment, {
    requireBackendOrigin: command === 'serve' && mode !== 'test',
  })

  return {
    plugins: [vue(), vueDevTools()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      proxy: environment.backendUrl
        ? {
            '/api': { target: environment.backendUrl, changeOrigin: true },
            '/uploads': { target: environment.backendUrl, changeOrigin: true },
          }
        : undefined,
    },
  }
})
