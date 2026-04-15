#!/bin/bash
set -euo pipefail

wt::die() {
	printf '❌ %s\n' "$*" >&2
	exit 1
}

wt::warn() {
	printf '⚠️ %s\n' "$*" >&2
}

wt::note() {
	printf '• %s\n' "$*"
}

wt::require_git_repo() {
	git rev-parse --is-inside-work-tree >/dev/null 2>&1 || wt::die "Run this command inside the repository or one of its worktrees."
}

wt::common_dir() {
	git rev-parse --path-format=absolute --git-common-dir
}

wt::common_root() {
	dirname "$(wt::common_dir)"
}

wt::current_root() {
	git rev-parse --path-format=absolute --show-toplevel
}

wt::worktrees_root() {
	printf '%s/.worktree\n' "$(wt::common_root)"
}

wt::sanitize_name() {
	printf '%s' "$1" | tr '[:space:]' '-' | tr -cs '[:alnum:]._-' '-'
}

wt::timestamp_utc() {
	date -u +"%Y-%m-%dT%H:%M:%SZ"
}

wt::quote_cmd() {
	local arg
	for arg in "$@"; do
		printf '%q ' "$arg"
	done
	printf '\n'
}

wt::run() {
	if [ "${WT_DRY_RUN:-0}" -eq 1 ]; then
		printf '[dry-run] '
		wt::quote_cmd "$@"
		return 0
	fi
	"$@"
}

wt::resolve_worktree_path() {
	local input="$1"
	if [ -z "$input" ]; then
		wt::die "Worktree topic or path is required."
	fi

	case "$input" in
	/*)
		printf '%s\n' "$input"
		;;
	./*|../*|*/*)
		if [ -e "$input" ]; then
			(
				cd "$input"
				pwd -P
			)
		else
			printf '%s/%s\n' "$(cd "$(dirname "$input")" && pwd -P)" "$(basename "$input")"
		fi
		;;
	*)
		printf '%s/%s\n' "$(wt::worktrees_root)" "$input"
		;;
	esac
}

wt::tracked_status() {
	git -C "$1" status --porcelain --untracked-files=no
}

wt::full_status() {
	git -C "$1" status --porcelain
}

wt::require_clean_tracked() {
	local path="$1"
	local status
	status=$(wt::tracked_status "$path")
	if [ -n "$status" ]; then
		printf '%s\n' "$status" >&2
		wt::die "Tracked changes must be clean in $path before continuing."
	fi
}

wt::require_clean_all() {
	local path="$1"
	local status
	status=$(wt::full_status "$path")
	if [ -n "$status" ]; then
		printf '%s\n' "$status" >&2
		wt::die "Worktree $path has local changes or untracked files."
	fi
}

wt::default_target_ref() {
	if git show-ref --verify --quiet refs/remotes/origin/main; then
		printf 'origin/main\n'
		return 0
	fi
	printf 'main\n'
}

wt::worktree_path_for_branch() {
	local branch="$1"
	git -C "$(wt::common_root)" worktree list --porcelain |
		awk -v target="refs/heads/$branch" '
			$1 == "worktree" { path = $2; next }
			$1 == "branch" && $2 == target { print path; exit }
		'
}
