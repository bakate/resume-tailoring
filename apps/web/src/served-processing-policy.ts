import { createServerFn } from '@tanstack/react-start'

import { readActiveProcessingPolicy } from './processing-policy'

/**
 * Hands the browser the Processing Policy of the provider this server calls, rendered with the landing. Switching
 * provider therefore changes the policy the Candidate consents to without rebuilding the browser bundle.
 */
export const readServedProcessingPolicy = createServerFn({ method: 'GET' })
  .handler(() => readActiveProcessingPolicy({ environment: process.env }))
