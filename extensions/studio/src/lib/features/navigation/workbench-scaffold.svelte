<script lang="ts">
	import { Scaffold } from '@agenter/svelte-components';
	import type { Snippet } from 'svelte';

	import { cn } from '$lib/utils.js';

	type WorkbenchSurfaceTone = 'page' | 'pane';
	type WorkbenchSurfaceBody = 'body' | 'scroll';

	const rootClassByTone = (tone: WorkbenchSurfaceTone): string =>
		tone === 'pane'
			? 'h-full rounded-[1.05rem] border border-border/55 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--card),white_8%)_0%,color-mix(in_srgb,var(--background),var(--card)_54%)_100%)] text-card-foreground shadow-[inset_0_1px_0_color-mix(in_srgb,var(--background),white_76%)]'
			: 'h-full border-0 bg-transparent text-card-foreground shadow-none';

	const headerClassByTone = (tone: WorkbenchSurfaceTone): string =>
		tone === 'pane'
			? 'grid gap-3 border-b border-border/55 px-5 py-4'
			: 'grid gap-3 border-b border-border/60 px-5 py-4 md:px-7';

	const footerClassByTone = (tone: WorkbenchSurfaceTone): string =>
		tone === 'pane'
			? 'border-t border-border/55 bg-transparent px-5 py-4'
			: 'border-t border-border/60 bg-transparent px-5 py-4 md:px-7';

	const scrollContentClassByTone = (tone: WorkbenchSurfaceTone): string =>
		tone === 'pane' ? 'grid gap-4 p-4 md:p-5' : 'grid gap-5 px-5 py-5 md:px-7 md:py-6';

	let {
		id,
		style,
		'data-testid': testId,
		class: className,
		tone = 'page',
		body = 'body',
		headerClass,
		bodyClass,
		contentClass,
		footerClass,
		header,
		footer,
		children,
	}: {
		id?: string;
		style?: string;
		'data-testid'?: string;
		class?: string;
		tone?: WorkbenchSurfaceTone;
		body?: WorkbenchSurfaceBody;
		headerClass?: string;
		bodyClass?: string;
		contentClass?: string;
		footerClass?: string;
		header?: Snippet;
		footer?: Snippet;
		children?: Snippet;
	} = $props();
</script>

<Scaffold.Root
	{id}
	{style}
	class={cn(rootClassByTone(tone), className)}
	data-testid={testId}
	data-workbench-surface={tone}
>
	{#if header}
		<Scaffold.Header
			class={cn(headerClassByTone(tone), headerClass)}
			data-workbench-surface-region="header"
		>
			{@render header()}
		</Scaffold.Header>
	{/if}

	{#if body === 'scroll'}
		<Scaffold.ScrollBody
			contentClass={cn(scrollContentClassByTone(tone), contentClass)}
			data-workbench-surface-region="body"
			data-workbench-surface-body="scroll"
		>
			{@render children?.()}
		</Scaffold.ScrollBody>
	{:else}
		<Scaffold.Body
			class={cn('h-full', bodyClass)}
			data-workbench-surface-region="body"
			data-workbench-surface-body="body"
		>
			{@render children?.()}
		</Scaffold.Body>
	{/if}

	{#if footer}
		<Scaffold.Footer
			class={cn(footerClassByTone(tone), footerClass)}
			data-workbench-surface-region="footer"
		>
			{@render footer()}
		</Scaffold.Footer>
	{/if}
</Scaffold.Root>
