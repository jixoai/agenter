<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';

	import RunningAvatarRail from './running-avatar-rail.svelte';

	const { Story } = defineMeta({
		title: 'Features/Shell/RunningAvatarRail',
		component: RunningAvatarRail,
	});
</script>

<script lang="ts">
	import { expect, within } from 'storybook/test';

	import * as Sidebar from '$lib/components/ui/sidebar/index.js';

	const items = [
		{
			sessionId: 'session-alpha',
			label: 'architect',
			workspacePath: '/repo/alpha',
			workspaceName: 'alpha',
			status: 'running' as const,
			unreadCount: 3,
			iconUrl: null,
			href: '/runtime/session-alpha/attention',
			active: true,
		},
		{
			sessionId: 'session-beta',
			label: 'reviewer',
			workspacePath: '/repo/beta',
			workspaceName: 'beta',
			status: 'starting' as const,
			unreadCount: 0,
			iconUrl: null,
			href: '/runtime/session-beta/attention',
			active: false,
		},
	];
</script>

<Story
	name="Desktop rail"
	asChild
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('Running Avatars')).toBeInTheDocument();
		await expect(canvas.getByRole('link', { name: /architect/i })).toHaveAttribute(
			'href',
			'/runtime/session-alpha/attention',
		);
		await expect(canvas.getByText('3')).toBeInTheDocument();
		await expect(canvas.getByText('alpha')).toBeInTheDocument();
	}}
>
	<div class="h-96 w-72">
		<Sidebar.Provider>
			<Sidebar.Sidebar collapsible="icon" variant="inset">
				<Sidebar.Content>
					<RunningAvatarRail {items} />
				</Sidebar.Content>
			</Sidebar.Sidebar>
		</Sidebar.Provider>
	</div>
</Story>
