<script lang="ts">
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';

	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';

	import {
		parseRuntimeSettingsPolicyNumber,
		parseRuntimeSettingsPolicyText,
		type RuntimeSettingsPolicyBinding,
		type RuntimeSettingsPolicyDraft,
	} from './runtime-settings-policy-state';

	let {
		binding,
		loading = false,
		saving = false,
		error = null,
		onRefresh,
		onSave,
	}: {
		binding: RuntimeSettingsPolicyBinding;
		loading?: boolean;
		saving?: boolean;
		error?: string | null;
		onRefresh: () => void | Promise<void>;
		onSave: (draft: RuntimeSettingsPolicyDraft) => boolean | Promise<boolean>;
	} = $props();

	let transportMaxRetriesValue = $state('');
	let compactThresholdPromptFractionValue = $state('');
	let compactThresholdEnabled = $state(false);
	let compactOnAttentionRetry = $state(false);
	let compactOnContextOverflow = $state(false);
	let compactOnExternalContinuationLimit = $state(false);
	let compactOnTimeout = $state(false);
	let retryMaxAttemptsValue = $state('');
	let retryInitialBackoffMsValue = $state('');
	let retryMultiplierValue = $state('');
	let retryMaxBackoffMsValue = $state('');
	let retryResetOnExternalInput = $state(false);
	let retryResetOnProgress = $state(false);
	let langValue = $state('');
	let promptRootDirValue = $state('');
	let promptAgenterPathValue = $state('');
	let promptAgenterSystemPathValue = $state('');
	let promptSystemTemplatePathValue = $state('');
	let promptResponseContractPathValue = $state('');
	let activeTab = $state<'transport' | 'compact' | 'retry' | 'prompt'>('transport');

	const toInputValue = (value: number | null): string => (value === null ? '' : String(value));
	const toTextValue = (value: string | null): string => value ?? '';

	const syncDraftFromBinding = (): void => {
		transportMaxRetriesValue = toInputValue(binding.draft.transportMaxRetries);
		compactThresholdEnabled = binding.draft.compactThresholdEnabled;
		compactThresholdPromptFractionValue = toInputValue(binding.draft.compactThresholdPromptFraction);
		compactOnAttentionRetry = binding.draft.compactOnAttentionRetry;
		compactOnContextOverflow = binding.draft.compactOnContextOverflow;
		compactOnExternalContinuationLimit = binding.draft.compactOnExternalContinuationLimit;
		compactOnTimeout = binding.draft.compactOnTimeout;
		retryMaxAttemptsValue = toInputValue(binding.draft.retryMaxAttempts);
		retryInitialBackoffMsValue = toInputValue(binding.draft.retryInitialBackoffMs);
		retryMultiplierValue = toInputValue(binding.draft.retryMultiplier);
		retryMaxBackoffMsValue = toInputValue(binding.draft.retryMaxBackoffMs);
		retryResetOnExternalInput = binding.draft.retryResetOnExternalInput;
		retryResetOnProgress = binding.draft.retryResetOnProgress;
		langValue = toTextValue(binding.draft.lang);
		promptRootDirValue = toTextValue(binding.draft.promptRootDir);
		promptAgenterPathValue = toTextValue(binding.draft.promptAgenterPath);
		promptAgenterSystemPathValue = toTextValue(binding.draft.promptAgenterSystemPath);
		promptSystemTemplatePathValue = toTextValue(binding.draft.promptSystemTemplatePath);
		promptResponseContractPathValue = toTextValue(binding.draft.promptResponseContractPath);
	};

	$effect(() => {
		binding;
		syncDraftFromBinding();
	});

	const disabled = $derived(loading || saving || binding.activeProviderId === null || binding.editableLayerId === null);

	const save = async (): Promise<void> => {
		if (disabled) {
			return;
		}
		await onSave({
			transportMaxRetries: parseRuntimeSettingsPolicyNumber(transportMaxRetriesValue),
			compactThresholdEnabled,
			compactThresholdPromptFraction: parseRuntimeSettingsPolicyNumber(compactThresholdPromptFractionValue),
			compactOnAttentionRetry,
			compactOnContextOverflow,
			compactOnExternalContinuationLimit,
			compactOnTimeout,
			retryMaxAttempts: parseRuntimeSettingsPolicyNumber(retryMaxAttemptsValue),
			retryInitialBackoffMs: parseRuntimeSettingsPolicyNumber(retryInitialBackoffMsValue),
			retryMultiplier: parseRuntimeSettingsPolicyNumber(retryMultiplierValue),
			retryMaxBackoffMs: parseRuntimeSettingsPolicyNumber(retryMaxBackoffMsValue),
			retryResetOnExternalInput,
			retryResetOnProgress,
			lang: parseRuntimeSettingsPolicyText(langValue),
			promptRootDir: parseRuntimeSettingsPolicyText(promptRootDirValue),
			promptAgenterPath: parseRuntimeSettingsPolicyText(promptAgenterPathValue),
			promptAgenterSystemPath: parseRuntimeSettingsPolicyText(promptAgenterSystemPathValue),
			promptSystemTemplatePath: parseRuntimeSettingsPolicyText(promptSystemTemplatePathValue),
			promptResponseContractPath: parseRuntimeSettingsPolicyText(promptResponseContractPathValue),
		});
	};
