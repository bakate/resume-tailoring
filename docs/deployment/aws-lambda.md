# AWS Lambda deployment

For automatic updates after a push to `main`, see [GitHub Actions setup](github-actions.md).

The application runs as one public ARM64 AWS Lambda container behind a Cloudflare Worker. The
Worker exposes `resume-studio.bakateba.workers.dev` and forwards requests to the
Lambda Function URL with a shared origin secret. The container includes Chromium for PDF rendering
and AWS Lambda Web Adapter for the Nitro HTTP server.

## Cost and abuse controls

- Set a hard spend limit on a dedicated OpenAI project before using its API key.
- Keep production and development in separate OpenAI projects, each with its own API key and spend limit.
  Local runs, `test:evaluation` and `test:qualification` call the real API and must use the development
  project, so they never consume the public demo's budget.
- Disable automatic OpenAI credit recharge.
- Restrict the OpenAI project to the configured structured and writing models.
- Configure a Cloudflare Turnstile widget for the `workers.dev` hostname.
- Keep `DEMO_ORIGIN_SECRET` identical in the Worker secret and Lambda environment. Protected API
  routes reject requests made directly to the Lambda Function URL.
- Set a monthly budget alert on the production OpenAI project, below its hard limit, so a spending
  drift is noticed before the limit stops the demo.
- Keep the account Lambda concurrency quota at ten: it is the function's concurrency ceiling. The
  template sets no `ReservedConcurrentExecutions`, because Lambda keeps at least ten unreserved
  executions per account and any reservation would fail the deployment at this quota. If the quota
  is ever raised above twenty, reserve ten for the function instead.
- Do not attach the function to a VPC, NAT Gateway, load balancer, or database.

Turnstile grants a signed, HTTP-only access cookie for 30 minutes. Protected API routes reject
requests without that cookie. This reduces automated abuse but does not replace the enforced
OpenAI spend limit, nor the daily limits below: a renewed cookie would reset any limit keyed on it.

### Daily spending limits

The Worker counts requests in one Durable Object (`DailySpendingLimits`,
`infrastructure/cloudflare-worker/src/daily-spending-limits.js`), keyed by an HMAC of the client
network: the IPv4 address, or the IPv6 /64 one subscriber usually holds. The HMAC key is
`ORIGIN_SECRET`, so rotating it resets every count. Every window resets at 00:00 Europe/Paris,
when the object deletes everything it holds.

| Limit | Per day | Keyed by | Counted on |
| -- | -- | -- | -- |
| Daily Quota | 4 | client network | `POST /api/explainable-job-posting-extraction` |
| Global ceiling | 30 | all clients | the same request |
| Technical ceiling | 400 | client network | every model-backed API route |
| PDF renders | 200 | client network | `POST /api/resume-document` |

Over a limit, the Worker answers `429` with the `rate-limited` API Failure and `retryAfterSeconds`
until the reset, without reaching the Lambda. A request the application refuses before any model
call (`400`, `401`, `403` or `413`), such as a demo access renewal, gives back what it counted. A
provider failure keeps it counted, so a loop of failing model calls still reaches the technical
ceiling. Responses to a Job Posting extraction carry `x-resume-quota-remaining` (Tailored Resumes
this client can still start today, bounded by the global ceiling; `0` whenever a limit refuses it)
and `x-resume-quota-reset` (the ISO 8601 reset instant).

### Alarms

`template.yaml` defines three CloudWatch alarms on the function: more than 1,000 invocations in an
hour, five or more errors in 15 minutes, and any throttle at the account concurrency ceiling. They notify
the `honest-resume-demo-abuse-alarms` SNS topic. Pass `AlarmEmail=you@example.com` once in
`--parameter-overrides` to subscribe an address, then confirm the email AWS sends; later deployments
keep the value.

The GitHub deploy role needs CloudWatch and SNS permissions for these
resources. Update the `infrastructure/github-actions.yaml` stack before deploying a template that
adds them.

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
- A dedicated OpenAI project API key
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
    OpenAiApiKey=... \
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
  --env OPENAI_API_KEY=test-only \
  honest-resume-demo
```

Open `http://localhost:8080`. This check validates the container and Chromium packaging without
calling OpenAI.
