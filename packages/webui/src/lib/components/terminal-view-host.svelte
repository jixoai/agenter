<script lang="ts">
	import {
		DEFAULT_TERMINAL_CURSOR,
		DEFAULT_TERMINAL_FONT,
		DEFAULT_TERMINAL_RENDERER_PREFERENCE,
		DEFAULT_TERMINAL_THEME,
		TERMINAL_VIEW_TAG,
		defineTerminalView,
		type TerminalCursorStyle,
		type TerminalFontProfile,
		type TerminalRendererPreference,
		type TerminalViewApprovalActionDetail,
		type TerminalViewElement,
		type TerminalViewPermissionRequest,
		type TerminalViewRequestPermissionsHandler,
		type TerminalViewPresentationReadyDetail,
		type TerminalViewScreenMetrics,
		type TerminalViewSnapshot,
		type TerminalThemeName,
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
		rendererPreference = DEFAULT_TERMINAL_RENDERER_PREFERENCE,
		theme = DEFAULT_TERMINAL_THEME,
		cursor = DEFAULT_TERMINAL_CURSOR,
		font = DEFAULT_TERMINAL_FONT,
		permissionRequests = [],
		onRequestPermissions = null,
		onApprovalAction,
		onScreenMetrics,
		onPresentationReady,
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
		rendererPreference?: TerminalRendererPreference;
		theme?: TerminalThemeName;
		cursor?: TerminalCursorStyle;
		font?: TerminalFontProfile;
		permissionRequests?: TerminalViewPermissionRequest[];
		onRequestPermissions?: TerminalViewRequestPermissionsHandler | null;
		onApprovalAction?: (detail: TerminalViewApprovalActionDetail) => void;
		onScreenMetrics?: (metrics: TerminalViewScreenMetrics) => void;
		onPresentationReady?: (detail: TerminalViewPresentationReadyDetail) => void;
		elementRef?: TerminalViewHostElement | null;
		class?: string;
		style?: string;
	} = $props();

	type TerminalViewHostElement = HTMLElement &
		Pick<
			TerminalViewElement,
			'transportUrl' | 'terminalId' | 'snapshot' | 'rendererPreference' | 'theme' | 'cursor' | 'font'
		> & {
			liveTransportEnabled?: boolean;
			projectionWidth?: number;
			projectionHeight?: number;
			projectionScale?: number;
			projectionOffsetX?: number;
			projectionOffsetY?: number;
			permissionRequests?: TerminalViewPermissionRequest[];
			onRequestPermissions?: TerminalViewRequestPermissionsHandler | null;
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
		element.liveTransportEnabled = liveTransportEnabled;
		// Route-level transport discovery may outlive a running PTY. The viewport primitive
		// should only receive a live websocket URL when the host explicitly enables live transport.
		element.transportUrl = liveTransportEnabled ? (transportUrl ?? '') : '';
		element.terminalId = terminalId;
		element.snapshot = snapshot ?? null;
		element.projectionWidth = projectionWidth;
		element.projectionHeight = projectionHeight;
		element.projectionScale = projectionScale;
		element.projectionOffsetX = projectionOffsetX;
		element.projectionOffsetY = projectionOffsetY;
		element.rendererPreference = rendererPreference;
		element.theme = theme;
		element.cursor = cursor;
		element.font = font;
		element.permissionRequests = permissionRequests;
		element.onRequestPermissions = onRequestPermissions;
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

	const isPresentationReadyDetail = (value: unknown): value is TerminalViewPresentationReadyDetail =>
		typeof value === 'object' &&
		value !== null &&
		'terminalId' in value &&
		'resolvedRenderer' in value &&
		'reason' in value &&
		typeof value.terminalId === 'string' &&
		typeof value.resolvedRenderer === 'string' &&
		typeof value.reason === 'string';

	const handlePresentationReady = (event: Event): void => {
		if (!(event instanceof CustomEvent) || !isPresentationReadyDetail(event.detail)) {
			return;
		}
		onPresentationReady?.(event.detail);
	};

	const isApprovalActionDetail = (value: unknown): value is TerminalViewApprovalActionDetail =>
		typeof value === 'object' &&
		value !== null &&
		'terminalId' in value &&
		'requestId' in value &&
		'action' in value &&
		typeof value.terminalId === 'string' &&
		typeof value.requestId === 'string' &&
		(value.action === 'approve' || value.action === 'deny');

	const handleApprovalAction = (event: Event): void => {
		if (!(event instanceof CustomEvent) || !isApprovalActionDetail(event.detail)) {
			return;
		}
		onApprovalAction?.(event.detail);
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
		currentElement.addEventListener('terminal-view-presentation-ready', handlePresentationReady);
		currentElement.addEventListener('terminal-view-approval-action', handleApprovalAction);
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
			currentElement.removeEventListener('terminal-view-presentation-ready', handlePresentationReady);
			currentElement.removeEventListener('terminal-view-approval-action', handleApprovalAction);
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
