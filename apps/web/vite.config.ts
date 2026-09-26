import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  envDir: '../..',
  plugins: [tanstackStart(), viteReact(), nitro()],
  server: {
    port: 3000,
  },
})
