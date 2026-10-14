# AWS Lambda deployment

For automatic updates after a push to `main`, see [GitHub Actions setup](github-actions.md).

The application runs as one public ARM64 AWS Lambda container behind a Cloudflare Worker. The
Worker exposes `resume-studio.bakateba.workers.dev` and forwards requests to the
Lambda Function URL with a shared origin secret. The container includes Chromium for PDF rendering
and AWS Lambda Web Adapter for the Nitro HTTP server.

## Cost and abuse controls

- Production calls DeepSeek (`LANGUAGE_MODEL_PROVIDER=deepseek`). Its API is prepaid: the account balance is the
  hard spend limit, and an exhausted balance answers `402`, which alerts the operator (below). Top up only what the
  daily budget needs.
- Keep the production DeepSeek key for production alone. Local runs, `test:evaluation` and `test:qualification` call
  the real API and must use another key and balance, so they never consume the public demo's budget.
- Configure a Cloudflare Turnstile widget for the `workers.dev` hostname.
- Keep `DEMO_ORIGIN_SECRET` identical in the Worker secret and Lambda environment. Protected API
  routes reject requests made directly to the Lambda Function URL.
- Keep the account Lambda concurrency quota at ten: it is the function's concurrency ceiling. The
  template sets no `ReservedConcurrentExecutions`, because Lambda keeps at least ten unreserved
  executions per account and any reservation would fail the deployment at this quota. If the quota
  is ever raised above twenty, reserve ten for the function instead.
- Do not attach the function to a VPC, NAT Gateway, load balancer, or database.

Turnstile grants a signed, HTTP-only access cookie for 30 minutes. Protected API routes reject
requests without that cookie. This reduces automated abuse but does not replace the enforced
prepaid DeepSeek balance, nor the daily limits below: a renewed cookie would reset any limit keyed on it.

### Daily spending limits

The Worker counts requests in one Durable Object (`DailySpendingLimits`,
`infrastructure/cloudflare-worker/src/daily-spending-limits.js`), keyed by an HMAC of the client
network: the IPv4 address, or the IPv6 /64 one subscriber usually holds. The HMAC key is
`ORIGIN_SECRET`, so rotating it resets every count. Every window resets at 00:00 Europe/Paris,
when the object deletes everything it holds.

| Limit | Per day | Keyed by | Counted on |
| -- | -- | -- | -- |
| Daily Quota | 8 | client network | `POST /api/explainable-job-posting-extraction` |
| Global ceiling | 61 | all clients | the same request |
| Technical ceiling | 530 | client network | every model-backed API route |
| PDF renders | 200 | client network | `POST /api/resume-document` |

Over the Daily Quota, the global ceiling or the technical ceiling, the Worker answers `429` with the
`daily-quota-reached` API Failure, `retryAfterSeconds` until the reset, and `x-resume-quota-scope`
(`daily-quota`, `overall` or `model-requests`), so the Candidate comes back after the reset. Over
the PDF render limit, it answers the `rate-limited` API Failure instead. Neither reaches the Lambda. A request the application refuses before any model
call (`400`, `401`, `403` or `413`), such as a demo access renewal, gives back what it counted. A
provider failure keeps it counted, so a loop of failing model calls still reaches the technical
ceiling. Responses to a Job Posting extraction carry `x-resume-quota-remaining` (Tailored Resumes
this client can still start today, bounded by the global ceiling; `0` whenever a limit refuses it)
and `x-resume-quota-reset` (the ISO 8601 reset instant). `GET /api/daily-quota`, answered by the
Worker itself, returns the same two values without counting anything, so the interface shows them
before the Candidate starts a preparation.

Every model-backed request is signed with `DEEPSEEK_API_KEY`. Eight journeys with edits stay under 500
model-backed requests, so the technical ceiling only stops loops. The Worker strips the
`x-candidate-api-key` header an earlier version of the interface sent; it lifts no limit.

### Alarms

