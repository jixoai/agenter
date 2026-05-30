<script lang="ts">
	import { ScrollView } from '@agenter/svelte-components';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import FolderPlusIcon from '@lucide/svelte/icons/folder-plus';
	import PanelRightOpenIcon from '@lucide/svelte/icons/panel-right-open';
	import PlayIcon from '@lucide/svelte/icons/play';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SaveIcon from '@lucide/svelte/icons/save';
	import SearchIcon from '@lucide/svelte/icons/search';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { goto, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount, tick } from 'svelte';

	import { getAppControllerContext } from '$lib/app/controller-context';
	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as NativeSelect from '$lib/components/ui/native-select/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import WorkbenchDetailDrawer from '$lib/features/navigation/workbench-detail-drawer.svelte';
	import WorkbenchPageTabs from '$lib/features/navigation/workbench-page-tabs.svelte';
	import type { WorkbenchPageTabItem } from '$lib/features/navigation/workbench-page-tabs.types';
	import WorkbenchPageContent from '$lib/features/navigation/workbench-page-content.svelte';
	import WorkbenchPageToolbar from '$lib/features/navigation/workbench-page-toolbar.svelte';
	import WorkbenchToolbarAction from '$lib/features/navigation/workbench-toolbar-action.svelte';
	import WorkbenchToolbar from '$lib/features/navigation/workbench-toolbar.svelte';
	import type { WorkbenchToolbarRenderState } from '$lib/features/navigation/workbench-toolbar.types';
	import { cn } from '$lib/utils.js';
	import WorkspaceManageDialog from '$lib/features/workspaces/workspace-manage-dialog.svelte';
	import WorkspaceShellDialog from '$lib/features/workspaces/workspace-shell-dialog.svelte';
	import WorkspaceTree from '$lib/features/workspaces/workspace-tree.svelte';
	import WorkspaceContentHeader from '$lib/features/workspaces/workspace-content-header.svelte';
	import type { WorkspaceManageAvatarRow } from '$lib/features/workspaces/workspace-manage-dialog.types';
	import {
		buildWorkspaceDetailHref,
		buildWorkspaceIndexHref,
		readWorkspaceAvatar,
		WORKSPACE_SEARCH_QUERY_PARAM,
	} from '$lib/features/workspaces/workspace-location';
	import {
		resolveWorkspaceShellRuntimeRunning,
		resolveWorkspaceShellRuntimeStarting,
		resolveWorkspaceShellLaunchCwd,
		resolveWorkspaceShellSurface,
		type WorkspaceShellLaunch,
	} from '$lib/features/workspaces/workspace-shell-contract';
	import {
		buildRuleDrafts,
		collectWorkspaceCliMatchIds,
		collectWorkspaceRuleMatchIds,
		buildWorkspaceTreeRows,
		collectWorkspaceTreeMatchPaths,
		filterWorkspaceCliCatalogGroups,
		normalizeWorkspaceMode,
		orderWorkspaceCliCatalogGroupsForDisplay,
		resolveWorkspaceCliDefaultEntryId,
		serializeRuleDrafts,
		toGrantPattern,
		type WorkspaceMode,
		type WorkspaceRuleDraft,
		type WorkspaceTreePages,
	} from '$lib/features/workspaces/workspace-workbench-state';
	import {
		describeCompactWorkspace,
		resolveObjectiveWorkspacePath,
		sortWorkspacesForCatalog,
	} from './workspace-sorting';

	let {
		workspacePath,
	}: {
		workspacePath: string;
	} = $props();

	const controller = getAppControllerContext();
	type RuntimeWorkspaceMountEntry = Awaited<
		ReturnType<typeof controller.runtimeStore.listRuntimeWorkspaceMounts>
	>[number];
	type RuntimeWorkspaceGrantEntry = Awaited<
		ReturnType<typeof controller.runtimeStore.listRuntimeWorkspaceGrants>
	>[number];

	let selectedAvatar = $state(readWorkspaceAvatar(page.url.searchParams) ?? 'default');
	let mode = $state<WorkspaceMode>(normalizeWorkspaceMode(page.url.searchParams.get('mode')));
	let searchQuery = $state(page.url.searchParams.get(WORKSPACE_SEARCH_QUERY_PARAM) ?? '');
	let activeMatchIndex = $state(0);
	let routeSyncReady = $state(false);
	let detailCompact = $state(false);
	let detailOpen = $state(true);

	let explorerPages = $state<WorkspaceTreePages>({});
	let privatePages = $state<WorkspaceTreePages>({});
	let expandedExplorerPaths = $state<Set<string>>(new Set(['/']));
	let expandedPrivatePaths = $state<Set<string>>(new Set(['/']));
	let selectedExplorerPath = $state<string | null>('/');
	let selectedPrivatePath = $state<string | null>('/');
	let preview = $state<Awaited<ReturnType<typeof controller.runtimeStore.readWorkspaceWorkbenchPreview>> | null>(null);
	let previewLoading = $state(false);
	let cliCatalog = $state<Awaited<ReturnType<typeof controller.runtimeStore.readWorkspaceCliCatalog>> | null>(null);
	let cliLoading = $state(false);
	let selectedCliCommandId = $state<string | null>(null);
	let assetRoots = $state<Awaited<ReturnType<typeof controller.runtimeStore.getRuntimeWorkspaceAssetRoots>> | null>(null);
	let currentMount = $state<RuntimeWorkspaceMountEntry | null>(null);
	let currentGrantEntries = $state<RuntimeWorkspaceGrantEntry[]>([]);
	let rules = $state<WorkspaceRuleDraft[]>([]);
	let selectedRuleId = $state<string | null>(null);
	let rulesDirty = $state(false);
	let rulesSaving = $state(false);
	let quickRuleMode = $state<'ro' | 'rw'>('ro');
	let privateAssetName = $state('');
	let privateAssetKind = $state<'file' | 'directory'>('file');
	let privateAssetBusy = $state(false);
	let manageDialogOpen = $state(false);
	let manageDialogLoading = $state(false);
	let manageDialogError = $state<string | null>(null);
	let manageRows = $state<WorkspaceManageAvatarRow[]>([]);
	let manageRequestVersion = 0;
	let workspaceShellOpen = $state(false);
	let workspaceShellPreparing = $state(false);
	let workspaceShellError = $state<string | null>(null);
	let workspaceShellLaunch = $state<WorkspaceShellLaunch | null>(null);
	let workspaceShellLaunchKey = $state<string | null>(null);
	let pendingCliShellLaunchRequest = $state<WorkspaceShellLaunch | null>(null);

	const workspaceModeTabItems = [
		{ value: 'explorer', label: 'explorer', title: 'Explorer' },
		{ value: 'rules', label: 'rules', title: 'Rules' },
		{ value: 'private', label: 'private', title: 'Private assets' },
		{ value: 'cli', label: 'cli', title: 'CLI' },
	] as const satisfies WorkbenchPageTabItem[];

	const sortedWorkspaces = $derived(
		sortWorkspacesForCatalog(controller.runtimeState.workspaces, controller.runtimeState.recentWorkspaces),
	);
	const selectedWorkspace = $derived(
		sortedWorkspaces.find((workspace) => workspace.path === workspacePath) ?? null,
	);
	const workspaceObjectivePath = $derived(
		selectedWorkspace
			? resolveObjectiveWorkspacePath(selectedWorkspace, sortedWorkspaces)
			: workspacePath.trim().length > 0
				? workspacePath
				: null,
	);
	const emptyCatalogState = {
		data: [],
		loaded: false,
		loading: false,
		refreshing: false,
		error: null,
		refreshedAt: null,
	};
	const avatarCatalogState = $derived(
		selectedWorkspace ? controller.runtimeState.workspaceAvatarCatalogByPath[selectedWorkspace.path] ?? emptyCatalogState : emptyCatalogState,
	);
	const avatarOptions = $derived(avatarCatalogState.data);
	const selectedAvatarEntry = $derived(
		avatarOptions.find((entry) => entry.nickname === selectedAvatar) ?? avatarOptions[0] ?? null,
	);
	const selectedRuntimeSession = $derived(
		selectedAvatarEntry
			? controller.runtimeState.sessions.find((session) => session.id === selectedAvatarEntry.runtimeId) ?? null
			: null,
	);
	const selectedRootRuntimeStatus = $derived(selectedRuntimeSession?.status ?? null);
	const selectedRootRuntimeRunning = $derived(resolveWorkspaceShellRuntimeRunning(selectedRootRuntimeStatus));
	const selectedRootRuntimeStarting = $derived(resolveWorkspaceShellRuntimeStarting(selectedRootRuntimeStatus));
	const avatarSelectItems = $derived(
		avatarOptions.map((entry) => ({
			value: entry.nickname,
			label: entry.nickname,
		})),
	);
	const runtimeId = $derived(selectedAvatarEntry?.runtimeId ?? null);
	const explorerRows = $derived(
		buildWorkspaceTreeRows({
			pages: explorerPages,
			expandedPaths: expandedExplorerPaths,
			searchQuery,
		}),
	);
	const privateRows = $derived(
		buildWorkspaceTreeRows({
			pages: privatePages,
			expandedPaths: expandedPrivatePaths,
			searchQuery,
		}),
	);
	const filteredCliGroups = $derived(
		cliCatalog
			? orderWorkspaceCliCatalogGroupsForDisplay(filterWorkspaceCliCatalogGroups(cliCatalog.groups, searchQuery))
			: [],
	);
	const filteredCliEntries = $derived(filteredCliGroups.flatMap((group) => group.entries));
	const preferredCliCommandId = $derived(
		resolveWorkspaceCliDefaultEntryId(filteredCliGroups, selectedCliCommandId, {
			allowRootRuntimeDefault: selectedRootRuntimeRunning,
		}),
	);
	const activeMatchIds = $derived(
		mode === 'cli'
			? collectWorkspaceCliMatchIds(filteredCliGroups, searchQuery)
			: mode === 'private'
			? collectWorkspaceTreeMatchPaths(privatePages, searchQuery)
			: mode === 'explorer'
				? collectWorkspaceTreeMatchPaths(explorerPages, searchQuery)
				: collectWorkspaceRuleMatchIds(rules, searchQuery),
	);
	const activeMatchId = $derived(activeMatchIds[activeMatchIndex] ?? null);
	const activeSelectionPath = $derived(
		mode === 'private' ? selectedPrivatePath : mode === 'explorer' ? selectedExplorerPath : null,
	);
	const selectedRule = $derived(rules.find((rule) => rule.id === selectedRuleId) ?? rules[0] ?? null);
	const selectedRuleIndex = $derived(selectedRule ? rules.findIndex((rule) => rule.id === selectedRule.id) : -1);
	const selectedCliEntry = $derived(
		filteredCliEntries.find((entry) => entry.id === preferredCliCommandId) ?? null,
	);
	const selectedCliGroup = $derived(
		filteredCliGroups.find((group) => group.entries.some((entry) => entry.id === selectedCliEntry?.id)) ?? null,
	);
	const selectedQuickRule = $derived(
		selectedExplorerPath ? rules.find((rule) => rule.pattern === toGrantPattern(selectedExplorerPath)) ?? null : null,
	);
	const matchedRuleIdSet = $derived(new Set(collectWorkspaceRuleMatchIds(rules, searchQuery)));
	const manageCatalogSignature = $derived(avatarOptions.map((entry) => entry.runtimeId).join('|'));
	const hideCompactContentHeader = $derived(detailCompact && detailOpen);
	const currentSurfaceKind = $derived(
		currentMount?.kind === 'avatar-root' ? 'root-workspace' : 'public-workspace',
	);
	const currentSurfaceSummary = $derived(
		currentMount?.kind === 'avatar-root'
			? 'Avatar-private env and runtime CLI live here by default. Sharing still depends on mounts and grants.'
			: 'Collaboration surface. Root-exclusive env and CLI stay out by default.',
	);
	const currentWorkspaceHasRootGrantAccess = $derived(currentGrantEntries.some((grant) => grant.pattern === '/'));
	const selectedCliShellLaunch = $derived.by(() => {
		if (!selectedWorkspace || !selectedAvatarEntry || !selectedCliEntry) {
			return null;
		}
		const surface = resolveWorkspaceShellSurface({
			entry: selectedCliEntry,
			currentSurfaceKind,
		});
		const shellCwd = resolveWorkspaceShellLaunchCwd({
			surface,
			workspacePath: selectedWorkspace.path,
			mountKind: currentMount?.kind ?? null,
			hasRootGrantAccess: currentWorkspaceHasRootGrantAccess,
		});
		return {
			avatar: selectedAvatarEntry.nickname,
			command: selectedCliEntry.suggestedCommand,
			commandLabel: selectedCliEntry.commandLabel,
			cwd: shellCwd,
			runtimeId: selectedAvatarEntry.runtimeId,
			surface,
			workspacePath: selectedWorkspace.path,
		};
	});
	const selectedCliNeedsRootRuntime = $derived(
		selectedCliShellLaunch?.surface === 'root-workspace' || selectedCliEntry?.preferredExecutionSurface === 'root-workspace',
	);
	const selectedCliRunLabel = $derived.by(() => {
		if (!selectedCliNeedsRootRuntime) {
			return 'Run in shell';
		}
		if (workspaceShellPreparing) {
			return selectedRootRuntimeRunning ? 'Opening shell…' : 'Starting runtime…';
		}
		if (selectedRootRuntimeStarting) {
			return 'Run when runtime is ready';
		}
		if (!selectedRootRuntimeRunning) {
			return 'Start runtime and run';
		}
		return 'Run in shell';
	});

	const selectedCliRuntimeNotice = $derived.by(() => {
		if (!selectedCliNeedsRootRuntime || selectedRootRuntimeRunning) {
			return null;
		}
		if (selectedRootRuntimeStarting) {
			return workspaceShellPreparing
				? {
						title: 'The avatar runtime is starting now.',
						description: 'The shell dialog will open automatically once the root runtime is actually running.',
				  }
				: {
						title: 'The avatar runtime is still starting.',
						description: 'Wait for the runtime to finish booting, then run this command in the root shell.',
				  };
		}
		return {
			title: 'This command needs the avatar runtime first.',
			description: 'The shell button below will start that runtime, then run the command in the real backend shell.',
		};
	});

	const describeWorkspaceMountAccess = (
		mount: RuntimeWorkspaceMountEntry | null,
		grants: RuntimeWorkspaceGrantEntry[],
	): string => {
		if (!mount) {
			return 'Public workspace · not mounted yet';
		}
		if (mount.kind === 'avatar-root') {
			return 'Root workspace · avatar-private env and runtime CLI by default';
		}
		if (grants.length === 0) {
			return 'Public workspace · collaboration surface without rules yet';
		}
		const hasRootGrant = grants.some((grant) => grant.pattern === '/');
		const hasWriteGrant = grants.some((grant) => grant.mode === 'rw');
		if (hasRootGrant && hasWriteGrant) {
			return `Public workspace · ${grants.length} rules · root writable access`;
		}
		if (hasRootGrant) {
			return `Public workspace · ${grants.length} rules · root read only access`;
		}
		return `Public workspace · ${grants.length} rules · ${hasWriteGrant ? 'scoped writable paths' : 'read only paths'}`;
	};

	const listAncestorPaths = (path: string): string[] => {
		if (path === '/') {
			return ['/'];
		}
		const segments = path.split('/').filter(Boolean);
		const paths = ['/'];
		for (let index = 0; index < segments.length; index += 1) {
			paths.push(`/${segments.slice(0, index + 1).join('/')}`);
		}
		return paths;
	};

	const clearSearch = (): void => {
		searchQuery = '';
		activeMatchIndex = 0;
	};

	const revealDetail = (): void => {
		detailOpen = true;
	};

	const presentCliShellDialog = (launch: WorkspaceShellLaunch): void => {
		if (detailCompact) {
			detailOpen = false;
		}
		workspaceShellLaunch = { ...launch };
		workspaceShellLaunchKey = `${launch.runtimeId}:${launch.surface}:${Date.now()}`;
		workspaceShellOpen = true;
	};

	$effect(() => {
		if (
			!pendingCliShellLaunchRequest ||
			pendingCliShellLaunchRequest.surface !== 'root-workspace' ||
			!selectedRootRuntimeRunning
		) {
			return;
		}
		const nextLaunch = {
			...pendingCliShellLaunchRequest,
			cwd: resolveWorkspaceShellLaunchCwd({
				surface: pendingCliShellLaunchRequest.surface,
				workspacePath: pendingCliShellLaunchRequest.workspacePath,
				mountKind: currentMount?.kind ?? null,
				hasRootGrantAccess: currentWorkspaceHasRootGrantAccess,
			}),
			runtimeId: selectedAvatarEntry?.runtimeId ?? pendingCliShellLaunchRequest.runtimeId,
		};
		pendingCliShellLaunchRequest = null;
		workspaceShellPreparing = false;
		presentCliShellDialog(nextLaunch);
	});

	const openCliShellDialog = async (): Promise<void> => {
		if (!selectedWorkspace || !selectedAvatarEntry || !selectedCliShellLaunch) {
			return;
		}
		const pendingLaunch = { ...selectedCliShellLaunch };
		workspaceShellPreparing = true;
		workspaceShellError = null;
		try {
			if (selectedCliShellLaunch.surface === 'root-workspace' && !selectedRootRuntimeRunning) {
				pendingCliShellLaunchRequest = pendingLaunch;
				if (selectedRootRuntimeStarting) {
					return;
				}
				if (selectedRuntimeSession) {
					await controller.runtimeStore.startSession(selectedRuntimeSession.id);
				} else {
					await controller.runtimeStore.createSession({
						cwd: selectedWorkspace.path,
						avatar: selectedAvatarEntry.nickname,
						autoStart: true,
					});
				}
				await refreshWorkbenchContext();
				return;
			}
			presentCliShellDialog(pendingLaunch);
		} catch (error) {
			pendingCliShellLaunchRequest = null;
			workspaceShellError = error instanceof Error ? error.message : String(error);
		} finally {
			if (!pendingCliShellLaunchRequest) {
				workspaceShellPreparing = false;
			}
		}
	};

	const closeCliShellDialog = (): void => {
		workspaceShellOpen = false;
		workspaceShellLaunch = null;
		workspaceShellLaunchKey = null;
	};

	const getPreviewEmptyStateTitle = (
		currentPreview: NonNullable<typeof preview>,
	): string => (currentPreview.previewKind === 'directory' ? 'Directory preview is not available.' : 'Preview is not available.');

	const getPreviewEmptyStateDescription = (
		currentPreview: NonNullable<typeof preview>,
	): string =>
		currentPreview.previewKind === 'directory'
			? 'Choose a file inside this directory to inspect text, image, audio, or video content.'
			: currentPreview.note ?? 'Select a different asset to inspect a richer preview.';

	const revealTreePath = async (treeMode: 'explorer' | 'private', path: string): Promise<void> => {
		const nextExpandedPaths = new Set(treeMode === 'explorer' ? expandedExplorerPaths : expandedPrivatePaths);
		for (const directoryPath of listAncestorPaths(path).slice(0, -1)) {
			nextExpandedPaths.add(directoryPath);
			if (directoryPath === '/') {
				continue;
			}
			const pages = treeMode === 'explorer' ? explorerPages : privatePages;
			if (!pages[directoryPath]) {
				await loadTree(treeMode, directoryPath);
			}
		}
		if (treeMode === 'explorer') {
			expandedExplorerPaths = nextExpandedPaths;
			return;
		}
		expandedPrivatePaths = nextExpandedPaths;
	};

	const scrollActiveMatchIntoView = async (targetId: string): Promise<void> => {
		if (typeof document === 'undefined') {
			return;
		}
		await tick();
		const selector =
			mode === 'cli'
				? `[data-workspace-cli-command-id="${CSS.escape(targetId)}"]`
				: mode === 'rules'
				? `[data-workspace-rule-id="${CSS.escape(targetId)}"]`
				: `[data-workspace-tree-path="${CSS.escape(targetId)}"]`;
		const element = document.querySelector<HTMLElement>(selector);
		element?.scrollIntoView({ block: 'nearest' });
	};

	const syncRoute = (): void => {
		if (!routeSyncReady || !selectedWorkspace) {
			return;
		}
		const nextHref = buildWorkspaceDetailHref({
			workspacePath: selectedWorkspace.path,
			avatar: selectedAvatarEntry?.nickname ?? selectedAvatar,
			mode,
			q: searchQuery.trim(),
		});
		const currentHref = `${page.url.pathname}${page.url.search}`;
		if (nextHref === currentHref) {
			return;
		}
		replaceState(nextHref, page.state);
	};

	const loadTree = async (
		treeMode: 'explorer' | 'private',
		path: string,
		offset = 0,
	): Promise<void> => {
		if (!selectedWorkspace || !selectedAvatarEntry) {
			return;
		}
		const output = await controller.runtimeStore.listWorkspaceWorkbenchTree({
			workspacePath: selectedWorkspace.path,
			avatar: selectedAvatarEntry.nickname,
			mode: treeMode,
			path,
			offset,
		});
		if (treeMode === 'explorer') {
			explorerPages = { ...explorerPages, [output.rootPath]: output };
			return;
		}
		privatePages = { ...privatePages, [output.rootPath]: output };
	};

	const toggleExpandedPath = async (treeMode: 'explorer' | 'private', path: string): Promise<void> => {
		const current = treeMode === 'explorer' ? expandedExplorerPaths : expandedPrivatePaths;
		const next = new Set(current);
		if (next.has(path)) {
			next.delete(path);
		} else {
			next.add(path);
			const pages = treeMode === 'explorer' ? explorerPages : privatePages;
			if (!pages[path]) {
				await loadTree(treeMode, path);
			}
		}
		if (treeMode === 'explorer') {
			expandedExplorerPaths = next;
			return;
		}
		expandedPrivatePaths = next;
	};

	const loadPreview = async (previewMode: 'explorer' | 'private', path: string | null): Promise<void> => {
		if (!selectedWorkspace || !selectedAvatarEntry || !path) {
			preview = null;
			return;
		}
		previewLoading = true;
		try {
			preview = await controller.runtimeStore.readWorkspaceWorkbenchPreview({
				workspacePath: selectedWorkspace.path,
				avatar: selectedAvatarEntry.nickname,
				mode: previewMode,
				path,
			});
		} finally {
			previewLoading = false;
		}
	};

	const loadCliCatalog = async (): Promise<void> => {
		if (!selectedWorkspace || !selectedAvatarEntry) {
			cliCatalog = null;
			selectedCliCommandId = null;
			return;
		}
		cliLoading = true;
		try {
			const nextCatalog = await controller.runtimeStore.readWorkspaceCliCatalog({
				workspacePath: selectedWorkspace.path,
				avatar: selectedAvatarEntry.nickname,
			});
			cliCatalog = nextCatalog;
			const orderedGroups = orderWorkspaceCliCatalogGroupsForDisplay(nextCatalog.groups);
			selectedCliCommandId = resolveWorkspaceCliDefaultEntryId(orderedGroups, selectedCliCommandId, {
				allowRootRuntimeDefault: selectedRootRuntimeRunning,
			});
		} finally {
			cliLoading = false;
		}
	};

	const refreshWorkbenchContext = async (): Promise<void> => {
		if (!selectedWorkspace || !selectedAvatarEntry || !runtimeId) {
			currentMount = null;
			currentGrantEntries = [];
			pendingCliShellLaunchRequest = null;
			return;
		}
		const [nextGrants, nextRoots, mounts] = await Promise.all([
			controller.runtimeStore.listRuntimeWorkspaceGrants({
				runtimeId,
				workspacePath: selectedWorkspace.path,
			}),
			controller.runtimeStore.getRuntimeWorkspaceAssetRoots({
				workspacePath: selectedWorkspace.path,
				avatar: selectedAvatarEntry.nickname,
			}),
			controller.runtimeStore.listRuntimeWorkspaceMounts(runtimeId),
		]);
		currentMount =
			mounts.find((item) => item.workspacePath === selectedWorkspace.path && item.kind === 'avatar-root') ??
			mounts.find((item) => item.workspacePath === selectedWorkspace.path) ??
			null;
		currentGrantEntries = nextGrants;
		const nextRules = buildRuleDrafts(nextGrants);
		rules = nextRules;
		selectedRuleId = nextRules[0]?.id ?? null;
		rulesDirty = false;
		assetRoots = nextRoots;
		cliCatalog = null;
		explorerPages = {};
		privatePages = {};
		expandedExplorerPaths = new Set(['/']);
		expandedPrivatePaths = new Set(['/']);
		selectedExplorerPath = '/';
		selectedPrivatePath = '/';
		await Promise.all([loadTree('explorer', '/'), loadTree('private', '/'), loadPreview('explorer', '/'), loadCliCatalog()]);
	};

	const loadManageRows = async (): Promise<void> => {
		if (!selectedWorkspace) {
			manageRows = [];
			manageDialogError = null;
			return;
		}
		const currentWorkspacePath = selectedWorkspace.path;
		const currentAvatars = [...avatarOptions];
		const requestVersion = ++manageRequestVersion;
		manageDialogLoading = true;
		manageDialogError = null;
		try {
			const nextRows = await Promise.all(
				currentAvatars.map(async (entry) => {
					const mounts = await controller.runtimeStore.listRuntimeWorkspaceMounts(entry.runtimeId);
					const mount =
						mounts.find((item) => item.workspacePath === currentWorkspacePath && item.kind === 'workspace') ??
						mounts.find((item) => item.workspacePath === currentWorkspacePath) ??
						null;
					const grants =
						mount?.kind === 'workspace'
							? await controller.runtimeStore.listRuntimeWorkspaceGrants({
									runtimeId: entry.runtimeId,
									workspacePath: currentWorkspacePath,
								})
							: [];
					return {
						nickname: entry.nickname,
						runtimeId: entry.runtimeId,
						iconUrl: entry.iconUrl ?? null,
						mountKind: mount?.kind ?? null,
						grantCount: grants.length,
						accessSummary: describeWorkspaceMountAccess(mount, grants),
					} satisfies WorkspaceManageAvatarRow;
				}),
			);
			if (requestVersion !== manageRequestVersion) {
				return;
			}
			manageRows = nextRows.sort((left, right) => {
				const leftMounted = left.mountKind ? 1 : 0;
				const rightMounted = right.mountKind ? 1 : 0;
				return rightMounted - leftMounted || left.nickname.localeCompare(right.nickname);
			});
		} catch (error) {
			if (requestVersion !== manageRequestVersion) {
				return;
			}
			manageDialogError = error instanceof Error ? error.message : String(error);
		} finally {
			if (requestVersion === manageRequestVersion) {
				manageDialogLoading = false;
			}
		}
	};

	const openManageDialog = async (): Promise<void> => {
		manageDialogOpen = true;
		await loadManageRows();
	};

	const mountWorkspaceForAvatar = async (row: WorkspaceManageAvatarRow): Promise<void> => {
		if (!selectedWorkspace) {
			return;
		}
		await controller.runtimeStore.grantRuntimeWorkspace({
			runtimeId: row.runtimeId,
			workspacePath: selectedWorkspace.path,
			grants: [],
		});
		await loadManageRows();
		if (row.nickname === selectedAvatar) {
			await refreshWorkbenchContext();
		}
	};

	const unmountWorkspaceForAvatar = async (row: WorkspaceManageAvatarRow): Promise<void> => {
		if (!selectedWorkspace || row.mountKind !== 'workspace') {
			return;
		}
		await controller.runtimeStore.detachRuntimeWorkspace({
			runtimeId: row.runtimeId,
			workspacePath: selectedWorkspace.path,
		});
		await loadManageRows();
		if (row.nickname === selectedAvatar) {
			await refreshWorkbenchContext();
		}
	};

	const openRulesForAvatar = (nickname: string): void => {
		selectedAvatar = nickname;
		mode = 'rules';
		manageDialogOpen = false;
	};

	const persistRules = async (): Promise<void> => {
		if (!selectedWorkspace || !runtimeId) {
			return;
		}
		rulesSaving = true;
		const currentSelectedPattern = selectedRule?.pattern ?? null;
		try {
			const nextGrants = await controller.runtimeStore.grantRuntimeWorkspace({
				runtimeId,
				workspacePath: selectedWorkspace.path,
				grants: serializeRuleDrafts(rules),
			});
			const nextRules = buildRuleDrafts(nextGrants);
			rules = nextRules;
			selectedRuleId =
				(currentSelectedPattern
					? nextRules.find((rule) => rule.pattern === currentSelectedPattern)?.id
					: null) ??
				nextRules[0]?.id ??
				null;
			rulesDirty = false;
			await loadTree('explorer', '/');
		} finally {
			rulesSaving = false;
		}
	};

	const addRule = (): void => {
		const nextRule: WorkspaceRuleDraft = {
			id: `draft-${crypto.randomUUID()}`,
			pattern: selectedRule?.pattern ?? selectedExplorerPath ?? '/',
			mode: selectedRule?.mode ?? quickRuleMode,
			enabled: true,
		};
		rules = [...rules, nextRule];
		selectedRuleId = nextRule.id;
		rulesDirty = true;
	};

	const stageQuickRule = (): void => {
		if (!selectedExplorerPath) {
			return;
		}
		const targetPath = toGrantPattern(selectedExplorerPath);
		const nextRules = rules.some((rule) => rule.pattern === targetPath)
			? rules.map((rule) =>
					rule.pattern === targetPath ? { ...rule, mode: quickRuleMode, enabled: true } : rule,
				)
			: [
					...rules,
					{
						id: `draft-${crypto.randomUUID()}`,
						pattern: targetPath,
						mode: quickRuleMode,
						enabled: true,
					},
				];
		rules = nextRules;
		selectedRuleId = nextRules.find((rule) => rule.pattern === targetPath)?.id ?? nextRules[0]?.id ?? null;
		rulesDirty = true;
	};

	const duplicateRule = (): void => {
		if (!selectedRule) {
			return;
		}
		const nextRule: WorkspaceRuleDraft = {
			...selectedRule,
			id: `draft-${crypto.randomUUID()}`,
			pattern: `${selectedRule.pattern}-copy`,
			enabled: false,
		};
		rules = [
			...rules,
			nextRule,
		];
		selectedRuleId = nextRule.id;
		rulesDirty = true;
	};

	const moveRule = (direction: -1 | 1): void => {
		if (selectedRuleIndex < 0) {
			return;
		}
		const nextIndex = selectedRuleIndex + direction;
		if (nextIndex < 0 || nextIndex >= rules.length) {
			return;
		}
		const nextRules = [...rules];
		const currentRule = nextRules[selectedRuleIndex]!;
		nextRules.splice(selectedRuleIndex, 1);
		nextRules.splice(nextIndex, 0, currentRule);
		rules = nextRules;
		rulesDirty = true;
	};

	const removeRule = (): void => {
		if (!selectedRule) {
			return;
		}
		const nextRules = rules.filter((rule) => rule.id !== selectedRule.id);
		rules = nextRules;
		selectedRuleId = nextRules[0]?.id ?? null;
		rulesDirty = true;
	};

	const createPrivateAsset = async (): Promise<void> => {
		if (!selectedWorkspace || !selectedAvatarEntry || privateAssetName.trim().length === 0) {
			return;
		}
		privateAssetBusy = true;
		const parentPath = selectedPrivatePath ?? '/';
		try {
			const created = await controller.runtimeStore.createWorkspacePrivateAsset({
				workspacePath: selectedWorkspace.path,
				avatar: selectedAvatarEntry.nickname,
				parentPath,
				name: privateAssetName.trim(),
				kind: privateAssetKind,
			});
			privateAssetName = '';
			await loadTree('private', parentPath);
			selectedPrivatePath = created.path;
			await loadPreview('private', created.path);
		} finally {
			privateAssetBusy = false;
		}
	};

	const jumpToActiveMatch = async (direction: -1 | 1): Promise<void> => {
		if (activeMatchIds.length === 0) {
			return;
		}
		const nextIndex = (activeMatchIndex + direction + activeMatchIds.length) % activeMatchIds.length;
		activeMatchIndex = nextIndex;
		const nextTarget = activeMatchIds[nextIndex] ?? null;
		if (!nextTarget) {
			return;
		}
		if (mode === 'private') {
			await revealTreePath('private', nextTarget);
			selectedPrivatePath = nextTarget;
			await loadPreview('private', nextTarget);
			revealDetail();
			await scrollActiveMatchIntoView(nextTarget);
			return;
		}
		if (mode === 'cli') {
			selectedCliCommandId = nextTarget;
			revealDetail();
			await scrollActiveMatchIntoView(nextTarget);
			return;
		}
		if (mode === 'explorer') {
			await revealTreePath('explorer', nextTarget);
			selectedExplorerPath = nextTarget;
			await loadPreview('explorer', nextTarget);
			revealDetail();
			await scrollActiveMatchIntoView(nextTarget);
			return;
		}
		selectedRuleId = nextTarget;
		revealDetail();
		await scrollActiveMatchIntoView(nextTarget);
	};

	$effect(() => {
		const workspacePath = selectedWorkspace?.path;
		if (!workspacePath) {
			return;
		}
		const release = controller.runtimeStore.retainWorkspaceAvatarCatalog(workspacePath);
		void controller.runtimeStore.hydrateWorkspaceAvatarCatalog(workspacePath);
		return () => {
			release();
		};
	});

	$effect(() => {
		if (!selectedAvatarEntry) {
			return;
		}
		selectedAvatar = selectedAvatarEntry.nickname;
	});

	$effect(() => {
		if (!workspaceShellLaunch) {
			return;
		}
		if (!selectedWorkspace || !selectedAvatarEntry) {
			closeCliShellDialog();
			return;
		}
		if (
			workspaceShellLaunch.workspacePath !== selectedWorkspace.path ||
			workspaceShellLaunch.avatar !== selectedAvatarEntry.nickname
		) {
			closeCliShellDialog();
		}
	});

	$effect(() => {
		if (!selectedWorkspace || !selectedAvatarEntry || !runtimeId) {
			return;
		}
		void refreshWorkbenchContext();
	});

	$effect(() => {
		if (!manageDialogOpen) {
			return;
		}
		selectedWorkspace?.path;
		manageCatalogSignature;
		void loadManageRows();
	});

	$effect(() => {
		if (selectedQuickRule) {
			quickRuleMode = selectedQuickRule.mode;
		}
	});

	$effect(() => {
		if (activeMatchIds.length === 0) {
			activeMatchIndex = 0;
			return;
		}
		if (activeMatchIndex >= activeMatchIds.length) {
			activeMatchIndex = 0;
		}
	});

	$effect(() => {
		if (selectedCliCommandId !== preferredCliCommandId) {
			selectedCliCommandId = preferredCliCommandId;
		}
	});

	$effect(() => {
		if (!workspaceShellOpen && workspaceShellLaunch) {
			workspaceShellLaunch = null;
			workspaceShellLaunchKey = null;
		}
	});

	$effect(() => {
		syncRoute();
	});

	onMount(() => {
		routeSyncReady = true;
	});
