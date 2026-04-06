<script lang="ts">
	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import type { RunningAvatarRailItem } from '$lib/features/runtime/runtime-shell-state';
	import { resolveRuntimeStatusLabel, resolveRuntimeStatusTone } from '$lib/features/runtime/runtime-shell-state';

	let {
		items,
	}: {
		items: RunningAvatarRailItem[];
	} = $props();
</script>

<Sidebar.MenuSub>
	{#if items.length === 0}
		<Sidebar.MenuSubItem>
			<div
				class="text-sidebar-foreground/60 flex h-7 items-center rounded-md px-2 text-xs"
				data-running-avatar-empty
			>
				No running avatars
			</div>
		</Sidebar.MenuSubItem>
	{:else}
		{#each items as item (item.sessionId)}
			<Sidebar.MenuSubItem>
				<Sidebar.MenuSubButton isActive={item.active}>
					{#snippet child({ props })}
						<a
							href={item.href}
							{...props}
							data-running-avatar-link={item.sessionId}
							title={`${item.workspaceName} · ${resolveRuntimeStatusLabel(item.status)}`}
						>
							<div class="relative shrink-0">
								<ProfileAvatar label={item.label} src={item.iconUrl} class="size-5 rounded-md" />
								<span
									class={`absolute -bottom-0.5 -right-0.5 size-2 rounded-full ring-2 ring-sidebar ${resolveRuntimeStatusTone(item.status)}`}
									title={resolveRuntimeStatusLabel(item.status)}
								></span>
							</div>
							<span class="truncate">{item.label}</span>
							{#if item.unreadCount > 0}
								<div
									class="ms-auto inline-flex min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white"
								>
									{item.unreadCount}
								</div>
							{/if}
						</a>
					{/snippet}
				</Sidebar.MenuSubButton>
			</Sidebar.MenuSubItem>
		{/each}
	{/if}
</Sidebar.MenuSub>
