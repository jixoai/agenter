<script lang="ts">
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import { tick } from 'svelte';

	import { Button } from '$lib/components/ui/button/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import HelpHint from '$lib/components/web-components/help-hint.svelte';

	import type { RuntimeHeartbeatConfigBinding, RuntimeHeartbeatConfigDraft } from './runtime-heartbeat-config-state';

	let {
		binding,
		loading = false,
		saving = false,
		error = null,
		onRefresh,
		onSave,
	}: {
		binding: RuntimeHeartbeatConfigBinding;
		loading?: boolean;
		saving?: boolean;
		error?: string | null;
		onRefresh: () => void | Promise<void>;
		onSave: (draft: RuntimeHeartbeatConfigDraft) => boolean | Promise<boolean>;
	} = $props();

	let open = $state(false);
	let temperatureValue = $state('');
	let topKValue = $state('');
	let maxTokenValue = $state('');
	let thinkingEnabled = $state(false);
	let thinkingBudgetValue = $state('');

	const toInputValue = (value: number | null): string => (value === null ? '' : String(value));
	const toNumberOrNull = (value: string): number | null => {
		const trimmed = value.trim();
		if (trimmed.length === 0) {
			return null;
		}
		const parsed = Number(trimmed);
		return Number.isFinite(parsed) ? parsed : null;
	};

	const syncDraftFromBinding = (): void => {
		temperatureValue = toInputValue(binding.draft.temperature);
		topKValue = toInputValue(binding.draft.topK);
		maxTokenValue = toInputValue(binding.draft.maxToken);
		thinkingEnabled = binding.draft.thinkingEnabled;
		thinkingBudgetValue = toInputValue(binding.draft.thinkingBudgetTokens);
	};

	$effect(() => {
		binding;
		if (!open) {
			syncDraftFromBinding();
		}
	});

	const disabled = $derived(loading || saving || binding.activeProviderId === null || binding.editableLayerId === null);

	const save = async (): Promise<void> => {
		if (binding.activeProviderId === null || binding.editableLayerId === null || saving) {
			return;
		}
		const saved = await onSave({
			temperature: toNumberOrNull(temperatureValue),
			topK: toNumberOrNull(topKValue),
			maxToken: toNumberOrNull(maxTokenValue),
			thinkingEnabled,
			thinkingBudgetTokens: thinkingEnabled ? toNumberOrNull(thinkingBudgetValue) : null,
		});
		if (saved) {
			open = false;
		}
	};

	const refresh = async (): Promise<void> => {
		await onRefresh();
		await tick();
		syncDraftFromBinding();
	};
</script>

<Dialog.Root bind:open>
	<Button
		variant="outline"
		size="icon"
		class="rounded-full"
		aria-label="Config"
		title="Config"
		disabled={loading && binding.activeProviderId === null}
		onclick={() => {
			open = true;
		}}
	>
		<SlidersHorizontal class="size-4" />
	</Button>

	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Next call config</Dialog.Title>
			<Dialog.Description class="flex items-center gap-2">
				<span>Save to the persistent Settings layer. The current streaming call keeps its original config.</span>
				<HelpHint textContext="Config edits are durable Settings facts. They immediately form a trailing before-call config fact, but only the next model call will consume them.">
					<p>Saving here updates the durable Settings layer, leaves the current streaming call untouched, and makes the next call pick up the new knobs.</p>
				</HelpHint>
			</Dialog.Description>
		</Dialog.Header>

		<div class="grid gap-4 py-2">
			<div class="grid gap-1 text-sm text-muted-foreground">
				<span>{binding.providerLabel ?? 'No active provider found.'}</span>
				<span>{binding.editableLayerSource ? `Layer: ${binding.editableLayerSource}` : 'No editable Settings layer.'}</span>
			</div>

			{#if error}
				<p class="text-sm text-destructive">{error}</p>
			{/if}

			<div class="grid gap-3">
				<div class="grid gap-2">
					<Label for="heartbeat-config-temperature">Temperature</Label>
					<Input id="heartbeat-config-temperature" type="number" step="0.1" bind:value={temperatureValue} />
				</div>

				<div class="grid gap-2">
					<Label for="heartbeat-config-topk">Top-k</Label>
					<Input id="heartbeat-config-topk" type="number" step="1" min="0" bind:value={topKValue} />
				</div>

				<div class="grid gap-2">
					<Label for="heartbeat-config-maxtoken">Max tokens</Label>
					<Input id="heartbeat-config-maxtoken" type="number" step="1" min="1" bind:value={maxTokenValue} />
				</div>

				<div class="grid gap-2 rounded-lg border border-border/60 px-3 py-3">
					<label class="flex items-center gap-2 text-sm font-medium" for="heartbeat-config-thinking">
						<Checkbox id="heartbeat-config-thinking" bind:checked={thinkingEnabled} />
						<span>Enable thinking</span>
					</label>
					<div class="grid gap-2">
						<Label for="heartbeat-config-thinking-budget">Thinking budget</Label>
						<Input
							id="heartbeat-config-thinking-budget"
							type="number"
							step="1"
							min="1024"
							bind:value={thinkingBudgetValue}
							disabled={!thinkingEnabled}
							placeholder="1024"
						/>
					</div>
				</div>
			</div>

			{#if binding.activeProviderId === null || binding.editableLayerId === null}
				<p class="text-sm text-muted-foreground">
					Heartbeat config needs an active provider and an editable Settings layer before it can save.
				</p>
			{/if}
		</div>

		<Dialog.Footer class="gap-2 sm:justify-between">
			<Button type="button" variant="ghost" class="gap-2" disabled={saving} onclick={() => void refresh()}>
				<RefreshCw class="size-4" />
				Refresh
			</Button>
			<Button type="button" class="gap-2" disabled={disabled} onclick={() => void save()}>
				{#if saving}
					<LoaderCircle class="size-4 animate-spin" />
				{/if}
				Save
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
