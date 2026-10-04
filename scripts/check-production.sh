#!/usr/bin/env bash
set -euo pipefail

public_url="${1:?Provide the public Worker URL}"
origin_url="${2:?Provide the Lambda origin URL}"
response_file=$(mktemp)
trap 'rm -f "$response_file"' EXIT

curl --fail --silent --show-error --retry 4 --retry-delay 5 --max-time 90 \
  "${public_url%/}/" --output "$response_file"
grep -qi '<!doctype html' "$response_file"

check_protection() {
  local target_url="$1" expected_status="$2" expected_error="$3" actual_status
  actual_status=$(curl --silent --show-error --max-time 90 \
    --request POST --header 'Content-Type: application/json' \
    --header 'Sec-Fetch-Site: same-origin' \
    --header "Origin: ${public_url%/}" --data '{}' \
    --output "$response_file" --write-out '%{http_code}' \
    "${target_url%/}/api/explainable-match-evidence")
  if [[ "$actual_status" != "$expected_status" ]]; then
    printf 'Access protection failed: expected HTTP %s, received %s\n' "$expected_status" "$actual_status" >&2
    return 1
  fi
  jq --exit-status --arg expected "$expected_error" '.error.type == $expected' "$response_file" > /dev/null
}

check_protection "$public_url" 401 demo-access-required
check_protection "$origin_url" 403 demo-origin-required
printf 'Production is available; public and direct-origin API guards are active.\n'