`template.yaml` defines four CloudWatch alarms on the function: more than 1,000 invocations in an
hour, five or more errors in 15 minutes, any throttle at the account concurrency ceiling, and any
request the Language Model Provider refused for exhausted operator credit (OpenAI `insufficient_quota`,
DeepSeek `402`), counted by a metric filter on the `operator-alert` log line. They notify
the `honest-resume-demo-abuse-alarms` SNS topic. Pass `AlarmEmail=you@example.com` once in
`--parameter-overrides` to subscribe an address, then confirm the email AWS sends; later deployments
keep the value.

The GitHub deploy role needs CloudWatch and SNS permissions for these
resources. Update the `infrastructure/github-actions.yaml` stack before deploying a template that
adds them.

### Deadline chain

Each layer outlasts the one it waits for, so a slow model call ends as a Failure Cause the Candidate
can act on, never as a cut connection:

| Layer | Deadline | Where |
| --- | --- | --- |
| Provider call, per operation, conformance retry included | 90 s; 110 s for match evidence on DeepSeek (p95 82 s in BAK-171) | `language-model-configuration.ts` |
| Lambda | 120 s | `template.yaml` `Timeout` |
| Cloudflare Worker | none of its own; Workers document no limit on a subrequest while the client stays connected | `infrastructure/cloudflare-worker/src/worker.js` |
| Browser | none on model requests | `adapters/browser/server-language-model-gateway.ts` |

`deployment-environment.test.ts` checks that every operation deadline of every configuration ends at
least 5 s before the Lambda timeout. A conformance retry is sent only if the time left can hold
another attempt as long as the first.

The PDF renderer was sized against a 100 s Cloudflare proxy limit. Cloudflare documents that limit
(error 524) for proxied origins, not for a Worker's `fetch` to the Lambda Function URL, but it has not
been measured on this deployment. Right after switching to DeepSeek (BAK-168), confirm on the deployed Worker that a
match evidence request answered after 100 s still reaches the browser; otherwise lower its deadline below 100 s.

### Preparation phase timings

Every preparation is timed phase by phase on real traffic (BAK-182). The browser sends one privacy-safe
`preparation-phase-timed` event per completed phase to `/api/analytics`: intake, Job Posting extraction, Match
Evidence, Resume Sections, coherence, Overflow Reduction (with the renders it used), then the time from the start of
the preparation to its first downloadable PDF. Each carries its duration and a random preparation identifier, generated
when the preparation starts and linked to nothing else. A failed phase is not timed. When coherence sends sections back
for rewriting, Resume Sections and coherence are timed again. The server adds the DeepSeek pricing window the event
arrived in (`peak`: 01:00–04:00 and 06:00–10:00 UTC on weekdays, otherwise `off-peak`) and writes it to the function's
log group, kept seven days.

Run this in CloudWatch Logs Insights on `/aws/lambda/honest-resume-demo`, over the last seven days:

```text
fields @timestamp
| filter @message like /"metric":"preparation-phase-timed"/
| parse @message /"phase":"(?<phase>[^"]+)"/
| parse @message /"durationMilliseconds":(?<durationMilliseconds>\d+)/
| parse @message /"renderCount":(?<renderCount>\d+)/
| parse @message /"deepSeekWindow":"(?<deepSeekWindow>[^"]+)"/
| stats count(*) as samples, pct(durationMilliseconds, 50) as p50, pct(durationMilliseconds, 95) as p95,
  pct(renderCount, 50) as renders_p50 by phase, deepSeekWindow
| sort phase, deepSeekWindow
```

Durations are in milliseconds. To follow one slow preparation, filter on its `preparationId`.

The baseline the BAK-181 changes are measured against is the first production result of this query, recorded here
once a week of traffic has been timed:

| Phase | Window | Samples | p50 | p95 |
| --- | --- | ---: | ---: | ---: |
| _Pending the first production week after BAK-182 ships._ | | | | |

## Security headers

