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
      rolldownOptions: {
        output: {
          codeSplitting: {
            // Zod probes `new Function` when a schema is built unless it is already jitless, which the page
            // Content-Security-Policy reports as a violation. Bundling the setting with Zod applies it before any schema.
            groups: [{ name: 'zod', test: /[\\/]node_modules[\\/]zod[\\/]|[\\/]zod-without-eval\.ts$/ }],
          },
        },
      },
      target: [...sourceDocumentBrowserSupportPolicy.buildTargets],
    },
    envDir: '../..',
    optimizeDeps: {
      include: [...sourceDocumentBrowserSupportPolicy.pdfWorkerPreBundledPackages],
    },
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
