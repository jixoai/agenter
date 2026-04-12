<script lang="ts">
	import type { RuntimeSnapshotEntry, SessionEntry } from '@agenter/client-sdk';

	import { getAppControllerContext } from '$lib/app/controller-context';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import WorkbenchDetailDrawer from '$lib/features/navigation/workbench-detail-drawer.svelte';
	import WorkbenchPageContent from '$lib/features/navigation/workbench-page-content.svelte';

	const controller = getAppControllerContext();

	type EditableKind = 'settings' | 'agenter' | 'system' | 'template' | 'contract';

	const editableKinds = ['settings', 'agenter', 'system', 'template', 'contract'] as const satisfies EditableKind[];
	const editableKindMeta: Record<EditableKind, { title: string; detail: string }> = {
		settings: {
			title: 'Runtime settings',
			detail: 'Attention defaults, notification policy, quick replies, and linked-system preferences.',
		},
		agenter: {
			title: 'Agenter prompt',
			detail: 'Runtime-specific operator instructions that stay separate from workspace rules.',
		},
		system: {
			title: 'System source',
			detail: 'System-level prompt and bootstrap fragments for this runtime shell.',
		},
		template: {
			title: 'Template source',
			detail: 'Reusable template content that can seed runtime work without changing workspace grants.',
		},
		contract: {
			title: 'Response contract',
			detail: 'Output constraints and durable response guidance for this runtime.',
		},
	};

	let {
		session,
		runtime,
	}: {
		session: SessionEntry;
		runtime: RuntimeSnapshotEntry | null;
	} = $props();

	let selectedKind = $state<EditableKind>('settings');
	let editorContent = $state('');
	let loadedContent = $state('');
	let filePath = $state('');
	let fileMtimeMs = $state(0);
	let loading = $state(false);
	let saving = $state(false);
	let notice = $state<string | null>(null);
	let loadVersion = 0;

	const capabilityEntries = $derived(
		Object.entries(runtime?.modelCapabilities ?? {}).map(([key, value]) => ({
			key,
			enabled: Boolean(value),
		})),
	);
	const dirty = $derived(editorContent !== loadedContent);
	const currentMeta = $derived(editableKindMeta[selectedKind]);

	const loadEditable = async (kind: EditableKind): Promise<void> => {
		const version = ++loadVersion;
		loading = true;
		notice = null;
		try {
			const file = await controller.runtimeStore.readSettings(session.id, kind);
			if (version !== loadVersion) {
				return;
			}
			filePath = file.path;
			fileMtimeMs = file.mtimeMs;
			loadedContent = file.content;
			editorContent = file.content;
		} catch (error) {
			if (version !== loadVersion) {
				return;
			}
			notice = error instanceof Error ? error.message : 'Unable to load runtime settings.';
			filePath = '';
			fileMtimeMs = 0;
			loadedContent = '';
			editorContent = '';
		} finally {
			if (version === loadVersion) {
				loading = false;
			}
		}
	};

	const reloadEditable = async (): Promise<void> => {
		await loadEditable(selectedKind);
	};

	const resetDraft = (): void => {
		notice = 'Draft reset to the last loaded runtime file.';
		void loadEditable(selectedKind);
	};

	const saveEditable = async (): Promise<void> => {
		saving = true;
		notice = null;
		try {
			const result = await controller.runtimeStore.saveSettings({
				sessionId: session.id,
				kind: selectedKind,
				content: editorContent,
				baseMtimeMs: fileMtimeMs,
			});
			if (!result.ok) {
				filePath = result.latest.path;
				fileMtimeMs = result.latest.mtimeMs;
				loadedContent = result.latest.content;
				editorContent = result.latest.content;
				notice = 'The source changed on disk. Latest content has been loaded back into the editor.';
				return;
			}
			filePath = result.file.path;
			fileMtimeMs = result.file.mtimeMs;
			loadedContent = result.file.content;
			editorContent = result.file.content;
			notice = 'Runtime settings saved.';
		} catch (error) {
			notice = error instanceof Error ? error.message : 'Unable to save runtime settings.';
		} finally {
			saving = false;
		}
	};

	$effect(() => {
		const currentSessionId = session.id;
		const kind = selectedKind;
		void currentSessionId;
		void loadEditable(kind);
	});
</script>

