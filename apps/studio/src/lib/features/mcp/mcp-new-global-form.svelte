<script lang="ts">
	import type {
		McpInspectorCloseInput,
		McpInspectorCloseOutput,
		McpInspectorEvent,
		McpInspectorStartInput,
		McpInspectorStartOutput,
		McpProbeInput,
		McpProbeOutput,
	} from '@agenter/client-sdk';
	import HelpCircleIcon from '@lucide/svelte/icons/help-circle';
	import SaveIcon from '@lucide/svelte/icons/save';
	import TrashIcon from '@lucide/svelte/icons/trash';

	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as NativeSelect from '$lib/components/ui/native-select/index.js';
	import NoticeBanner from '$lib/components/ui/notice-banner.svelte';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import HelpHint from '$lib/components/web-components/help-hint.svelte';
	import { resolveAvatarHandle } from '$lib/features/avatars/avatar-identity-presentation';
	import ActorSelect from '$lib/features/collaboration/actor-select.svelte';
	import type { ActorSelectItem } from '$lib/features/collaboration/actor-select.types';

	import McpConfigInspectPanel from './mcp-config-inspect-panel.svelte';
	import { parseMcpDraftJson, serializeMcpDraft } from './mcp-draft-codec';
	import type {
		McpAvatarCatalogOption,
		McpConfigCatalogRow,
		McpGlobalConfigDraft,
		McpTransportKind,
		McpWorkbenchRow,
	} from './mcp-workbench-state';

	type EditorMode = 'form' | 'code';

	let {
		avatarOptions = [],
		knownConfigRows = [],
		ownerAvatarNickname = $bindable('default'),
		initialRow = null,
		pending = false,
		onBack,
		onOpenAvatar,
		onRemove,
		onSubmit,
		onProbe,
		onInspectorStart,
		onInspectorClose,
		onInspectorSubscribe,
	}: {
		avatarOptions?: readonly McpAvatarCatalogOption[];
		knownConfigRows?: readonly McpConfigCatalogRow[];
		ownerAvatarNickname?: string;
		initialRow?: McpWorkbenchRow | null;
		pending?: boolean;
		onBack?: () => void;
		onOpenAvatar?: (avatarNickname: string) => void;
		onRemove?: (row: McpWorkbenchRow) => Promise<void>;
		onSubmit: (draft: McpGlobalConfigDraft, options?: { override?: boolean }) => Promise<void>;
		onProbe?: (input: McpProbeInput) => Promise<McpProbeOutput>;
		onInspectorStart?: (input: McpInspectorStartInput) => Promise<McpInspectorStartOutput>;
		onInspectorClose?: (input: McpInspectorCloseInput) => Promise<McpInspectorCloseOutput>;
		onInspectorSubscribe?: (
			input: McpInspectorCloseInput,
			handlers: {
				onData: (event: McpInspectorEvent) => void;
				onError?: () => void;
			},
		) => { unsubscribe: () => void };
	} = $props();

	const isStringRecord = (value: unknown): value is Record<string, string> =>
		typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value) &&
		Object.values(value).every((entry) => typeof entry === 'string');

	const parseOptionalStringRecord = (source: string, label: string): Record<string, string> | undefined => {
		const trimmed = source.trim();
		if (!trimmed) {
			return undefined;
		}
		const parsed: unknown = JSON.parse(trimmed);
		if (!isStringRecord(parsed)) {
			throw new Error(`${label} must be a JSON object with string values`);
		}
		return parsed;
	};

	const serializeRecord = (value: Record<string, string> | undefined): string =>
		value && Object.keys(value).length > 0 ? JSON.stringify(value, null, 2) : '';

	const serializeArgs = (args: readonly string[] | undefined): string => (args ?? []).join(' ');

	let name = $state('browser-tools');
	let title = $state('Browser Tools');
	let description = $state('Authenticated browser automation.');
	let transport = $state<McpTransportKind>('stdio');
	let command = $state('bunx');
	let args = $state('@agent/browser-mcp');
	let url = $state('https://mcp.example.com/messages');
	let headers = $state('');
	let globalEnv = $state('');
	let transportEnv = $state('{\n  "BROWSER_PROFILE": "default"\n}');
	let editorMode = $state<EditorMode>('form');
	let codeText = $state('');
	let formError = $state<string | null>(null);
	let lastInitialName = $state<string | null>(null);
	let overrideDialogOpen = $state(false);
	let pendingOverrideDraft = $state<McpGlobalConfigDraft | null>(null);

	const modeLabel = $derived(initialRow ? 'Edit config' : 'New config');
	const submitLabel = $derived(initialRow ? 'Update' : 'Install');
	const formSectionId = $derived(initialRow ? `mcp-config:${initialRow.name}` : '__new__');
	const selectedOwnerAvatar = $derived.by(() => {
		const owner = avatarOptions.find((avatar) => avatar.nickname === ownerAvatarNickname);
		if (owner) {
			return owner;
		}
		if (avatarOptions[0]) {
			return avatarOptions[0];
		}
		return {
			nickname: ownerAvatarNickname || 'default',
			label: ownerAvatarNickname || 'default',
			principalId: ownerAvatarNickname || 'default',
			iconUrl: null,
		} satisfies McpAvatarCatalogOption;
	});
	const ownerAvatarItems = $derived.by(
		(): ActorSelectItem[] =>
			avatarOptions.length === 0
				? [
						{
							value: selectedOwnerAvatar.nickname,
							label: selectedOwnerAvatar.label,
							subtitle: resolveAvatarHandle(selectedOwnerAvatar) ?? `@${selectedOwnerAvatar.nickname}`,
							iconUrl: selectedOwnerAvatar.iconUrl ?? null,
						},
					]
				: avatarOptions.map((avatar) => ({
						value: avatar.nickname,
						label: avatar.label,
						subtitle: resolveAvatarHandle(avatar) ?? `@${avatar.nickname}`,
						iconUrl: avatar.iconUrl ?? null,
					})),
	);
	const selectedOwnerAvatarItem = $derived.by(
		(): ActorSelectItem | null =>
			ownerAvatarItems.find((item) => item.value === selectedOwnerAvatar.nickname) ?? null,
	);
	const isNameConflictError = (error: unknown): boolean =>
		(error instanceof Error ? error.message : String(error)).includes('mcp global already exists:');

	const applyDraft = (draft: McpGlobalConfigDraft): void => {
		ownerAvatarNickname = draft.avatarNickname;
		name = draft.name;
		title = draft.title ?? '';
		description = draft.description ?? '';
		transport = draft.transport.kind;
		if (draft.transport.kind === 'stdio') {
			command = draft.transport.command;
			args = serializeArgs(draft.transport.args);
			transportEnv = serializeRecord(draft.transport.env);
			url = 'https://mcp.example.com/messages';
			headers = '';
		} else {
			url = draft.transport.url;
			headers = serializeRecord(draft.transport.headers);
			command = 'bunx';
			args = '@agent/browser-mcp';
			transportEnv = '{\n  "BROWSER_PROFILE": "default"\n}';
		}
		globalEnv = serializeRecord(draft.env);
		codeText = serializeMcpDraft(draft);
	};

	const buildFormDraft = (): McpGlobalConfigDraft => {
		const trimmedName = name.trim();
		if (!trimmedName) {
			throw new Error('Name is required');
		}

		const draft: McpGlobalConfigDraft = {
			avatarNickname: selectedOwnerAvatar.nickname,
			name: trimmedName,
			title: title.trim() || undefined,
			description: description.trim() || undefined,
			transport:
				transport === 'stdio'
					? {
							kind: transport,
							command: command.trim(),
							args: args
								.split(/\s+/)
								.map((arg) => arg.trim())
								.filter(Boolean),
							env: parseOptionalStringRecord(transportEnv, 'Transport env'),
						}
					: {
							kind: transport,
							url: url.trim(),
							headers: parseOptionalStringRecord(headers, 'Headers'),
						},
			env: parseOptionalStringRecord(globalEnv, 'Global env'),
		};

		if (draft.transport.kind === 'stdio' && !draft.transport.command) {
			throw new Error('Command is required for stdio transport');
		}
		if (draft.transport.kind !== 'stdio' && !draft.transport.url) {
			throw new Error('URL is required for remote transport');
		}

		return draft;
	};

	const buildDraft = (): McpGlobalConfigDraft =>
		editorMode === 'code'
			? parseMcpDraftJson(codeText, {
					defaultAvatarNickname: selectedOwnerAvatar.nickname,
					immutableName: initialRow?.name ?? null,
				})
			: buildFormDraft();

	const draftPreview = $derived.by(() => {
		try {
			return buildDraft();
		} catch {
			return null;
		}
	});

	const matchingConfigRow = $derived.by(() => {
		if (initialRow || !draftPreview) {
			return null;
		}
		return (
			knownConfigRows.find(
				(row) => row.avatarNickname === draftPreview.avatarNickname && row.name === draftPreview.name,
			) ?? null
		);
	});

	$effect(() => {
		const nextInitialName = initialRow?.name ?? null;
		if (nextInitialName === lastInitialName) {
			return;
		}
		lastInitialName = nextInitialName;
		formError = null;
		overrideDialogOpen = false;
		pendingOverrideDraft = null;
		editorMode = 'form';
		if (!initialRow) {
			applyDraft({
				avatarNickname: avatarOptions[0]?.nickname ?? ownerAvatarNickname ?? 'default',
				name: 'browser-tools',
				title: 'Browser Tools',
				description: 'Authenticated browser automation.',
				transport: {
					kind: 'stdio',
					command: 'bunx',
					args: ['@agent/browser-mcp'],
					env: {
						BROWSER_PROFILE: 'default',
					},
				},
			});
			return;
		}
		applyDraft({
			avatarNickname: selectedOwnerAvatar.nickname,
			name: initialRow.name,
			title: initialRow.title,
			description: initialRow.description === 'No description' ? undefined : initialRow.description,
			transport:
				initialRow.transportSummary.kind === 'stdio'
					? {
							kind: 'stdio',
							command: initialRow.transportSummary.command ?? '',
							args: initialRow.transportSummary.args ?? [],
							env: initialRow.transportSummary.env,
						}
					: {
							kind: initialRow.transportSummary.kind,
							url: initialRow.transportSummary.url ?? '',
							headers: initialRow.transportSummary.headers,
						},
		});
	});

	$effect(() => {
		if (initialRow) {
			return;
		}
		if (!avatarOptions.some((avatar) => avatar.nickname === ownerAvatarNickname)) {
			ownerAvatarNickname = avatarOptions[0]?.nickname ?? ownerAvatarNickname ?? 'default';
		}
	});

	const setEditorMode = (nextMode: EditorMode): void => {
		if (nextMode === editorMode) {
			return;
		}
		try {
			if (nextMode === 'code') {
				codeText = serializeMcpDraft(buildFormDraft());
			} else {
				applyDraft(
					parseMcpDraftJson(codeText, {
						defaultAvatarNickname: selectedOwnerAvatar.nickname,
						immutableName: initialRow?.name ?? null,
					}),
				);
			}
			formError = null;
			editorMode = nextMode;
		} catch (error) {
			formError = error instanceof Error ? error.message : String(error);
		}
	};

	const performSubmit = async (
		draft: McpGlobalConfigDraft,
		options: { override?: boolean } = {},
	): Promise<void> => {
		formError = null;
		try {
			await onSubmit(draft, options);
			overrideDialogOpen = false;
			pendingOverrideDraft = null;
		} catch (error) {
			if (!options.override && isNameConflictError(error)) {
				pendingOverrideDraft = draft;
				overrideDialogOpen = true;
				return;
			}
			formError = error instanceof Error ? error.message : String(error);
		}
	};

	const submit = async (): Promise<void> => {
		const draft = buildDraft();
		if (initialRow) {
			await performSubmit(draft, { override: true });
			return;
		}
		if (matchingConfigRow) {
			formError = null;
			pendingOverrideDraft = draft;
			overrideDialogOpen = true;
			return;
		}
		await performSubmit(draft);
	};

	const confirmOverride = async (): Promise<void> => {
		if (!pendingOverrideDraft) {
			return;
		}
		await performSubmit(pendingOverrideDraft, { override: true });
	};
