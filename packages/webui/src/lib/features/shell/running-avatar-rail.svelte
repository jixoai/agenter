<script lang="ts">
	import MessageSquareMoreIcon from '@lucide/svelte/icons/message-square-more';

	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import type { RunningAvatarRailItem } from '$lib/features/runtime/runtime-shell-state';
	import {
		resolveRuntimeStatusLabel,
		resolveRuntimeStatusTone,
	} from '$lib/features/runtime/runtime-shell-state';

	let {
		items,
	}: {
		items: RunningAvatarRailItem[];
	} = $props();
</script>

<Sidebar.Group>
	<Sidebar.GroupLabel>Running Avatars</Sidebar.GroupLabel>
	<Sidebar.Menu>
		{#if items.length === 0}
			<Sidebar.MenuItem>
				<div
					class="rounded-lg border border-dashed border-sidebar-border/80 px-3 py-3 text-xs text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden"
				>
					No running avatars.
				</div>
				<div
					class="hidden size-8 items-center justify-center rounded-md border border-dashed border-sidebar-border/80 text-[10px] text-sidebar-foreground/70 group-data-[collapsible=icon]:flex"
					title="No running avatars"
				>
					0
				</div>
			</Sidebar.MenuItem>
		{:else}
			{#each items as item (item.sessionId)}
				<Sidebar.MenuItem>
					<Sidebar.MenuButton isActive={item.active} size="lg">
						{#snippet child({ props })}
							<a href={item.href} {...props} data-running-avatar-link={item.sessionId}>
								<div class="relative shrink-0">
									<ProfileAvatar label={item.label} src={item.iconUrl} class="size-8 rounded-xl" />
									<span
										class={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-sidebar ${resolveRuntimeStatusTone(item.status)}`}
										title={resolveRuntimeStatusLabel(item.status)}
									></span>
								</div>
								<div class="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
									<div class="flex items-center gap-2">
										<span class="truncate text-sm font-medium">{item.label}</span>
										{#if item.unreadCount > 0}
											<span
												class="inline-flex min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold text-white"
											>
												{item.unreadCount}
											</span>
										{/if}
									</div>
									<div class="mt-1 flex items-center gap-1.5 text-[11px] text-sidebar-foreground/70">
										<MessageSquareMoreIcon class="size-3" />
										<span class="truncate">{item.workspaceName}</span>
										<span>·</span>
										<span class="truncate">{resolveRuntimeStatusLabel(item.status)}</span>
									</div>
								</div>
							</a>
						{/snippet}
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
			{/each}
		{/if}
	</Sidebar.Menu>
</Sidebar.Group>
