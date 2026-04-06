<script lang="ts">
	import { ScrollView } from '@agenter/svelte-components';
	import { Tabs as TabsPrimitive } from 'bits-ui';
	import CircleEllipsisIcon from '@lucide/svelte/icons/circle-ellipsis';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import XIcon from '@lucide/svelte/icons/x';
	import { goto } from '$app/navigation';
	import type { Component } from 'svelte';

	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { cn } from '$lib/utils.js';

	export interface WorkbenchTabMenuItem {
		id: string;
		label: string;
		danger?: boolean;
		disabled?: boolean;
		onSelect?: () => void | Promise<void>;
	}

	export interface WorkbenchTabItem {
		id: string;
		label: string;
		href?: string;
		title?: string;
		description?: string;
		icon?: Component<{ class?: string }>;
		avatarLabel?: string;
		avatarUrl?: string | null;
		badgeLabel?: string;
		badgeClassName?: string;
		loading?: boolean;
		closable?: boolean;
		onClose?: () => void | Promise<void>;
		menuItems?: WorkbenchTabMenuItem[];
	}

	let {
		ariaLabel,
		value,
		tabs,
		onValueChange,
		fusedBelow = false,
		class: className,
	}: {
		ariaLabel: string;
		value: string;
		tabs: WorkbenchTabItem[];
		onValueChange?: (value: string) => void | Promise<void>;
		fusedBelow?: boolean;
		class?: string;
	} = $props();

	let openMenus = $state<Record<string, boolean>>({});
	let pendingSelection = $state<string | null>(null);
	let trackedTabElements = $state<Record<string, HTMLButtonElement>>({});

	const updateMenuOpen = (tabId: string, open: boolean): void => {
		openMenus = {
			...openMenus,
			[tabId]: open,
		};
	};

	const handleTabSelection = async (nextValue: string): Promise<void> => {
		if (nextValue === value || pendingSelection === nextValue) {
			return;
		}
		pendingSelection = nextValue;
		if (onValueChange) {
			try {
				await onValueChange(nextValue);
			} finally {
				pendingSelection = null;
			}
			return;
		}
		const tab = tabs.find((item) => item.id === nextValue);
		if (tab?.href) {
			try {
				await goto(tab.href, {
					noScroll: true,
					keepFocus: true,
				});
			} finally {
				pendingSelection = null;
			}
			return;
		}
		pendingSelection = null;
	};

	const runTriggerClick = (
		event: MouseEvent,
		nextValue: string,
		triggerClick: ((event: MouseEvent) => void) | undefined,
	): void => {
		triggerClick?.(event);
		void handleTabSelection(nextValue);
	};

	const asMouseHandler = (candidate: unknown): ((event: MouseEvent) => void) | undefined =>
		typeof candidate === 'function' ? (candidate as (event: MouseEvent) => void) : undefined;

	const trackTabElement = (element: HTMLButtonElement, tabId: string) => {
		trackedTabElements = {
			...trackedTabElements,
			[tabId]: element,
		};
		return {
			destroy: () => {
				const { [tabId]: _removed, ...rest } = trackedTabElements;
				trackedTabElements = rest;
			},
		};
	};

	$effect(() => {
		trackedTabElements[value]?.scrollIntoView({
			block: 'nearest',
			inline: 'nearest',
		});
	});

</script>

