<script lang="ts">
	import MessageSquareMoreIcon from '@lucide/svelte/icons/message-square-more';

	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import { cn } from '$lib/utils.js';
	import type { RunningAvatarRailItem } from '$lib/features/runtime/runtime-shell-state';
	import {
		resolveRuntimeStatusLabel,
		resolveRuntimeStatusTone,
	} from '$lib/features/runtime/runtime-shell-state';

	let {
		items,
		showHeading = true,
	}: {
		items: RunningAvatarRailItem[];
		showHeading?: boolean;
	} = $props();
</script>

<div class="grid h-full gap-3">
	{#if showHeading}
		<div class="grid gap-1">
			<h2 class="text-sm font-semibold">Open Avatars</h2>
			<p class="text-xs text-muted-foreground">Secondary navigation for open avatar tabs and runtime sessions.</p>
		</div>
	{/if}

	{#if items.length === 0}
		<div class="rounded-2xl border border-dashed px-4 py-5 text-sm text-muted-foreground">
			No open avatars.
		</div>
	{:else}
		<div class="grid gap-2">
			{#each items as item (item.sessionId)}
				<a
					href={item.href}
					data-running-avatar-link={item.sessionId}
					data-active={item.active}
					class={cn(
						'grid gap-2 rounded-2xl border px-3 py-3 transition-colors',
						'hover:bg-muted/50',
						item.active && 'border-primary bg-primary/6',
					)}
					title={item.detail}
				>
					<div class="flex items-center gap-3">
						<div class="relative shrink-0">
							<ProfileAvatar label={item.label} src={item.iconUrl} class="size-9 rounded-xl" />
							{#if item.status}
								<span
									class={cn(
										'absolute -bottom-0.5 -right-0.5 size-3 rounded-full ring-2 ring-background',
										resolveRuntimeStatusTone(item.status),
									)}
									title={resolveRuntimeStatusLabel(item.status)}
								></span>
							{/if}
						</div>
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<div class="truncate text-sm font-medium">{item.label}</div>
								{#if item.unreadCount > 0}
									<span class="inline-flex min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold text-white">
										{item.unreadCount}
									</span>
								{/if}
							</div>
							<div class="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
								<MessageSquareMoreIcon class="size-3" />
								<span class="truncate">{item.workspaceName}</span>
								{#if item.status}
									<span>·</span>
									<span>{resolveRuntimeStatusLabel(item.status)}</span>
								{/if}
							</div>
						</div>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
