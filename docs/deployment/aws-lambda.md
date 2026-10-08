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
- Keep the regional Lambda account quota low. New accounts commonly start at ten concurrent
  executions, which already caps this single-function demo.
- Do not attach the function to a VPC, NAT Gateway, load balancer, or database.

Turnstile grants a signed, HTTP-only access cookie for 30 minutes. Protected API routes reject
requests without that cookie. This reduces automated abuse but does not replace the enforced
OpenAI spend limit.

## Security headers

The application sets its own `Content-Security-Policy`, `Referrer-Policy`, `X-Content-Type-Options` and
`Permissions-Policy` on every response, from the request middleware in `apps/web/src/start.ts`; the Worker passes them
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
