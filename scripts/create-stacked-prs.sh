#!/usr/bin/env bash
set -euo pipefail

repo="${REPO:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"
base_ref="${BASE_REF:-test}"
source_ref="${SOURCE_REF:?Set SOURCE_REF to the branch, tag, or ref containing commits to stack.}"
count="${COUNT:-100}"
start_at="${START_AT:-1}"
branch_prefix="${BRANCH_PREFIX:-codex/stack}"
mode="${MODE:-direct}"
draft="${DRAFT:-false}"
validate_each="${VALIDATE_EACH:-true}"
push_branches="${PUSH_BRANCHES:-true}"
create_prs="${CREATE_PRS:-true}"
auto_merge="${AUTO_MERGE:-false}"
wait_for_merge="${WAIT_FOR_MERGE:-false}"
merge_method="${MERGE_METHOD:-squash}"
delete_branch="${DELETE_BRANCH:-true}"
merge_timeout_seconds="${MERGE_TIMEOUT_SECONDS:-3600}"
log_file="${LOG_FILE:-/tmp/taopedia-stacked-prs.log}"

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Working tree has uncommitted changes. Commit or stash them before creating PRs." >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI 'gh' is required." >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub CLI is not authenticated. Run 'gh auth login' first." >&2
  exit 1
fi

git fetch origin "$base_ref" >/dev/null 2>&1 || true
git fetch origin "$source_ref" >/dev/null 2>&1 || true

if [ "$mode" != "direct" ] && [ "$mode" != "stacked" ]; then
  echo "MODE must be 'direct' or 'stacked'." >&2
  exit 1
fi

if [ "$draft" = "true" ] && [ "$auto_merge" = "true" ]; then
  echo "DRAFT=true cannot be combined with AUTO_MERGE=true." >&2
  exit 1
fi

make_branch_name() {
  local number="$1"
  local sha="$2"
  local subject="$3"
  local clean_subject slug

  clean_subject="${subject% (#*)}"
  slug="$(
    printf '%s' "$clean_subject" |
      sed -E 's/^docs\(article\): add //; s/^\[codex\] //; s/Relationship to //Ig; s/context to //Ig; s/article$//Ig; s/[^A-Za-z0-9]+/-/g; s/^-+|-+$//g; s/.*/\L&/' |
      cut -c1-52 |
      sed -E 's/-+$//'
  )"

  printf '%s-%03d-%s-%s' "$branch_prefix" "$number" "$slug" "${sha:0:7}"
}

pr_url_for_head() {
  timeout 45s gh pr view --repo "$repo" --json url --jq .url --head "$1" 2>/dev/null || true
}

create_pr_retry() {
  local base="$1"
  local branch="$2"
  local title="$3"
  local body="$4"
  local draft_flag=()
  local attempt out rc existing

  if [ "$draft" = "true" ]; then
    draft_flag=(--draft)
  fi

  for attempt in 1 2 3 4; do
    set +e
    out="$(timeout 75s gh pr create --repo "$repo" --base "$base" --head "$branch" "${draft_flag[@]}" --title "$title" --body "$body" 2>&1)"
    rc=$?
    set -e

    if [ "$rc" -eq 0 ]; then
      printf '%s' "$out"
      return 0
    fi

    existing="$(pr_url_for_head "$branch")"
    if [ -n "$existing" ]; then
      printf '%s' "$existing"
      return 0
    fi

    printf 'WARN create PR attempt %s failed for %s: %s\n' "$attempt" "$branch" "$out" >&2
    sleep $((attempt * 5))
  done

  return 1
}

enable_auto_merge() {
  local pr_url="$1"
  local delete_flag=()

  if [ "$delete_branch" = "true" ]; then
    delete_flag=(--delete-branch)
  fi

  timeout 75s gh pr merge "$pr_url" --auto "--${merge_method}" "${delete_flag[@]}"
}

wait_until_merged() {
  local pr_url="$1"
  local start now state merged_at

  start="$(date +%s)"
  while true; do
    state="$(gh pr view "$pr_url" --json state --jq .state)"
    merged_at="$(gh pr view "$pr_url" --json mergedAt --jq '.mergedAt // ""')"

    if [ "$state" = "MERGED" ] || [ -n "$merged_at" ]; then
      return 0
    fi

    now="$(date +%s)"
    if [ $((now - start)) -gt "$merge_timeout_seconds" ]; then
      echo "Timed out waiting for $pr_url to merge." >&2
      return 1
    fi

    sleep 30
  done
}

