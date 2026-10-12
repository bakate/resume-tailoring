module.exports = {
  forbidden: [
    {
      name: 'domain-does-not-depend-outward',
      severity: 'error',
      from: { path: '^packages/resume-tailoring-domain/src' },
      to: {
        path: '^(apps|packages/resume-tailoring-application)',
      },
    },
    {
      name: 'application-does-not-depend-on-web',
      severity: 'error',
      from: { path: '^packages/resume-tailoring-application/src' },
      to: { path: '^apps/web' },
    },
    {
      name: 'matching-engine-is-provider-neutral',
      severity: 'error',
      from: { path: '^packages/resume-matching-engine/src' },
      to: {
        path: '^(apps|packages/(?!resume-matching-engine))',
      },
    },
    {
      name: 'web-does-not-reach-through-application',
      severity: 'error',
      from: { path: '^apps/web/src' },
      to: { path: '^packages/resume-tailoring-domain' },
    },
    {
      name: 'core-does-not-import-runtime-adapters',
      severity: 'error',
      from: {
        path: '^packages/(resume-matching-engine|resume-tailoring-domain|resume-tailoring-application)/src',
      },
      to: {
        dependencyTypes: ['npm'],
        path: '(@tanstack|react|puppeteer|openai|idb|node_modules/ai/|@ai-sdk)',
      },
    },
    {
      name: 'ai-sdk-stays-in-server-adapters',
      comment: 'The AI SDK is infrastructure: only server adapters reach language models, and no port ever sees its types.',
      severity: 'error',
      from: { pathNot: '^apps/web/src/adapters/server/' },
      to: {
        // A resolved import lands under node_modules; one a package does not declare stays its bare name.
        path: '(^|/)node_modules/(ai|@ai-sdk/[^/]+)/|^(ai|@ai-sdk/[^/]+)$',
      },
    },
    {
      name: 'only-the-composition-root-wires-adapters',
      comment: 'UI modules reach adapters through apps/web/src/composition-root.ts; API routes and model evaluation use them directly.',
      severity: 'error',
      from: {
        path: '^apps/web/src',
        pathNot: '^apps/web/src/(composition-root[.]ts$|adapters/|model-evaluation/|routes/(api[.]|-)[^/]*[.]ts$)|[.]evaluation[.]test[.]ts$',
      },
      to: { path: '^apps/web/src/adapters/' },
    },
    {
      name: 'model-qualification-is-provider-neutral',
      comment: 'Qualification reaches models only through the call wrapper: it never names a provider adapter or package.',
      severity: 'error',
      from: { path: '^apps/web/src/model-evaluation/', pathNot: '[.]test[.]ts$' },
      to: {
        path: '^apps/web/src/adapters/server/[^/]*-language-model-provider[.]ts$|(^|/)node_modules/(openai|@ai-sdk/[^/]+)/|^(openai|@ai-sdk/[^/]+)$',
      },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
    },
    tsConfig: {
      fileName: 'tsconfig.base.json',
    },
  },
}
