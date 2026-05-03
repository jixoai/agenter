<script lang="ts">
	import FileClockIcon from '@lucide/svelte/icons/file-clock';
	import MoveDiagonal2Icon from '@lucide/svelte/icons/move-diagonal-2';
	import SendHorizontalIcon from '@lucide/svelte/icons/send-horizontal';
	import { resolveAsyncSurfaceState, type ToolInvocationView } from '@agenter/web-components';
	import { flushSync, tick, untrack } from 'svelte';

	import { Scaffold } from '@agenter/svelte-components';
	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import AsyncSurface from '$lib/components/web-components/async-surface.svelte';
	import ToolInvocationCard from '$lib/components/web-components/tool-invocation-card.svelte';
	import ActorSelect from '$lib/features/collaboration/actor-select.svelte';
	import type { ActorSelectItem } from '$lib/features/collaboration/actor-select.types';
	import WorkbenchPageContent from '$lib/features/navigation/workbench-page-content.svelte';
	import WorkbenchPageToolbar from '$lib/features/navigation/workbench-page-toolbar.svelte';
	import WorkbenchScaffold from '$lib/features/navigation/workbench-scaffold.svelte';
	import * as InputGroup from '$lib/components/ui/input-group/index.js';
	import NoticeBanner from '$lib/components/ui/notice-banner.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';

	import TerminalPageToolbarContent from './terminal-page-toolbar-content.svelte';
	import TerminalUsersDialog from './terminal-users-dialog.svelte';
	import TerminalWindowSurface from './terminal-window-surface.svelte';
	import {
		isTerminalRunning,
		resolveTerminalIdentitySubtitle,
		resolveTerminalInstanceName,
		resolveTerminalTransportLabel,
	} from './terminal-display';
	import type {
		TerminalLifecycleAction,
		TerminalLifecycleIntent,
		TerminalSystemNotice,
		TerminalSystemSurfaceProps,
	} from './terminal-system-surface.types';

	let {
		selectedTerminal,
		terminalViewportComponent,
		selectedTransportUrl,
		terminalApprovalsState,
		terminalActivityState,
		routeNotice,
		selectableActors,
		callAsOptions,
		selectedCallerToken,
		seatStates,
		onChangeCallerToken,
		onBootstrapTerminal,
		onStopTerminal,
		onDeleteTerminal,
		onGrantSeat,
		onToggleSeatFocus,
		onRevokeSeat,
		onApproveRequest,
		onDenyRequest,
		onWriteToolCall,
		onReadToolCall,
		onResizeToolCall,
		onPresentationConfigChange,
	}: TerminalSystemSurfaceProps = $props();

	let deleteBusy = $state(false);
	let lifecycleBusy = $state(false);
	let lifecycleIntent = $state<TerminalLifecycleIntent | null>(null);
	let deleteDialogOpen = $state(false);
	let stopDialogOpen = $state(false);
	let actionToolTab: 'write' | 'read' | 'resize' = $state('write');
	let actionsDetailOpen = $state(true);
	let usersDialogOpen = $state(false);
	let grantParticipantId = $state('');
	let grantRole: 'admin' | 'writer' | 'requester' | 'readonly' = $state('writer');
	let grantBusy = $state(false);
	let grantError: string | null = $state(null);
	let writeText = $state('');
	let writeBusy = $state(false);
	let readMode: 'auto' | 'diff' | 'snapshot' = $state('snapshot');
	let readBusy = $state(false);
	let resizeCols = $state('');
	let resizeRows = $state('');
	let resizeBusy = $state(false);
	let viewportModeByTerminalId = $state<Record<string, 'fit' | 'cover'>>({});
	let liveViewportSizeByTerminalId = $state<Record<string, { width: number; height: number; cols: number; rows: number }>>({});
	let actionsPanelRef: HTMLElement | null = $state(null);
	let detailRailCompact = $state(false);
	let lastSelectedTerminalId = $state<string | null>(null);
	let lastResizeFormSeed = $state<{ terminalId: string; cols: number; rows: number } | null>(null);
	type TerminalActionEvent = TerminalSystemSurfaceProps['terminalActivityState']['data'][number];

	const TERMINAL_SURFACE_SPLIT_RATIO_PERSISTENCE = 'terminal-system:surface';
	const TERMINAL_SURFACE_SPLIT_LEFT_MIN = 380;
	const TERMINAL_SURFACE_SPLIT_RIGHT_MIN = 280;
	const TERMINAL_SURFACE_SPLIT_DEFAULT_RATIO = 0.625;

	const actionEvents = $derived.by(() =>
		[...terminalActivityState.data].sort((left, right) => {
			if (left.createdAt !== right.createdAt) {
				return right.createdAt - left.createdAt;
			}
			return right.id - left.id;
		}),
	);
	const actionsSurfaceState = $derived(
		resolveAsyncSurfaceState({
			loading: terminalActivityState.loading && !terminalActivityState.loaded,
			hasData: actionEvents.length > 0,
		}),
	);
	const effectiveCallerToken = $derived(selectedCallerToken ?? callAsOptions[0]?.accessToken ?? null);
	const TerminalViewport = $derived(terminalViewportComponent);
	const callAsItems = $derived(
		callAsOptions.map((option) => ({
			value: option.accessToken,
			label: option.label,
			subtitle: option.subtitle ?? [option.role, option.participantId].filter(Boolean).join(' · '),
			iconUrl: option.iconUrl ?? null,
		})) satisfies ActorSelectItem[],
	);
	const selectedCallAsItem = $derived(
		callAsItems.find((item) => item.value === effectiveCallerToken) ?? (callAsItems[0] ?? null),
	);
	const readModeItems: { value: 'auto' | 'diff' | 'snapshot'; label: string }[] = [
		{ value: 'auto', label: 'auto' },
		{ value: 'diff', label: 'diff' },
		{ value: 'snapshot', label: 'snapshot' },
	];
	const selectedReadModeLabel = $derived(
		readModeItems.find((item) => item.value === readMode)?.label ?? 'snapshot',
	);
	const readModeDescription = $derived.by(() => {
		switch (readMode) {
			case 'auto':
				return 'Let the runtime choose the most useful terminal representation for the active seat.';
			case 'diff':
				return 'Read only the latest terminal delta instead of a full snapshot.';
			default:
				return 'Request the latest terminal snapshot for the active seat.';
		}
	});
	const selectedViewportMode = $derived(
		selectedTerminal ? (viewportModeByTerminalId[selectedTerminal.terminalId] ?? 'fit') : 'fit',
	);
	const selectedLiveViewportSize = $derived(selectedTerminal ? (liveViewportSizeByTerminalId[selectedTerminal.terminalId] ?? null) : null);
	const selectedResizeGeometry = $derived.by(() => {
		if (!selectedTerminal) {
			return null;
		}
		return {
			terminalId: selectedTerminal.terminalId,
			cols: selectedLiveViewportSize?.cols ?? selectedTerminal.snapshot?.cols ?? 80,
			rows: selectedLiveViewportSize?.rows ?? selectedTerminal.snapshot?.rows ?? 24,
		};
	});
	const effectiveTransportUrl = $derived(selectedTransportUrl ?? selectedTerminal?.transportUrl ?? null);
	const selectedTransportLabel = $derived(
		selectedTerminal ? resolveTerminalTransportLabel(selectedTerminal) : 'No transport discovery',
	);
	const seatStateByActorId = $derived(
		new Map(seatStates.map((seat) => [seat.actorId, seat] as const)),
	);
	const latestActionEventId = $derived(actionEvents[0]?.id ?? null);
	const actionsPanelDescription = $derived.by(() => {
		if (actionEvents.length > 0) {
			return `${actionEvents.length} recent terminal facts rendered through the shared tool invocation surface.`;
		}
		return 'Terminal reads and writes render as durable tool facts.';
	});

	const formatTimestamp = (value?: number): string => {
		if (!value) {
			return 'unknown';
		}
		return new Date(value).toLocaleString();
	};

	const stringifyDetail = (value: unknown): string | null => {
		if (value === undefined) {
			return null;
		}
		if (typeof value === 'string') {
			return value;
		}
		try {
			return JSON.stringify(value, null, 2);
		} catch {
			return String(value);
		}
	};

	const describeTerminalError = (error: unknown, fallback: string): TerminalSystemNotice => ({
		tone: 'destructive',
		message: error instanceof Error ? error.message : fallback,
	});

	const handleDeleteTerminal = async (): Promise<void> => {
		if (!selectedTerminal || deleteBusy) {
			return;
		}
		deleteBusy = true;
		try {
			await onDeleteTerminal();
			deleteDialogOpen = false;
		} finally {
			deleteBusy = false;
		}
	};

	const handleBootstrapTerminal = async (): Promise<void> => {
		if (!selectedTerminal || lifecycleBusy) {
			return;
		}
		lifecycleBusy = true;
		lifecycleIntent = 'bootstrap';
		try {
			await onBootstrapTerminal();
			routeNotice = null;
		} catch (error) {
			routeNotice = describeTerminalError(error, 'terminal bootstrap failed');
		} finally {
			lifecycleBusy = false;
			lifecycleIntent = null;
		}
	};

	const handleStopTerminal = async (): Promise<void> => {
		if (!selectedTerminal || lifecycleBusy) {
			return;
		}
		lifecycleBusy = true;
		lifecycleIntent = 'stop';
		try {
			await onStopTerminal();
			routeNotice = null;
		} catch (error) {
			routeNotice = describeTerminalError(error, 'terminal stop failed');
		} finally {
			lifecycleBusy = false;
			lifecycleIntent = null;
		}
	};

	const handleRequestLifecycleAction = (action: TerminalLifecycleAction): void => {
		if (!selectedTerminal || lifecycleBusy) {
			return;
		}
		if (action === 'stop') {
			stopDialogOpen = true;
			return;
		}
		void handleBootstrapTerminal();
	};

	const handleRequestDeleteTerminal = (): void => {
		if (!selectedTerminal || deleteBusy) {
			return;
		}
		deleteDialogOpen = true;
	};

	const handleToggleViewportMode = (): void => {
		if (!selectedTerminal) {
			return;
		}
		const nextMode = selectedViewportMode === 'cover' ? 'fit' : 'cover';
		viewportModeByTerminalId = {
			...viewportModeByTerminalId,
			[selectedTerminal.terminalId]: nextMode,
		};
	};

	const clampResizeValue = (value: string, fallback: number): number => {
		const parsed = Number.parseInt(value, 10);
		if (!Number.isFinite(parsed)) {
			return fallback;
		}
		return Math.max(1, parsed);
	};

	const projectResizeGeometry = (input: {
		terminalId: string;
		cols: number;
		rows: number;
	}): void => {
		const current = untrack(() => {
			const formCols = Number.parseInt(resizeCols, 10);
			const formRows = Number.parseInt(resizeRows, 10);
			return {
				formCols,
				formRows,
				seed: lastResizeFormSeed,
			};
		});
		const seedMatchesInput =
			current.seed?.terminalId === input.terminalId &&
			current.seed.cols === input.cols &&
			current.seed.rows === input.rows;
		if (seedMatchesInput) {
			return;
		}
		const formMatchesSeed =
			Number.isFinite(current.formCols) &&
			Number.isFinite(current.formRows) &&
			current.seed?.terminalId === input.terminalId &&
			current.formCols === current.seed.cols &&
			current.formRows === current.seed.rows;
		const shouldReplaceForm = current.seed?.terminalId !== input.terminalId || formMatchesSeed;
		lastResizeFormSeed = input;
		if (!shouldReplaceForm) {
			return;
		}
		resizeCols = String(input.cols);
		resizeRows = String(input.rows);
	};

	const handleGrantSeat = async (): Promise<void> => {
		if (!selectedTerminal || grantBusy || grantParticipantId.length === 0) {
			return;
		}
		grantBusy = true;
		grantError = null;
		try {
			await onGrantSeat({
				participantId: grantParticipantId,
				role: grantRole,
			});
			grantParticipantId = '';
		} catch (error) {
			grantError = error instanceof Error ? error.message : String(error);
		} finally {
			grantBusy = false;
		}
	};

	const handleWriteToolCall = async (): Promise<void> => {
		if (!selectedTerminal || !effectiveCallerToken || !writeText.trim() || writeBusy) {
			return;
		}
		flushSync();
		const draft = writeText;
		if (!draft.trim()) {
			return;
		}
		writeBusy = true;
		try {
			const result = await onWriteToolCall({ text: draft });
			if (result?.ok) {
				writeText = '';
			}
		} finally {
			writeBusy = false;
		}
	};

	const handleReadToolCall = async (): Promise<void> => {
		if (!selectedTerminal || !effectiveCallerToken || readBusy) {
			return;
		}
		readBusy = true;
		try {
			await onReadToolCall({ mode: readMode });
		} finally {
			readBusy = false;
		}
	};

	const handleResizeToolCall = async (): Promise<void> => {
		if (!selectedTerminal || resizeBusy) {
			return;
		}
		const fallbackCols = selectedTerminal.snapshot?.cols ?? 80;
		const fallbackRows = selectedTerminal.snapshot?.rows ?? 24;
		const cols = clampResizeValue(resizeCols, fallbackCols);
		const rows = clampResizeValue(resizeRows, fallbackRows);
		resizeBusy = true;
		try {
			const result = await onResizeToolCall({ cols, rows });
			if (result?.ok) {
				resizeCols = String(result.cols);
				resizeRows = String(result.rows);
				lastResizeFormSeed = selectedTerminal
					? {
							terminalId: selectedTerminal.terminalId,
							cols: result.cols,
							rows: result.rows,
						}
					: null;
			}
		} finally {
			resizeBusy = false;
		}
	};

	const resolveActionToolName = (kind: string): string => {
		if (kind === 'terminal_write') {
			return 'terminal.write';
		}
		if (kind === 'terminal_read') {
			return 'terminal.read';
		}
		if (kind === 'terminal_resize') {
			return 'terminal.resize';
		}
		return kind;
	};

	const toActionInvocation = (event: TerminalActionEvent): ToolInvocationView => {
		const detailText = stringifyDetail(event.detail);
		if (event.kind === 'terminal_read') {
			const representation =
				event.detail && typeof event.detail === 'object' && !Array.isArray(event.detail)
					? ((event.detail as { representation?: string }).representation ?? 'snapshot')
					: 'snapshot';
			return {
				invocationId: `${event.terminalId}:${event.id}`,
				toolName: resolveActionToolName(event.kind),
				status: 'success',
				call: {
					value:
						event.detail && typeof event.detail === 'object' && !Array.isArray(event.detail)
							? { mode: representation }
							: { mode: 'snapshot' },
				},
				result: {
					value: event.detail ?? event.content,
					rawText: detailText ?? event.content,
				},
				meta: {
					title: event.title,
					actorId: event.actorId,
				},
				startedAt: event.createdAt,
				finishedAt: event.createdAt,
			};
		}
		if (event.kind === 'terminal_resize') {
			const resizeDetail =
				event.detail && typeof event.detail === 'object' && !Array.isArray(event.detail)
					? (event.detail as { cols?: number | null; rows?: number | null })
					: {};
			return {
				invocationId: `${event.terminalId}:${event.id}`,
				toolName: resolveActionToolName(event.kind),
				status: 'success',
				call: {
					value: {
						cols: resizeDetail.cols ?? null,
						rows: resizeDetail.rows ?? null,
					},
				},
				result: {
					value: event.detail ?? event.content,
					rawText: detailText ?? event.content,
				},
				meta: {
					title: event.title,
					actorId: event.actorId,
				},
				startedAt: event.createdAt,
				finishedAt: event.createdAt,
			};
		}
		return {
			invocationId: `${event.terminalId}:${event.id}`,
			toolName: resolveActionToolName(event.kind),
			status: 'success',
			call: {
				value:
					event.detail && typeof event.detail === 'object' && !Array.isArray(event.detail)
						? {
								text: event.content,
								...(event.detail as Record<string, unknown>),
							}
						: { text: event.content },
				rawText: event.content,
			},
			meta: {
				title: event.title,
				actorId: event.actorId,
			},
			startedAt: event.createdAt,
			finishedAt: event.createdAt,
		};
	};

	const actionCards = $derived(
		actionEvents.map((event) => {
			const seat = event.actorId ? seatStateByActorId.get(event.actorId) : null;
			return {
				event,
				invocation: toActionInvocation(event),
				actorLabel: seat?.label ?? event.actorId ?? event.terminalId,
				actorIconUrl: seat?.iconUrl ?? null,
			};
		}),
	);

	$effect(() => {
		const actionEventId = latestActionEventId;
		if (usersDialogOpen || !actionsPanelRef || actionEventId === null) {
			return;
		}

		void tick().then(() => {
			const viewport = actionsPanelRef?.querySelector<HTMLElement>('[data-scroll-view-viewport]');
			viewport?.scrollTo({ top: 0, behavior: 'auto' });
		});
	});

	$effect(() => {
		const nextTerminalId = selectedTerminal?.terminalId ?? null;
		if (nextTerminalId) {
			if (lastSelectedTerminalId !== nextTerminalId) {
				const nextGeometry = selectedResizeGeometry;
				if (nextGeometry) {
					projectResizeGeometry(nextGeometry);
				}
			}
			lastSelectedTerminalId = nextTerminalId;
			return;
		}
		lifecycleBusy = false;
		lifecycleIntent = null;
		deleteDialogOpen = false;
		stopDialogOpen = false;
		usersDialogOpen = false;
		if (lastSelectedTerminalId !== null) {
			actionsDetailOpen = false;
			lastSelectedTerminalId = null;
		}
		lastResizeFormSeed = null;
		resizeCols = '';
		resizeRows = '';
	});

	$effect(() => {
		const geometry = selectedResizeGeometry;
		if (!geometry) {
			return;
		}
		projectResizeGeometry(geometry);
	});
