import { createServerFn } from '@tanstack/react-start'

import { readActiveProcessingPolicy } from './processing-policy'

/**
 * Hands the browser the Processing Policy of the provider this server calls, rendered with the landing. Switching
 * provider therefore changes the policy the Candidate consents to without rebuilding the browser bundle. It is null
 * when the server refuses its Language Model selection, and the landing then disables the Candidate Journey.
 */
export const readServedProcessingPolicy = createServerFn({ method: 'GET' })
  .handler(() => readActiveProcessingPolicy({ environment: process.env }))