refresh_base_branch() {
  git fetch origin "$base_ref" >/dev/null
  git switch "$base_ref" >/dev/null
  git merge --ff-only "origin/$base_ref" >/dev/null
}

mapfile -t commits < <(git log --reverse --format='%H%x09%s' "${base_ref}..${source_ref}" | sed -n "${start_at},$((start_at + count - 1))p")

if [ "${#commits[@]}" -eq 0 ]; then
  echo "No commits found in ${base_ref}..${source_ref} for start_at=${start_at}, count=${count}." >&2
  exit 1
fi

: >"$log_file"
previous_base="$base_ref"

if [ "$start_at" -gt 1 ]; then
  previous_entry="$(git log --reverse --format='%H%x09%s' "${base_ref}..${source_ref}" | sed -n "$((start_at - 1))p")"
  previous_sha="${previous_entry%%$'\t'*}"
  previous_subject="${previous_entry#*$'\t'}"
  previous_base="$(make_branch_name "$((start_at - 1))" "$previous_sha" "$previous_subject")"
fi

created=0
for entry in "${commits[@]}"; do
  sha="${entry%%$'\t'*}"
  subject="${entry#*$'\t'}"
  number=$((start_at + created))
  clean_subject="${subject% (#*)}"
  branch="$(make_branch_name "$number" "$sha" "$subject")"
  title="[codex] ${clean_subject#docs(article): }"
  pr_base="$base_ref"

  if [ "$mode" = "stacked" ]; then
    pr_base="$previous_base"
  fi

  existing="$(pr_url_for_head "$branch")"
  if [ -n "$existing" ]; then
    printf 'SKIP existing PR %03d %s %s\n' "$number" "$branch" "$existing" | tee -a "$log_file"
    previous_base="$branch"
    created=$((created + 1))
    continue
  fi

  if git show-ref --verify --quiet "refs/heads/$branch"; then
    git switch "$branch" >/dev/null
  else
    if [ "$mode" = "direct" ] && [ "$wait_for_merge" = "true" ]; then
      refresh_base_branch
    fi
    git switch -c "$branch" "$pr_base" >/dev/null
    git cherry-pick "$sha" >/dev/null
  fi

  if [ "$validate_each" = "true" ]; then
    npm run validate >/tmp/taopedia-validate-${number}.log
  fi

  if [ "$push_branches" = "true" ]; then
    git push -u origin "$branch" >/dev/null
  fi

  if [ "$create_prs" = "true" ]; then
    body="$(printf '## What changed\n\nApplies upstream article update `%s`: %s.\n\nThis PR is part of a Taopedia article-import batch.\n\n## Merge plan\n\n- Mode: `%s`\n- Base: `%s`\n- Head: `%s`\n\n## Validation\n\n- `%s`\n' "${sha:0:7}" "$clean_subject" "$mode" "$pr_base" "$branch" "$([ "$validate_each" = "true" ] && printf 'npm run validate' || printf 'Not run by this workflow')")"
    pr_url="$(create_pr_retry "$pr_base" "$branch" "$title" "$body")"
    printf 'CREATED %03d %s %s\n' "$number" "$branch" "$pr_url" | tee -a "$log_file"

    if [ "$auto_merge" = "true" ]; then
      enable_auto_merge "$pr_url"
      printf 'AUTO_MERGE_ENABLED %03d %s %s\n' "$number" "$branch" "$pr_url" | tee -a "$log_file"

      if [ "$wait_for_merge" = "true" ]; then
        wait_until_merged "$pr_url"
        printf 'MERGED %03d %s %s\n' "$number" "$branch" "$pr_url" | tee -a "$log_file"
      fi
    fi
  else
    printf 'CREATED_BRANCH %03d %s\n' "$number" "$branch" | tee -a "$log_file"
  fi

  previous_base="$branch"
  created=$((created + 1))
done

git switch "$base_ref" >/dev/null
printf 'Processed %d stacked PR candidate(s). Log: %s\n' "$created" "$log_file"
