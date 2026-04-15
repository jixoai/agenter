<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";

	import { cn, type WithElementRef } from "../../internal/utils.js";
	import { setWorkbenchSplitDetailContext } from "./workbench-split-detail-context.js";
	import {
		resolveWorkbenchSplitDetailLayout,
		resolveWorkbenchSplitDetailMaxRatio,
		resolveWorkbenchSplitDetailMinRatio,
		resolveWorkbenchSplitDetailRatioFromPointer,
		shiftWorkbenchSplitDetailRatio,
	} from "./workbench-split-detail-math.js";
	import {
		resolveWorkbenchSplitDetailRatioSource,
		type WorkbenchSplitDetailRatioPersistence,
	} from "./workbench-split-detail-ratio-source.js";

	const KEYBOARD_STEP_PX = 24;
	const SAME_RATIO_EPSILON = 0.0001;

	let {
		ref = $bindable(null),
		class: className,
		style,
		compact = $bindable(false),
		ratioPersistence = null,
		leftMin = 380,
		rightMin = 280,
		handleSize = 12,
		defaultRatio = 0.625,
		compactThreshold,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
		compact?: boolean;
		ratioPersistence?: WorkbenchSplitDetailRatioPersistence;
		leftMin?: number;
		rightMin?: number;
		handleSize?: number;
		defaultRatio?: number;
		compactThreshold?: number;
		children?: Snippet;
	} = $props();

	let rootRef = $state<HTMLDivElement | null>(null);
	let currentRatio = $state(0.625);
	let measuredWidth = $state(0);
	let dragging = $state(false);
	let ratioSourceReady = $state(false);
	let lastSyncedRatio = $state<number | null>(null);

	const ratioSource = $derived(resolveWorkbenchSplitDetailRatioSource(ratioPersistence));
	const layout = $derived(
		resolveWorkbenchSplitDetailLayout({
			containerWidth: measuredWidth,
			ratio: currentRatio,
			leftMin,
			rightMin,
			handleSize,
			compactThreshold,
		}),
	);
	const rootStyle = $derived(
		[
			style,
			`--workbench-split-detail-left:${layout.leftWidth}px`,
			`--workbench-split-detail-handle:${Math.max(0, handleSize)}px`,
		]
			.filter(Boolean)
			.join(";"),
	);

	setWorkbenchSplitDetailContext({
		compact: () => compact,
		ratio: () => currentRatio,
	});

	const isHandleTarget = (target: EventTarget | null): boolean => {
		return target instanceof Element && Boolean(target.closest('[data-layout-role="workbench-split-detail-handle"]'));
	};

	const commitRatioFromPointer = (pointerOffset: number): void => {
		currentRatio = resolveWorkbenchSplitDetailRatioFromPointer({
			containerWidth: measuredWidth,
			pointerOffset,
			ratio: currentRatio,
			leftMin,
			rightMin,
			handleSize,
			compactThreshold,
		});
	};

	const handlePointerDown = (event: PointerEvent): void => {
		if (!rootRef || compact || event.button !== 0 || !isHandleTarget(event.target)) {
			return;
		}
		const rootRect = rootRef.getBoundingClientRect();
		dragging = true;
		commitRatioFromPointer(event.clientX - rootRect.left);
		const ownerDocument = rootRef.ownerDocument;
		const releaseDrag = (): void => {
			dragging = false;
			ownerDocument.removeEventListener("pointermove", handlePointerMove);
			ownerDocument.removeEventListener("pointerup", handlePointerUp);
			ownerDocument.removeEventListener("pointercancel", handlePointerUp);
		};
		const handlePointerMove = (moveEvent: PointerEvent): void => {
			commitRatioFromPointer(moveEvent.clientX - rootRect.left);
		};
		const handlePointerUp = (upEvent: PointerEvent): void => {
			if (upEvent.pointerId !== event.pointerId) {
				return;
			}
			releaseDrag();
		};
		ownerDocument.addEventListener("pointermove", handlePointerMove);
		ownerDocument.addEventListener("pointerup", handlePointerUp);
		ownerDocument.addEventListener("pointercancel", handlePointerUp);
		event.preventDefault();
	};

	const handleKeyDown = (event: KeyboardEvent): void => {
		if (!isHandleTarget(event.target) || compact) {
			return;
		}
		if (event.key === "ArrowLeft") {
			currentRatio = shiftWorkbenchSplitDetailRatio({
				containerWidth: measuredWidth,
				ratio: currentRatio,
				leftMin,
				rightMin,
				handleSize,
				compactThreshold,
				deltaPx: -KEYBOARD_STEP_PX,
			});
			event.preventDefault();
			return;
		}
		if (event.key === "ArrowRight") {
			currentRatio = shiftWorkbenchSplitDetailRatio({
				containerWidth: measuredWidth,
				ratio: currentRatio,
				leftMin,
				rightMin,
				handleSize,
				compactThreshold,
				deltaPx: KEYBOARD_STEP_PX,
			});
			event.preventDefault();
			return;
		}
		if (event.key === "Home") {
			currentRatio = resolveWorkbenchSplitDetailMinRatio({
				containerWidth: measuredWidth,
				leftMin,
				rightMin,
				handleSize,
				compactThreshold,
			});
			event.preventDefault();
			return;
		}
		if (event.key === "End") {
			currentRatio = resolveWorkbenchSplitDetailMaxRatio({
				containerWidth: measuredWidth,
				leftMin,
				rightMin,
				handleSize,
				compactThreshold,
			});
			event.preventDefault();
		}
	};

	$effect(() => {
		ref = rootRef;
	});

	$effect(() => {
		compact = layout.compact;
	});

	$effect(() => {
		if (ratioSource || lastSyncedRatio !== null) {
			return;
		}
		currentRatio = defaultRatio;
	});

	$effect(() => {
		if (!rootRef || typeof ResizeObserver === "undefined") {
			measuredWidth = rootRef?.clientWidth ?? 0;
			return;
		}
		const observedRoot = rootRef;
		let frame = 0;
		const commitWidth = (nextWidth: number): void => {
			if (frame !== 0) {
				cancelAnimationFrame(frame);
			}
			frame = requestAnimationFrame(() => {
				frame = 0;
				measuredWidth = nextWidth;
			});
		};
		const observer = new ResizeObserver((entries) => {
			const nextWidth = Math.round(entries[0]?.contentRect.width ?? observedRoot.clientWidth ?? 0);
			commitWidth(nextWidth);
		});
		observer.observe(observedRoot);
		commitWidth(observedRoot.clientWidth);
		return () => {
			if (frame !== 0) {
				cancelAnimationFrame(frame);
			}
			observer.disconnect();
		};
	});

	$effect(() => {
		const source = ratioSource;
		let cancelled = false;
		ratioSourceReady = false;
		lastSyncedRatio = null;
		if (!source) {
			ratioSourceReady = true;
			return;
		}
		void Promise.resolve(source.read())
			.then((value) => {
				if (cancelled || typeof value !== "number") {
					return;
				}
				currentRatio = value;
				lastSyncedRatio = value;
			})
			.finally(() => {
				if (!cancelled) {
					ratioSourceReady = true;
				}
			});
		const unsubscribe = source.subscribe?.((value) => {
			if (cancelled || dragging) {
				return;
			}
			currentRatio = value;
			lastSyncedRatio = value;
		});
		return () => {
			cancelled = true;
			unsubscribe?.();
		};
	});

	$effect(() => {
		if (!ratioSource || !ratioSourceReady) {
			return;
		}
		if (lastSyncedRatio !== null && Math.abs(lastSyncedRatio - currentRatio) <= SAME_RATIO_EPSILON) {
			return;
		}
		lastSyncedRatio = currentRatio;
		void ratioSource.write(currentRatio);
	});
