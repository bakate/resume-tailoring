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
        path: '(@tanstack|react|puppeteer|openai|idb)',
      },
    },
    {
      name: 'only-the-composition-root-wires-adapters',
      comment: 'UI modules reach adapters through apps/web/src/composition-root.ts; API routes and evaluation tests use them directly.',
      severity: 'error',
      from: {
        path: '^apps/web/src',
        pathNot: '^apps/web/src/(composition-root[.]ts$|adapters/|routes/(api[.]|-)[^/]*[.]ts$)|[.]evaluation[.]test[.]ts$',
      },
      to: { path: '^apps/web/src/adapters/' },
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
