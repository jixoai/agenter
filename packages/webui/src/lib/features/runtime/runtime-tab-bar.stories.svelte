<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';

	import RuntimeTabBar from './runtime-tab-bar.svelte';

	const { Story } = defineMeta({
		title: 'Features/Runtime/RuntimeTabBar',
		component: RuntimeTabBar,
	});
</script>

<script lang="ts">
	import { expect, fn, within } from 'storybook/test';

	import type { RuntimeTabId } from './runtime-shell-state';

	const tabs = [
		{
			id: 'heartbeat',
			label: 'Heartbeat',
			badgeLabel: '12',
			badgeClassName: 'bg-teal-600 text-white',
			badgeAnimated: true,
		},
		{ id: 'attention', label: 'Attention' },
		{ id: 'settings', label: 'Settings' },
	] satisfies Array<{
		id: RuntimeTabId;
		label: string;
		badgeLabel?: string;
		badgeClassName?: string;
		badgeAnimated?: boolean;
	}>;

	const onNavigate = fn<(tab: RuntimeTabId) => void>();
</script>

<Story
	name="Heartbeat badge"
	asChild
	play={async ({ canvasElement, userEvent }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('12')).toBeInTheDocument();
		await userEvent.click(canvas.getByRole('tab', { name: /heartbeat/i }));
		await expect(onNavigate).toHaveBeenCalledWith('heartbeat');
	}}
>
	<div class="w-full max-w-3xl rounded-2xl border p-3">
		<RuntimeTabBar sessionId="session-alpha" activeTab="attention" {tabs} {onNavigate} />
	</div>
</Story>
