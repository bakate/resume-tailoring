import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, '../..', 'OPENAI_'))
  return {
    build: {
      target: ['chrome125', 'firefox140', 'safari18'],
    },
    envDir: '../..',
    plugins: [tanstackStart(), viteReact(), nitro()],
    server: {
      port: 3000,
    },
    worker: {
      format: 'es',
    },
  }
})
