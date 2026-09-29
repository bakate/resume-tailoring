import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig, loadEnv } from 'vite'

import { sourceDocumentBrowserSupportPolicy } from './src/resume-tailoring/source-document-browser-support.ts'

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, '../..', 'OPENAI_'))
  const isEndToEndTestServer = process.env.VITE_E2E === '1'

  return {
    build: {
      target: [...sourceDocumentBrowserSupportPolicy.buildTargets],
    },
    envDir: '../..',
    plugins: [tanstackStart(), viteReact(), nitro()],
    server: {
      hmr: isEndToEndTestServer ? { overlay: false } : undefined,
      port: 3000,
    },
    worker: {
      format: 'es',
    },
  }
})
