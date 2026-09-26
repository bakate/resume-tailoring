import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, '../..', 'OPENAI_'))
  return {
    envDir: '../..',
    plugins: [tanstackStart(), viteReact(), nitro()],
    server: {
      port: 3000,
    },
  }
})
