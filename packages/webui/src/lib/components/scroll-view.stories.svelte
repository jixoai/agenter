<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';

	import ScrollView from './scroll-view.svelte';

	const { Story } = defineMeta({
		title: 'Primitives/ScrollView',
		component: ScrollView,
	});
</script>

<script lang="ts">
	import { expect, within } from 'storybook/test';

	const staticItems = Array.from({ length: 24 }, (_, index) => `Static item ${index + 1}`);
	const virtualItems = Array.from({ length: 120 }, (_, index) => `Virtual item ${index + 1}`);

	const queryViewport = (canvasElement: HTMLElement): HTMLElement => {
		const viewport = canvasElement.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]');
		if (!viewport) {
			throw new Error('ScrollView viewport not found');
		}
		return viewport;
	};
</script>

<Story
	name="Static content"
	asChild
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const viewport = queryViewport(canvasElement);

		await expect(canvas.getByText('Static item 1')).toBeInTheDocument();
		viewport.scrollTop = viewport.scrollHeight;
		viewport.dispatchEvent(new Event('scroll'));
		await new Promise((resolve) => window.setTimeout(resolve, 50));
		await expect(canvas.getByText('Static item 24')).toBeInTheDocument();
	}}
>
	<div class="h-64 w-80 rounded-xl border">
		<ScrollView class="h-full" contentClass="grid gap-2 p-3">
			{#each staticItems as itemLabel}
				<div class="rounded-lg border bg-muted/40 px-3 py-2 text-sm">{itemLabel}</div>
			{/each}
		</ScrollView>
	</div>
</Story>

<Story
	name="Virtual content"
	asChild
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const viewport = queryViewport(canvasElement);

		await expect(canvas.getByText('Virtual item 1')).toBeInTheDocument();
		viewport.scrollTop = viewport.scrollHeight;
		viewport.dispatchEvent(new Event('scroll'));
		await new Promise((resolve) => window.setTimeout(resolve, 50));
		await expect(canvas.getByText('Virtual item 120')).toBeInTheDocument();
		await expect(canvas.queryByText('Virtual item 1')).not.toBeInTheDocument();
	}}
>
	<div class="h-64 w-80 rounded-xl border">
		<ScrollView
			class="h-full"
			virtual={{
				items: virtualItems,
				itemSize: 28,
				overscan: 2,
			}}
		>
			{#snippet item(itemLabel)}
				<div class="rounded-lg border bg-muted/40 px-3 py-1 text-sm">{itemLabel}</div>
			{/snippet}
		</ScrollView>
	</div>
</Story>
