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
			detail: 'alpha · Running',
			status: 'running' as const,
			unreadCount: 3,
			iconUrl: null,
			href: '/avatars/runtime/session-alpha/attention',
			active: true,
			pinned: true,
			pinEnabled: true,
		},
		{
			sessionId: 'session-beta',
			label: 'reviewer',
			workspacePath: '/repo/beta',
			workspaceName: 'beta',
			detail: 'beta · Starting',
			status: 'starting' as const,
			unreadCount: 0,
			iconUrl: null,
			href: '/avatars/runtime/session-beta/attention',
			active: false,
			pinned: false,
			pinEnabled: true,
		},
	];
</script>

<Story
	name="Desktop rail"
	asChild
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByRole('link', { name: /architect/i })).toHaveAttribute(
			'href',
			'/avatars/runtime/session-alpha/attention',
		);
		await expect(canvas.getByText('3')).toBeInTheDocument();
		await expect(canvas.queryByText('Running Avatars')).toBeNull();
	}}
>
	<div class="h-96 w-72">
		<Sidebar.Provider>
			<Sidebar.Sidebar collapsible="icon" variant="inset">
				<Sidebar.Content>
					<Sidebar.Group>
						<Sidebar.Menu>
							<Sidebar.MenuItem>
								<Sidebar.MenuButton isActive>
									{#snippet child({ props })}
										<a href="/avatars" {...props}>
											<span>Avatars</span>
										</a>
									{/snippet}
								</Sidebar.MenuButton>
								<RunningAvatarRail {items} />
							</Sidebar.MenuItem>
						</Sidebar.Menu>
					</Sidebar.Group>
				</Sidebar.Content>
			</Sidebar.Sidebar>
		</Sidebar.Provider>
	</div>
</Story>