</script>

{#if selectedTerminal}
	<WorkbenchPageToolbar>
		<TerminalPageToolbarContent
			{selectedTerminal}
			actionsOpen={actionsDetailOpen}
			usersOpen={usersDialogOpen}
			{lifecycleBusy}
			{lifecycleIntent}
			{deleteBusy}
			onToggleActions={() => {
				usersDialogOpen = false;
				actionsDetailOpen = !actionsDetailOpen;
			}}
			onOpenUsers={() => {
				usersDialogOpen = true;
			}}
			onRequestLifecycleAction={handleRequestLifecycleAction}
			onDeleteTerminal={handleRequestDeleteTerminal}
		/>
	</WorkbenchPageToolbar>
{/if}

{#snippet terminalCallerSelectInline()}
	<ActorSelect
		ariaLabel="Call tool as"
		items={callAsItems}
		value={effectiveCallerToken}
		selectedItem={selectedCallAsItem}
		placeholder="No seat token"
		disabled={callAsItems.length === 0}
		density="compact"
		chrome="borderless"
		showTriggerSubtitle={false}
		showMenuSubtitle
		class="w-full"
		onValueChange={(value) => {
			onChangeCallerToken(value);
		}}
	/>
{/snippet}

{#snippet terminalReadModeField()}
	<Select.Root
		type="single"
		items={readModeItems}
		value={readMode}
		onValueChange={(value) => {
			readMode = value as typeof readMode;
		}}
	>
		<Select.Trigger
			id="terminal-read-mode-select"
			aria-label="Read mode"
			data-testid="terminal-read-parameter-mode"
			class="w-full justify-between rounded-[1rem] border border-border/60 bg-background/90 px-3 py-2 text-left text-sm font-medium shadow-none hover:bg-background focus-visible:ring-2 focus-visible:ring-ring/40"
		>
			{selectedReadModeLabel}
		</Select.Trigger>
		<Select.Content>
			{#each readModeItems as item (item.value)}
				<Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
			{/each}
		</Select.Content>
	</Select.Root>
{/snippet}

{#snippet terminalWriteInputGroup()}
	<InputGroup.Root layout="block" data-testid="terminal-write-input-group">
		<InputGroup.Textarea
			bind:value={writeText}
			class="min-h-28 resize-none px-4 py-3 text-sm"
			placeholder={selectedTerminal && !isTerminalRunning(selectedTerminal) ? 'Bootstrap the PTY before writing…' : 'Type terminal input…'}
			disabled={!selectedTerminal || !isTerminalRunning(selectedTerminal)}
			data-testid="terminal-write-draft"
		/>
		<InputGroup.Addon
			align="block-end"
			class="flex flex-wrap items-center justify-between gap-2 border-border/60 bg-muted/25 px-3 py-2.5"
		>
			<div class="min-w-0 flex-1 basis-56">
				{@render terminalCallerSelectInline()}
			</div>
			<Button
				data-testid="terminal-write-submit"
				class="w-full sm:w-auto"
				disabled={!selectedTerminal || !isTerminalRunning(selectedTerminal) || !effectiveCallerToken || !writeText.trim() || writeBusy}
				onclick={() => void handleWriteToolCall()}
			>
				<SendHorizontalIcon class="size-4" />
				Call tool
			</Button>
		</InputGroup.Addon>
	</InputGroup.Root>
{/snippet}

{#snippet terminalReadInputGroup()}
	<InputGroup.Root layout="block" data-testid="terminal-read-input-group">
		<div
			class="grid gap-3 border-b border-border/60 bg-muted/15 px-4 py-3"
			data-testid="terminal-read-parameter-panel"
		>
			<div class="grid gap-1">
				<div class="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
					Read terminal state
				</div>
				<p class="text-sm text-muted-foreground">{readModeDescription}</p>
			</div>
			<div class="grid gap-1.5 sm:max-w-56">
				<label class="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase" for="terminal-read-mode-select">
					Mode
				</label>
				{@render terminalReadModeField()}
			</div>
		</div>
		<InputGroup.Addon
			align="block-end"
			class="flex flex-wrap items-center justify-between gap-2 border-border/60 bg-muted/25 px-3 py-2.5"
		>
			<div class="min-w-0 flex-1 basis-44">
				{@render terminalCallerSelectInline()}
			</div>
			<Button
				data-testid="terminal-read-submit"
				class="w-full sm:w-auto"
				disabled={!selectedTerminal || !isTerminalRunning(selectedTerminal) || !effectiveCallerToken || readBusy}
				onclick={() => void handleReadToolCall()}
			>
				<FileClockIcon class="size-4" />
				Call read
			</Button>
		</InputGroup.Addon>
	</InputGroup.Root>
{/snippet}

{#snippet terminalResizeInputGroup()}
	<InputGroup.Root layout="block" data-testid="terminal-resize-input-group">
		<div class="grid gap-3 border-b border-border/60 bg-muted/15 px-4 py-3" data-testid="terminal-resize-parameter-panel">
			<div class="grid gap-1">
				<div class="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
					Resize terminal geometry
				</div>
				<p class="text-sm text-muted-foreground">
					This updates the terminal's durable cols and rows. Running PTYs apply it live when allowed, and stopped PTYs use it on the next bootstrap.
				</p>
				<p class="text-xs text-muted-foreground">
					Drag resize previews geometry through live transport first. Apply resize is the explicit durable mutation path.
				</p>
			</div>
			<div class="grid gap-3 sm:grid-cols-2">
				<div class="grid gap-1.5">
					<label class="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase" for="terminal-resize-cols-input">
						Cols
					</label>
					<InputGroup.Input
						id="terminal-resize-cols-input"
						type="number"
						min="1"
						step="1"
						bind:value={resizeCols}
						data-testid="terminal-resize-cols"
					/>
				</div>
				<div class="grid gap-1.5">
					<label class="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase" for="terminal-resize-rows-input">
						Rows
					</label>
					<InputGroup.Input
						id="terminal-resize-rows-input"
						type="number"
						min="1"
						step="1"
						bind:value={resizeRows}
						data-testid="terminal-resize-rows"
					/>
				</div>
			</div>
		</div>
		<InputGroup.Addon
			align="block-end"
			class="flex flex-wrap items-center justify-between gap-2 border-border/60 bg-muted/25 px-3 py-2.5"
		>
			<div class="text-xs text-muted-foreground">
				{#if selectedTerminal?.snapshot}
					<div data-testid="terminal-current-snapshot">
						Current snapshot: {selectedTerminal.snapshot.cols}x{selectedTerminal.snapshot.rows}
					</div>
				{/if}
				{#if selectedLiveViewportSize}
					<div data-testid="terminal-live-resize-hint">Live frame: {selectedLiveViewportSize.width}x{selectedLiveViewportSize.height}px</div>
				{/if}
			</div>
			<Button
				data-testid="terminal-resize-submit"
				class="w-full sm:w-auto"
				disabled={!selectedTerminal || resizeBusy}
				onclick={() => void handleResizeToolCall()}
			>
				<MoveDiagonal2Icon class="size-4" />
				Apply resize
			</Button>
		</InputGroup.Addon>
	</InputGroup.Root>
{/snippet}

{#snippet terminalActionsPanel()}
	<div class="grid gap-3" data-testid="terminal-actions-panel">
		<Tabs.Root bind:value={actionToolTab}>
			<Tabs.List class="grid w-full grid-cols-3">
				<Tabs.Trigger value="write">Write</Tabs.Trigger>
				<Tabs.Trigger value="read">Read</Tabs.Trigger>
				<Tabs.Trigger value="resize">Resize</Tabs.Trigger>
			</Tabs.List>

			<Tabs.Content value="write" class="mt-3">
				{@render terminalWriteInputGroup()}
			</Tabs.Content>

			<Tabs.Content value="read" class="mt-3">
				{@render terminalReadInputGroup()}
			</Tabs.Content>

			<Tabs.Content value="resize" class="mt-3">
				{@render terminalResizeInputGroup()}
			</Tabs.Content>
		</Tabs.Root>
	</div>
{/snippet}

{#snippet terminalStagePanel()}
	<WorkbenchScaffold
		tone="page"
		body="scroll"
		contentClass="grid gap-4 px-2 py-2 sm:px-3 sm:py-3"
		data-testid="terminal-stage-pane"
	>
		{#if selectedTerminal}
			<div class="grid gap-4">
				{#if routeNotice}
					<NoticeBanner tone={routeNotice.tone} message={routeNotice.message} />
				{/if}
					<div class="grid gap-3">
					<TerminalWindowSurface
						terminal={selectedTerminal}
						terminalViewportComponent={TerminalViewport}
						transportUrl={effectiveTransportUrl}
						viewportMode={selectedViewportMode}
						{lifecycleBusy}
						{lifecycleIntent}
						onRequestLifecycleAction={handleRequestLifecycleAction}
						onToggleViewportMode={handleToggleViewportMode}
						onPresentationConfigChange={onPresentationConfigChange}
						onLiveResize={({ width, height, cols, rows }) => {
							liveViewportSizeByTerminalId = {
								...liveViewportSizeByTerminalId,
								[selectedTerminal.terminalId]: { width, height, cols, rows },
							};
						}}
					/>
					<div class="grid gap-2 text-xs text-muted-foreground">
						<div>Launch cwd: {selectedTerminal.launchCwd}</div>
						<div>
							Observed path: {selectedTerminal.currentPath ?? 'not currently observed'}
						</div>
						<div>
							Projection mode: {selectedViewportMode === 'cover' ? 'cover window' : 'fit window'}
						</div>
						<div>Transport: {selectedTransportLabel}</div>
					</div>
				</div>
				{@render terminalActionsPanel()}
			</div>
		{:else}
			<div class="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
				Select a terminal tab.
			</div>
		{/if}
	</WorkbenchScaffold>
{/snippet}

<Dialog.Root bind:open={deleteDialogOpen}>
	<Dialog.Content
		class="max-w-md gap-0 rounded-[1.5rem] border-white/60 bg-[linear-gradient(180deg,rgba(252,252,253,0.96),rgba(236,240,246,0.92))] p-0 shadow-[0_28px_72px_rgba(15,23,42,0.22),0_1px_0_rgba(255,255,255,0.6)_inset] backdrop-blur-2xl"
		showCloseButton={false}
		data-testid="terminal-delete-confirm-dialog"
	>
		<div class="grid gap-0">
			<Dialog.Header class="border-b border-slate-200/85 px-6 py-5">
				<Dialog.Title class="text-base font-semibold text-slate-900">Delete terminal?</Dialog.Title>
				<Dialog.Description class="text-sm text-slate-600">
					This closes the shared terminal window and removes its catalog entry.
					{#if selectedTerminal}
						<span class="mt-2 block rounded-[0.85rem] border border-white/70 bg-white/75 px-3 py-2 text-xs text-slate-500 shadow-[0_1px_0_rgba(255,255,255,0.65)_inset]">
							{resolveTerminalInstanceName(selectedTerminal)}
							{#if resolveTerminalIdentitySubtitle(selectedTerminal)}
								· {resolveTerminalIdentitySubtitle(selectedTerminal)}
							{/if}
						</span>
					{/if}
				</Dialog.Description>
			</Dialog.Header>

			<Dialog.Footer class="border-t border-slate-200/80 px-6 py-4">
				<Button
					variant="outline"
					disabled={deleteBusy}
					onclick={() => {
						deleteDialogOpen = false;
					}}
				>
					Cancel
				</Button>
				<Button
					variant="destructive"
					disabled={deleteBusy}
					data-testid="terminal-delete-confirm-submit"
					onclick={() => void handleDeleteTerminal()}
				>
					{deleteBusy ? 'Deleting…' : 'Delete terminal'}
				</Button>
			</Dialog.Footer>
		</div>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={stopDialogOpen}>
	<Dialog.Content
		class="max-w-md gap-0 rounded-[1.5rem] border-white/60 bg-[linear-gradient(180deg,rgba(252,252,253,0.96),rgba(236,240,246,0.92))] p-0 shadow-[0_28px_72px_rgba(15,23,42,0.22),0_1px_0_rgba(255,255,255,0.6)_inset] backdrop-blur-2xl"
		showCloseButton={false}
		data-testid="terminal-stop-confirm-dialog"
	>
		<div class="grid gap-0">
			<Dialog.Header class="border-b border-slate-200/85 px-6 py-5">
				<Dialog.Title class="text-base font-semibold text-slate-900">Kill terminal PTY?</Dialog.Title>
				<Dialog.Description class="text-sm text-slate-600">
					This stops the live PTY now but keeps the terminal entry and durable launch configuration.
				</Dialog.Description>
			</Dialog.Header>

			<Dialog.Footer class="border-t border-slate-200/80 px-6 py-4">
				<Button
					variant="outline"
					disabled={lifecycleBusy}
					onclick={() => {
						stopDialogOpen = false;
					}}
				>
					Cancel
				</Button>
				<Button
					variant="destructive"
					disabled={lifecycleBusy}
					data-testid="terminal-stop-confirm-submit"
					onclick={() => {
						stopDialogOpen = false;
						void handleStopTerminal();
					}}
				>
					{lifecycleBusy && lifecycleIntent === 'stop' ? 'Killing…' : 'Kill PTY'}
				</Button>
			</Dialog.Footer>
		</div>
	</Dialog.Content>
</Dialog.Root>

<TerminalUsersDialog
	bind:open={usersDialogOpen}
	{selectedTerminal}
	terminalApprovals={terminalApprovalsState.data}
	{selectableActors}
	{seatStates}
	{grantParticipantId}
	{grantRole}
	{grantBusy}
	{grantError}
	{formatTimestamp}
	onGrantParticipantIdChange={(value) => {
		grantParticipantId = value;
		grantError = null;
	}}
	onGrantRoleChange={(value) => {
		grantRole = value;
	}}
	onGrantSeat={() => void handleGrantSeat()}
	onApproveRequest={onApproveRequest}
	onDenyRequest={onDenyRequest}
	onToggleSeatFocus={onToggleSeatFocus}
	onRevokeSeat={onRevokeSeat}
/>

{#snippet terminalActivityPanel()}
	<WorkbenchScaffold
		tone="page"
		bodyClass="h-full"
	>
		{#snippet header()}
			<div class="grid gap-1">
				<h2 class="text-base font-semibold">Actions</h2>
				<p class="text-sm text-muted-foreground">{actionsPanelDescription}</p>
			</div>
		{/snippet}

		<div bind:this={actionsPanelRef} class="grid h-full grid-rows-[minmax(0,1fr)]" data-terminal-detail-panel-view="actions">
			<AsyncSurface
				class="h-full"
				state={actionsSurfaceState}
				emptyLoadingLabel="Loading terminal actions…"
				loadingOverlayLabel="Refreshing terminal actions…"
			>
				{#snippet empty()}
					{#if terminalActivityState.error && terminalActivityState.data.length === 0}
						<div class="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
							{terminalActivityState.error}
						</div>
					{:else}
						<div class="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
							No terminal actions yet.
						</div>
					{/if}
				{/snippet}

				<Scaffold.ScrollBody class="h-full" contentClass="grid gap-3 px-0 py-4">
					{#each actionCards as action (action.event.id)}
						<div class="grid gap-3 rounded-2xl border p-3" data-testid={`terminal-action-card-${action.event.id}`}>
							<div class="flex items-center gap-3">
								<ProfileAvatar
									label={action.actorLabel}
									src={action.actorIconUrl}
									class="size-8"
								/>
								<div class="min-w-0">
									<div class="truncate text-sm font-semibold">{action.actorLabel}</div>
									<div class="truncate text-xs text-muted-foreground">
										{action.event.title} · {formatTimestamp(action.event.createdAt)}
									</div>
								</div>
							</div>
							<ToolInvocationCard invocation={action.invocation} />
						</div>
					{/each}
				</Scaffold.ScrollBody>
			</AsyncSurface>
		</div>
	</WorkbenchScaffold>
{/snippet}

<div
	class="h-full min-w-0"
	data-testid="terminal-system-surface"
	data-terminal-detail-layout={detailRailCompact ? 'sheet' : 'split'}
>
	<WorkbenchPageContent
		class="h-full min-w-0"
		mainClass="h-full min-w-0"
		drawerClass="h-full min-w-0"
		detailLayout="split-detail"
		bind:detailOpen={actionsDetailOpen}
		bind:detailCompact={detailRailCompact}
		detailRatioPersistence={TERMINAL_SURFACE_SPLIT_RATIO_PERSISTENCE}
		detailLeftMin={TERMINAL_SURFACE_SPLIT_LEFT_MIN}
		detailRightMin={TERMINAL_SURFACE_SPLIT_RIGHT_MIN}
		detailDefaultRatio={TERMINAL_SURFACE_SPLIT_DEFAULT_RATIO}
		detailCloseLabel="Close terminal actions"
	>
		{#snippet main()}
			{@render terminalStagePanel()}
		{/snippet}

		{#snippet drawer()}
			{@render terminalActivityPanel()}
		{/snippet}
	</WorkbenchPageContent>
</div>