<WorkbenchPageContent data-testid="runtime-settings-stage">
	{#snippet main()}
		<div class="grid h-full gap-4">
			<Card.Root>
				<Card.Content class="grid gap-4 pt-6">
					<div class="grid gap-2">
						<div class="flex flex-wrap items-center gap-2">
							<div class="text-base font-semibold">{currentMeta.title}</div>
							<Badge variant="outline">{session.avatar || session.name}</Badge>
							<Badge variant="secondary">{session.status}</Badge>
						</div>
						<div class="text-sm text-muted-foreground">{currentMeta.detail}</div>
					</div>

					<div class="flex flex-wrap gap-2">
						{#each editableKinds as kind}
							<Button
								size="sm"
								variant={selectedKind === kind ? 'secondary' : 'ghost'}
								class="rounded-full"
								onclick={() => {
									selectedKind = kind;
								}}
							>
								{kind}
							</Button>
						{/each}
					</div>

					{#if notice}
						<div class="rounded-xl border px-4 py-3 text-sm text-muted-foreground">
							{notice}
						</div>
					{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root class="h-full">
				<Card.Header class="border-b">
					<Card.Title>Editable source</Card.Title>
					<Card.Description>
						The runtime shell edits one durable source at a time instead of collapsing runtime concerns into workspace rule chrome.
					</Card.Description>
				</Card.Header>
				<Card.Content class="grid h-full gap-4 pt-6">
					{#if loading}
						<div class="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
							Loading {selectedKind}…
						</div>
					{:else}
						<Textarea
							bind:value={editorContent}
							class="min-h-[26rem] font-mono text-xs leading-6"
							placeholder={`Edit ${selectedKind} for ${session.avatar || session.name}`}
						/>
					{/if}
				</Card.Content>
			</Card.Root>
		</div>
	{/snippet}

	{#snippet bottom()}
		<Card.Root>
			<Card.Content class="grid gap-4 pt-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
				<div class="grid gap-1">
					<div class="text-sm font-semibold">
						{saving
							? 'Saving runtime settings…'
							: dirty
								? 'The draft differs from the last loaded runtime file.'
								: 'Save and reset actions stay docked below the editor.'}
					</div>
					<div class="text-xs text-muted-foreground">
						Edits remain runtime-scoped and do not masquerade as workspace rule changes.
					</div>
				</div>

				<div class="flex flex-wrap items-center gap-2">
					<Button variant="outline" disabled={loading || saving} onclick={() => void reloadEditable()}>
						Reload file
					</Button>
					<Button variant="outline" disabled={loading || saving || !dirty} onclick={resetDraft}>
						Reset draft
					</Button>
					<Button disabled={loading || saving || !dirty} onclick={() => void saveEditable()}>
						{saving ? 'Saving…' : 'Save settings'}
					</Button>
				</div>
			</Card.Content>
		</Card.Root>
	{/snippet}

	{#snippet drawer()}
		{#snippet settingsSummary()}
			<div><span class="font-medium text-foreground">File:</span> {filePath || 'Unavailable'}</div>
			<div><span class="font-medium text-foreground">Capabilities:</span> {capabilityEntries.length}</div>
			<div><span class="font-medium text-foreground">Workspace:</span> {session.workspacePath}</div>
		{/snippet}

		<WorkbenchDetailDrawer
			title="Runtime metadata"
			description="Passive metadata stays secondary while editing remains dominant in the main surface."
			summary={settingsSummary}
		>
			<section class="grid gap-2">
				<h4 class="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Runtime identity</h4>
				<div class="text-sm font-semibold">{session.avatar || session.name}</div>
				<div class="text-sm text-muted-foreground break-all">Session {session.id}</div>
				<div class="text-sm text-muted-foreground break-all">{session.workspacePath}</div>
			</section>

			<section class="grid gap-2 border-t border-border/55 pt-4">
				<h4 class="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Editable source</h4>
				<div class="text-sm font-medium">{currentMeta.title}</div>
				<div class="text-sm text-muted-foreground break-all">{filePath || 'Source path unavailable.'}</div>
				<div class="text-sm text-muted-foreground">
					Last modified {fileMtimeMs > 0 ? new Date(fileMtimeMs).toLocaleString() : 'unknown'}
				</div>
			</section>

			<section class="grid gap-2 border-t border-border/55 pt-4">
				<h4 class="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Runtime capabilities</h4>
				{#if capabilityEntries.length === 0}
					<div class="text-sm text-muted-foreground">No runtime capability snapshot is available yet.</div>
				{:else}
					<div class="flex flex-wrap gap-2">
						{#each capabilityEntries as entry (entry.key)}
							<Badge variant={entry.enabled ? 'secondary' : 'outline'}>
								{entry.key}
							</Badge>
						{/each}
					</div>
				{/if}
			</section>
		</WorkbenchDetailDrawer>
	{/snippet}
</WorkbenchPageContent>
