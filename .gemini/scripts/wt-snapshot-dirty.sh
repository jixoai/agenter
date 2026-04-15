#!/bin/bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=.gemini/scripts/wt-common.sh
source "$SCRIPT_DIR/wt-common.sh"

usage() {
	cat <<'EOF'
Usage: ./.gemini/scripts/wt-snapshot-dirty.sh [branch-name] [options]

Materialize the current checkout's dirty state into a named branch without
modifying the working tree. This is intended for dirty merge targets such as
local main before merge verification.

Arguments:
  [branch-name]     destination branch/ref name
                    (default: snapshot/<current-branch>-<utc-timestamp>)

Options:
  --allow-empty     create/update the snapshot branch even when there is no dirty state
  --force-ref       allow overwriting an existing local branch/ref with the snapshot commit
  --dry-run         print planned commands without mutating Git refs
  -h, --help        show this help
EOF
}

SNAPSHOT_REF=""
ALLOW_EMPTY=0
FORCE_REF=0
WT_DRY_RUN=0

while [ $# -gt 0 ]; do
	case "$1" in
	-h|--help)
		usage
		exit 0
		;;
	--allow-empty)
		ALLOW_EMPTY=1
		shift
		;;
	--force-ref)
		FORCE_REF=1
		shift
		;;
	--dry-run)
		WT_DRY_RUN=1
		shift
		;;
	*)
		if [ -z "$SNAPSHOT_REF" ]; then
			SNAPSHOT_REF="$1"
			shift
		else
			wt::die "Unexpected argument: $1"
		fi
		;;
	esac
done

wt::require_git_repo

COMMON_ROOT=$(wt::common_root)
CURRENT_ROOT=$(wt::current_root)
CURRENT_BRANCH=$(git -C "$CURRENT_ROOT" branch --show-current || true)
[ -n "$CURRENT_BRANCH" ] || CURRENT_BRANCH="detached"

if [ -z "$SNAPSHOT_REF" ]; then
	SNAPSHOT_REF="snapshot/$(wt::sanitize_name "$CURRENT_BRANCH")-$(date -u +%Y%m%dT%H%M%SZ)"
fi

if git -C "$COMMON_ROOT" show-ref --verify --quiet "refs/heads/$SNAPSHOT_REF"; then
	if [ "$FORCE_REF" -ne 1 ]; then
		wt::die "Local branch already exists: $SNAPSHOT_REF (re-run with --force-ref to overwrite it)"
	fi
fi

tracked_dirty=$(git -C "$CURRENT_ROOT" status --porcelain --untracked-files=no)
all_dirty=$(git -C "$CURRENT_ROOT" status --porcelain)
if [ -z "$all_dirty" ] && [ "$ALLOW_EMPTY" -ne 1 ]; then
	wt::die "Current checkout is clean. Use --allow-empty if you still want a named snapshot ref."
fi

if [ "$WT_DRY_RUN" -eq 1 ]; then
	wt::note "Would snapshot $CURRENT_ROOT into $SNAPSHOT_REF"
	if [ -n "$tracked_dirty" ]; then
		printf '%s\n' "$tracked_dirty"
	fi
	if [ -n "$all_dirty" ] && [ "$all_dirty" != "$tracked_dirty" ]; then
		printf '%s\n' "$all_dirty"
	fi
	exit 0
fi

TEMP_INDEX=$(mktemp "${TMPDIR:-/tmp}/wt-snapshot-index.XXXXXX")
cleanup_temp_index() {
	rm -f "$TEMP_INDEX"
}
trap cleanup_temp_index EXIT

cp "$(git -C "$CURRENT_ROOT" rev-parse --git-path index)" "$TEMP_INDEX"

export GIT_DIR
GIT_DIR=$(git -C "$CURRENT_ROOT" rev-parse --absolute-git-dir)
export GIT_WORK_TREE="$CURRENT_ROOT"
export GIT_INDEX_FILE="$TEMP_INDEX"

git add -A
SNAPSHOT_TREE=$(git write-tree)
PARENT_COMMIT=$(git -C "$CURRENT_ROOT" rev-parse HEAD)
SNAPSHOT_MESSAGE=$(
	cat <<EOF
snapshot(${CURRENT_BRANCH}): capture dirty worktree

Source worktree: $CURRENT_ROOT
Created at (UTC): $(wt::timestamp_utc)
EOF
)
SNAPSHOT_COMMIT=$(printf '%s\n' "$SNAPSHOT_MESSAGE" | git commit-tree "$SNAPSHOT_TREE" -p "$PARENT_COMMIT")

if [ "$FORCE_REF" -eq 1 ]; then
	git -C "$COMMON_ROOT" update-ref "refs/heads/$SNAPSHOT_REF" "$SNAPSHOT_COMMIT"
else
	git -C "$COMMON_ROOT" update-ref --create-reflog "refs/heads/$SNAPSHOT_REF" "$SNAPSHOT_COMMIT"
fi

printf 'Dirty snapshot created\n'
printf '  Source worktree : %s\n' "$CURRENT_ROOT"
printf '  Branch/ref      : %s\n' "$SNAPSHOT_REF"
printf '  Commit          : %s\n' "$SNAPSHOT_COMMIT"
