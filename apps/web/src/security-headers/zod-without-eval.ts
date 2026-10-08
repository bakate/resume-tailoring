import { z } from 'zod'

// Zod would otherwise probe `new Function` to compile its parsers, which the page Content-Security-Policy forbids.
// Imported first by the router, so the setting lands before any module parses.
z.config({ jitless: true })
