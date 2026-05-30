<script lang="ts">
	import * as Avatar from '$lib/components/ui/avatar/index.js';
	import { onMount } from 'svelte';
	import { cn } from '$lib/utils.js';

	let {
		label,
		src = null,
		class: className,
	}: {
		label: string;
		src?: string | null;
		class?: string;
	} = $props();

	const initials = $derived(
		label
			.split(/\s+/u)
			.filter(Boolean)
			.slice(0, 2)
			.map((segment) => segment[0]?.toUpperCase() ?? '')
			.join('') || '?',
	);

	let rootRef = $state<HTMLElement | null>(null);
	let rasterSrc = $state<string | null>(null);

	const withAvatarRasterSize = (value: string, size: number): string => {
		const trimmed = value.trim();
		if (!trimmed || !trimmed.includes('/media/')) {
			return trimmed;
		}
		if (typeof window === 'undefined') {
			return trimmed;
		}
		try {
			const url = new URL(trimmed, window.location.href);
			if (url.searchParams.get('format') === 'svg') {
				return url.toString();
			}
			url.searchParams.set('size', String(size));
			return url.toString();
		} catch {
			return trimmed;
		}
	};

	const computeRasterSize = (element: HTMLElement): number => {
		const rect = element.getBoundingClientRect();
		const dpr = typeof window === 'undefined' ? 1 : Math.max(1, window.devicePixelRatio || 1);
		const pixelSize = Math.max(rect.width, rect.height) * dpr * 1.25;
		return Math.min(1024, Math.max(96, Math.ceil(pixelSize)));
	};

	const refreshRasterSrc = (): void => {
		if (!src) {
			rasterSrc = null;
			return;
		}
		if (!rootRef || typeof window === 'undefined') {
			rasterSrc = src;
			return;
		}
		rasterSrc = withAvatarRasterSize(src, computeRasterSize(rootRef));
	};

	$effect(() => {
		src;
		refreshRasterSrc();
	});

	onMount(() => {
		refreshRasterSrc();
		if (!rootRef || typeof ResizeObserver === 'undefined') {
			return;
		}
		let frame = 0;
		const scheduleRefresh = (): void => {
			if (frame !== 0) {
				cancelAnimationFrame(frame);
			}
			frame = requestAnimationFrame(() => {
				frame = 0;
				refreshRasterSrc();
			});
		};
		const observer = new ResizeObserver(() => {
			scheduleRefresh();
		});
		observer.observe(rootRef);
		return () => {
			if (frame !== 0) {
				cancelAnimationFrame(frame);
			}
			observer.disconnect();
		};
	});
</script>

<Avatar.Root bind:ref={rootRef} class={cn('size-9 rounded-xl border border-border/80 bg-muted/50', className)}>
	{#if rasterSrc}
		<Avatar.Image src={rasterSrc} alt={label} class="object-cover" />
	{/if}
	<Avatar.Fallback class="bg-primary/10 text-primary text-xs font-semibold">{initials}</Avatar.Fallback>
</Avatar.Root>
