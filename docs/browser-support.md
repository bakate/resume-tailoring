# Browser support

The Resume Tailoring web application supports the following browser matrix. Mobile browsers are supported when they use the listed engine and meet the same minimum major version.

| Engine family | Desktop variants | Mobile variants | Minimum version |
| --- | --- | --- | --- |
| Chromium | Google Chrome, Chromium, Microsoft Edge | Chrome for Android | 125 |
| Gecko | Firefox | Firefox for Android | 140 |
| WebKit | Safari for macOS | Safari for iOS and iPadOS | 18 |

Source Document PDF import runs entirely in the Candidate's browser. It uses the PDF.js legacy build plus a browser-local `Promise.withResolvers` polyfill installed in both the application and PDF worker contexts. Candidate content is never sent to the server while the PDF is read.

Browsers below this matrix, unknown browser families, and runtimes without Web Workers receive a localized compatibility message with update and pasted-text recovery options. Invalid, encrypted, scanned, and text-empty PDFs remain document failures with category-specific recovery guidance instead of compatibility failures.

Playwright keeps the complete product E2E suite on Chromium. Focused PDF import journeys run separately on Chromium, Firefox, and WebKit desktop, plus representative Chromium Android, Firefox Android, and WebKit iPhone viewports. The production workflow runs the Chromium smoke test on every pull request and push to `main`; the complete compatibility coverage runs weekly and on manual request. The build targets are derived from the same executable policy as runtime detection, and a compatibility contract test fails when the audited PDF.js version changes so that dependency upgrades cannot silently raise these minimums.
