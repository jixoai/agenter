<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import HelpCircleIcon from '@lucide/svelte/icons/help-circle';
	import { ScrollView } from '@agenter/svelte-components';
	import { tick } from 'svelte';

	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { cn } from '$lib/utils.js';

	import {
		patchValueAtPointer,
		pointerToTokens,
		tokensToPointer,
	} from './settings-json-pointer';
	import type { SettingsPointerJumpTarget, SettingsProvenanceEntry } from './settings-graph-types';

	let {
		schema,
		value,
		mode,
		provenance = {},
		focusPointer = null,
		onValueChange,
		onJumpToSource,
	}: {
		schema: Record<string, unknown> | null;
		value: unknown;
		mode: 'readonly' | 'editable';
		provenance?: Record<string, SettingsProvenanceEntry>;
		focusPointer?: string | null;
		onValueChange?: (nextValue: unknown) => void;
		onJumpToSource?: (target: SettingsPointerJumpTarget) => void;
	} = $props();

	type SchemaKind = 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null' | 'unknown';

	let expandedPointers = $state<Record<string, boolean>>({});
	const pointerElements = new Map<string, HTMLElement>();

	const isRecord = (entry: unknown): entry is Record<string, unknown> =>
		typeof entry === 'object' && entry !== null && !Array.isArray(entry);

	const isPrimitive = (entry: unknown): entry is string | number | boolean | null =>
		entry === null || typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean';

	const asSchemaRecord = (entry: unknown): Record<string, unknown> | null => (isRecord(entry) ? entry : null);

	const asSchemaList = (entry: unknown): Record<string, unknown>[] =>
		Array.isArray(entry)
			? entry.map((item) => asSchemaRecord(item)).filter((item): item is Record<string, unknown> => item !== null)
			: [];

	const toSchemaKind = (currentSchema: Record<string, unknown> | null, currentValue: unknown): SchemaKind => {
		const rawType = currentSchema?.type;
		if (
			rawType === 'object' ||
			rawType === 'array' ||
			rawType === 'string' ||
			rawType === 'number' ||
			rawType === 'integer' ||
			rawType === 'boolean' ||
			rawType === 'null'
		) {
			return rawType;
		}
		if (currentSchema?.properties || currentSchema?.additionalProperties) {
			return 'object';
		}
		if (currentSchema?.items) {
			return 'array';
		}
		if (Array.isArray(currentValue)) {
			return 'array';
		}
		if (isRecord(currentValue)) {
			return 'object';
		}
		if (currentValue === null) {
			return 'null';
		}
		if (typeof currentValue === 'string') {
			return 'string';
		}
		if (typeof currentValue === 'number') {
			return 'number';
		}
		if (typeof currentValue === 'boolean') {
			return 'boolean';
		}
		return 'unknown';
	};

	const pickUnionSchema = (currentSchema: Record<string, unknown> | null, currentValue: unknown): Record<string, unknown> | null => {
		if (!currentSchema) {
			return null;
		}
		const unions = [...asSchemaList(currentSchema.anyOf), ...asSchemaList(currentSchema.oneOf)];
		if (unions.length === 0) {
			return currentSchema;
		}
		return unions.find((entry) => toSchemaKind(entry, currentValue) === toSchemaKind(currentSchema, currentValue)) ?? unions[0] ?? currentSchema;
	};

	const getChildSchema = (
		currentSchema: Record<string, unknown> | null,
		token: string,
		currentValue: unknown,
	): Record<string, unknown> | null => {
		const normalizedSchema = pickUnionSchema(currentSchema, currentValue);
		if (!normalizedSchema) {
			return null;
		}
		const kind = toSchemaKind(normalizedSchema, currentValue);
		if (kind === 'object') {
			const properties = asSchemaRecord(normalizedSchema.properties);
			if (properties && asSchemaRecord(properties[token])) {
				return asSchemaRecord(properties[token]);
			}
			return asSchemaRecord(normalizedSchema.additionalProperties);
		}
		if (kind === 'array') {
			return asSchemaRecord(normalizedSchema.items);
		}
		return null;
	};

	const readDescription = (currentSchema: Record<string, unknown> | null): string | null => {
		const description = currentSchema?.description;
		return typeof description === 'string' && description.trim().length > 0 ? description.trim() : null;
	};

	const readEnumValues = (currentSchema: Record<string, unknown> | null): Array<string | number | boolean> => {
		if (!currentSchema || !Array.isArray(currentSchema.enum)) {
			return [];
		}
		return currentSchema.enum.filter(
			(entry): entry is string | number | boolean =>
				typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean',
		);
	};

	const shortPath = (path: string): string => (path.length <= 42 ? path : `...${path.slice(-39)}`);

	const summarizeValue = (currentValue: unknown): string => {
		if (currentValue === null || currentValue === undefined) {
			return 'empty';
		}
		if (typeof currentValue === 'string') {
			return currentValue.trim().length === 0 ? 'empty' : currentValue;
		}
		if (Array.isArray(currentValue)) {
			return currentValue.length === 0 ? '[]' : `array(${currentValue.length})`;
		}
		if (isRecord(currentValue)) {
			const keys = Object.keys(currentValue);
			return keys.length === 0 ? '{}' : `object(${keys.length})`;
		}
		return String(currentValue);
	};

	const isEmptyValue = (currentValue: unknown): boolean => {
		if (currentValue === null || currentValue === undefined) {
			return true;
		}
		if (typeof currentValue === 'string') {
			return currentValue.trim().length === 0;
		}
		if (typeof currentValue === 'number' || typeof currentValue === 'boolean') {
			return false;
		}
		if (Array.isArray(currentValue)) {
			return currentValue.length === 0 || currentValue.every((entry) => isEmptyValue(entry));
		}
		if (isRecord(currentValue)) {
			const keys = Object.keys(currentValue);
			return keys.length === 0 || keys.every((key) => isEmptyValue(currentValue[key]));
		}
		return false;
	};

	const rememberPointer = (node: HTMLElement, pointer: string) => {
		let currentPointer = pointer;
		pointerElements.set(currentPointer, node);
		return {
			update(nextPointer: string) {
				if (nextPointer === currentPointer) {
					return;
				}
				pointerElements.delete(currentPointer);
				currentPointer = nextPointer;
				pointerElements.set(currentPointer, node);
			},
			destroy() {
				pointerElements.delete(currentPointer);
			},
		};
	};

	const isExpanded = (pointer: string, currentValue: unknown, isRoot = false): boolean => {
		if (isRoot) {
			return true;
		}
		const explicit = expandedPointers[pointer];
		if (explicit !== undefined) {
			return explicit;
		}
		return focusPointer === pointer || !isEmptyValue(currentValue);
	};

	const togglePointer = (pointer: string, currentValue: unknown): void => {
		expandedPointers = {
			...expandedPointers,
			[pointer]: !isExpanded(pointer, currentValue),
		};
	};

	const patchPointerValue = (pointer: string, nextValue: unknown): void => {
		if (mode !== 'editable' || !onValueChange) {
			return;
		}
		onValueChange(patchValueAtPointer(value, pointer, nextValue));
	};

	$effect(() => {
		if (!focusPointer) {
			return;
		}
		const nextExpanded = { ...expandedPointers };
		const tokens = pointerToTokens(focusPointer);
		for (let index = 0; index <= tokens.length; index += 1) {
			nextExpanded[tokensToPointer(tokens.slice(0, index))] = true;
		}
		expandedPointers = nextExpanded;
		void tick().then(() => {
			pointerElements.get(focusPointer)?.scrollIntoView({
				block: 'center',
				behavior: 'smooth',
			});
		});
	});
