#!/bin/bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=.gemini/scripts/wt-common.sh
source "$SCRIPT_DIR/wt-common.sh"

usage() {
	cat <<'EOF'
Usage: ./.gemini/scripts/wt-land-ff.sh <feature-ref> [options]

Fast-forward the current branch checkout to a verified feature ref while
preserving only the current checkout's dirty paths that do not overlap with the
landed feature diff.

Options:
  --snapshot-ref <ref>  named snapshot ref for the dirty target state
                        (default: snapshot/<target-branch>-pre-land-<utc-timestamp>)
  --backup-dir <path>   directory used to back up dirty paths before cleaning
                        (default: temporary directory under $TMPDIR)
  --report-file <path>  also write the landing report to the given file
  --dry-run             print the planned actions without mutating Git or files
  -h, --help            show this help
EOF
}

FEATURE_REF=""
SNAPSHOT_REF=""
BACKUP_DIR=""
REPORT_FILE=""
WT_DRY_RUN=0

while [ $# -gt 0 ]; do
	case "$1" in
	-h|--help)
		usage
		exit 0
		;;
	--snapshot-ref)
		[ $# -ge 2 ] || wt::die "--snapshot-ref requires a ref"
		SNAPSHOT_REF="$2"
		shift 2
		;;
	--backup-dir)
		[ $# -ge 2 ] || wt::die "--backup-dir requires a path"
		BACKUP_DIR="$2"
		shift 2
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
		if [ -z "$FEATURE_REF" ]; then
			FEATURE_REF="$1"
			shift
		else
			wt::die "Unexpected argument: $1"
		fi
		;;
	esac
done

wt::require_git_repo
[ -n "$FEATURE_REF" ] || wt::die "Feature ref is required. Run with --help for usage."

CURRENT_ROOT=$(wt::current_root)
COMMON_ROOT=$(wt::common_root)
TARGET_BRANCH=$(git -C "$CURRENT_ROOT" branch --show-current || true)
[ -n "$TARGET_BRANCH" ] || wt::die "wt-land-ff.sh must run from a branch-attached target checkout."

FEATURE_HEAD=$(git -C "$COMMON_ROOT" rev-parse "$FEATURE_REF^{commit}" 2>/dev/null) ||
	wt::die "Feature ref does not resolve locally: $FEATURE_REF"
TARGET_HEAD=$(git -C "$CURRENT_ROOT" rev-parse HEAD)

if ! git -C "$COMMON_ROOT" merge-base --is-ancestor "$TARGET_HEAD" "$FEATURE_HEAD"; then
	wt::die "Feature ref $FEATURE_REF is not a fast-forward descendant of $TARGET_BRANCH. Rebase or linearize it first."
fi

DIRTY_TRACKED=()
DIRTY_UNTRACKED=()
DIRTY_DELETED=()

while IFS= read -r -d '' entry; do
	status=${entry:0:2}
	path=${entry:3}
	x=${status:0:1}
	y=${status:1:1}

	case "$status" in
	'??')
		DIRTY_UNTRACKED+=("$path")
		continue
		;;
	'!!')
		continue
		;;
	esac

	if [ "$x" = "R" ] || [ "$y" = "R" ] || [ "$x" = "C" ] || [ "$y" = "C" ]; then
		IFS= read -r -d '' rename_target || true
		wt::die "Dirty rename/copy entries are not supported by wt-land-ff yet: $path -> ${rename_target:-<unknown>}"
	fi

	DIRTY_TRACKED+=("$path")
	case "$x$y" in
	*D*)
		DIRTY_DELETED+=("$path")
		;;
	esac
done < <(git -C "$CURRENT_ROOT" status --porcelain=v1 -z)

has_any_dirty=0
if [ "${#DIRTY_TRACKED[@]}" -gt 0 ] || [ "${#DIRTY_UNTRACKED[@]}" -gt 0 ]; then
	has_any_dirty=1
fi

timestamp_tag=$(date -u +%Y%m%dT%H%M%SZ)
if [ -z "$SNAPSHOT_REF" ] && [ "$has_any_dirty" -eq 1 ]; then
	SNAPSHOT_REF="snapshot/$(wt::sanitize_name "$TARGET_BRANCH")-pre-land-$timestamp_tag"
fi

if [ "$has_any_dirty" -eq 1 ] && [ -z "$BACKUP_DIR" ]; then
	if [ "$WT_DRY_RUN" -eq 1 ]; then
		BACKUP_DIR="${TMPDIR:-/tmp}/wt-land-backup-$(wt::sanitize_name "$TARGET_BRANCH")-$timestamp_tag"
	else
		BACKUP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/wt-land-backup.XXXXXX")
	fi
fi

FEATURE_DIFF_FILE=$(mktemp "${TMPDIR:-/tmp}/wt-land-diff.XXXXXX")
trap 'rm -f "$FEATURE_DIFF_FILE"' EXIT
git -C "$COMMON_ROOT" diff --name-only "$TARGET_HEAD..$FEATURE_HEAD" >"$FEATURE_DIFF_FILE"

path_in_array() {
	local needle="$1"
	shift || true
	local item
	for item in "$@"; do
		if [ "$item" = "$needle" ]; then
			return 0
		fi
	done
	return 1
}