<Tabs.Root value={value} onValueChange={(nextValue) => void handleTabSelection(nextValue)}>
	<nav aria-label={ariaLabel} class={cn('grid gap-0', className)} data-workbench-chrome>
		<div
			class={cn(
				'border border-border/65 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--muted),white_52%)_0%,color-mix(in_srgb,var(--muted),white_20%)_52%,color-mix(in_srgb,var(--background),transparent_12%)_100%)] px-2.5 pt-2.5 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--background),white_78%),0_24px_48px_-40px_color-mix(in_srgb,var(--foreground),transparent_24%)]',
				fusedBelow ? 'rounded-t-[1.35rem] border-b-0 pb-0' : 'rounded-[1.35rem] pb-2.5',
			)}
		>
			<ScrollView class="w-full [touch-action:pan-x]" orientation="horizontal" contentClass="min-w-max">
				<Tabs.List class="relative flex w-max min-w-full items-end gap-1.5 bg-transparent px-1 pb-0 after:pointer-events-none after:absolute after:right-0 after:bottom-0 after:left-0 after:h-px after:bg-[color-mix(in_srgb,var(--border),transparent_18%)] after:content-['']">
					{#each tabs as tab (tab.id)}
						<div class="group relative shrink-0" data-workbench-tab-entry>
							<Tooltip.Root>
								<Tooltip.Trigger>
									{#snippet child({ props })}
										<TabsPrimitive.Trigger value={tab.id}>
											{#snippet child({ props: triggerProps })}
												<button
													{...props}
													{...triggerProps}
													use:trackTabElement={tab.id}
													type="button"
													data-workbench-tab={tab.id}
													class={cn(
														'relative inline-flex h-10 items-center justify-start gap-2 overflow-visible rounded-t-[0.95rem] rounded-b-none border border-transparent border-b-0 px-3.5 py-0 text-[12.5px] font-medium leading-none text-muted-foreground shadow-none transition-[color,background-color,border-color,box-shadow,transform]',
														'bg-[linear-gradient(180deg,color-mix(in_srgb,var(--muted),white_18%)_0%,color-mix(in_srgb,var(--muted),transparent_14%)_100%)] hover:text-foreground hover:[background:linear-gradient(180deg,color-mix(in_srgb,var(--muted),white_30%)_0%,color-mix(in_srgb,var(--muted),transparent_6%)_100%)]',
														'data-[state=active]:z-10 data-[state=active]:isolate data-[state=active]:-mb-px data-[state=active]:border-border/65',
														'data-[state=active]:[background:linear-gradient(180deg,color-mix(in_srgb,var(--card),white_34%)_0%,color-mix(in_srgb,var(--card),white_18%)_72%,color-mix(in_srgb,var(--card),transparent_0%)_100%)]',
														'data-[state=active]:text-foreground data-[state=active]:shadow-[inset_0_1px_0_color-mix(in_srgb,var(--background),white_70%),0_14px_24px_-22px_color-mix(in_srgb,var(--foreground),transparent_10%)]',
														fusedBelow
															? "data-[state=active]:after:absolute data-[state=active]:after:-right-px data-[state=active]:after:-bottom-[8px] data-[state=active]:after:-left-px data-[state=active]:after:-z-10 data-[state=active]:after:h-[8px] data-[state=active]:after:bg-[color-mix(in_srgb,var(--card),white_10%)] data-[state=active]:after:content-['']"
															: '',
														tab.closable || tab.menuItems?.length ? 'pr-12 sm:pr-14' : '',
														tab.closable && tab.menuItems?.length ? 'pr-16 sm:pr-20' : '',
													)}
													onclick={(event) => {
														runTriggerClick(event, tab.id, asMouseHandler(triggerProps.onclick));
													}}
													oncontextmenu={(event) => {
														if (!tab.menuItems?.length) {
															return;
														}
														event.preventDefault();
														updateMenuOpen(tab.id, true);
													}}
												>
													{#if tab.avatarLabel}
														<ProfileAvatar label={tab.avatarLabel} src={tab.avatarUrl} class="size-5 rounded-md" />
													{:else if tab.icon}
														<tab.icon class="size-4 shrink-0" />
													{/if}
													<span class="min-w-0 flex-1 self-center truncate text-left">{tab.label}</span>
													{#if tab.loading}
														<LoaderCircleIcon class="size-3.5 shrink-0 animate-spin text-muted-foreground" />
													{/if}
													{#if tab.badgeLabel}
														<span
															class={cn(
																'inline-flex min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold',
																tab.badgeClassName ?? 'bg-muted text-muted-foreground',
															)}
														>
															{tab.badgeLabel}
														</span>
													{/if}
												</button>
											{/snippet}
										</TabsPrimitive.Trigger>
									{/snippet}
								</Tooltip.Trigger>
								<Tooltip.Content side="bottom" align="start" class="max-w-80">
									<div class="grid gap-1">
										<div class="text-xs font-semibold text-foreground">{tab.title ?? tab.label}</div>
										{#if tab.description}
											<p class="text-xs leading-relaxed text-muted-foreground">{tab.description}</p>
										{/if}
									</div>
								</Tooltip.Content>
							</Tooltip.Root>

							{#if tab.menuItems?.length}
								<DropdownMenu.Root
									open={openMenus[tab.id] ?? false}
									onOpenChange={(open) => updateMenuOpen(tab.id, open)}
								>
									<DropdownMenu.Trigger>
										{#snippet child({ props })}
											<Button
												{...props}
												type="button"
												size="icon-sm"
												variant="ghost"
												class={cn(
													'workbench-tab-action absolute top-1/2 right-1 z-20 -translate-y-1/2 text-muted-foreground',
													tab.closable ? 'right-7' : 'right-1',
												)}
												data-workbench-tab-action="menu"
												aria-label={`Tab menu for ${tab.label}`}
												title={`Tab menu for ${tab.label}`}
												onclick={(event) => {
													event.preventDefault();
													event.stopPropagation();
												}}
											>
												<CircleEllipsisIcon class="size-3.5" />
											</Button>
										{/snippet}
									</DropdownMenu.Trigger>
									<DropdownMenu.Content align="end" sideOffset={8}>
										{#each tab.menuItems as item (item.id)}
											<DropdownMenu.Item
												disabled={item.disabled}
												class={item.danger ? 'text-destructive focus:text-destructive' : ''}
												onSelect={() => {
													void item.onSelect?.();
												}}
											>
												{item.label}
											</DropdownMenu.Item>
										{/each}
									</DropdownMenu.Content>
								</DropdownMenu.Root>
							{/if}

							{#if tab.closable}
								<Button
									type="button"
									size="icon-sm"
									variant="ghost"
									class="workbench-tab-action absolute top-1/2 right-1 z-20 -translate-y-1/2 text-muted-foreground"
									data-workbench-tab-action="close"
									aria-label={`Close ${tab.label}`}
									title={`Close ${tab.label}`}
									onclick={(event) => {
										event.preventDefault();
										event.stopPropagation();
										void tab.onClose?.();
									}}
								>
									<XIcon class="size-3.5" />
								</Button>
							{/if}
						</div>
					{/each}
				</Tabs.List>
			</ScrollView>
		</div>
	</nav>
</Tabs.Root>

<style>
	:global([data-workbench-chrome]) {
		container-type: inline-size;
	}

	:global([data-workbench-tab]) {
		max-inline-size: 12rem;
		min-inline-size: 7.25rem;
	}

	:global([data-workbench-tab-entry] [data-workbench-tab-action]) {
		opacity: 0;
		pointer-events: none;
		transition: opacity 160ms ease;
	}

	@container (min-width: 42rem) {
		:global([data-workbench-tab]) {
			max-inline-size: 16rem;
			min-inline-size: 8rem;
		}
	}

	@container (max-width: 31rem) {
		:global([data-workbench-tab]) {
			block-size: 2.25rem;
			max-inline-size: 9rem;
			min-inline-size: 5.75rem;
			gap: 0.375rem;
			padding-inline: 0.75rem;
			font-size: 0.72rem;
		}
	}

	@container (min-width: 64rem) {
		:global([data-workbench-tab]) {
			max-inline-size: 20rem;
		}
	}

	@container (min-width: 80rem) {
		:global([data-workbench-tab]) {
			max-inline-size: 22rem;
		}
	}

	@media (hover: hover) {
		:global([data-workbench-tab-entry]:hover [data-workbench-tab-action]),
		:global([data-workbench-tab-entry]:focus-within [data-workbench-tab-action]) {
			opacity: 1;
			pointer-events: auto;
		}
	}

	@media (pointer: coarse) {
		:global([data-workbench-tab-entry] [data-workbench-tab-action]) {
			display: none;
		}
	}
</style>
