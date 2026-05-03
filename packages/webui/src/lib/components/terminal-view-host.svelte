<script lang="ts">
	import {
		TERMINAL_VIEW_TAG,
		defineTerminalView,
		type TerminalViewElement,
		type TerminalViewScreenMetrics,
		type TerminalViewSnapshot,
	} from '@agenter/terminal-view';

	if (typeof window !== 'undefined' && typeof customElements !== 'undefined') {
		defineTerminalView();
	}

	let {
		terminalId,
		transportUrl,
		liveTransportEnabled = true,
		snapshot = null,
		projectionWidth = 0,
		projectionHeight = 0,
		projectionScale = 1,
		projectionOffsetX = 0,
		projectionOffsetY = 0,
		onScreenMetrics,
		elementRef = $bindable<TerminalViewHostElement | null>(null),
		class: className = '',
		style = '',
	}: {
		terminalId: string;
		transportUrl?: string;
		liveTransportEnabled?: boolean;
		snapshot?: TerminalViewSnapshot | null;
		projectionWidth?: number;
		projectionHeight?: number;
		projectionScale?: number;
		projectionOffsetX?: number;
		projectionOffsetY?: number;
		onScreenMetrics?: (metrics: TerminalViewScreenMetrics) => void;
		elementRef?: TerminalViewHostElement | null;
		class?: string;
		style?: string;
	} = $props();

	type TerminalViewHostElement = HTMLElement &
		Pick<TerminalViewElement, 'transportUrl' | 'terminalId' | 'snapshot'> & {
			liveTransportEnabled?: boolean;
			projectionWidth?: number;
			projectionHeight?: number;
			projectionScale?: number;
			projectionOffsetX?: number;
			projectionOffsetY?: number;
			screenMetrics?: TerminalViewScreenMetrics | null;
		};

	let element = $state<TerminalViewHostElement | null>(null);
	let lastReportedScreenMetrics = $state<TerminalViewScreenMetrics | null>(null);

	const reportScreenMetrics = (metrics: TerminalViewScreenMetrics): void => {
		if (
			lastReportedScreenMetrics?.width === metrics.width &&
			lastReportedScreenMetrics.height === metrics.height
		) {
			return;
		}
		lastReportedScreenMetrics = metrics;
		onScreenMetrics?.(metrics);
	};

	const syncProps = (): void => {
		if (!element) {
			return;
		}
		element.transportUrl = transportUrl ?? '';
		element.liveTransportEnabled = liveTransportEnabled;
		element.terminalId = terminalId;
		element.snapshot = snapshot ?? null;
		element.projectionWidth = projectionWidth;
		element.projectionHeight = projectionHeight;
		element.projectionScale = projectionScale;
		element.projectionOffsetX = projectionOffsetX;
		element.projectionOffsetY = projectionOffsetY;
	};

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

	const handleScreenMetrics = (event: Event): void => {
		if (!(event instanceof CustomEvent) || !isTerminalViewScreenMetrics(event.detail)) {
			return;
		}
		reportScreenMetrics(event.detail);
	};

	const readElementScreenMetrics = (target: TerminalViewHostElement): void => {
		if (!isTerminalViewScreenMetrics(target.screenMetrics)) {
			return;
		}
		reportScreenMetrics(target.screenMetrics);
	};

	$effect(() => {
		syncProps();
		elementRef = element;
		if (element) {
			readElementScreenMetrics(element);
		}
	});

	$effect(() => {
		const currentElement = element;
		if (!currentElement) {
			return;
		}
		let cancelled = false;
		let firstFrame = 0;
		let secondFrame = 0;
		const readCurrentElementMetrics = (): void => {
			if (cancelled || element !== currentElement) {
				return;
			}
			readElementScreenMetrics(currentElement);
		};
		currentElement.addEventListener('terminal-view-screen-metrics', handleScreenMetrics);
		readCurrentElementMetrics();
		queueMicrotask(readCurrentElementMetrics);
		if (typeof requestAnimationFrame === 'function') {
			firstFrame = requestAnimationFrame(() => {
				readCurrentElementMetrics();
				secondFrame = requestAnimationFrame(readCurrentElementMetrics);
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
			currentElement.removeEventListener('terminal-view-screen-metrics', handleScreenMetrics);
		};
	});
</script>

<svelte:element
	this={TERMINAL_VIEW_TAG}
	bind:this={element}
	class={className}
	{style}
	data-terminal-host-root="true"
/>
