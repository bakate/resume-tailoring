# Production deployments with GitHub Actions

The `Production` workflow checks pull requests targeting `main`. A push to `main` runs
`pnpm check`, builds an ARM64 container, updates the existing `honest-resume-demo` stack,
deploys the Cloudflare Worker, and checks availability and API access protection.
Manual runs are supported on `main` only. Deployment jobs are serialized and are never
cancelled midway by a newer push. Actions are pinned to commit SHAs.

Dependabot checks GitHub Actions versions every Monday and groups available version updates
into one pull request, including repeated references across jobs. Review and merge that PR
after checks pass; updates are not merged automatically. Action releases have independent
version numbers and runtimes, so they cannot share one version variable. `.nvmrc` controls
the application Node version, not the runtime embedded in third-party actions.
This Dependabot group covers action references only, not the Wrangler CLI or Docker base images.

The deployment job installs the pnpm version declared in the root `packageManager` field.
It runs the pinned Wrangler version through `pnpm dlx`, which installs the CLI in an isolated
environment without installing or changing the application workspace dependencies.
The CLI uses the Worker configuration and Cloudflare credentials from environment variables.

## One-time setup

### Local toolchain

`.nvmrc` selects Node.js 24 for local development and both CI jobs. It tracks the major
version rather than pinning a patch release. `package.json` defines the exact pnpm version
in `packageManager`, read by Corepack locally and `pnpm/action-setup` in CI.

With nvm and Corepack installed, run from the repository root:

```sh
nvm install
nvm use
corepack enable
pnpm --version
```

Complete these steps before pushing the workflow to `main`.

### 1. Create the GitHub environment

In [repository environments](https://github.com/bakate/resume-tailoring/settings/environments),
create an environment named exactly `production`. Under **Deployment branches and tags**,
choose **Selected branches and tags** and allow only the branch `main` (not tags).
Leave required reviewers disabled if every successful push should deploy automatically.

The AWS trust policy accepts only this repository's `production` environment. Its branch
restriction is essential: the environment name replaces the branch in the OIDC subject.

This repository uses GitHub's immutable OIDC subject format. The AWS trust policy must match
`repo:bakate@38812007/resume-tailoring@1389399266:environment:production` exactly. A name-only
subject such as `repo:bakate/resume-tailoring:environment:production` will be rejected by AWS.
Verify the prefix with `gh api repos/bakate/resume-tailoring/actions/oidc/customization/sub`.
For another repository, configure `GitHubOidcSubjectPrefix` from its `sub_claim_prefix`.

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

To fix an existing bootstrap stack created with the old name-only subject, obtain this
updated template and rerun `bash scripts/bootstrap-github-actions.sh` while authenticated
to AWS. The new `GitHubOidcSubjectPrefix` parameter uses the immutable prefix above by
default. The role ARN stays unchanged, so no GitHub secret replacement is required. Then
rerun the failed deployment job. Merging a template change alone does not update this
separate bootstrap stack.

### 3. Configure Cloudflare credentials

Find the account ID in the Cloudflare dashboard. Add it to the `production` environment as
the secret `CLOUDFARE_ACCOUNT_ID`.

Create an API token from [Cloudflare API tokens](https://dash.cloudflare.com/profile/api-tokens).
Use the **Edit Cloudflare Workers** template and restrict account resources to the account
hosting `resume-studio`. No zone access is needed for the existing `workers.dev` route.
Add the token as the environment **secret** `CLOUDFARE_API_TOKEN`.

| GitHub environment setting | Kind | Value |
| --- | --- | --- |
| `AWS_DEPLOY_ROLE_ARN` | Variable | ARN printed by the bootstrap command |
| `CLOUDFARE_ACCOUNT_ID` | Secret | Cloudflare account ID |
| `CLOUDFARE_API_TOKEN` | Secret | Token authorized to deploy the Worker |

The workflow also accepts `AWS_DEPLOY_ROLE_ARN` as a secret. The Cloudflare secret names
above match the existing GitHub configuration exactly. The workflow maps them to
`CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`, the environment variables required by Wrangler.

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
