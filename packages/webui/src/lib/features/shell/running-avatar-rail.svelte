<script lang="ts">
	import PinIcon from '@lucide/svelte/icons/pin';
	import PinOffIcon from '@lucide/svelte/icons/pin-off';

	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { cn } from '$lib/utils.js';
	import type { AvatarSessionRailItem } from '$lib/features/runtime/runtime-shell-state';
	import { resolveRuntimeStatusLabel, resolveRuntimeStatusTone } from '$lib/features/runtime/runtime-shell-state';

	let {
		items,
		onTogglePin,
	}: {
		items: AvatarSessionRailItem[];
		onTogglePin?: (sessionId: string, nextPinned: boolean) => void;
	} = $props();
</script>

<Sidebar.MenuSub>
	{#if items.length === 0}
		<Sidebar.MenuSubItem>
			<div
				class="text-sidebar-foreground/60 flex h-7 items-center rounded-md px-2 text-xs"
				data-running-avatar-empty
			>
				No avatar sessions
			</div>
		</Sidebar.MenuSubItem>
	{:else}
		{#each items as item (item.sessionId)}
			<Sidebar.MenuSubItem>
				<Sidebar.MenuSubButton isActive={item.active}>
					{#snippet child({ props })}
						{@const baseClassName = typeof props.class === 'string' ? props.class : ''}
						<a
							href={item.href}
							{...props}
							class={cn(baseClassName, 'pr-8')}
							data-running-avatar-link={item.sessionId}
							title={item.detail}
						>
							<div class="relative shrink-0">
								<ProfileAvatar label={item.label} src={item.iconUrl} class="size-5 rounded-md" />
								{#if item.status}
									<span
										class={`absolute -bottom-0.5 -right-0.5 size-2 rounded-full ring-2 ring-sidebar ${resolveRuntimeStatusTone(item.status)}`}
										title={resolveRuntimeStatusLabel(item.status)}
									></span>
								{/if}
							</div>
							<span class="truncate">{item.label}</span>
							{#if item.unreadCount > 0}
								<div
									class="inline-flex min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white"
								>
									{item.unreadCount}
								</div>
							{/if}
						</a>
					{/snippet}
				</Sidebar.MenuSubButton>
				{#if onTogglePin && item.pinEnabled}
					<button
						type="button"
						class={cn(
							'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground absolute end-1 top-1 flex size-5 items-center justify-center rounded-md transition-opacity',
							'group-data-[collapsible=icon]:hidden md:opacity-0 md:group-hover/menu-sub-item:opacity-100 md:group-focus-within/menu-sub-item:opacity-100',
							item.pinned && 'opacity-100 text-sidebar-accent-foreground',
						)}
						aria-label={item.pinned ? `Unpin ${item.label}` : `Pin ${item.label}`}
						title={item.pinned ? `Unpin ${item.label}` : `Pin ${item.label}`}
						data-running-avatar-pin={item.sessionId}
						onclick={(event) => {
							event.preventDefault();
							event.stopPropagation();
							onTogglePin(item.sessionId, !item.pinned);
						}}
					>
						{#if item.pinned}
							<PinOffIcon class="size-3.5" />
						{:else}
							<PinIcon class="size-3.5" />
						{/if}
					</button>
				{/if}
			</Sidebar.MenuSubItem>
		{/each}
	{/if}
</Sidebar.MenuSub>
