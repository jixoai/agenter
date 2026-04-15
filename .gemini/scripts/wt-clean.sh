#!/bin/bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=.gemini/scripts/wt-common.sh
source "$SCRIPT_DIR/wt-common.sh"

usage() {
	cat <<'EOF'
Usage: ./.gemini/scripts/wt-clean.sh <topic-or-path> [options]

Remove a named worktree safely and optionally delete its branch.

Options:
  --delete-branch   delete the worktree branch after removal
  --target <ref>    ref that must already contain the branch before deletion
                    (default: origin/main when available, otherwise main)
  --force-dirty     allow removing a dirty worktree
  --force-branch    allow deleting a branch that is not merged into the target ref
  --dry-run         print planned commands without mutating Git state
  -h, --help        show this help
EOF
}

TARGET_INPUT=""
TARGET_REF=""
DELETE_BRANCH=0
FORCE_DIRTY=0
FORCE_BRANCH=0
WT_DRY_RUN=0

while [ $# -gt 0 ]; do
	case "$1" in
	-h|--help)
		usage
		exit 0
		;;
	--delete-branch)
		DELETE_BRANCH=1
		shift
		;;
	--target)
		[ $# -ge 2 ] || wt::die "--target requires a ref"
		TARGET_REF="$2"
		shift 2
		;;
	--force-dirty)
		FORCE_DIRTY=1
		shift
		;;
	--force-branch)
		FORCE_BRANCH=1
		shift
		;;
	--dry-run)
		WT_DRY_RUN=1
		shift
		;;
	*)
		if [ -z "$TARGET_INPUT" ]; then
			TARGET_INPUT="$1"
			shift
		else
			wt::die "Unexpected argument: $1"
		fi
		;;
	esac
done

wt::require_git_repo
[ -n "$TARGET_INPUT" ] || wt::die "Worktree topic or path is required. Run with --help for usage."

COMMON_ROOT=$(wt::common_root)
WORKTREE_PATH=$(wt::resolve_worktree_path "$TARGET_INPUT")
[ -d "$WORKTREE_PATH" ] || wt::die "Worktree not found: $WORKTREE_PATH"

BRANCH=$(git -C "$WORKTREE_PATH" branch --show-current || true)
[ -n "$TARGET_REF" ] || TARGET_REF=$(wt::default_target_ref)

if [ "$FORCE_DIRTY" -ne 1 ]; then
	wt::require_clean_all "$WORKTREE_PATH"
fi

if [ "$DELETE_BRANCH" -eq 1 ] && [ -n "$BRANCH" ] && [ "$FORCE_BRANCH" -ne 1 ]; then
	git -C "$COMMON_ROOT" rev-parse --verify "$TARGET_REF^{commit}" >/dev/null 2>&1 ||
		wt::die "Target ref does not resolve locally: $TARGET_REF"

	if ! git -C "$COMMON_ROOT" merge-base --is-ancestor "$BRANCH" "$TARGET_REF"; then
		wt::die "Branch $BRANCH is not merged into $TARGET_REF. Re-run with --force-branch only if deletion is intentional."
	fi
fi

cd "$COMMON_ROOT"

if [ "$FORCE_DIRTY" -eq 1 ]; then
	wt::run git -C "$COMMON_ROOT" worktree remove --force "$WORKTREE_PATH"
else
	wt::run git -C "$COMMON_ROOT" worktree remove "$WORKTREE_PATH"
fi
wt::run git -C "$COMMON_ROOT" worktree prune

if [ "$DELETE_BRANCH" -eq 1 ] && [ -n "$BRANCH" ]; then
	if [ "$FORCE_BRANCH" -eq 1 ]; then
		wt::run git -C "$COMMON_ROOT" branch -D "$BRANCH"
	else
		wt::run git -C "$COMMON_ROOT" branch -d "$BRANCH"
	fi
fi

printf '\n'
printf 'Worktree cleaned\n'
printf '  Worktree : %s\n' "$WORKTREE_PATH"
if [ -n "$BRANCH" ]; then
	printf '  Branch   : %s\n' "$BRANCH"
fi