The application sets its own `Content-Security-Policy`, `Referrer-Policy`, `X-Content-Type-Options`,
`Permissions-Policy` and `Strict-Transport-Security` on every response, from the request middleware in `apps/web/src/start.ts`; the Worker passes them
through unchanged. Inline scripts run only with the per-request nonce, and `connect-src` keeps every request on our
origin. A new third-party host, such as a CDN or an analytics script, must be added to
`apps/web/src/security-headers/page-security-headers.ts` or the browser will block it. The end-to-end suite fails on
any `securitypolicyviolation`.

## Prerequisites

- Docker
- AWS CLI authenticated to the target account
- A DeepSeek API key used by production alone
- A Cloudflare Turnstile site key and secret key

## Build

```sh
sam build --use-container
```

## First deployment

```sh
aws ecr create-repository \
  --region eu-west-3 \
  --repository-name honest-resume-demo

aws ecr get-login-password --region eu-west-3 \
  | docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.eu-west-3.amazonaws.com

docker tag honest-resume-demo:local \
  ACCOUNT_ID.dkr.ecr.eu-west-3.amazonaws.com/honest-resume-demo:latest

docker push \
  ACCOUNT_ID.dkr.ecr.eu-west-3.amazonaws.com/honest-resume-demo:latest

aws cloudformation deploy \
  --region eu-west-3 \
  --stack-name honest-resume-demo \
  --template-file template.yaml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    ApplicationName=honest-resume-demo \
    ContainerImageUri=ACCOUNT_ID.dkr.ecr.eu-west-3.amazonaws.com/honest-resume-demo:latest \
    DemoSessionSecret=... \
    DemoOriginSecret=... \
    DemoPublicHostname=resume-studio.bakateba.workers.dev \
    DeepSeekApiKey=... \
    TurnstileSecretKey=... \
    TurnstileSiteKey=...
```

Use `eu-west-3` and pass secrets through environment variables or a secure interactive shell.
Never add them to shell history, the template, or Git. CloudFormation marks secret parameters with
`NoEcho`.

The stack output named `DemoUrl` contains the origin URL and must not be shared. Deploy the Worker
from `infrastructure/cloudflare-worker`, configure its `ORIGIN_SECRET` with `wrangler secret put`,
and share its `workers.dev` URL. Add that hostname to the Turnstile widget before sharing it.

## Local container check

```sh
docker build --platform linux/arm64 --tag honest-resume-demo .
docker run --rm --publish 8080:8080 \
  --env DEMO_ACCESS_MODE=disabled \
  --env LANGUAGE_MODEL_PROVIDER=deepseek \
  --env DEEPSEEK_API_KEY=test-only \
  honest-resume-demo
```

Open `http://localhost:8080`. This check validates the container and Chromium packaging without
calling DeepSeek.

## Switching the stack to DeepSeek (once, BAK-168)

The stack replaces its `OpenAiApiKey` parameter with `DeepSeekApiKey`. The deployment workflow passes only the
image and keeps every other parameter's previous value, and `DeepSeekApiKey` has none yet, so its first run after the
merge fails at "Update the application stack" and leaves production untouched on OpenAI. Then:

1. Copy the image URI the failed run pushed (its "Build and push the Lambda image" step logs the digest: `…/honest-resume-demo@sha256:…`).
2. Update the stack with it and the DeepSeek key, from `main`:

   ```sh
   aws cloudformation deploy \
     --region eu-west-3 \
     --stack-name honest-resume-demo \
     --template-file template.yaml \
     --capabilities CAPABILITY_IAM \
     --parameter-overrides \
       ContainerImageUri=IMAGE_URI \
       DeepSeekApiKey=...
   ```

3. Re-run the failed workflow. The stack keeps the key, and the run deploys the Worker with its new global ceiling.
4. Check that the landing names DeepSeek and China, then the 100 s check under "Deadline chain".

Every later run keeps the key. Revoke the production OpenAI key once DeepSeek serves Candidates.