</script>

<section class="grid gap-3 rounded-2xl border border-border/70 bg-background/70 p-4" data-testid="runtime-settings-policy-panel">
	<div class="flex flex-wrap items-start justify-between gap-3">
		<div class="grid gap-1">
			<div class="flex flex-wrap items-center gap-2">
				<h2 class="text-sm font-semibold">Runtime policy</h2>
				<Badge variant="outline">{binding.providerLabel ?? 'No active provider'}</Badge>
			</div>
			<p class="text-sm text-muted-foreground">
				Durable runtime law lives here: transport retry, compact triggers, retry backoff, and prompt/locale sources.
			</p>
			<p class="text-xs text-muted-foreground">
				Editing layer: {binding.editableLayerSource ?? 'No editable Settings layer'}
			</p>
		</div>

		<div class="flex items-center gap-2">
			<Button type="button" variant="outline" class="gap-2" disabled={saving} onclick={() => void onRefresh()}>
				<RefreshCw class="size-4" />
				Refresh
			</Button>
			<Button type="button" class="gap-2" disabled={disabled} onclick={() => void save()}>
				{#if saving}
					<LoaderCircle class="size-4 animate-spin" />
				{/if}
				Save runtime policy
			</Button>
		</div>
	</div>

	{#if error}
		<p class="text-sm text-destructive">{error}</p>
	{/if}

	<Tabs.Root
		value={activeTab}
		onValueChange={(value) => (activeTab = value as 'transport' | 'compact' | 'retry' | 'prompt')}
		class="grid gap-4"
	>
		<Tabs.List class="flex flex-wrap">
			<Tabs.Trigger value="transport">Transport</Tabs.Trigger>
			<Tabs.Trigger value="compact">Compact</Tabs.Trigger>
			<Tabs.Trigger value="retry">Retry</Tabs.Trigger>
			<Tabs.Trigger value="prompt">Prompt / Locale</Tabs.Trigger>
		</Tabs.List>

		<Tabs.Content value="transport" class="grid gap-4">
			<div class="grid gap-2 md:max-w-sm">
				<Label for="runtime-policy-transport-retries">Transport retries</Label>
				<Input id="runtime-policy-transport-retries" type="number" min="0" bind:value={transportMaxRetriesValue} />
				<p class="text-xs text-muted-foreground">Per-request provider retry budget. This does not control scheduler backoff.</p>
			</div>
		</Tabs.Content>

		<Tabs.Content value="compact" class="grid gap-4">
			<div class="grid gap-4 md:grid-cols-2">
				<div class="grid gap-3 rounded-xl border border-border/70 p-3">
					<label class="flex items-center gap-2 text-sm font-medium" for="runtime-policy-compact-threshold-enabled">
						<Checkbox id="runtime-policy-compact-threshold-enabled" bind:checked={compactThresholdEnabled} />
						<span>Enable threshold compaction</span>
					</label>
					<div class="grid gap-2">
						<Label for="runtime-policy-compact-threshold">Prompt fraction</Label>
						<Input
							id="runtime-policy-compact-threshold"
							type="number"
							step="0.05"
							min="0.05"
							max="1"
							bind:value={compactThresholdPromptFractionValue}
							disabled={!compactThresholdEnabled}
						/>
					</div>
				</div>

				<div class="grid gap-3 rounded-xl border border-border/70 p-3">
					<div class="text-sm font-medium">Recovery triggers</div>
					<label class="flex items-center gap-2 text-sm">
						<Checkbox bind:checked={compactOnAttentionRetry} />
						<span>Attention retry</span>
					</label>
					<label class="flex items-center gap-2 text-sm">
						<Checkbox bind:checked={compactOnContextOverflow} />
						<span>Context overflow</span>
					</label>
					<label class="flex items-center gap-2 text-sm">
						<Checkbox bind:checked={compactOnExternalContinuationLimit} />
						<span>Continuation limit</span>
					</label>
					<label class="flex items-center gap-2 text-sm">
						<Checkbox bind:checked={compactOnTimeout} />
						<span>Timeout</span>
					</label>
				</div>
			</div>
		</Tabs.Content>

		<Tabs.Content value="retry" class="grid gap-4">
			<div class="grid gap-4 md:grid-cols-2">
				<div class="grid gap-2">
					<Label for="runtime-policy-retry-max-attempts">Max attempts</Label>
					<Input id="runtime-policy-retry-max-attempts" type="number" min="1" bind:value={retryMaxAttemptsValue} />
					<p class="text-xs text-muted-foreground">Leave blank to keep retry progression unbounded.</p>
				</div>
				<div class="grid gap-2">
					<Label for="runtime-policy-retry-initial-backoff">Initial backoff ms</Label>
					<Input id="runtime-policy-retry-initial-backoff" type="number" min="1" bind:value={retryInitialBackoffMsValue} />
				</div>
				<div class="grid gap-2">
					<Label for="runtime-policy-retry-multiplier">Multiplier</Label>
					<Input id="runtime-policy-retry-multiplier" type="number" step="0.1" min="1.1" bind:value={retryMultiplierValue} />
				</div>
				<div class="grid gap-2">
					<Label for="runtime-policy-retry-max-backoff">Max backoff ms</Label>
					<Input id="runtime-policy-retry-max-backoff" type="number" min="1" bind:value={retryMaxBackoffMsValue} />
				</div>
			</div>
			<div class="flex flex-wrap gap-4">
				<label class="flex items-center gap-2 text-sm">
					<Checkbox bind:checked={retryResetOnExternalInput} />
					<span>Reset on external input</span>
				</label>
				<label class="flex items-center gap-2 text-sm">
					<Checkbox bind:checked={retryResetOnProgress} />
					<span>Reset on durable progress</span>
				</label>
			</div>
		</Tabs.Content>

		<Tabs.Content value="prompt" class="grid gap-4">
			<div class="grid gap-4 md:grid-cols-2">
				<div class="grid gap-2">
					<Label for="runtime-policy-lang">Locale</Label>
					<Input id="runtime-policy-lang" bind:value={langValue} placeholder="en / zh-Hans" />
				</div>
				<div class="grid gap-2">
					<Label for="runtime-policy-prompt-root">Prompt root</Label>
					<Input id="runtime-policy-prompt-root" bind:value={promptRootDirValue} placeholder="~/.agenter/prompts" />
				</div>
				<div class="grid gap-2">
					<Label for="runtime-policy-agenter-path">AGENTER path</Label>
					<Input id="runtime-policy-agenter-path" bind:value={promptAgenterPathValue} />
				</div>
				<div class="grid gap-2">
					<Label for="runtime-policy-agenter-system-path">AGENTER_SYSTEM path</Label>
					<Input id="runtime-policy-agenter-system-path" bind:value={promptAgenterSystemPathValue} />
				</div>
				<div class="grid gap-2">
					<Label for="runtime-policy-system-template-path">SYSTEM_TEMPLATE path</Label>
					<Input id="runtime-policy-system-template-path" bind:value={promptSystemTemplatePathValue} />
				</div>
				<div class="grid gap-2">
					<Label for="runtime-policy-response-contract-path">RESPONSE_CONTRACT path</Label>
					<Input id="runtime-policy-response-contract-path" bind:value={promptResponseContractPathValue} />
				</div>
			</div>
		</Tabs.Content>
	</Tabs.Root>

	{#if binding.activeProviderId === null || binding.editableLayerId === null}
		<p class="text-sm text-muted-foreground">
			Runtime policy editing needs an active provider and an editable Settings layer.
		</p>
	{/if}
</section>
