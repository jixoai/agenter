#!/bin/bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=.gemini/scripts/wt-common.sh
source "$SCRIPT_DIR/wt-common.sh"

usage() {
	cat <<'EOF'
Usage: ./.gemini/scripts/wt-merge-verify.sh [options]

Verify that the current feature branch rebases onto a named target ref and
merges cleanly inside a disposable verification worktree.

Options:
  --target <ref>     target ref to verify against
                     (default: origin/main when available, otherwise main)
  --no-rebase        skip the rebase step and only run merge simulation
  --keep-temp        keep the disposable verification worktree for inspection
  --report-file <p>  also write the report to the given file
  --dry-run          print planned commands without mutating Git state
  -h, --help         show this help
EOF
}

TARGET_REF=""
DO_REBASE=1
KEEP_TEMP=0
REPORT_FILE=""
WT_DRY_RUN=0

while [ $# -gt 0 ]; do
	case "$1" in
	-h|--help)
		usage
		exit 0
		;;
	--target)
		[ $# -ge 2 ] || wt::die "--target requires a ref"
		TARGET_REF="$2"
		shift 2
		;;
	--no-rebase)
		DO_REBASE=0
		shift
		;;
	--keep-temp)
		KEEP_TEMP=1
		shift
		;;
	--report-file)
		[ $# -ge 2 ] || wt::die "--report-file requires a path"
		REPORT_FILE="$2"
		shift 2
		;;
	--dry-run)
		WT_DRY_RUN=1
		shift
		;;
	*)
		wt::die "Unexpected argument: $1"
		;;
	esac
done

emit_report() {
	local result="$1"
	local failure_stage="${2:-none}"
	local details="${3:-}"
	local report
	report=$(cat <<EOF
Merge verification: $result
Repo root: $COMMON_ROOT
Feature worktree: $CURRENT_ROOT
Feature branch: $BRANCH
Feature head: $FEATURE_HEAD
Target ref: $TARGET_REF
Rebase: $REBASE_STATUS
Merge simulation: $MERGE_STATUS
Failure stage: $failure_stage
Verified at (UTC): $(wt::timestamp_utc)
Policy: dirty working trees are not merge targets; use origin/main or another named ref, and snapshot dirty main changes into a named branch before using them as the target.
EOF
)
	if [ -n "$details" ]; then
		report="$report
Details:
$details"
	fi
	printf '%s\n' "$report"
	if [ -n "$REPORT_FILE" ]; then
		printf '%s\n' "$report" >"$REPORT_FILE"
	fi
}

wt::require_git_repo
COMMON_ROOT=$(wt::common_root)
CURRENT_ROOT=$(wt::current_root)
[ -n "$TARGET_REF" ] || TARGET_REF=$(wt::default_target_ref)
BRANCH=$(git branch --show-current || true)
[ -n "$BRANCH" ] || wt::die "Merge verification must run from a branch-attached worktree."

if [ "$DO_REBASE" -eq 1 ]; then
	wt::require_clean_tracked "$CURRENT_ROOT"
fi

if [ "$TARGET_REF" = "main" ]; then
	MAIN_WORKTREE_PATH=$(wt::worktree_path_for_branch "main" || true)
	if [ -n "${MAIN_WORKTREE_PATH:-}" ] && [ -n "$(wt::tracked_status "$MAIN_WORKTREE_PATH")" ]; then
		wt::die "Local main has unpublished tracked changes at $MAIN_WORKTREE_PATH. Verify against origin/main or a named snapshot branch instead."
	fi
fi

case "$TARGET_REF" in
origin/*)
	wt::run git -C "$COMMON_ROOT" fetch origin "${TARGET_REF#origin/}"
	;;
refs/remotes/origin/*)
	wt::run git -C "$COMMON_ROOT" fetch origin "${TARGET_REF#refs/remotes/origin/}"
	;;
esac

git -C "$COMMON_ROOT" rev-parse --verify "$TARGET_REF^{commit}" >/dev/null 2>&1 ||
	wt::die "Target ref does not resolve locally: $TARGET_REF"

REBASE_STATUS="skipped"
MERGE_STATUS="pending"
FEATURE_HEAD=$(git rev-parse HEAD)
TEMP_PATH=""
cleanup_temp() {
	if [ -z "$TEMP_PATH" ] || [ ! -d "$TEMP_PATH" ] || [ "$KEEP_TEMP" -eq 1 ]; then
		return 0
	fi
	git -C "$COMMON_ROOT" worktree remove --force "$TEMP_PATH" >/dev/null 2>&1 || rm -rf "$TEMP_PATH"
	git -C "$COMMON_ROOT" worktree prune >/dev/null 2>&1 || true
}
trap cleanup_temp EXIT

if [ "$DO_REBASE" -eq 1 ]; then
	if [ "$WT_DRY_RUN" -eq 1 ]; then
		REBASE_STATUS="dry-run"
		wt::run git -C "$CURRENT_ROOT" rebase "$TARGET_REF"
	else
		wt::note "Rebasing $BRANCH onto $TARGET_REF"
		if git -C "$CURRENT_ROOT" rebase "$TARGET_REF"; then
			REBASE_STATUS="clean"
		else
			REBASE_STATUS="conflict"
			FEATURE_HEAD=$(git -C "$CURRENT_ROOT" rev-parse HEAD)
			emit_report "FAIL" "rebase" "Resolve the rebase conflicts in $CURRENT_ROOT, then rerun verification."
			exit 2
		fi
	fi
	FEATURE_HEAD=$(git -C "$CURRENT_ROOT" rev-parse HEAD)
fi

TEMP_PATH="$(wt::worktrees_root)/.merge-verify-$(wt::sanitize_name "$BRANCH")-$$"
wt::run mkdir -p "$(wt::worktrees_root)"
wt::run git -C "$COMMON_ROOT" worktree add --detach "$TEMP_PATH" "$TARGET_REF"

if [ "$WT_DRY_RUN" -eq 1 ]; then
	MERGE_STATUS="dry-run"
	wt::run git -C "$TEMP_PATH" merge --no-commit --no-ff "$BRANCH"
	emit_report "PASS"
	exit 0
fi

wt::note "Simulating merge inside $TEMP_PATH"
merge_output=""
if merge_output=$(git -C "$TEMP_PATH" merge --no-commit --no-ff "$BRANCH" 2>&1); then
	MERGE_STATUS="clean"
	git -C "$TEMP_PATH" merge --abort >/dev/null 2>&1 || git -C "$TEMP_PATH" reset --hard -q HEAD >/dev/null 2>&1
	emit_report "PASS"
	exit 0
fi

MERGE_STATUS="conflict"
git -C "$TEMP_PATH" merge --abort >/dev/null 2>&1 || git -C "$TEMP_PATH" reset --hard -q HEAD >/dev/null 2>&1
emit_report "FAIL" "merge-simulation" "$merge_output"
exit 3