</script>

{#snippet workspaceRouteToolbarPageTabs(toolbarState: WorkbenchToolbarRenderState)}
	<WorkbenchPageTabs
		ariaLabel="Workspace modes"
		value={mode}
		items={workspaceModeTabItems}
		toolbarState={toolbarState}
		onValueChange={(value) => {
			mode = value as WorkspaceMode;
		}}
	/>
{/snippet}

{#snippet workspaceRouteToolbarStatus(toolbarState: WorkbenchToolbarRenderState)}
	<!-- Shared page-toolbar already owns responsive overflow; keep the avatar lens here once
		and let the shared inline/overflow placements decide how compact viewports present it. -->
	<div class={cn('min-w-0', toolbarState.placement === 'overflow' ? 'grid w-full gap-2' : 'flex justify-end')}>
		{#if toolbarState.placement === 'overflow'}
			<div class="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">View as</div>
		{/if}
		<Select.Root
			type="single"
			items={avatarSelectItems}
			value={selectedAvatar}
			onValueChange={(value) => {
				selectedAvatar = value as string;
			}}
		>
			<Select.Trigger
				aria-label="View as"
				class={cn(
					'min-w-0 justify-start border border-border/60 bg-background/70 shadow-none',
					toolbarState.placement === 'overflow'
						? 'h-11 min-h-11 w-full rounded-[0.95rem] px-3'
						: 'h-8 min-h-8 min-w-[9rem] max-w-[11.5rem] rounded-full px-2.5',
				)}
				data-testid="workspace-avatar-select"
			>
				<div class="flex min-w-0 items-center gap-2">
					<ProfileAvatar
						label={selectedAvatarEntry?.nickname ?? selectedAvatar}
						class={cn(
							'border-0 bg-foreground text-background',
							toolbarState.placement === 'overflow'
								? 'size-8 rounded-[0.82rem]'
								: 'size-6 rounded-[0.72rem]',
						)}
					/>
					<div class="grid min-w-0 text-left leading-tight">
						<span
							class={cn(
								'truncate font-semibold text-foreground',
								toolbarState.placement === 'overflow' ? 'text-sm' : 'text-[13px]',
							)}
						>
							{selectedAvatarEntry?.nickname ?? selectedAvatar}
						</span>
						{#if toolbarState.placement === 'overflow'}
							<span class="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Avatar lens</span>
						{/if}
					</div>
				</div>
			</Select.Trigger>
			<Select.Content>
				{#each avatarOptions as avatar (avatar.nickname)}
					<Select.Item value={avatar.nickname} label={avatar.nickname}>{avatar.nickname}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	</div>
{/snippet}

{#snippet workspaceRouteToolbarActions(toolbarState: WorkbenchToolbarRenderState)}
	<div
		class={cn(
			'flex min-w-0 items-center gap-1 md:gap-1.5',
			toolbarState.placement === 'overflow' && 'grid justify-items-start gap-2',
		)}
		aria-label="Workspace toolbar actions"
	>
		<WorkbenchToolbarAction
			placement={toolbarState.placement}
			label="Manage"
			title="Manage workspace mounts"
			inlineLabel
			onclick={() => void openManageDialog()}
		/>

		{#if detailCompact}
			<WorkbenchToolbarAction
				placement={toolbarState.placement}
				label="Open detail panel"
				title="Open detail panel"
				onclick={() => {
					detailOpen = true;
				}}
			>
				<PanelRightOpenIcon class="size-4" />
			</WorkbenchToolbarAction>
		{/if}

		<div
			class={cn(
				'min-w-0 border border-border/60 bg-background/70',
				toolbarState.placement === 'overflow'
					? 'grid w-full max-w-[18rem] gap-2 rounded-2xl px-3 py-2'
					: 'flex h-6 min-w-[11rem] max-w-[15rem] items-center gap-1 rounded-full px-1.5 md:min-w-[12rem] md:max-w-[17rem]',
			)}
		>
			<div class="flex min-w-0 items-center gap-1.5">
				<SearchIcon class="size-3.5 shrink-0 text-muted-foreground" />
					<Input
						bind:value={searchQuery}
						class={cn(
							'h-auto border-0 bg-transparent p-0 shadow-none focus-visible:ring-0',
							toolbarState.placement === 'overflow'
								? 'w-full min-w-[14rem] text-sm'
								: 'min-w-0 flex-1 text-[11px] md:text-xs',
						)}
						placeholder={mode === 'rules' ? 'Search rules' : mode === 'cli' ? 'Search commands' : 'Search loaded tree'}
					/>
				</div>

			{#if activeMatchIds.length > 0}
				<div
					class={cn(
						'flex min-w-0 items-center gap-1',
						toolbarState.placement === 'overflow' && 'flex-wrap gap-2',
					)}
				>
					<Badge variant="outline" class="bg-background/70">
						{activeMatchIndex + 1}/{activeMatchIds.length}
					</Badge>
					<WorkbenchToolbarAction
						placement={toolbarState.placement}
						label="Previous match"
						title="Previous match"
						onclick={() => void jumpToActiveMatch(-1)}
					>
						<ArrowUpIcon class="size-4" />
					</WorkbenchToolbarAction>
					<WorkbenchToolbarAction
						placement={toolbarState.placement}
						label="Next match"
						title="Next match"
						onclick={() => void jumpToActiveMatch(1)}
					>
						<ArrowDownIcon class="size-4" />
					</WorkbenchToolbarAction>
					<WorkbenchToolbarAction
						placement={toolbarState.placement}
						label="Cancel"
						title="Clear search"
						inlineLabel
						onclick={clearSearch}
					/>
				</div>
			{/if}
		</div>
	</div>
{/snippet}

<WorkbenchPageToolbar>
	<WorkbenchToolbar
		pageTabs={workspaceRouteToolbarPageTabs}
		status={workspaceRouteToolbarStatus}
		actions={workspaceRouteToolbarActions}
		overflowLabel="Open workspace toolbar details"
	/>
</WorkbenchPageToolbar>

<div
	class={cn(
		'grid h-full grid-rows-[auto_minmax(0,1fr)] md:gap-4 md:p-5',
		hideCompactContentHeader ? 'gap-0 p-0' : 'gap-2 px-2 pb-2 pt-2 md:gap-4 md:p-5',
	)}
	style="min-block-size: 0;"
	data-testid="workspaces-route"
>
	{#if !selectedWorkspace}
		<Card.Root class="h-full">
			<Card.Content class="grid h-full place-items-center p-6">
				<div class="grid max-w-md gap-4 text-center">
					<div class="text-lg font-semibold">Workspace root not found</div>
					<div class="text-sm text-muted-foreground">
						This detail route is bound to one workspace root. Go back to the start page and choose a valid root.
					</div>
					<div class="flex justify-center">
						<Button variant="outline" onclick={() => void goto(buildWorkspaceIndexHref({ avatar: selectedAvatar }))}>
							Back to start page
						</Button>
					</div>
				</div>
			</Card.Content>
		</Card.Root>
	{:else}
	<div class={cn('min-w-0 w-full', hideCompactContentHeader && 'hidden md:block')}>
		<WorkspaceContentHeader
			objectivePath={workspaceObjectivePath}
			{selectedWorkspace}
			surfaceKind={currentSurfaceKind}
			surfaceSummary={currentSurfaceSummary}
		/>
	</div>
	<WorkspaceManageDialog
		bind:open={manageDialogOpen}
		workspacePath={selectedWorkspace.path}
		{selectedAvatar}
		rows={manageRows}
		loading={manageDialogLoading}
		error={manageDialogError}
		onMountAvatar={mountWorkspaceForAvatar}
		onUnmountAvatar={unmountWorkspaceForAvatar}
		onOpenAvatar={openRulesForAvatar}
	/>

	<WorkbenchPageContent
		class="workspace-route-page-content row-start-2 h-full min-w-0 w-full"
		mainClass="workspace-route-main h-full"
		drawerClass="workspace-route-drawer h-full"
		detailLayout="split-detail"
		bind:detailCompact
		bind:detailOpen
		detailRatioPersistence="workspaces:detail"
		>
			{#snippet main()}
				<Card.Root class="workspace-route-list-card grid h-full grid-rows-[auto_minmax(0,1fr)] gap-0 rounded-none border-0 bg-transparent py-0 shadow-none">
					<Card.Header class="gap-1 border-b px-3 py-3.5 md:px-5 md:py-4.5">
						<Card.Title>{mode === 'rules' ? 'Rules' : mode === 'private' ? 'Private assets' : mode === 'cli' ? 'CLI' : 'Explorer'}</Card.Title>
						<Card.Description class="hidden max-w-[30rem] text-xs leading-5 md:block md:text-sm">
							{#if mode === 'rules'}
								Rule order maps directly to runtime grant priority for the selected avatar lens.
							{:else if mode === 'private'}
								Avatar-private assets reuse the tree model without workspace permission badges.
							{:else if mode === 'cli'}
								One grouped catalog keeps builtins, root runtime CLI, and workspace tools aligned with helpcenter truth.
							{:else}
								Folders toggle inline and loaded tree search stays inside the same hierarchy.
							{/if}
					</Card.Description>
				</Card.Header>
					<Card.Content class="workspace-route-list-card-content h-full p-0">
						{#if mode === 'rules'}
							<ScrollView class="h-full" contentClass="grid gap-2 p-2.5 md:p-3">
								{#if rules.length === 0}
									<div class="rounded-[0.9rem] bg-muted/24 px-4 py-6 text-sm text-muted-foreground">
										No explicit rules are configured for this workspace/avatar pair.
								</div>
							{:else}
								{#each rules as rule, index (rule.id)}
									{@const matched = matchedRuleIdSet.has(rule.id)}
									{@const activeMatched = activeMatchId === rule.id}
										<button
											type="button"
											data-workspace-rule-id={rule.id}
											class={cn(
												'grid w-full grid-cols-[minmax(0,1fr)_auto] gap-2.5 rounded-[0.85rem] border border-transparent px-3 py-2.5 text-left transition-colors hover:bg-muted/34 md:px-4 md:py-3',
												selectedRule?.id === rule.id ? 'bg-primary/6 ring-1 ring-primary/24' : 'bg-transparent',
												matched && 'bg-amber-500/8',
												activeMatched && 'ring-2 ring-amber-500/60',
										)}
									onclick={() => {
										selectedRuleId = rule.id;
										revealDetail();
									}}
									>
										<div class="min-w-0">
											<div class="truncate text-sm font-semibold">{rule.pattern}</div>
											<div class="text-[11px] text-muted-foreground">Priority {index + 1}</div>
										</div>
										<div class="flex items-center gap-2">
											<Badge variant={rule.enabled ? 'secondary' : 'outline'}>
												{rule.enabled ? 'enabled' : 'disabled'}
											</Badge>
											<Badge variant="outline">{rule.mode}</Badge>
										</div>
									</button>
								{/each}
							{/if}
						</ScrollView>
					{:else if mode === 'cli'}
						<ScrollView
							class="h-full"
							contentClass="grid gap-3 p-3 md:gap-4 md:p-4"
							viewportTestId="workspace-cli-list"
						>
							{#if cliLoading}
								<div class="rounded-[0.95rem] bg-muted/24 px-4 py-6 text-sm text-muted-foreground">
									Loading the workspace CLI catalog for the active avatar lens…
								</div>
							{:else if filteredCliGroups.length === 0}
								<div class="rounded-[0.95rem] bg-muted/24 px-4 py-6 text-sm text-muted-foreground">
									No registered command rows match the current query for this workspace lens.
								</div>
							{:else}
								{#each filteredCliGroups as group (group.id)}
									<section class="grid gap-2.5">
										<div class="grid gap-1 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
											<div class="min-w-0">
												<div class="truncate text-sm font-semibold md:text-[15px]">{group.title}</div>
												<div class="text-xs leading-5 text-muted-foreground">{group.description}</div>
											</div>
											<Badge variant="outline" class="w-fit bg-background/70">{group.entries.length}</Badge>
										</div>

										<div class="grid gap-2">
											{#each group.entries as entry (entry.id)}
												{@const matched = activeMatchIds.includes(entry.id)}
												{@const activeMatched = activeMatchId === entry.id}
												{@const selected = selectedCliEntry?.id === entry.id}
												<button
													type="button"
													data-workspace-cli-command-id={entry.id}
													class={cn(
														'grid w-full gap-2 rounded-[0.9rem] border border-transparent px-3 py-3 text-left transition-colors hover:bg-muted/34 md:px-4',
														selected ? 'bg-primary/6 ring-1 ring-primary/24' : 'bg-transparent',
														matched && 'bg-amber-500/8',
														activeMatched && 'ring-2 ring-amber-500/60',
													)}
													onclick={() => {
														selectedCliCommandId = entry.id;
														revealDetail();
													}}
												>
													<div class="flex min-w-0 flex-wrap items-center gap-2">
														<code class="rounded bg-muted/38 px-2 py-1 text-[11px] font-semibold md:text-xs">{entry.commandLabel}</code>
														{#if entry.toolScope}
															<Badge variant="outline">{entry.toolScope}</Badge>
														{/if}
														{#if entry.metadataState === 'fallback'}
															<Badge variant="secondary">fallback metadata</Badge>
														{/if}
													</div>
													{#if entry.displayName !== entry.commandLabel}
														<div class="text-sm font-medium">{entry.displayName}</div>
													{/if}
													<div class="text-xs leading-5 text-muted-foreground md:text-sm">{entry.description}</div>
												</button>
											{/each}
										</div>
									</section>
								{/each}
							{/if}
						</ScrollView>
					{:else}
						<WorkspaceTree
							rows={mode === 'private' ? privateRows : explorerRows}
							selectedPath={activeSelectionPath}
							activeMatchPath={activeMatchId}
							expandedPaths={mode === 'private' ? expandedPrivatePaths : expandedExplorerPaths}
							matchPaths={activeMatchIds}
							showAccessBadges={mode === 'explorer'}
							viewportTestId={mode === 'private' ? 'workspace-private-tree' : 'workspace-explorer-tree'}
							onSelect={async (path) => {
								if (mode === 'private') {
									selectedPrivatePath = path;
									await loadPreview('private', path);
									revealDetail();
									return;
								}
								selectedExplorerPath = path;
								await loadPreview('explorer', path);
								revealDetail();
							}}
							onToggleDirectory={async (path) => {
								await toggleExpandedPath(mode === 'private' ? 'private' : 'explorer', path);
							}}
							onLoadMore={async (path) => {
								const pages = mode === 'private' ? privatePages : explorerPages;
								const nextOffset = pages[path]?.nextOffset ?? 0;
								await loadTree(mode === 'private' ? 'private' : 'explorer', path, nextOffset);
							}}
						/>
					{/if}
				</Card.Content>
			</Card.Root>
		{/snippet}

		{#snippet drawer()}
		{#snippet workspacePreviewDetail()}
				{#if previewLoading}
					<div class="grid min-h-[clamp(10rem,26vh,16rem)] place-items-center rounded-[0.9rem] bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--muted),transparent_18%),transparent_72%)] px-4 py-6 text-center text-sm text-muted-foreground">
						<div class="grid max-w-[16rem] gap-2">
							<SearchIcon class="mx-auto size-6 text-muted-foreground/70" />
							<div class="font-medium text-foreground">Loading preview…</div>
							<div class="text-xs leading-5 text-muted-foreground">Fetching the current selection before rendering the detail view.</div>
						</div>
					</div>
				{:else if !preview}
					<div class="grid min-h-[clamp(10rem,26vh,16rem)] place-items-center rounded-[0.9rem] bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--muted),transparent_18%),transparent_72%)] px-4 py-6 text-center text-sm text-muted-foreground">
						<div class="grid max-w-[16rem] gap-2">
							<SearchIcon class="mx-auto size-6 text-muted-foreground/70" />
							<div class="font-medium text-foreground">Select one entry to inspect its preview.</div>
							<div class="text-xs leading-5 text-muted-foreground">The detail area stays focused on one current tree selection at a time.</div>
						</div>
					</div>
				{:else if preview.previewKind === 'text'}
					<ScrollView
						class="max-h-[24rem] rounded-[0.85rem] bg-muted/24 md:max-h-[28rem]"
						contentClass="min-w-full"
					>
						<pre class="p-3 text-[11px] leading-5 md:p-4 md:text-xs md:leading-6">{preview.textContent}</pre>
					</ScrollView>
				{:else if preview.previewKind === 'image' && preview.mediaDataUrl}
					<img src={preview.mediaDataUrl} alt={preview.name} class="max-h-full w-full rounded-[0.85rem] object-contain" />
				{:else if preview.previewKind === 'audio' && preview.mediaDataUrl}
					<audio controls src={preview.mediaDataUrl} class="w-full"></audio>
				{:else if preview.previewKind === 'video' && preview.mediaDataUrl}
					<!-- svelte-ignore a11y_media_has_caption -->
					<video controls src={preview.mediaDataUrl} class="max-h-full w-full rounded-[0.85rem]"></video>
				{:else}
					<div class="grid min-h-[clamp(10rem,26vh,16rem)] place-items-center rounded-[0.9rem] bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--muted),transparent_18%),transparent_72%)] px-4 py-6 text-center text-sm text-muted-foreground">
						<div class="grid max-w-[16rem] gap-2">
							<SearchIcon class="mx-auto size-6 text-muted-foreground/70" />
							<div class="font-medium text-foreground">{getPreviewEmptyStateTitle(preview)}</div>
							<div class="text-xs leading-5 text-muted-foreground">{getPreviewEmptyStateDescription(preview)}</div>
						</div>
					</div>
				{/if}
			{/snippet}

			<WorkbenchDetailDrawer
				data-testid="workspace-detail-drawer"
				tone={detailCompact ? 'page' : 'pane'}
				title={mode === 'rules' ? 'Rule detail' : mode === 'cli' ? 'Command detail' : mode === 'private' ? 'Private detail' : 'Preview'}
				description={
					mode === 'rules'
						? 'Rules editing and apply actions stay inside this drawer.'
						: mode === 'cli'
							? 'Command discovery stays grouped while runtime-sensitive execution stays explicit in this drawer.'
						: mode === 'private'
							? 'Create avatar-private assets here, then inspect the currently selected entry below.'
						: 'Preview stays dominant while quick rule staging stays beside the selected path.'
				}
				contentClass={cn(mode !== 'rules' && detailCompact && 'min-h-full')}
			>
				{#if mode === 'rules'}
					<div class="grid gap-3 rounded-[0.9rem] bg-muted/24 px-4 py-4 text-sm">
						{#if selectedRule}
							<div class="grid gap-2.5">
								<div class="font-semibold">{selectedRule.pattern}</div>
								<div class="grid gap-2.5">
									<Input
										value={selectedRule.pattern}
										oninput={(event) => {
											const value = (event.currentTarget as HTMLInputElement).value;
											rules = rules.map((rule) => (rule.id === selectedRule.id ? { ...rule, pattern: value } : rule));
											rulesDirty = true;
										}}
									/>
									<NativeSelect.NativeSelect
										value={selectedRule.mode}
										onchange={(event) => {
											const value = (event.currentTarget as HTMLSelectElement).value as 'ro' | 'rw';
											rules = rules.map((rule) => (rule.id === selectedRule.id ? { ...rule, mode: value } : rule));
											rulesDirty = true;
										}}
									>
										<option value="ro">Read only</option>
										<option value="rw">Read write</option>
									</NativeSelect.NativeSelect>
									<label class="flex items-center gap-2 text-sm">
										<input
											type="checkbox"
											checked={selectedRule.enabled}
											onchange={(event) => {
												const checked = (event.currentTarget as HTMLInputElement).checked;
												rules = rules.map((rule) => (rule.id === selectedRule.id ? { ...rule, enabled: checked } : rule));
												rulesDirty = true;
											}}
										/>
										Enabled
									</label>
								</div>
							</div>
						{:else}
							No rule selected.
						{/if}
						<div class="flex flex-wrap gap-2">
							<Button variant="outline" onclick={addRule}>
								<PlusIcon class="size-4" />
								Add rule
							</Button>
							<Button variant="outline" disabled={!selectedRule} onclick={duplicateRule}>
								<PlusIcon class="size-4" />
								Duplicate
							</Button>
							<Button variant="outline" disabled={selectedRuleIndex <= 0} onclick={() => moveRule(-1)}>
								<ArrowUpIcon class="size-4" />
								Move up
							</Button>
							<Button
								variant="outline"
								disabled={selectedRuleIndex < 0 || selectedRuleIndex >= rules.length - 1}
								onclick={() => moveRule(1)}
							>
								<ArrowDownIcon class="size-4" />
								Move down
							</Button>
							<Button variant="outline" disabled={!selectedRule} onclick={removeRule}>
								<Trash2Icon class="size-4" />
								Delete
							</Button>
							<Button disabled={!rulesDirty || rulesSaving} onclick={() => void persistRules()}>
								<SaveIcon class="size-4" />
								{rulesSaving ? 'Applying…' : 'Apply rules'}
							</Button>
						</div>
					</div>
				{:else if mode === 'cli'}
					{#if cliLoading}
						<div class="grid min-h-[clamp(10rem,26vh,16rem)] place-items-center rounded-[0.9rem] bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--muted),transparent_18%),transparent_72%)] px-4 py-6 text-center text-sm text-muted-foreground">
							<div class="grid max-w-[16rem] gap-2">
								<SearchIcon class="mx-auto size-6 text-muted-foreground/70" />
								<div class="font-medium text-foreground">Loading command detail…</div>
								<div class="text-xs leading-5 text-muted-foreground">Waiting for the grouped CLI catalog to finish loading.</div>
							</div>
						</div>
					{:else if !selectedCliEntry}
						<div class="grid min-h-[clamp(10rem,26vh,16rem)] place-items-center rounded-[0.9rem] bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--muted),transparent_18%),transparent_72%)] px-4 py-6 text-center text-sm text-muted-foreground">
							<div class="grid max-w-[16rem] gap-2">
								<SearchIcon class="mx-auto size-6 text-muted-foreground/70" />
								<div class="font-medium text-foreground">Select one command to inspect its detail hint.</div>
								<div class="text-xs leading-5 text-muted-foreground">Builtins point back to `help`, while runtime and workspace commands point back to `--help`.</div>
							</div>
						</div>
					{:else}
						<div class="grid gap-3 rounded-[0.9rem] bg-muted/24 px-4 py-4 text-sm">
							<div class="grid gap-1">
								<code class="w-fit rounded bg-background px-2 py-1 text-[11px] font-semibold md:text-xs">{selectedCliEntry.commandLabel}</code>
								{#if selectedCliEntry.displayName !== selectedCliEntry.commandLabel}
									<div class="font-semibold">{selectedCliEntry.displayName}</div>
								{/if}
								<div class="text-muted-foreground">{selectedCliEntry.description}</div>
							</div>
							{#if selectedCliEntry.detailHint}
								<div class="grid gap-1 rounded-[0.8rem] border border-border/60 bg-background/70 px-3 py-2.5">
									<div class="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Detail hint</div>
									<code class="break-all text-[11px] md:text-xs">{selectedCliEntry.detailHint}</code>
								</div>
							{/if}
							{#if selectedCliRuntimeNotice}
								<div class="grid gap-1 rounded-[0.8rem] border border-amber-500/30 bg-amber-500/8 px-3 py-2.5 text-xs text-amber-950 dark:text-amber-100">
									<div class="font-semibold">{selectedCliRuntimeNotice.title}</div>
									<div>{selectedCliRuntimeNotice.description}</div>
								</div>
							{/if}
							{#if workspaceShellError}
								<div class="grid gap-1 rounded-[0.8rem] border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-xs text-destructive">
									<div class="font-semibold">Shell launch failed.</div>
									<div>{workspaceShellError}</div>
								</div>
							{/if}
							<div class="flex flex-wrap gap-2">
								{#if selectedCliGroup}
									<Badge variant="outline">{selectedCliGroup.title}</Badge>
								{/if}
								{#if selectedCliEntry.metadataState === 'fallback'}
									<Badge variant="secondary">Fallback metadata</Badge>
								{/if}
								{#if selectedCliEntry.toolFileName}
									<Badge variant="outline">{selectedCliEntry.toolFileName}</Badge>
								{/if}
								{#if selectedCliNeedsRootRuntime && !selectedRootRuntimeRunning}
									<Badge variant="outline">{selectedRootRuntimeStarting ? 'runtime starting' : 'runtime stopped'}</Badge>
								{/if}
							</div>
							<div class="flex flex-wrap gap-2">
								<Button
									data-testid="workspace-cli-open-shell-button"
									disabled={!selectedCliShellLaunch || workspaceShellPreparing}
									onclick={() => void openCliShellDialog()}
								>
									<PlayIcon class="size-4" />
									{selectedCliRunLabel}
								</Button>
								{#if selectedCliShellLaunch}
									<Badge variant="outline">{selectedCliShellLaunch.surface}</Badge>
								{/if}
							</div>
						</div>
					{/if}
				{:else if mode === 'private'}
					<div class="grid gap-4">
						<div class="grid gap-3 rounded-[0.9rem] bg-muted/24 px-4 py-4 text-sm">
							<div class="grid gap-1">
								<div class="font-semibold">Create private asset</div>
								<div class="text-muted-foreground">New private files and folders are scoped to the selected avatar lens.</div>
							</div>
							<div class="grid gap-2.5">
								<Input bind:value={privateAssetName} placeholder="New private asset name" />
								<NativeSelect.NativeSelect bind:value={privateAssetKind}>
									<option value="file">File</option>
									<option value="directory">Directory</option>
								</NativeSelect.NativeSelect>
							</div>
							<div class="flex flex-wrap gap-2">
								<Button disabled={privateAssetBusy || privateAssetName.trim().length === 0} onclick={() => void createPrivateAsset()}>
									<FolderPlusIcon class="size-4" />
									{privateAssetBusy ? 'Creating…' : 'Create private asset'}
								</Button>
								{#if assetRoots}
									<Badge variant="outline">{assetRoots.privateRoots.memory}</Badge>
								{/if}
							</div>
						</div>
						{@render workspacePreviewDetail()}
					</div>
				{:else if mode === 'explorer'}
					<div class="grid gap-4">
						<div class="grid gap-3 rounded-[0.9rem] bg-muted/24 px-4 py-4 text-sm">
							<div class="grid gap-1">
								<div class="font-semibold">
									{selectedExplorerPath ? `Stage rule for ${selectedExplorerPath}` : 'Select one path to stage a quick rule.'}
								</div>
								<div class="text-muted-foreground">
									Quick edit only stages one rule; the full catalog still lives in Rules mode.
								</div>
							</div>
							<div class="flex flex-wrap items-center gap-2">
								<NativeSelect.NativeSelect
									bind:value={quickRuleMode}
									class="min-w-36"
									aria-label="Quick rule access mode"
									title={quickRuleMode === 'ro' ? 'Read only' : 'Read write'}
								>
									<option value="ro">Read only</option>
									<option value="rw">Read write</option>
								</NativeSelect.NativeSelect>
								<Button variant="outline" disabled={!selectedExplorerPath} onclick={stageQuickRule}>
									<PlusIcon class="size-4" />
									Stage rule
								</Button>
								<Button disabled={!rulesDirty || rulesSaving} onclick={() => void persistRules()}>
									<SaveIcon class="size-4" />
									{rulesSaving ? 'Applying…' : 'Apply rules'}
								</Button>
							</div>
						</div>
						{@render workspacePreviewDetail()}
					</div>
				{:else}
					{@render workspacePreviewDetail()}
				{/if}
			</WorkbenchDetailDrawer>
	{/snippet}
	</WorkbenchPageContent>
	{/if}
</div>

<style>
	.workspace-route-page-content,
	:global(.workspace-route-main),
	:global(.workspace-route-drawer),
	.workspace-route-list-card,
	.workspace-route-list-card-content {
		min-block-size: 0;
		min-inline-size: 0;
	}
</style>

<WorkspaceShellDialog
	bind:open={workspaceShellOpen}
	launch={workspaceShellLaunch}
	launchKey={workspaceShellLaunchKey}
	onExec={async (input) =>
		await controller.runtimeStore.execRuntimeWorkspace({
			avatar: input.avatar,
			command: input.command,
			cwd: input.cwd,
			runtimeId: input.runtimeId,
			surface: input.surface,
			workspacePath: input.workspacePath,
		})}
/>
