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
		detailVisible = true,
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
		detailVisible?: boolean;
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
	let activeDragPointerId = $state<number | null>(null);
	let releaseCurrentDrag: (() => void) | null = null;

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
	const hasMeasuredLayout = $derived(measuredWidth > 0);

	setWorkbenchSplitDetailContext({
		compact: () => compact,
		detailVisible: () => detailVisible,
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

	const capturePointer = (target: Element, pointerId: number): void => {
		try {
			target.setPointerCapture?.(pointerId);
		} catch {
			// Some synthetic/browser states do not expose an active pointer capture target.
		}
	};

	const releasePointerCapture = (target: Element, pointerId: number): void => {
		try {
			if (target.hasPointerCapture?.(pointerId)) {
				target.releasePointerCapture?.(pointerId);
			}
		} catch {
			// Pointer capture may already be gone after blur, cancellation, or synthetic events.
		}
	};

	const handlePointerDown = (event: PointerEvent): void => {
		if (dragging || !rootRef || compact || event.button !== 0 || !isHandleTarget(event.target)) {
			return;
		}
		const rootRect = rootRef.getBoundingClientRect();
		const dragPointerTarget = rootRef;
		const dragPointerId = event.pointerId;
		activeDragPointerId = dragPointerId;
		dragging = true;
		commitRatioFromPointer(event.clientX - rootRect.left);
		const ownerDocument = rootRef.ownerDocument;
		const ownerWindow = ownerDocument.defaultView;
		const handlePointerMove = (moveEvent: PointerEvent): void => {
			if (moveEvent.pointerId !== dragPointerId) {
				return;
			}
			commitRatioFromPointer(moveEvent.clientX - rootRect.left);
			moveEvent.preventDefault();
		};
		const handlePointerUp = (upEvent: PointerEvent): void => {
			if (upEvent.pointerId !== dragPointerId) {
				return;
			}
			releaseDrag();
			upEvent.preventDefault();
		};
		const releaseDrag = (): void => {
			dragging = false;
			activeDragPointerId = null;
			ownerDocument.removeEventListener("pointermove", handlePointerMove, true);
			ownerDocument.removeEventListener("pointerup", handlePointerUp, true);
			ownerDocument.removeEventListener("pointercancel", handlePointerUp, true);
			ownerWindow?.removeEventListener("blur", releaseDrag);
			releasePointerCapture(dragPointerTarget, dragPointerId);
			if (releaseCurrentDrag === releaseDrag) {
				releaseCurrentDrag = null;
			}
		};
		releaseCurrentDrag = releaseDrag;
		capturePointer(dragPointerTarget, dragPointerId);
		ownerDocument.addEventListener("pointermove", handlePointerMove, true);
		ownerDocument.addEventListener("pointerup", handlePointerUp, true);
		ownerDocument.addEventListener("pointercancel", handlePointerUp, true);
		ownerWindow?.addEventListener("blur", releaseDrag);
		event.preventDefault();
	};

	const handleDragShieldPointerEvent = (event: PointerEvent): void => {
		if (activeDragPointerId !== null && event.pointerId === activeDragPointerId) {
			event.preventDefault();
		}
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
		return () => {
			releaseCurrentDrag?.();
		};
	});

	$effect(() => {
		if (!hasMeasuredLayout) {
			return;
		}
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
	data-detail-visible={detailVisible ? "true" : "false"}
	data-dragging={dragging ? "true" : "false"}
	class={cn("workbench-split-detail-root", className)}
	style={rootStyle}
	onpointerdown={handlePointerDown}
	onkeydown={handleKeyDown}
	{...restProps}
>
	{@render children?.()}
	{#if dragging}
		<div
			aria-hidden="true"
			data-layout-role="workbench-split-detail-drag-shield"
			data-slot="workbench-split-detail-drag-shield"
			onpointermove={handleDragShieldPointerEvent}
			onpointerup={handleDragShieldPointerEvent}
			onpointercancel={handleDragShieldPointerEvent}
		></div>
	{/if}
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
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: minmax(0, 1fr);
	}

	:where(
			[data-layout-role="workbench-split-detail-root"][data-compact="false"][data-detail-visible="true"]
		) {
		grid-template-columns:
			minmax(0, var(--workbench-split-detail-left, 1fr))
			minmax(0, var(--workbench-split-detail-handle, 12px))
			minmax(0, 1fr);
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

	:where([data-layout-role="workbench-split-detail-drag-shield"]) {
		position: fixed;
		inset: 0;
		z-index: 2147483647;
		cursor: col-resize;
		background: transparent;
		pointer-events: auto;
		touch-action: none;
		user-select: none;
	}

	:global([data-layout-role="workbench-split-detail-root"][data-dragging="true"] iframe) {
		pointer-events: none;
	}
	</style>
