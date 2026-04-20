<script lang="ts">
	import type { HeartbeatGroupItem } from '@agenter/client-sdk';

	import { MessageAvatar } from '$lib/components/ai-elements/message/index.js';
	import { cn } from '$lib/utils.js';

	import RuntimeHeartbeatEntry from './runtime-heartbeat-entry.svelte';
	import {
		buildHeartbeatSubjectSections,
		getHeartbeatGroupLabel,
		type HeartbeatSubjectSection,
	} from './runtime-heartbeat-parts';

	let {
		group,
		sessionIconUrl = null,
		avatarLabel = 'Avatar',
	}: {
		group: HeartbeatGroupItem;
		sessionIconUrl?: string | null;
		avatarLabel?: string;
	} = $props();

	type HeartbeatLayoutMode = 'compact' | 'detailed';

	const groupLabel = $derived(getHeartbeatGroupLabel(group));
	const sections = $derived(buildHeartbeatSubjectSections(group));
	let layoutMode = $state<HeartbeatLayoutMode>('compact');
</script>

<div
	class="grid min-w-0 gap-2.5"
	data-layout-mode={layoutMode}
	data-testid={`runtime-heartbeat-group-${group.id}`}
>
	{#snippet sectionRow(section: HeartbeatSubjectSection)}
		<div
			class={cn(
				'grid min-w-0 gap-2',
				section.role === 'assistant'
					? 'md:grid-cols-[auto_minmax(0,1fr)] md:items-start'
					: 'md:grid-cols-[minmax(0,1fr)_auto] md:items-start',
			)}
			data-role={section.role}
			data-testid={`runtime-heartbeat-section-${section.key}`}
		>
			{#if section.role === 'assistant'}
				<MessageAvatar class="size-8 ring-border/55" name={avatarLabel} src={sessionIconUrl} />
			{/if}
			<div
				class={cn(
					'min-w-0 w-full md:max-w-[78ch]',
					section.role === 'assistant' ? 'justify-self-start' : 'justify-self-end',
				)}
			>
				<RuntimeHeartbeatEntry
					{section}
					{layoutMode}
					groupLabel={groupLabel}
					groupTimestamp={group.createdAt}
					presentation={group.kind === 'compact' ? 'compact-special' : 'default'}
					onLayoutModeChange={(value) => {
						layoutMode = value;
					}}
				/>
			</div>
			{#if section.role !== 'assistant'}
				<MessageAvatar class="size-8 ring-border/55" name={avatarLabel} src={sessionIconUrl} />
			{/if}
		</div>
	{/snippet}

	{#if sections.length === 1}
		{@render sectionRow(sections[0]!)}
	{:else}
		{#each sections as section (section.key)}
			{@render sectionRow(section)}
		{/each}
	{/if}
</div>
