#!/usr/bin/env bash
set -euo pipefail

# Run from the repository root with an authenticated AWS administrator session.
export AWS_REGION=eu-west-3
export AWS_PAGER=''
bootstrap_stack=$(aws cloudformation list-stacks \
  --query "StackSummaries[?StackName=='resume-studio-github-actions' && StackStatus!='DELETE_COMPLETE'].StackId | [0]" \
  --output text)
deploy_arguments=(
  --stack-name resume-studio-github-actions
  --template-file infrastructure/github-actions.yaml
  --capabilities CAPABILITY_IAM
  --no-fail-on-empty-changeset
)
if [[ "$bootstrap_stack" == None ]]; then
  account_id=$(aws sts get-caller-identity --query Account --output text)
  provider_arn="arn:aws:iam::${account_id}:oidc-provider/token.actions.githubusercontent.com"
  existing_provider=$(aws iam list-open-id-connect-providers \
    --query "OpenIDConnectProviderList[?Arn=='${provider_arn}'].Arn | [0]" --output text)
  if [[ "$existing_provider" == None ]]; then
    existing_provider=''
  fi
  deploy_arguments+=(--parameter-overrides "ExistingOidcProviderArn=$existing_provider")
fi

aws cloudformation deploy "${deploy_arguments[@]}"

# shellcheck disable=SC2016
aws cloudformation describe-stacks --stack-name resume-studio-github-actions \
  --query 'Stacks[0].Outputs[?OutputKey==`DeployRoleArn`].OutputValue | [0]' --output text
