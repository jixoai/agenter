#!/bin/bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=.gemini/scripts/wt-common.sh
source "$SCRIPT_DIR/wt-common.sh"

usage() {
	cat <<'EOF'
Usage: ./.gemini/scripts/wt-setup.sh <topic> [branch] [base-ref] [options]

Create and prepare a named worktree under the repository common root.

Arguments:
  <topic>       worktree folder name under .worktree/
  [branch]      branch name to create or check out (default: feature/<topic>)
  [base-ref]    starting ref when creating a new branch (default: HEAD)

Options:
  --skip-install  skip `bun install`
  --dry-run       print planned commands without mutating Git state
  -h, --help      show this help
EOF
}

TOPIC=""
BRANCH=""
BASE_REF="HEAD"
INSTALL_DEPS=1
WT_DRY_RUN=0

while [ $# -gt 0 ]; do
	case "$1" in
	-h|--help)
		usage
		exit 0
		;;
	--skip-install)
		INSTALL_DEPS=0
		shift
		;;
	--dry-run)
		WT_DRY_RUN=1
		shift
		;;
	*)
		if [ -z "$TOPIC" ]; then
			TOPIC="$1"
		elif [ -z "$BRANCH" ]; then
			BRANCH="$1"
		elif [ "$BASE_REF" = "HEAD" ]; then
			BASE_REF="$1"
		else
			wt::die "Unexpected argument: $1"
		fi
		shift
		;;
	esac
done

wt::require_git_repo
[ -n "$TOPIC" ] || wt::die "Topic is required. Run with --help for usage."

COMMON_ROOT=$(wt::common_root)
WORKTREES_ROOT=$(wt::worktrees_root)
TOPIC_SLUG=$(wt::sanitize_name "$TOPIC")
WORKTREE_PATH="$WORKTREES_ROOT/$TOPIC_SLUG"
[ -n "$BRANCH" ] || BRANCH="feature/$TOPIC_SLUG"

if [ -e "$WORKTREE_PATH" ]; then
	wt::die "Worktree path already exists: $WORKTREE_PATH"
fi

wt::run mkdir -p "$WORKTREES_ROOT"

if git -C "$COMMON_ROOT" show-ref --verify --quiet "refs/heads/$BRANCH"; then
	wt::note "Checking out existing branch $BRANCH in $WORKTREE_PATH"
	wt::run git -C "$COMMON_ROOT" worktree add "$WORKTREE_PATH" "$BRANCH"
else
	wt::note "Creating branch $BRANCH from $BASE_REF in $WORKTREE_PATH"
	wt::run git -C "$COMMON_ROOT" worktree add "$WORKTREE_PATH" -b "$BRANCH" "$BASE_REF"
fi

if [ "$INSTALL_DEPS" -eq 1 ]; then
	wt::note "Preparing dependencies with bun install"
	wt::run bash -lc "cd \"$WORKTREE_PATH\" && bun install"
fi

printf '\n'
printf 'Worktree ready\n'
printf '  Common root : %s\n' "$COMMON_ROOT"
printf '  Worktree    : %s\n' "$WORKTREE_PATH"
printf '  Branch      : %s\n' "$BRANCH"
printf '  Base ref    : %s\n' "$BASE_REF"
