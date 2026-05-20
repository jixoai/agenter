<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';

	import { DialogScaffold, Scaffold, SidebarScaffold } from '@agenter/svelte-components';

	const { Story } = defineMeta({
		title: 'Primitives/Layout/Scaffold Family',
		component: Scaffold.Root,
	});
</script>

<script lang="ts">
	import { expect } from 'storybook/test';

	const scaffoldItems = Array.from({ length: 24 }, (_, index) => `Scaffold item ${index + 1}`);
	const splitItems = Array.from({ length: 12 }, (_, index) => `Room ${index + 1}`);

	const queryScrollViewports = (canvasElement: HTMLElement): HTMLElement[] =>
		Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-scroll-view-viewport]'));
</script>

<Story
	name="Scaffold scroll body owns the only scroll viewport"
	asChild
	play={async ({ canvasElement }) => {
		const viewports = queryScrollViewports(canvasElement);

		await expect(viewports).toHaveLength(1);
		viewports[0]!.scrollTop = viewports[0]!.scrollHeight;
		viewports[0]!.dispatchEvent(new Event('scroll'));
		await new Promise((resolve) => window.setTimeout(resolve, 50));
		await expect(canvasElement.textContent).toContain('Scaffold item 24');
	}}
>
	<div class="h-80 w-[28rem] rounded-2xl border">
		<Scaffold.Root>
			<Scaffold.Header class="border-b px-4 py-3">
				<div class="text-sm font-semibold">Scaffold header</div>
			</Scaffold.Header>
			<Scaffold.ScrollBody contentClass="grid gap-2 p-4">
				{#each scaffoldItems as item}
					<div class="rounded-xl border px-3 py-2 text-sm">{item}</div>
				{/each}
			</Scaffold.ScrollBody>
			<Scaffold.Footer class="border-t px-4 py-3 text-xs text-muted-foreground">
				Footer actions remain outside the scroll body.
			</Scaffold.Footer>
		</Scaffold.Root>
	</div>
</Story>

<Story
	name="Dialog scaffold keeps header and footer outside the scroll body"
	asChild
	play={async ({ canvasElement }) => {
		const viewports = queryScrollViewports(canvasElement);

		await expect(viewports).toHaveLength(1);
		await expect(canvasElement.textContent).toContain('Bind superadmin key');
		await expect(canvasElement.textContent).toContain('Authenticate');
	}}
>
	<div class="h-80 w-[28rem] rounded-2xl border">
		<DialogScaffold.Root>
			<DialogScaffold.Header class="grid-cols-1">
				<div class="grid gap-1">
					<div class="text-base font-semibold">Bind superadmin key</div>
					<div class="text-sm text-muted-foreground">Dialog chrome stays fixed while only the body scrolls.</div>
				</div>
			</DialogScaffold.Header>
			<DialogScaffold.ScrollBody contentClass="grid gap-3 p-4">
				{#each scaffoldItems as item}
					<div class="rounded-xl border px-3 py-2 text-sm">{item}</div>
				{/each}
			</DialogScaffold.ScrollBody>
			<DialogScaffold.Footer>
				<button class="rounded-lg border px-3 py-2 text-sm">Later</button>
				<button class="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">Authenticate</button>
			</DialogScaffold.Footer>
		</DialogScaffold.Root>
	</div>
</Story>

<Story
	name="Sidebar scaffold keeps compact stack and desktop split"
	asChild
	play={async ({ canvasElement }) => {
		const splitRoot = canvasElement.querySelector<HTMLElement>('[data-slot="sidebar-scaffold-root"]');
		await expect(splitRoot?.dataset.padding).toBe('none');
		await expect(canvasElement.textContent).toContain('Room 12');
	}}
>
	<div class="h-[36rem] rounded-2xl border">
		<SidebarScaffold.Root padding="none">
			<SidebarScaffold.Sidebar class="border-b md:border-r md:border-b-0">
				<Scaffold.Root class="h-full">
					<Scaffold.Header class="border-b px-4 py-3">
						<div class="text-sm font-semibold">Rooms</div>
					</Scaffold.Header>
					<Scaffold.ScrollBody contentClass="grid gap-2 p-3">
						{#each splitItems as item}
							<div class="rounded-xl border px-3 py-2 text-sm">{item}</div>
						{/each}
					</Scaffold.ScrollBody>
				</Scaffold.Root>
			</SidebarScaffold.Sidebar>
			<SidebarScaffold.Content>
				<Scaffold.Root class="h-full">
					<Scaffold.Header class="border-b px-4 py-3">
						<div class="text-sm font-semibold">Transcript</div>
					</Scaffold.Header>
					<Scaffold.ScrollBody contentClass="grid gap-2 p-3">
						{#each scaffoldItems as item}
							<div class="rounded-xl border px-3 py-2 text-sm">{item}</div>
						{/each}
					</Scaffold.ScrollBody>
				</Scaffold.Root>
			</SidebarScaffold.Content>
		</SidebarScaffold.Root>
	</div>
</Story>
