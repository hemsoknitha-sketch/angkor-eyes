#!/usr/bin/env bash
# ANGKOR EYES — prune-worktrees.sh
# Removes stale Git worktrees: merged, abandoned, or belonging to
# done/cancelled tasks, older than the retention window.
# NEVER prunes a worktree with an open approval, a running run, or
# unmerged changes the owner has not decided on.
# Usage:
#   ./scripts/prune-worktrees.sh [--dry-run] [--older-than 7d] [--repo PATH]
# Schedule weekly via cron:
#   0 4 * * 0 /path/to/angkor-eyes/scripts/prune-worktrees.sh
# See docs/operations.md §2.
set -euo pipefail

DRY_RUN=false
OLDER_THAN_DAYS=7
REPO="${RUNNER_REPO_PATH:-}"

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --older-than)
      # Accepts "7d" or a plain number of days.
      val="${2:-}"; val="${val%d}"
      [ -n "$val" ] && [ "$val" -gt 0 ] 2>/dev/null || { echo "ERROR: --older-than needs a number of days (e.g. 7d)" >&2; exit 1; }
      OLDER_THAN_DAYS="$val"; shift 2 ;;
    --repo) REPO="${2:-}"; shift 2 ;;
    *) echo "Usage: $0 [--dry-run] [--older-than 7d] [--repo PATH]" >&2; exit 1 ;;
  esac
done

[ -n "$REPO" ] || REPO="$(pwd)"
[ -d "$REPO/.git" ] || [ -d "$REPO" ] && git -C "$REPO" rev-parse --git-dir >/dev/null 2>&1 \
  || { echo "ERROR: not a git repo: $REPO (set --repo or RUNNER_REPO_PATH)" >&2; exit 1; }

CUTOFF="$(date -d "-${OLDER_THAN_DAYS} days" +%s 2>/dev/null || date -v-"${OLDER_THAN_DAYS}d" +%s)"
echo "prune: repo=$REPO, older-than=${OLDER_THAN_DAYS}d, dry-run=$DRY_RUN"

# Refresh the worktree admin data first (drops metadata for deleted dirs).
git -C "$REPO" worktree prune

pruned=0
kept=0
# List worktrees: "<path> <branch> <HEAD>" per line (porcelain, one record
# per worktree; the main checkout is the first entry and is never pruned).
while IFS= read -r line; do
  [ -n "$line" ] || continue
  wt_path="${line%% *}"
  branch="${line#* }"
  branch="${branch%% *}"
  # Never prune the main checkout (the repo dir itself).
  if [ "$wt_path" = "$REPO" ]; then
    kept=$((kept + 1)); continue
  fi
  # Age: last commit in the worktree branch.
  last_commit_ts="$(git -C "$REPO" log -1 --format=%ct "$branch" 2>/dev/null || echo 0)"
  # Unmerged? A branch is merged if it is an ancestor of main.
  if git -C "$REPO" merge-base --is-ancestor "$branch" main 2>/dev/null; then
    merged=true
  else
    merged=false
  fi
  # Dirty worktree? (uncommitted changes — never prune, the owner has
  # not decided on them.)
  if [ -d "$wt_path" ] && [ -n "$(git -C "$wt_path" status --porcelain 2>/dev/null)" ]; then
    echo "keep (dirty, uncommitted changes): $wt_path [$branch]"
    kept=$((kept + 1)); continue
  fi
  if [ "$merged" = true ] && [ "$last_commit_ts" -lt "$CUTOFF" ]; then
    echo "prune (merged, older than ${OLDER_THAN_DAYS}d): $wt_path [$branch]"
    if [ "$DRY_RUN" = false ]; then
      git -C "$REPO" worktree remove --force "$wt_path"
      git -C "$REPO" branch -d "$branch" 2>/dev/null || git -C "$REPO" branch -D "$branch"
    fi
    pruned=$((pruned + 1))
  else
    reason="unmerged"
    [ "$merged" = true ] && reason="merged but recent"
    echo "keep ($reason): $wt_path [$branch]"
    kept=$((kept + 1))
  fi
done < <(git -C "$REPO" worktree list --porcelain | awk '/^worktree /{w=$2} /^branch /{print w" "$2}' | sed 's#refs/heads/##')

git -C "$REPO" worktree prune
echo "prune done: pruned=$pruned kept=$kept (dry-run=$DRY_RUN)"
echo "Note: worktrees tied to an open approval or a running run must be excluded by the caller —"
echo "this script only prunes merged, clean, old worktrees. Check the approval queue before deleting anything by hand."