</script>

{#snippet HelpHint(label: string, text: string | null)}
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<button
					{...props}
					type="button"
					class="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground"
					aria-label={`Explain ${label}`}
				>
					<HelpCircleIcon class="size-3.5" />
				</button>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content side="bottom" align="start">
			<div class="max-w-72 text-xs leading-relaxed text-muted-foreground">
				{text ?? `No description for ${label}.`}
			</div>
		</Tooltip.Content>
	</Tooltip.Root>
{/snippet}

{#snippet ProvenanceChip(entry: SettingsProvenanceEntry | undefined)}
	{@const origin = entry?.origins.at(-1)}
	{#if origin}
		{#if entry?.jumpTarget && onJumpToSource}
			<button
				type="button"
				data-settings-source-layer={origin.layerId}
				data-settings-source-pointer={origin.pointer}
				data-settings-source-path={origin.path}
				class="rounded border border-border/70 bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted"
				aria-label={`Jump to source ${origin.path} ${origin.pointer}`}
				onclick={(event) => {
					event.preventDefault();
					event.stopPropagation();
					onJumpToSource(entry.jumpTarget!);
				}}
			>
				{shortPath(origin.note ?? origin.path)}
			</button>
		{:else}
			<span class="text-[10px] text-muted-foreground">{shortPath(origin.note ?? origin.path)}</span>
		{/if}
	{/if}
{/snippet}

{#snippet RenderNode(
	label: string,
	pointer: string,
	currentSchema: Record<string, unknown> | null,
	currentValue: unknown,
	isRoot = false,
)}
	{@const normalizedSchema = pickUnionSchema(currentSchema, currentValue)}
	{@const kind = toSchemaKind(normalizedSchema, currentValue)}
	{@const description = readDescription(normalizedSchema)}
	{@const entry = provenance[pointer]}
	{@const enumValues = readEnumValues(normalizedSchema)}
	{@const focused = focusPointer === pointer}
	{@const expanded = isExpanded(pointer, currentValue, isRoot)}

	<div
		use:rememberPointer={pointer}
		data-settings-pointer={pointer}
		class={cn(
			'rounded-xl border border-border/70 bg-card',
			isRoot ? 'p-3' : 'p-2',
			focused && 'ring-2 ring-primary/30',
		)}
	>
		<div class="flex items-start gap-2">
			{#if isRoot}
				<div class="mt-1 shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
					root
				</div>
			{:else if kind === 'object' || kind === 'array'}
				<button
					type="button"
					data-settings-pointer-trigger={pointer}
					class="mt-0.5 shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted"
					onclick={() => togglePointer(pointer, currentValue)}
				>
					<ChevronRightIcon class={cn('size-4 transition-transform', expanded && 'rotate-90')} />
				</button>
			{:else}
				<div class="mt-1 size-6 shrink-0"></div>
			{/if}

			<div class="grid min-w-0 flex-1 gap-2">
				<div class="flex flex-wrap items-center gap-1.5">
					<Badge variant="secondary" class="max-w-[20rem] truncate text-[10px]">
						{label}
					</Badge>
					{@render HelpHint(label, description)}
					{@render ProvenanceChip(entry)}
					{#if !isRoot}
						<span class="max-w-[16rem] truncate text-[10px] text-muted-foreground">
							{summarizeValue(currentValue)}
						</span>
					{/if}
				</div>

				{#if isRoot || expanded}
					<div class="grid gap-2">
						{#if kind === 'object'}
							{@const record = isRecord(currentValue) ? currentValue : {}}
							{@const schemaProps = asSchemaRecord(normalizedSchema?.properties)}
							{@const orderedKeys = [...new Set([...Object.keys(record), ...Object.keys(schemaProps ?? {})])].sort((left, right) =>
								left.localeCompare(right),
							)}
							{#if orderedKeys.length === 0}
								<div class="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">Empty object.</div>
							{:else}
								<div class="grid gap-2 pl-2">
									{#each orderedKeys as key (key)}
										{@const childPointer = `${pointer}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`}
										{@render RenderNode(key, childPointer, getChildSchema(normalizedSchema, key, record[key]), record[key], false)}
									{/each}
								</div>
							{/if}
						{:else if kind === 'array'}
							{@const list = Array.isArray(currentValue) ? currentValue : []}
							{#if list.length === 0}
								<div class="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">Empty array.</div>
							{:else}
								<div class="grid gap-2 pl-2">
									{#each list as entryValue, index (`${pointer}/${index}`)}
										{@render RenderNode(
											`[${index}]`,
											`${pointer}/${index}`,
											getChildSchema(normalizedSchema, String(index), entryValue),
											entryValue,
											false,
										)}
									{/each}
								</div>
							{/if}
						{:else if mode === 'editable' && enumValues.length > 0}
							<select
								class="h-9 rounded-md border border-input bg-background px-3 text-xs"
								value={typeof currentValue === 'string' || typeof currentValue === 'number' || typeof currentValue === 'boolean'
									? String(currentValue)
									: ''}
								onchange={(event) => {
									const selected = enumValues.find((entryValue) => String(entryValue) === event.currentTarget.value);
									if (selected !== undefined) {
										patchPointerValue(pointer, selected);
									}
								}}
							>
								{#each enumValues as enumValue (`${pointer}:${String(enumValue)}`)}
									<option value={String(enumValue)}>{String(enumValue)}</option>
								{/each}
							</select>
						{:else if mode === 'editable' && kind === 'boolean'}
							<select
								class="h-9 rounded-md border border-input bg-background px-3 text-xs"
								value={currentValue === true ? 'true' : 'false'}
								onchange={(event) => patchPointerValue(pointer, event.currentTarget.value === 'true')}
							>
								<option value="true">true</option>
								<option value="false">false</option>
							</select>
						{:else if mode === 'editable' && (kind === 'number' || kind === 'integer')}
							<Input
								type="number"
								value={typeof currentValue === 'number' ? String(currentValue) : ''}
								oninput={(event) => {
									const nextValue = Number(event.currentTarget.value);
									if (Number.isFinite(nextValue)) {
										patchPointerValue(pointer, kind === 'integer' ? Math.trunc(nextValue) : nextValue);
									}
								}}
								class="h-9 text-xs"
							/>
						{:else if mode === 'editable' && kind === 'string'}
							<Input
								value={typeof currentValue === 'string' ? currentValue : ''}
								oninput={(event) => patchPointerValue(pointer, event.currentTarget.value)}
								class="h-9 text-xs"
							/>
						{:else if isPrimitive(currentValue)}
							<div class="rounded-lg border bg-muted/40 px-3 py-2 text-xs whitespace-pre-wrap text-foreground">
								{typeof currentValue === 'string' ? currentValue : JSON.stringify(currentValue)}
							</div>
						{:else}
							<ScrollView orientation="horizontal" class="w-full" contentClass="min-w-max">
								<pre class="rounded-lg border bg-muted/40 px-3 py-2 text-[11px] text-foreground">
{JSON.stringify(currentValue, null, 2)}</pre
								>
							</ScrollView>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/snippet}

<div class="grid gap-2">
	{@render RenderNode('root', '', schema, value, true)}
</div>
