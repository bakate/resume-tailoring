/**
 * The prefixes of the server settings the development server loads from the repository's `.env` files, so a local
 * server reads the same Language Model settings as a deployment. Every setting `env.ts` reads must start with one.
 */
export const serverEnvironmentFilePrefixes = ['LANGUAGE_MODEL_', 'OPENAI_', 'DEEPSEEK_'] as const
