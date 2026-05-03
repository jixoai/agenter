<script lang="ts">
	import { ScrollView } from '@agenter/svelte-components';

	import type { GlobalTerminalEntry } from '@agenter/client-sdk';
	import {
		resolveTerminalTheme,
		type TerminalViewElement,
		type TerminalViewScreenMetrics,
	} from '@agenter/terminal-view';

	import { isTerminalRunning, resolveTerminalWindowTitle } from './terminal-display';
	import type { TerminalLifecycleAction, TerminalViewportComponent } from './terminal-system-surface.types';
	import {
		resolveTerminalGridFromFrame,
		resolveTerminalScreenMetrics,
		resolveTerminalWindowProjection,
	} from './terminal-geometry';

	type LiveResizableTerminalViewportElement = HTMLElement &
		Pick<TerminalViewElement, 'transportUrl' | 'terminalId' | 'snapshot' | 'rendererPreference' | 'theme' | 'cursor'> & {
			projectionWidth?: number;
			projectionHeight?: number;
			projectionScale?: number;
			projectionOffsetX?: number;
			projectionOffsetY?: number;
			screenMetrics?: TerminalViewScreenMetrics | null;
			requestViewportResize?: (input: { cols: number; rows: number }) => boolean;
		};

	type TerminalWindowMotionReason = 'mode-toggle' | 'resize-ack';

	interface TerminalWindowMotionSnapshot {
		terminalId: string;
		mode: 'fit' | 'cover';
		frameWidth: number;
		frameHeight: number;
		shellWidth: number;
		shellHeight: number;
		contentBoxWidth: number;
		contentBoxHeight: number;
		bodyWidth: number;
		bodyHeight: number;
	}

	let {
		terminal,
		terminalViewportComponent,
		transportUrl,
		viewportMode,
		lifecycleBusy = false,
		lifecycleIntent = null,
		onRequestLifecycleAction,
		onToggleViewportMode,
		onLiveResize,
	}: {
		terminal: GlobalTerminalEntry;
		terminalViewportComponent: TerminalViewportComponent;
		transportUrl?: string | null;
		viewportMode: 'fit' | 'cover';
		lifecycleBusy?: boolean;
		lifecycleIntent?: 'bootstrap' | 'stop' | null;
		onRequestLifecycleAction?: (action: TerminalLifecycleAction) => void;
		onToggleViewportMode: () => void;
		onLiveResize?: (input: { width: number; height: number; cols: number; rows: number }) => void;
	} = $props();

	const TerminalViewport = $derived(terminalViewportComponent);
	const viewportCols = $derived(terminal.snapshot?.cols ?? 80);
	const viewportRows = $derived(terminal.snapshot?.rows ?? 24);
	const liveTransportEnabled = $derived(isTerminalRunning(terminal));
	const terminalTitle = $derived(resolveTerminalWindowTitle(terminal));
	const terminalTheme = $derived(resolveTerminalTheme(terminal.theme));
	const viewportToggleLabel = $derived(
		viewportMode === 'cover' ? 'Minimize terminal window to fit view' : 'Expand terminal window to cover view',
	);
	const lifecycleAction = $derived(lifecycleIntent ?? (isTerminalRunning(terminal) ? 'stop' : 'bootstrap'));
	const lifecycleControlLabel = $derived(
		lifecycleAction === 'stop' ? 'Kill terminal PTY' : 'Bootstrap terminal PTY',
	);
	const modeControlLabel = $derived(viewportMode === 'cover' ? 'Terminal mode: cover' : 'Terminal mode: fit');

	const screenMetrics = $derived(
		resolveTerminalScreenMetrics({
			cols: viewportCols,
			rows: viewportRows,
		}),
	);

	const MIN_FRAME_WIDTH = 320;
	const MIN_FRAME_HEIGHT = 220;
	const MAX_FRAME_WIDTH = 2400;
	const MAX_FRAME_HEIGHT = 1600;
	const WINDOW_HEADER_HEIGHT = 44;
	const TERMINAL_BODY_INSET_EM = 0.25;
	const WINDOW_VIEWPORT_MIN_WIDTH = 320;
	const WINDOW_VIEWPORT_MIN_HEIGHT = 240;
	const MODE_TRANSITION_DURATION_MS = 420;
	const RESIZE_ACK_TRANSITION_DURATION_MS = 320;
	const IOS_STANDARD_EASING = 'cubic-bezier(0.2, 0, 0, 1)';
	const IOS_SYNC_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)';

	let dragFrameWidth = $state<number | null>(null);
	let dragFrameHeight = $state<number | null>(null);
	let draggingResize = $state(false);
	let dragResizeMoved = $state(false);
	let dragStartX = 0;
	let dragStartY = 0;
	let dragStartWidth = 0;
	let dragStartHeight = 0;
	let scrollViewportRef = $state<HTMLDivElement | null>(null);
	let availableViewportWidth = $state(0);
	let availableViewportHeight = $state(0);
	let resizePointerTarget = $state<HTMLElement | null>(null);
	let resizePointerId = $state<number | null>(null);
	let terminalViewportElement = $state<LiveResizableTerminalViewportElement | null>(null);
	let committedLiveGrid = $state<{ terminalId: string; cols: number; rows: number } | null>(null);
	let windowShellRef = $state<HTMLElement | null>(null);
	let windowBodyRef = $state<HTMLElement | null>(null);
	let lastMotionSnapshot = $state<TerminalWindowMotionSnapshot | null>(null);
	let pendingMotionReason = $state<TerminalWindowMotionReason | null>(null);
	let previousViewportMode = $state<'fit' | 'cover' | null>(null);
	let terminalShellAnimation: Animation | null = null;
	let terminalBodyAnimation: Animation | null = null;
	let previousDocumentCursor: string | null = null;
	let previousDocumentUserSelect: string | null = null;
	let previousSnapshotTerminalId = $state<string | null>(null);
	let previousSnapshotCols = $state<number | null>(null);
	let previousSnapshotRows = $state<number | null>(null);
	let measuredScreenMetrics = $state<{ terminalId: string; width: number; height: number } | null>(null);
	let resizeReferenceMetrics = $state<{
		cellWidth: number;
		cellHeight: number;
		framePaddingX: number;
		framePaddingY: number;
	} | null>(null);
	let lastGestureResizeGrid = $state<{ terminalId: string; cols: number; rows: number } | null>(null);

	const effectiveViewportCols = $derived(
		committedLiveGrid?.terminalId === terminal.terminalId ? committedLiveGrid.cols : viewportCols,
	);
	const effectiveViewportRows = $derived(
		committedLiveGrid?.terminalId === terminal.terminalId ? committedLiveGrid.rows : viewportRows,
	);
	const terminalGeometry = $derived.by(() => {
		if (typeof effectiveViewportCols === 'number' && typeof effectiveViewportRows === 'number') {
			return `${effectiveViewportCols}x${effectiveViewportRows}`;
		}
		return 'geometry pending';
	});
	const effectiveSnapshot = $derived.by(() => {
		const snapshot = terminal.snapshot ?? null;
		if (!snapshot || committedLiveGrid?.terminalId !== terminal.terminalId) {
			return snapshot;
		}
		return {
			...snapshot,
			cols: committedLiveGrid.cols,
			rows: committedLiveGrid.rows,
			cursor: {
				x: Math.max(0, Math.min(snapshot.cursor.x, Math.max(0, committedLiveGrid.cols - 1))),
				y: Math.max(0, Math.min(snapshot.cursor.y, Math.max(0, committedLiveGrid.rows - 1))),
			},
		};
	});

	const clampFrameDimension = (value: number, min: number, max: number): number =>
		Math.max(min, Math.min(max, Math.round(value)));

	const isTerminalViewScreenMetrics = (value: unknown): value is TerminalViewScreenMetrics =>
		typeof value === 'object' &&
		value !== null &&
		'width' in value &&
		'height' in value &&
		typeof value.width === 'number' &&
		typeof value.height === 'number' &&
		Number.isFinite(value.width) &&
		Number.isFinite(value.height) &&
		value.width > 0 &&
		value.height > 0;

	const effectiveScreenMetrics = $derived(
		resolveTerminalScreenMetrics({
			cols: effectiveViewportCols,
			rows: effectiveViewportRows,
			screenWidth:
				measuredScreenMetrics?.terminalId === terminal.terminalId
					? measuredScreenMetrics.width
					: screenMetrics.cellWidth * effectiveViewportCols,
			screenHeight:
				measuredScreenMetrics?.terminalId === terminal.terminalId
					? measuredScreenMetrics.height
					: screenMetrics.cellHeight * effectiveViewportRows,
		}),
	);
	const intrinsicFrameWidth = $derived(effectiveScreenMetrics.frameWidth);
	const intrinsicFrameHeight = $derived(effectiveScreenMetrics.frameHeight);
	const liveFrameWidth = $derived(
		clampFrameDimension(dragFrameWidth ?? intrinsicFrameWidth, MIN_FRAME_WIDTH, MAX_FRAME_WIDTH),
	);
	const liveFrameHeight = $derived(
		clampFrameDimension(dragFrameHeight ?? intrinsicFrameHeight, MIN_FRAME_HEIGHT, MAX_FRAME_HEIGHT),
	);
	const bodyInsetX = $derived(Math.max(2, Math.round(effectiveScreenMetrics.cellWidth * TERMINAL_BODY_INSET_EM)));
	const bodyInsetY = $derived(Math.max(2, Math.round(effectiveScreenMetrics.cellHeight * TERMINAL_BODY_INSET_EM)));
	const liveProjection = $derived(
		resolveTerminalWindowProjection({
			mode: viewportMode,
			frameWidth: liveFrameWidth,
			frameHeight: liveFrameHeight,
			contentWidth: effectiveScreenMetrics.screenWidth,
			contentHeight: effectiveScreenMetrics.screenHeight,
			availableWidth: Math.max(availableViewportWidth, WINDOW_VIEWPORT_MIN_WIDTH),
			availableHeight: Math.max(availableViewportHeight, WINDOW_VIEWPORT_MIN_HEIGHT),
			// Cover chrome is owned by the outer window-container, so projection math must
			// not subtract header height a second time once the titlebar is promoted there.
			headerHeight: viewportMode === 'cover' ? 0 : WINDOW_HEADER_HEIGHT,
			bodyInsetX,
			bodyInsetY,
		}),
	);
	const shellWidth = $derived(liveProjection.shellWidth);
	const shellHeight = $derived(liveProjection.shellHeight);
	const windowShellStyle = $derived(`width:${shellWidth}px;max-width:none;`);
	const windowBodyStyle = $derived(`width:${liveProjection.bodyWidth}px;height:${liveProjection.bodyHeight}px;`);
	const windowBodyInsetStyle = $derived(
		`padding:${bodyInsetY}px ${bodyInsetX}px;box-sizing:border-box;width:100%;height:100%;`,
	);
	const windowBodyContentStyle = $derived(
		`width:${liveProjection.contentBoxWidth}px;height:${liveProjection.contentBoxHeight}px;`,
	);
	const windowScrollContentClass = $derived(
		viewportMode === 'cover'
			? 'grid box-border min-h-full w-full min-w-max justify-items-start content-start'
			: 'grid box-border min-h-full w-full min-w-0 justify-items-center content-start',
	);
	const viewportProjectionWidth = $derived(liveProjection.contentBoxWidth);
	const viewportProjectionHeight = $derived(liveProjection.contentBoxHeight);
	const viewportProjectionScale = $derived(liveProjection.scale);
	const viewportProjectionOffsetX = $derived(-effectiveScreenMetrics.framePaddingX * viewportProjectionScale);
	const viewportProjectionOffsetY = $derived(-effectiveScreenMetrics.framePaddingY * viewportProjectionScale);
	const motionSnapshot = $derived<TerminalWindowMotionSnapshot>({
		terminalId: terminal.terminalId,
		mode: viewportMode,
		frameWidth: liveFrameWidth,
		frameHeight: liveFrameHeight,
		shellWidth,
		shellHeight,
		contentBoxWidth: liveProjection.contentBoxWidth,
		contentBoxHeight: liveProjection.contentBoxHeight,
		bodyWidth: liveProjection.bodyWidth,
		bodyHeight: liveProjection.bodyHeight,
	});

	const reportLiveResize = (
		width: number,
		height: number,
		grid?: {
			cols: number;
			rows: number;
		} | null,
	): void => {
		const cols =
			grid?.cols ??
			(committedLiveGrid?.terminalId === terminal.terminalId ? committedLiveGrid.cols : viewportCols);
		const rows =
			grid?.rows ??
			(committedLiveGrid?.terminalId === terminal.terminalId ? committedLiveGrid.rows : viewportRows);
		onLiveResize?.({ width, height, cols, rows });
	};

	const hasMotionSnapshotChanged = (
		previous: TerminalWindowMotionSnapshot | null,
		next: TerminalWindowMotionSnapshot,
	): boolean =>
		!previous ||
		previous.terminalId !== next.terminalId ||
		previous.mode !== next.mode ||
		previous.frameWidth !== next.frameWidth ||
		previous.frameHeight !== next.frameHeight ||
		previous.shellWidth !== next.shellWidth ||
		previous.shellHeight !== next.shellHeight ||
		previous.contentBoxWidth !== next.contentBoxWidth ||
		previous.contentBoxHeight !== next.contentBoxHeight ||
		previous.bodyWidth !== next.bodyWidth ||
		previous.bodyHeight !== next.bodyHeight;

	const shouldUseTerminalWindowMotion = (): boolean =>
		typeof window !== 'undefined' &&
		typeof windowShellRef?.animate === 'function' &&
		typeof windowBodyRef?.animate === 'function' &&
		(typeof window.matchMedia !== 'function' || !window.matchMedia('(prefers-reduced-motion: reduce)').matches);

	const cancelTerminalWindowMotion = (): void => {
		terminalShellAnimation?.cancel();
		terminalBodyAnimation?.cancel();
		terminalShellAnimation = null;
		terminalBodyAnimation = null;
	};

	const animateTerminalWindowGeometry = (
		from: TerminalWindowMotionSnapshot,
		to: TerminalWindowMotionSnapshot,
		reason: TerminalWindowMotionReason,
	): void => {
		if (!windowShellRef || !windowBodyRef || !shouldUseTerminalWindowMotion()) {
			return;
		}

		if (
			Math.abs(from.shellWidth - to.shellWidth) < 1 &&
			Math.abs(from.shellHeight - to.shellHeight) < 1 &&
			Math.abs(from.contentBoxWidth - to.contentBoxWidth) < 1 &&
			Math.abs(from.contentBoxHeight - to.contentBoxHeight) < 1 &&
			Math.abs(from.bodyWidth - to.bodyWidth) < 1 &&
			Math.abs(from.bodyHeight - to.bodyHeight) < 1
		) {
			return;
		}

		cancelTerminalWindowMotion();
		const duration = reason === 'mode-toggle' ? MODE_TRANSITION_DURATION_MS : RESIZE_ACK_TRANSITION_DURATION_MS;
		const easing = reason === 'mode-toggle' ? IOS_STANDARD_EASING : IOS_SYNC_EASING;
		const shellKeyframes: Keyframe[] = [
			{
				width: `${from.shellWidth}px`,
				height: `${from.shellHeight}px`,
			},
			{
				width: `${to.shellWidth}px`,
				height: `${to.shellHeight}px`,
			},
		];
		const bodyKeyframes: Keyframe[] = [
			{
				width: `${from.bodyWidth}px`,
				height: `${from.bodyHeight}px`,
			},
			{
				width: `${to.bodyWidth}px`,
				height: `${to.bodyHeight}px`,
			},
		];
		const options: KeyframeAnimationOptions = {
			duration,
			easing,
			fill: 'none',
		};
		terminalShellAnimation = windowShellRef.animate(shellKeyframes, options);
		terminalBodyAnimation = windowBodyRef.animate(
			bodyKeyframes,
			options,
		);
		const clearAnimation = (): void => {
			if (terminalShellAnimation?.playState === 'finished' || terminalShellAnimation?.playState === 'idle') {
				terminalShellAnimation = null;
			}
			if (terminalBodyAnimation?.playState === 'finished' || terminalBodyAnimation?.playState === 'idle') {
				terminalBodyAnimation = null;
			}
		};
		terminalShellAnimation.addEventListener('finish', clearAnimation, { once: true });
		terminalShellAnimation.addEventListener('cancel', clearAnimation, { once: true });
		terminalBodyAnimation.addEventListener('finish', clearAnimation, { once: true });
		terminalBodyAnimation.addEventListener('cancel', clearAnimation, { once: true });
	};

	const requestLiveViewportResize = (
		frameWidth: number,
		frameHeight: number,
	):
		| {
				cols: number;
				rows: number;
		  }
		| null => {
		if (!terminal.snapshot) {
			return null;
		}
		// Live drag resize is an unrecorded preview channel. It may temporarily project a
		// new cols x rows into the viewport, but durable geometry still belongs to Apply resize.
		const referenceMetrics = resizeReferenceMetrics ?? {
			cellWidth: effectiveScreenMetrics.cellWidth,
			cellHeight: effectiveScreenMetrics.cellHeight,
			framePaddingX: effectiveScreenMetrics.framePaddingX,
			framePaddingY: effectiveScreenMetrics.framePaddingY,
		};
		const { cols: nextCols, rows: nextRows } = resolveTerminalGridFromFrame({
			frameWidth,
			frameHeight,
			cellWidth: referenceMetrics.cellWidth,
			cellHeight: referenceMetrics.cellHeight,
			framePaddingX: referenceMetrics.framePaddingX,
			framePaddingY: referenceMetrics.framePaddingY,
		});
		const currentCols =
			committedLiveGrid?.terminalId === terminal.terminalId ? committedLiveGrid.cols : viewportCols;
		const currentRows =
			committedLiveGrid?.terminalId === terminal.terminalId ? committedLiveGrid.rows : viewportRows;
		if (nextCols === currentCols && nextRows === currentRows) {
			return {
				cols: currentCols,
				rows: currentRows,
			};
		}
		if (
			lastGestureResizeGrid?.terminalId === terminal.terminalId &&
			lastGestureResizeGrid.cols === nextCols &&
			lastGestureResizeGrid.rows === nextRows
		) {
			return {
				cols: nextCols,
				rows: nextRows,
			};
		}
		committedLiveGrid = {
			terminalId: terminal.terminalId,
			cols: nextCols,
			rows: nextRows,
		};
		lastGestureResizeGrid = {
			terminalId: terminal.terminalId,
			cols: nextCols,
			rows: nextRows,
		};
		terminalViewportElement?.requestViewportResize?.({ cols: nextCols, rows: nextRows });
		return {
			cols: nextCols,
			rows: nextRows,
		};
	};

	const resolveClientPoint = (event: PointerEvent): { x: number; y: number } | null => {
		return { x: event.clientX, y: event.clientY };
	};

	const handleResizeMove = (event: PointerEvent): void => {
		if (!draggingResize) {
			return;
		}
		event.preventDefault();
		const point = resolveClientPoint(event);
		if (!point) {
			return;
		}
		const nextFrameWidth = clampFrameDimension(
			dragStartWidth + (point.x - dragStartX),
			MIN_FRAME_WIDTH,
			MAX_FRAME_WIDTH,
		);
		const nextFrameHeight = clampFrameDimension(
			dragStartHeight + (point.y - dragStartY),
			MIN_FRAME_HEIGHT,
			MAX_FRAME_HEIGHT,
		);
		if (nextFrameWidth === dragStartWidth && nextFrameHeight === dragStartHeight) {
			return;
		}
		dragResizeMoved = true;
		dragFrameWidth = nextFrameWidth;
		dragFrameHeight = nextFrameHeight;
		const nextGrid = requestLiveViewportResize(nextFrameWidth, nextFrameHeight);
		reportLiveResize(nextFrameWidth, nextFrameHeight, nextGrid);
	};

	const detachResizeListeners = (): void => {
		window.removeEventListener('pointermove', handleResizeMove);
		window.removeEventListener('pointerup', handleResizeEnd);
		window.removeEventListener('pointercancel', handleResizeEnd);
	};

	const handleResizeEnd = (_event: PointerEvent): void => {
		if (!draggingResize) {
			return;
		}
		const finalFrameWidth = dragFrameWidth ?? liveFrameWidth;
		const finalFrameHeight = dragFrameHeight ?? liveFrameHeight;
		const shouldCommitResize = dragResizeMoved;
		draggingResize = false;
		if (resizePointerTarget && resizePointerId !== null && resizePointerTarget.hasPointerCapture?.(resizePointerId)) {
			resizePointerTarget.releasePointerCapture(resizePointerId);
		}
		resizePointerTarget = null;
		resizePointerId = null;
		detachResizeListeners();
		if (shouldCommitResize) {
			const nextGrid = requestLiveViewportResize(finalFrameWidth, finalFrameHeight);
			reportLiveResize(finalFrameWidth, finalFrameHeight, nextGrid);
		}
		dragFrameWidth = null;
		dragFrameHeight = null;
		dragResizeMoved = false;
		resizeReferenceMetrics = null;
		lastGestureResizeGrid = null;
	};

	const applyNativeResizeCursor = (): void => {
		if (typeof document === 'undefined') {
			return;
		}
		if (previousDocumentCursor === null) {
			previousDocumentCursor = document.documentElement.style.cursor;
			previousDocumentUserSelect = document.documentElement.style.userSelect;
		}
		document.documentElement.style.cursor = 'se-resize';
		document.documentElement.style.userSelect = 'none';
	};

	const restoreNativeResizeCursor = (): void => {
		if (typeof document === 'undefined' || previousDocumentCursor === null) {
			return;
		}
		document.documentElement.style.cursor = previousDocumentCursor;
		document.documentElement.style.userSelect = previousDocumentUserSelect ?? '';
		previousDocumentCursor = null;
		previousDocumentUserSelect = null;
	};

	const handleResizeStart = (event: PointerEvent): void => {
		if (draggingResize) {
			return;
		}
		event.preventDefault();
		const point = resolveClientPoint(event);
		if (!point) {
			return;
		}
		draggingResize = true;
		dragResizeMoved = false;
		dragStartX = point.x;
		dragStartY = point.y;
		dragStartWidth = liveFrameWidth;
		dragStartHeight = liveFrameHeight;
		resizeReferenceMetrics = {
			cellWidth: effectiveScreenMetrics.cellWidth,
			cellHeight: effectiveScreenMetrics.cellHeight,
			framePaddingX: effectiveScreenMetrics.framePaddingX,
			framePaddingY: effectiveScreenMetrics.framePaddingY,
		};
		lastGestureResizeGrid = null;
		applyNativeResizeCursor();
		if ('pointerId' in event && event.currentTarget instanceof HTMLElement) {
			resizePointerTarget = event.currentTarget;
			resizePointerId = event.pointerId;
			event.currentTarget.setPointerCapture?.(event.pointerId);
		} else {
			resizePointerTarget = null;
			resizePointerId = null;
		}
		window.addEventListener('pointermove', handleResizeMove);
		window.addEventListener('pointerup', handleResizeEnd);
		window.addEventListener('pointercancel', handleResizeEnd);
	};

	const handleViewportScreenMetrics = (metrics: TerminalViewScreenMetrics): void => {
		if (metrics.width <= 0 || metrics.height <= 0) {
			return;
		}
		measuredScreenMetrics = {
			terminalId: terminal.terminalId,
			width: metrics.width,
			height: metrics.height,
		};
	};

	const handleViewportScreenMetricsEvent = (event: Event): void => {
		if (!(event instanceof CustomEvent) || !isTerminalViewScreenMetrics(event.detail)) {
			return;
		}
		handleViewportScreenMetrics(event.detail);
	};

	const readViewportElementScreenMetrics = (element: LiveResizableTerminalViewportElement): void => {
		if (!isTerminalViewScreenMetrics(element.screenMetrics)) {
			return;
		}
		handleViewportScreenMetrics(element.screenMetrics);
	};

	const findViewportElement = (): LiveResizableTerminalViewportElement | null => {
		const candidate = windowBodyRef?.querySelector<HTMLElement>('[data-terminal-host-root="true"]') ?? null;
		return candidate as LiveResizableTerminalViewportElement | null;
	};

	$effect(() => {
		if (!scrollViewportRef || typeof ResizeObserver === 'undefined') {
			return;
		}
		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (!entry) {
				return;
			}
			availableViewportWidth = Math.round(entry.contentRect.width);
			availableViewportHeight = Math.round(entry.contentRect.height);
		});
		observer.observe(scrollViewportRef);
		return () => {
			observer.disconnect();
		};
	});

	$effect(() => {
		if (!committedLiveGrid) {
			return;
		}
		if (committedLiveGrid.terminalId !== terminal.terminalId) {
			committedLiveGrid = null;
			return;
		}
		if (
			typeof terminal.snapshot?.cols === 'number' &&
			typeof terminal.snapshot?.rows === 'number' &&
			!draggingResize &&
			terminal.snapshot.cols === committedLiveGrid.cols &&
			terminal.snapshot.rows === committedLiveGrid.rows
		) {
			committedLiveGrid = null;
		}
	});

	$effect(() => {
		if (previousViewportMode !== viewportMode) {
			previousViewportMode = viewportMode;
			pendingMotionReason = 'mode-toggle';
		}
	});

	$effect(() => {
		const sameTerminal = previousSnapshotTerminalId === terminal.terminalId;
		const geometryChanged = previousSnapshotCols !== viewportCols || previousSnapshotRows !== viewportRows;
		previousSnapshotTerminalId = terminal.terminalId;
		previousSnapshotCols = viewportCols;
		previousSnapshotRows = viewportRows;
		if (!sameTerminal || !geometryChanged || draggingResize) {
			return;
		}
		if (
			committedLiveGrid?.terminalId === terminal.terminalId &&
			committedLiveGrid.cols === viewportCols &&
			committedLiveGrid.rows === viewportRows
		) {
			// This is the backend ack path after Apply resize or a live resize sideband was
			// accepted. Do not replay a second motion when the viewport is already at that grid.
			committedLiveGrid = null;
			lastGestureResizeGrid = null;
			return;
		}
		if (committedLiveGrid?.terminalId === terminal.terminalId) {
			// Any authoritative snapshot geometry change ends the transient live-resize preview.
			// This keeps Apply resize and backend acks as the single source of truth for rows/cols.
			committedLiveGrid = null;
			lastGestureResizeGrid = null;
		}
		pendingMotionReason = 'resize-ack';
	});

	$effect(() => {
		const previous = lastMotionSnapshot;
		const next = motionSnapshot;
		if (!hasMotionSnapshotChanged(previous, next)) {
			return;
		}
		lastMotionSnapshot = next;
		if (!previous || previous.terminalId !== next.terminalId) {
			pendingMotionReason = null;
			cancelTerminalWindowMotion();
			return;
		}
		const reason = pendingMotionReason;
		pendingMotionReason = null;
		if (!reason || draggingResize) {
			return;
		}
		animateTerminalWindowGeometry(previous, next, reason);
	});

	$effect(() => {
		return () => {
			cancelTerminalWindowMotion();
			restoreNativeResizeCursor();
		};
	});

	$effect(() => {
		if (draggingResize) {
			applyNativeResizeCursor();
			return;
		}
		restoreNativeResizeCursor();
	});

	$effect(() => {
		const element = terminalViewportElement;
		if (!element) {
			return;
		}
		let cancelled = false;
		let firstFrame = 0;
		let secondFrame = 0;
		const readMetrics = (): void => {
			if (cancelled || terminalViewportElement !== element) {
				return;
			}
			readViewportElementScreenMetrics(element);
		};
		element.addEventListener('terminal-view-screen-metrics', handleViewportScreenMetricsEvent);
		readMetrics();
		queueMicrotask(readMetrics);
		if (typeof requestAnimationFrame === 'function') {
			firstFrame = requestAnimationFrame(() => {
				readMetrics();
				secondFrame = requestAnimationFrame(readMetrics);
			});
		}
		return () => {
			cancelled = true;
			if (firstFrame !== 0) {
				cancelAnimationFrame(firstFrame);
			}
			if (secondFrame !== 0) {
				cancelAnimationFrame(secondFrame);
			}
			element.removeEventListener('terminal-view-screen-metrics', handleViewportScreenMetricsEvent);
		};
	});

	$effect(() => {
		if (!windowBodyRef) {
			return;
		}
		let cancelled = false;
		let firstFrame = 0;
		let secondFrame = 0;
		const syncViewportElement = (): void => {
			if (cancelled) {
				return;
			}
			const element = findViewportElement();
			if (!element) {
				return;
			}
			if (terminalViewportElement !== element) {
				terminalViewportElement = element;
			}
			readViewportElementScreenMetrics(element);
		};
		const observer = new MutationObserver(syncViewportElement);
		observer.observe(windowBodyRef, { childList: true, subtree: true });
		syncViewportElement();
		queueMicrotask(syncViewportElement);
		if (typeof requestAnimationFrame === 'function') {
			firstFrame = requestAnimationFrame(() => {
				syncViewportElement();
				secondFrame = requestAnimationFrame(syncViewportElement);
			});
		}
		return () => {
			cancelled = true;
			observer.disconnect();
			if (firstFrame !== 0) {
				cancelAnimationFrame(firstFrame);
			}
			if (secondFrame !== 0) {
				cancelAnimationFrame(secondFrame);
			}
		};
	});