</script>

<div
	bind:this={rootRef}
	data-layout-role="workbench-split-detail-root"
	data-slot="workbench-split-detail-root"
	data-compact={compact ? "true" : "false"}
	data-dragging={dragging ? "true" : "false"}
	class={cn("workbench-split-detail-root", className)}
	style={rootStyle}
	onpointerdown={handlePointerDown}
	onkeydown={handleKeyDown}
	{...restProps}
>
	{@render children?.()}
</div>

<style>
	:where([data-layout-role="workbench-split-detail-root"]) {
		display: grid;
		block-size: 100%;
		inline-size: 100%;
		min-block-size: 0;
		min-inline-size: 0;
	}

	:where([data-layout-role="workbench-split-detail-root"][data-compact="false"]) {
		grid-template-columns:
			minmax(0, var(--workbench-split-detail-left, 1fr))
			minmax(0, var(--workbench-split-detail-handle, 12px))
			minmax(0, 1fr);
		grid-template-rows: minmax(0, 1fr);
	}

	:where([data-layout-role="workbench-split-detail-root"][data-compact="true"]) {
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: minmax(0, 1fr);
	}

	:global([data-layout-role="workbench-split-detail-root"])
		> :global([data-layout-role="workbench-split-detail-main"]) {
		grid-column: 1;
		grid-row: 1;
		min-block-size: 0;
		min-inline-size: 0;
	}

	:global([data-layout-role="workbench-split-detail-root"])
		> :global([data-layout-role="workbench-split-detail-handle"]) {
		grid-column: 2;
		grid-row: 1;
	}

	:global([data-layout-role="workbench-split-detail-root"])
		> :global([data-layout-role="workbench-split-detail-detail"]) {
		grid-column: 3;
		grid-row: 1;
		min-block-size: 0;
		min-inline-size: 0;
	}
	</style>