path_overlaps_feature() {
	local target_path="$1"
	local changed_path
	while IFS= read -r changed_path; do
		case "$changed_path" in
		"$target_path"|"$target_path"/*)
			return 0
			;;
		esac
	done <"$FEATURE_DIFF_FILE"
	return 1
}

DIRTY_ALL=()
if [ "${#DIRTY_TRACKED[@]}" -gt 0 ]; then
	DIRTY_ALL+=("${DIRTY_TRACKED[@]}")
fi
if [ "${#DIRTY_UNTRACKED[@]}" -gt 0 ]; then
	DIRTY_ALL+=("${DIRTY_UNTRACKED[@]}")
fi

RESTORE_PATHS=()
SKIPPED_PATHS=()
if [ "${#DIRTY_ALL[@]}" -gt 0 ]; then
	for path in "${DIRTY_ALL[@]}"; do
		if path_overlaps_feature "$path"; then
			SKIPPED_PATHS+=("$path")
		else
			RESTORE_PATHS+=("$path")
		fi
	done
fi

emit_report() {
	local report
	report=$(
		cat <<EOF
Fast-forward landing: ${1:-PASS}
Target checkout: $CURRENT_ROOT
Target branch: $TARGET_BRANCH
Target head (before): $TARGET_HEAD
Feature ref: $FEATURE_REF
Feature head: $FEATURE_HEAD
Dirty snapshot ref: ${SNAPSHOT_REF:-none}
Backup dir: ${BACKUP_DIR:-none}
Dirty tracked paths: ${#DIRTY_TRACKED[@]}
Dirty untracked paths: ${#DIRTY_UNTRACKED[@]}
Restored non-overlap paths: ${#RESTORE_PATHS[@]}
Skipped overlap paths: ${#SKIPPED_PATHS[@]}
EOF
	)

	if [ "${#RESTORE_PATHS[@]}" -gt 0 ]; then
		report="$report
Restored paths:"
		local path
		for path in "${RESTORE_PATHS[@]}"; do
			report="$report
- $path"
		done
	fi

	if [ "${#SKIPPED_PATHS[@]}" -gt 0 ]; then
		report="$report
Skipped overlapping paths:"
		local path
		for path in "${SKIPPED_PATHS[@]}"; do
			report="$report
- $path"
		done
	fi

	printf '%s\n' "$report"
	if [ -n "$REPORT_FILE" ]; then
		printf '%s\n' "$report" >"$REPORT_FILE"
	fi
}

if [ "$WT_DRY_RUN" -eq 1 ]; then
	if [ "$has_any_dirty" -eq 1 ]; then
		wt::note "Would snapshot dirty target state into ${SNAPSHOT_REF:-<none>}"
		wt::note "Would back up dirty paths into $BACKUP_DIR"
	fi
	if [ "$FEATURE_HEAD" = "$TARGET_HEAD" ]; then
		wt::note "Feature ref already matches $TARGET_BRANCH head; no branch fast-forward needed."
	else
		wt::note "Would fast-forward $TARGET_BRANCH from $TARGET_HEAD to $FEATURE_HEAD"
	fi
	emit_report "DRY-RUN"
	exit 0
fi

if [ "$has_any_dirty" -eq 1 ]; then
	mkdir -p "$BACKUP_DIR"
	for path in "${DIRTY_ALL[@]}"; do
		if [ -e "$CURRENT_ROOT/$path" ]; then
			mkdir -p "$BACKUP_DIR/$(dirname "$path")"
			cp -R "$CURRENT_ROOT/$path" "$BACKUP_DIR/$path"
		fi
	done
	if [ "${#DIRTY_DELETED[@]}" -gt 0 ]; then
		printf '%s\n' "${DIRTY_DELETED[@]}" >"$BACKUP_DIR/deleted-paths.txt"
	fi
	"$SCRIPT_DIR/wt-snapshot-dirty.sh" "$SNAPSHOT_REF"

	if [ "${#DIRTY_TRACKED[@]}" -gt 0 ]; then
		git -C "$CURRENT_ROOT" restore --worktree --staged -- "${DIRTY_TRACKED[@]}"
	fi
	if [ "${#DIRTY_UNTRACKED[@]}" -gt 0 ]; then
		local_path=""
		for local_path in "${DIRTY_UNTRACKED[@]}"; do
			rm -rf "$CURRENT_ROOT/$local_path"
		done
	fi
fi

if [ "$FEATURE_HEAD" != "$TARGET_HEAD" ]; then
	git -C "$CURRENT_ROOT" merge --ff-only "$FEATURE_REF"
fi

restore_path=""
if [ "${#RESTORE_PATHS[@]}" -gt 0 ]; then
	for restore_path in "${RESTORE_PATHS[@]}"; do
		if [ "${#DIRTY_DELETED[@]}" -gt 0 ] && path_in_array "$restore_path" "${DIRTY_DELETED[@]}"; then
			rm -rf "$CURRENT_ROOT/$restore_path"
			continue
		fi

		if [ ! -e "$BACKUP_DIR/$restore_path" ]; then
			continue
		fi

		rm -rf "$CURRENT_ROOT/$restore_path"
		mkdir -p "$CURRENT_ROOT/$(dirname "$restore_path")"
		cp -R "$BACKUP_DIR/$restore_path" "$CURRENT_ROOT/$restore_path"
	done
fi

emit_report "PASS"