</script>

{#snippet terminalWindowTitlebar(className: string, owner: 'terminal-window' | 'window-container', testId: string)}
	<header
		class={className}
		data-terminal-window-titlebar-owner={owner}
		data-testid={testId}
	>
		<div class="flex min-w-0 flex-1 items-center gap-2">
			<div class="flex items-center gap-2" aria-label="Window controls">
				<button
					type="button"
					class={`window-control-button ${lifecycleAction === 'stop' ? 'window-control-button-lifecycle-stop' : 'window-control-button-lifecycle-bootstrap'}`}
					data-testid="terminal-window-lifecycle-control"
					data-terminal-window-lifecycle-state={lifecycleAction === 'stop' ? 'kill' : 'bootstrap'}
					aria-label={lifecycleControlLabel}
					title={lifecycleControlLabel}
					disabled={lifecycleBusy}
					onclick={() => {
						onRequestLifecycleAction?.(lifecycleAction);
					}}
				></button>
				<button
					type="button"
					class={`window-control-button ${viewportMode === 'cover' ? 'window-control-button-mode-cover' : 'window-control-button-mode-fit'}`}
					data-testid="terminal-window-zoom-control"
					data-terminal-window-mode-state={viewportMode}
					aria-label={viewportToggleLabel}
					title={modeControlLabel}
					onclick={onToggleViewportMode}
				></button>
			</div>

			<div class="min-w-0 flex-1 truncate text-[12px] font-medium text-slate-100">
				{terminalTitle}
			</div>
		</div>

		<div
			class="shrink-0 text-[11px] font-medium tabular-nums text-slate-300"
			data-testid="terminal-window-size-info"
		>
			{terminalGeometry}
		</div>
	</header>
{/snippet}

	<!-- window-container owns cover-mode chrome; terminal-window owns fit-mode chrome -->
	<div class="flex h-full min-h-96 flex-col overflow-hidden rounded-lg" style={`background:${terminalTheme.background};color:${terminalTheme.foreground};`}>
	{#if viewportMode === 'cover'}
		{@render terminalWindowTitlebar(
			'sticky top-0 z-20 shrink-0 flex h-8 items-center gap-2 border-b border-white/8 bg-[linear-gradient(180deg,rgba(58,58,60,0.98),rgba(40,40,42,0.96))] px-3 shadow-[0_1px_0_rgba(255,255,255,0.05)_inset] backdrop-blur-xl',
			'window-container',
			'terminal-window-cover-titlebar',
		)}
	{/if}
	<ScrollView
		class={viewportMode === 'cover' ? 'flex-1' : 'h-full'}
		orientation="both"
		bind:viewportRef={scrollViewportRef}
		viewportTestId="terminal-window-scroll-viewport"
		contentClass={windowScrollContentClass}
	>
		<section
			bind:this={windowShellRef}
			class={viewportMode === 'cover'
				? 'flex flex-col overflow-visible text-slate-100'
				: 'box-border flex flex-col overflow-hidden rounded-md border border-white/10 text-slate-100 shadow-[0_28px_72px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.08)]'}
			style={`${windowShellStyle}${viewportMode === 'cover' ? '' : `background:${terminalTheme.background};`}`}
			data-terminal-window-surface="true"
			data-terminal-window-mode={viewportMode}
			data-terminal-window-resizing={draggingResize ? 'true' : 'false'}
			data-terminal-window-shell-width={String(shellWidth)}
			data-terminal-window-shell-height={String(shellHeight)}
			data-terminal-window-body-width={String(liveProjection.bodyWidth)}
			data-terminal-window-body-height={String(liveProjection.bodyHeight)}
			data-terminal-window-frame-width={String(liveFrameWidth)}
			data-terminal-window-frame-height={String(liveFrameHeight)}
		>
			<!-- Fit keeps one framed window, so the titlebar belongs to terminal-window itself. -->
			{#if viewportMode !== 'cover'}
				{@render terminalWindowTitlebar(
					'flex h-8 items-center gap-2 border-b border-white/8 bg-[linear-gradient(180deg,rgba(58,58,60,0.98),rgba(40,40,42,0.96))] px-3 shadow-[0_1px_0_rgba(255,255,255,0.05)_inset]',
					'terminal-window',
					'terminal-window-fit-titlebar',
				)}
			{/if}

			<div
				bind:this={windowBodyRef}
				class={viewportMode === 'cover'
					? 'relative min-w-0 overflow-hidden'
					: 'relative min-w-0 overflow-hidden'}
				style={`${windowBodyStyle}background:${terminalTheme.background};color:${terminalTheme.foreground};`}
				data-terminal-window-body="true"
				data-terminal-window-body-inset-x={String(bodyInsetX)}
				data-terminal-window-body-inset-y={String(bodyInsetY)}
				data-terminal-window-content-box-width={String(liveProjection.contentBoxWidth)}
				data-terminal-window-content-box-height={String(liveProjection.contentBoxHeight)}
			>
				<div
					class="box-border h-full w-full"
					style={windowBodyInsetStyle}
					data-terminal-window-body-content="true"
				>
					<TerminalViewport
						class="block"
						style={windowBodyContentStyle}
						bind:elementRef={terminalViewportElement}
						terminalId={terminal.terminalId}
						transportUrl={transportUrl ?? terminal.transportUrl}
						{liveTransportEnabled}
						snapshot={effectiveSnapshot}
						projectionWidth={viewportProjectionWidth}
						projectionHeight={viewportProjectionHeight}
						projectionScale={viewportProjectionScale}
						projectionOffsetX={viewportProjectionOffsetX}
						projectionOffsetY={viewportProjectionOffsetY}
						rendererPreference={terminal.rendererPreference}
						theme={terminal.theme}
						cursor={terminal.cursor}
						onScreenMetrics={handleViewportScreenMetrics}
					/>
				</div>
				{#if viewportMode !== 'cover'}
					<button
						type="button"
						class="native-window-resize-handle"
						aria-label="Resize terminal window"
						title="Resize terminal window"
						data-terminal-window-native-resize-handle="true"
						data-testid="terminal-window-live-resize-handle"
						onpointerdown={handleResizeStart}
					></button>
				{/if}
			</div>
		</section>
	</ScrollView>
</div>

<style>
	.window-control-button {
		position: relative;
		display: inline-flex;
		height: 0.875rem;
		width: 0.875rem;
		align-items: center;
		justify-content: center;
		border-radius: 9999px;
		border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
		box-shadow:
			0 0.5px 0 rgba(255, 255, 255, 0.55) inset,
			0 1px 1px rgba(15, 23, 42, 0.12);
	}

	.window-control-button:hover:not(:disabled),
	.window-control-button:focus-visible {
		filter: saturate(1.04);
	}

	.window-control-button:active:not(:disabled) {
		transform: translateY(0.5px);
	}

	.window-control-button:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	.window-control-button-lifecycle-stop {
		background: linear-gradient(180deg, #ff6f67, #f34d42);
		color: rgba(122, 24, 16, 0.88);
	}

	.window-control-button-lifecycle-bootstrap {
		background: linear-gradient(180deg, #4f8dff, #2d72f7);
		color: rgba(14, 40, 99, 0.88);
	}

	.window-control-button-mode-fit {
		background: linear-gradient(180deg, #ffd866, #f2c94c);
		color: rgba(120, 74, 4, 0.88);
	}

	.window-control-button-mode-cover {
		background: linear-gradient(180deg, #39d161, #27bc47);
		color: rgba(11, 78, 27, 0.9);
	}

	.native-window-resize-handle {
		position: absolute;
		right: 0;
		bottom: 0;
		z-index: 20;
		display: block;
		width: 1.25rem;
		height: 1.25rem;
		border: 0;
		padding: 0;
		background: transparent;
		cursor: se-resize;
		touch-action: none;
		user-select: none;
	}

	.native-window-resize-handle::before {
		content: '';
		position: absolute;
		right: 0.375rem;
		bottom: 0.375rem;
		width: 0.875rem;
		height: 0.875rem;
		background: repeating-linear-gradient(
			135deg,
			transparent 0,
			transparent 0.1875rem,
			color-mix(in srgb, white 24%, transparent) 0.1875rem,
			color-mix(in srgb, white 24%, transparent) 0.25rem
		);
		clip-path: polygon(100% 0, 100% 100%, 0 100%);
		opacity: 0.72;
	}

	.native-window-resize-handle:hover::before,
	.native-window-resize-handle:focus-visible::before,
	.native-window-resize-handle:active::before {
		background: repeating-linear-gradient(
			135deg,
			transparent 0,
			transparent 0.1875rem,
			color-mix(in srgb, white 42%, transparent) 0.1875rem,
			color-mix(in srgb, white 42%, transparent) 0.25rem
		);
		opacity: 0.94;
	}

	.native-window-resize-handle:focus-visible {
		outline: 1px solid color-mix(in srgb, white 36%, transparent);
		outline-offset: -0.375rem;
	}

	@media (pointer: coarse) {
		.native-window-resize-handle {
			width: 2.75rem;
			height: 2.75rem;
		}
	}

	@media (max-width: 480px) {
		.native-window-resize-handle {
			right: 1.25rem;
		}
	}
</style>
