# Production deployments with GitHub Actions

The `Production` workflow checks pull requests targeting `main`. A push to `main` runs
`pnpm check`, builds an ARM64 container, updates the existing `honest-resume-demo` stack,
deploys the Cloudflare Worker, and checks availability and API access protection.
Manual runs are supported on `main` only. Deployment jobs are serialized and are never
cancelled midway by a newer push. Actions are pinned to commit SHAs.

## One-time setup

Complete these steps before pushing the workflow to `main`.

### 1. Create the GitHub environment

In [repository environments](https://github.com/bakate/resume-tailoring/settings/environments),
create an environment named exactly `production`. Under **Deployment branches and tags**,
choose **Selected branches and tags** and allow only the branch `main` (not tags).
Leave required reviewers disabled if every successful push should deploy automatically.

The AWS trust policy accepts only this repository's `production` environment. Its branch
restriction is essential: the environment name replaces the branch in the OIDC subject.

### 2. Bootstrap AWS access

From the repository root:

```sh
aws login
bash scripts/bootstrap-github-actions.sh
```

The script creates a separate `resume-studio-github-actions` CloudFormation stack containing
the deployment role and, if necessary, the GitHub OIDC provider. It does not deploy the app.
It reuses an existing GitHub provider, which must include `sts.amazonaws.com` as an audience.
The final output is the deployment role ARN. Add it as the GitHub environment variable
`AWS_DEPLOY_ROLE_ARN` in `production`.

No permanent AWS access keys are stored in GitHub. Permissions are limited to the existing
application stack, ECR repository, Lambda function, execution role, and log group. This role
supports normal application/configuration updates, not arbitrary infrastructure creation
or execution-role policy changes. Extend its permissions deliberately for future resources.

The existing stack must use its original SAM-generated execution role name and no separate
CloudFormation service role. Verify these assumptions if the stack was changed manually.

The script can be rerun: it preserves the existing bootstrap stack's parameters so OIDC
provider ownership stays unchanged.

### 3. Configure Cloudflare credentials

Find the account ID in the Cloudflare dashboard. Add it to the `production` environment as
the variable `CLOUDFLARE_ACCOUNT_ID`.

Create an API token from [Cloudflare API tokens](https://dash.cloudflare.com/profile/api-tokens).
Use the **Edit Cloudflare Workers** template and restrict account resources to the account
hosting `resume-studio`. No zone access is needed for the existing `workers.dev` route.
Add the token as the environment **secret** `CLOUDFLARE_API_TOKEN`.

| GitHub environment setting | Kind | Value |
| --- | --- | --- |
| `AWS_DEPLOY_ROLE_ARN` | Variable | ARN printed by the bootstrap command |
| `CLOUDFLARE_ACCOUNT_ID` | Variable | Cloudflare account ID |
| `CLOUDFLARE_API_TOKEN` | Secret | Token authorized to deploy the Worker |

For compatibility with the initial GitHub configuration, the workflow also accepts
`AWS_DEPLOY_ROLE_ARN` and `CLOUDFLARE_ACCOUNT_ID` as secrets, and the existing misspelled
secret names `CLOUDFARE_ACCOUNT_ID` and `CLOUDFARE_API_TOKEN`. Prefer the names above for
new configuration; no token needs to be exposed or recreated to use the existing setup.

The application already has its OpenAI, Turnstile, session, and origin secrets configured.
The workflow overrides only `ContainerImageUri`; CloudFormation retains all other existing
parameter values. Wrangler retains the existing `ORIGIN_SECRET` Worker secret. Do not add
these application secrets to GitHub or replace them during this setup.

### 4. Push and follow the first run

Commit the workflow and related files, then push `main`:

```sh
git push origin main
```

Follow [GitHub Actions](https://github.com/bakate/resume-tailoring/actions). Both `check` and
`deploy` must succeed. The public URL remains <https://resume-studio.bakateba.workers.dev>.
The first real run verifies AWS permissions and container deployment; local checks cannot
prove those integrations.

## Everyday workflow

Open a pull request to run checks before merging. A successful push or merge to `main`
deploys automatically. Changes to the Worker are deployed by the same workflow.
Optionally require the `check` status in the repository's `main` ruleset.

Each image has a unique commit/run tag, and CloudFormation deploys its immutable digest.
The smoke check fetches the HTML page, verifies that anonymous API requests return the
session-required error, and verifies that direct-origin API requests are rejected. Its
empty request body cannot trigger a valid OpenAI generation even if a guard regresses.
It does not test a complete Turnstile challenge, PDF rendering, or model output.

## Failures and rollback

- Failed checks prevent deployment. Inspect the failed job before retrying.
- A failed CloudFormation update normally rolls back within AWS. A failed Worker deployment
  or smoke check does not automatically revert a successful AWS update; inspect the current
  production state before retrying.
- To roll back application and Worker code together, revert the problematic commit and push
  the revert to `main`. This builds and deploys a fresh image from the reverted source.
- The workflow does not prune ECR images. Storage grows with releases; old images can be
  cleaned up separately while retaining the deployed image and rollback candidates.

## References

- [GitHub OIDC with AWS](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws)
- [Cloudflare deployment with GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)
- [CloudFormation deploy parameter retention](https://docs.aws.amazon.com/cli/latest/reference/cloudformation/deploy.html)
