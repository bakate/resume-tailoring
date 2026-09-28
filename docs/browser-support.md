# Browser support

The Resume Tailoring web application supports the following browser matrix. Mobile browsers are supported when they use the listed engine and meet the same minimum major version.

| Engine family | Desktop variants | Mobile variants | Minimum version |
| --- | --- | --- | --- |
| Chromium | Google Chrome, Chromium, Microsoft Edge | Chrome for Android | 125 |
| Gecko | Firefox | Firefox for Android | 140 |
| WebKit | Safari for macOS | Safari for iOS and iPadOS | 18 |

Source Document PDF import runs entirely in the Candidate's browser. It uses the PDF.js legacy build plus a browser-local `Promise.withResolvers` polyfill installed in both the application and PDF worker contexts. Candidate content is never sent to the server while the PDF is read.

Browsers below this matrix, unknown browser families, and runtimes without Web Workers receive a localized compatibility message with update and pasted-text recovery options. Invalid, encrypted, scanned, and text-empty PDFs remain document failures instead of compatibility failures.

Playwright exercises Chromium, Firefox, and WebKit on desktop, plus representative Chromium Android and WebKit iPhone viewports. The production workflow runs this compatibility suite on every pull request and push to `main`.