</script>

<div class="grid gap-0" data-testid="mcp-new-global-form">
	<div class="flex min-w-0 items-center justify-between gap-3 border-b border-border/50 px-3 py-3 md:px-5">
		<div class="flex min-w-0 items-center gap-2">
			<div class="truncate text-sm font-semibold">{modeLabel}</div>
			<HelpHint
				ariaLabel="New MCP config help"
				side="bottom"
				align="start"
				textContext="Global config is durable truth. Install updates only the owner Avatar config."
			>
				<HelpCircleIcon class="size-4 text-muted-foreground" />
			</HelpHint>
		</div>
		<div class="flex items-center gap-2">
			<div class="inline-flex rounded-lg border border-border/60 bg-muted/35 p-0.5">
				<button
					type="button"
					class={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${editorMode === 'form' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
					aria-pressed={editorMode === 'form'}
					onclick={() => setEditorMode('form')}
				>
					Form
				</button>
				<button
					type="button"
					class={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${editorMode === 'code' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
					aria-pressed={editorMode === 'code'}
					onclick={() => setEditorMode('code')}
				>
					Code
				</button>
			</div>
			{#if onBack}
				<Button variant="outline" size="sm" onclick={onBack}>
					Back
				</Button>
			{/if}
			{#if initialRow && onRemove}
				<Button variant="destructive" size="sm" disabled={pending} onclick={() => void onRemove(initialRow)}>
					<TrashIcon class="size-4" />
					Remove
				</Button>
			{/if}
			<Button variant="outline" size="sm" disabled={pending} onclick={submit}>
				<SaveIcon class="size-4" />
				{pending ? 'Saving' : submitLabel}
			</Button>
		</div>
	</div>

	{#if formError}
		<div
			class="border-b border-border/50 bg-destructive/8 px-3 py-2 text-sm text-destructive md:px-5"
			data-testid="mcp-config-form-error"
		>
			{formError}
		</div>
	{/if}

	<section class="grid gap-3 border-b border-border/50 px-3 py-4 md:px-5">
		<div class="flex min-w-0 items-center gap-2">
			<div class="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Global</div>
			<HelpHint
				ariaLabel="Global MCP help"
				side="bottom"
				align="start"
				textContext="Global config belongs to one Avatar. Project rows live in config detail."
			>
				<HelpCircleIcon class="size-4 text-muted-foreground" />
			</HelpHint>
		</div>

		{#if editorMode === 'form'}
			<div class="grid gap-3 md:grid-cols-[minmax(12rem,0.72fr)_minmax(0,1fr)_minmax(0,1fr)]">
				<div class="grid gap-1.5 text-xs text-muted-foreground" data-testid="mcp-config-owner">
					Avatar
					{#if initialRow}
						<button
							type="button"
							class="flex h-8 min-w-0 items-center gap-2 rounded-md border border-border/50 px-2.5 text-left transition-colors hover:bg-muted/22"
							data-testid="mcp-config-owner-readonly"
							aria-label={`Open Avatar ${selectedOwnerAvatar.label}`}
							onclick={() => onOpenAvatar?.(selectedOwnerAvatar.nickname)}
						>
							<ProfileAvatar
								label={selectedOwnerAvatar.label}
								src={selectedOwnerAvatar.iconUrl ?? null}
								class="size-6 rounded-lg"
							/>
							<div class="min-w-0 truncate text-sm text-foreground">{selectedOwnerAvatar.label}</div>
						</button>
					{:else}
						<ActorSelect
							ariaLabel="Owner Avatar"
							items={ownerAvatarItems}
							value={selectedOwnerAvatar.nickname}
							selectedItem={selectedOwnerAvatarItem}
							density="detail"
							chrome="field"
							class="w-full"
							onValueChange={(value) => {
								ownerAvatarNickname = value;
							}}
						/>
					{/if}
				</div>

				<label class="grid gap-1.5 text-xs text-muted-foreground">
					Name
					<Input
						bind:value={name}
						class="h-8 text-sm text-foreground"
						autocomplete="off"
						disabled={Boolean(initialRow)}
					/>
				</label>

				<label class="grid gap-1.5 text-xs text-muted-foreground">
					Title
					<Input bind:value={title} class="h-8 text-sm text-foreground" autocomplete="off" />
				</label>
			</div>

			<label class="grid gap-1.5 text-xs text-muted-foreground">
				Description
				<Input bind:value={description} class="h-8 text-sm text-foreground" autocomplete="off" />
			</label>

			<div class="grid gap-3 md:grid-cols-[12rem_minmax(0,1fr)]">
				<label class="grid gap-1.5 text-xs text-muted-foreground">
					Transport
					<NativeSelect.NativeSelect
						bind:value={transport}
						class="h-8 text-sm text-foreground"
						wrapperClass="w-full"
					>
						<option value="stdio">stdio</option>
						<option value="streamable-http">streamable-http</option>
						<option value="sse">sse</option>
					</NativeSelect.NativeSelect>
				</label>

				{#if transport === 'stdio'}
					<div class="grid gap-3 md:grid-cols-[minmax(10rem,0.35fr)_minmax(0,1fr)]">
						<label class="grid gap-1.5 text-xs text-muted-foreground">
							Command
							<Input bind:value={command} class="h-8 text-sm text-foreground" autocomplete="off" />
						</label>

						<label class="grid gap-1.5 text-xs text-muted-foreground">
							Args
							<Input bind:value={args} class="h-8 text-sm text-foreground" autocomplete="off" />
						</label>
					</div>
				{:else}
					<label class="grid gap-1.5 text-xs text-muted-foreground">
						URL
						<Input bind:value={url} class="h-8 text-sm text-foreground" autocomplete="off" />
					</label>
				{/if}
			</div>

			<div class="grid gap-3 md:grid-cols-2">
				<label class="grid gap-1.5 text-xs text-muted-foreground">
					Global env
					<Textarea bind:value={globalEnv} class="min-h-20 font-mono text-xs text-foreground" spellcheck="false" />
				</label>

				{#if transport === 'stdio'}
					<label class="grid gap-1.5 text-xs text-muted-foreground">
						Transport env
						<Textarea
							bind:value={transportEnv}
							class="min-h-20 font-mono text-xs text-foreground"
							spellcheck="false"
						/>
					</label>
				{:else}
					<label class="grid gap-1.5 text-xs text-muted-foreground">
						Headers
						<Textarea bind:value={headers} class="min-h-20 font-mono text-xs text-foreground" spellcheck="false" />
					</label>
				{/if}
			</div>
		{:else}
			<div class="grid gap-1.5 text-xs text-muted-foreground">
				Config JSON
				<Textarea
					bind:value={codeText}
					class="min-h-[26rem] font-mono text-xs text-foreground"
					spellcheck="false"
					data-testid="mcp-config-code-textarea"
				/>
			</div>
		{/if}

		{#if matchingConfigRow}
			<div data-testid="mcp-config-name-conflict">
				<NoticeBanner
					tone="warning"
					message={`Config id "${matchingConfigRow.name}" already exists under @${matchingConfigRow.avatarNickname}. Install requires explicit override.`}
				/>
			</div>
		{/if}
	</section>

	{#if onProbe}
		<McpConfigInspectPanel
			resetKey={formSectionId}
			{pending}
			buildDraft={buildDraft}
			onProbe={onProbe}
			{onInspectorStart}
			{onInspectorClose}
			{onInspectorSubscribe}
		/>
	{/if}
</div>

<Dialog.Root bind:open={overrideDialogOpen}>
	<Dialog.Content class="sm:max-w-md" data-testid="mcp-config-override-dialog">
		<Dialog.Header>
			<Dialog.Title>Override existing config?</Dialog.Title>
			<Dialog.Description>
				{#if pendingOverrideDraft}
					The id "{pendingOverrideDraft.name}" already exists under @{pendingOverrideDraft.avatarNickname}. Override replaces the global config bound to this id.
				{:else}
					This config id already exists. Override replaces the current global config.
				{/if}
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button
				variant="outline"
				onclick={() => {
					overrideDialogOpen = false;
					pendingOverrideDraft = null;
				}}
			>
				Cancel
			</Button>
			<Button variant="destructive" disabled={pending} onclick={confirmOverride}>Override</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
