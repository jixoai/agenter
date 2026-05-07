<script lang="ts">
	import '@wterm/dom/css';
	import {
		resolveTerminalAppearance,
		type TerminalRendererSession,
		wtermRendererAdapter,
	} from '@agenter/terminal-view';

	import { WorkspaceShellController } from './workspace-shell-controller';
	import type { WorkspaceShellSurface } from './workspace-shell-contract';

	const MIN_WORKSPACE_SHELL_TERMINAL_COLUMNS = 80;
	const MIN_WORKSPACE_SHELL_TERMINAL_ROWS = 6;
	const DEFAULT_WORKSPACE_SHELL_TERMINAL_ROWS = 24;
	const WORKSPACE_SHELL_TERMINAL_FONT_SIZE = 13;
	const WORKSPACE_SHELL_TERMINAL_LINE_HEIGHT = 1.52;
	const WORKSPACE_SHELL_TERMINAL_SCROLLBACK = 10_000;

	const workspaceShellTerminalAppearance = resolveTerminalAppearance({
		theme: 'default-dark',
		font: {
			family: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
			sizePx: WORKSPACE_SHELL_TERMINAL_FONT_SIZE,
			lineHeight: WORKSPACE_SHELL_TERMINAL_LINE_HEIGHT,
		},
	});

	let wtermReady: Promise<void> | null = null;

	const ensureWTermReady = (): Promise<void> => {
		wtermReady ??= wtermRendererAdapter.ensureReady?.() ?? Promise.resolve();
		return wtermReady;
	};

	let {
		avatar,
		cwd = $bindable<string | null>(null),
		initialCommand = null,
		initialCwd = null,
		promptLabel,
		running = $bindable(false),
		runtimeId,
		surface,
		workspacePath,
		onExec,
	}: {
		avatar: string;
		cwd?: string | null;
		initialCommand?: string | null;
		initialCwd?: string | null;
		promptLabel: string;
		running?: boolean;
		runtimeId: string;
		surface: WorkspaceShellSurface;
		workspacePath: string;
		onExec: (input: {
			avatar: string;
			command: string;
			cwd?: string;
			runtimeId: string;
			surface: WorkspaceShellSurface;
			workspacePath: string;
		}) => Promise<{
			cwd: string;
			exitCode: number;
			stderr: string;
			stdout: string;
		}>;
	} = $props();

	let host = $state<HTMLElement | null>(null);
	let initError = $state<string | null>(null);
	let ready = $state(false);
	let shell = $state<HTMLElement | null>(null);

	const shellSessionKey = $derived(
		`${runtimeId}::${avatar}::${surface}::${initialCwd ?? ''}::${initialCommand ?? ''}`,
	);

	const inputDecoder = new TextDecoder();

	const measureTerminalCellSize = (element: HTMLElement): { charWidth: number; rowHeight: number } => {
		const row = document.createElement('div');
		row.className = 'term-row';
		row.style.visibility = 'hidden';
		row.style.position = 'absolute';
		row.style.insetBlockStart = '0';
		row.style.insetInlineStart = '0';
		const probe = document.createElement('span');
		probe.textContent = 'W';
		row.appendChild(probe);
		element.appendChild(row);
		const charWidth = probe.getBoundingClientRect().width;
		const rowHeight = row.getBoundingClientRect().height;
		row.remove();
		return {
			charWidth: Math.max(1, charWidth),
			rowHeight: Math.max(
				1,
				rowHeight || Math.ceil(WORKSPACE_SHELL_TERMINAL_FONT_SIZE * WORKSPACE_SHELL_TERMINAL_LINE_HEIGHT),
			),
		};
	};

	const parseCssSize = (value: string): number => {
		const parsed = Number.parseFloat(value);
		return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
	};

	const readElementSize = (element: HTMLElement): { height: number; width: number } => {
		const rect = element.getBoundingClientRect();
		return {
			height: rect.height || element.clientHeight || element.offsetHeight,
			width: rect.width || element.clientWidth || element.offsetWidth,
		};
	};

	const resolveTerminalViewportFrame = (shellElement: HTMLElement): HTMLElement | null => {
		const parentElement = shellElement.parentElement;
		return parentElement instanceof HTMLElement && parentElement.dataset.layoutRole === 'clip-surface'
			? parentElement
			: null;
	};

	const resolveTerminalViewportSize = (shellElement: HTMLElement): { height: number; width: number } => {
		const shellSize = readElementSize(shellElement);
		const frameElement = resolveTerminalViewportFrame(shellElement);
		if (frameElement) {
			const frameSize = readElementSize(frameElement);
			return {
				height: Math.max(shellSize.height, frameSize.height),
				width: Math.max(shellSize.width, frameSize.width),
			};
		}
		return shellSize;
	};

	const resolveTerminalGeometry = (
		shellElement: HTMLElement,
		hostElement: HTMLElement,
		cellSize: { charWidth: number; rowHeight: number },
	): { cols: number; rows: number } => {
		const { height, width } = resolveTerminalViewportSize(shellElement);
		const computed = getComputedStyle(hostElement);
		const inlineExtra = parseCssSize(computed.paddingLeft) + parseCssSize(computed.paddingRight);
		const blockExtra = parseCssSize(computed.paddingTop) + parseCssSize(computed.paddingBottom);
		const contentWidth = Math.max(1, width - inlineExtra);
		const contentHeight = Math.max(1, height - blockExtra);
		return {
			cols: Math.max(MIN_WORKSPACE_SHELL_TERMINAL_COLUMNS, Math.floor(contentWidth / cellSize.charWidth)),
			rows: Math.max(
				MIN_WORKSPACE_SHELL_TERMINAL_ROWS,
				Math.floor(contentHeight / cellSize.rowHeight) || DEFAULT_WORKSPACE_SHELL_TERMINAL_ROWS,
			),
		};
	};

	const setTerminalGridInlineSize = (
		element: HTMLElement,
		geometry: { cols: number },
		cellSize: { charWidth: number },
	): void => {
		element.style.setProperty(
			'--workspace-shell-terminal-grid-min-inline-size',
			`${Math.ceil(geometry.cols * cellSize.charWidth)}px`,
		);
	};

	$effect(() => {
		const currentHost = host;
		const currentShell = shell;
		shellSessionKey;
		if (!currentHost || !currentShell) {
			return;
		}

		let active = true;
		let terminalSession: TerminalRendererSession | null = null;
		let resizeObserver: ResizeObserver | null = null;
		let shellController: WorkspaceShellController | null = null;
		let cellSize = { charWidth: 8, rowHeight: 20 };

		ready = false;
		running = false;
		cwd = initialCwd?.trim() || null;
		initError = null;
		currentHost.replaceChildren();
		currentHost.classList.add('wterm', 'cursor-blink', 'workspace-shell-terminal__wterm-host');

		void (async () => {
			try {
				await ensureWTermReady();
				if (!active) {
					return;
				}

				cellSize = measureTerminalCellSize(currentHost);
				let geometry = resolveTerminalGeometry(currentShell, currentHost, cellSize);
				setTerminalGridInlineSize(currentHost, geometry, cellSize);
				currentHost.style.setProperty('--term-row-height', `${Math.ceil(cellSize.rowHeight)}px`);

				terminalSession = await wtermRendererAdapter.createSession({
					host: currentHost,
					cols: geometry.cols,
					rows: geometry.rows,
					scrollback: WORKSPACE_SHELL_TERMINAL_SCROLLBACK,
					appearance: workspaceShellTerminalAppearance,
					onInputBytes: (data) => {
						shellController?.handleData(inputDecoder.decode(data));
					},
				});
				if (!active) {
					terminalSession.dispose();
					return;
				}
				resizeObserver = new ResizeObserver(() => {
					if (!terminalSession) {
						return;
					}
					cellSize = measureTerminalCellSize(currentHost);
					const nextGeometry = resolveTerminalGeometry(currentShell, currentHost, cellSize);
					setTerminalGridInlineSize(currentHost, nextGeometry, cellSize);
					currentHost.style.setProperty('--term-row-height', `${Math.ceil(cellSize.rowHeight)}px`);
					if (nextGeometry.cols !== geometry.cols || nextGeometry.rows !== geometry.rows) {
						geometry = nextGeometry;
						terminalSession.resize(nextGeometry.cols, nextGeometry.rows);
					}
				});
				resizeObserver.observe(currentShell);
				const viewportFrame = resolveTerminalViewportFrame(currentShell);
				if (viewportFrame) {
					resizeObserver.observe(viewportFrame);
				}

				if (import.meta.env.DEV && typeof window !== 'undefined') {
					const debugWindow = window as Window & {
						__workspaceShellTerminalSession?: TerminalRendererSession;
					};
					debugWindow.__workspaceShellTerminalSession = terminalSession;
				}

				ready = true;
				terminalSession.focus();

				shellController = new WorkspaceShellController({
					exec: async (input) =>
						await onExec({
							avatar,
							command: input.command,
							cwd: input.cwd,
							runtimeId,
							surface: input.surface,
							workspacePath,
						}),
					initialCommand,
					initialCwd,
					onCwdChange: (nextCwd) => {
						cwd = nextCwd.trim().length > 0 ? nextCwd : null;
					},
					onRunningChange: (nextRunning) => {
						running = nextRunning;
					},
					promptLabel,
					surface,
					terminal: {
						focus: () => {
							terminalSession?.focus();
						},
						write: (data) => {
							terminalSession?.write(data);
						},
					},
				});
				await shellController.start();
			} catch (error) {
				if (!active) {
					return;
				}
				initError = error instanceof Error ? error.message : String(error);
				running = false;
			}
		})();

		return () => {
			active = false;
			resizeObserver?.disconnect();
			shellController?.dispose();
			terminalSession?.dispose();
			if (import.meta.env.DEV && typeof window !== 'undefined') {
				const debugWindow = window as Window & {
					__workspaceShellTerminalSession?: TerminalRendererSession;
				};
				if (debugWindow.__workspaceShellTerminalSession === terminalSession) {
					delete debugWindow.__workspaceShellTerminalSession;
				}
			}
			currentHost.classList.remove('wterm', 'cursor-blink', 'has-scrollback', 'focused', 'wterm-host-reset');
			currentHost.style.removeProperty('height');
			currentHost.style.removeProperty('--term-row-height');
			currentHost.style.removeProperty('--workspace-shell-terminal-grid-min-inline-size');
			currentHost.replaceChildren();
		};
	});
</script>

<div bind:this={shell} class="workspace-shell-terminal" data-testid="workspace-shell-terminal">
	<div bind:this={host} class="workspace-shell-terminal__host" data-testid="workspace-shell-terminal-host"></div>
	{#if !ready && !initError}
		<div class="workspace-shell-terminal__placeholder">Loading terminal…</div>
	{/if}
	{#if initError}
		<div class="workspace-shell-terminal__placeholder workspace-shell-terminal__placeholder--error">
			{initError}
		</div>
	{/if}
</div>

<style>
	.workspace-shell-terminal {
		background:
			radial-gradient(circle at 18% 0%, color-mix(in srgb, #1f3f62 34%, transparent), transparent 34rem),
			linear-gradient(180deg, #101827 0%, #0b1220 58%, #070d18 100%);
		block-size: 100%;
		display: grid;
		inline-size: 100%;
		justify-self: stretch;
		min-block-size: 0;
		min-inline-size: 0;
		position: relative;
	}

	.workspace-shell-terminal__host {
		--workspace-shell-terminal-grid-min-inline-size: 80ch;
		--term-bg: #0b1220;
		--term-brightBlack: #415063;
		--term-brightBlue: #85c1ff;
		--term-brightCyan: #81e6d9;
		--term-brightGreen: #9ae6b4;
		--term-brightMagenta: #f6adff;
		--term-brightRed: #fc8181;
		--term-brightWhite: #f7fafc;
		--term-brightYellow: #f6e05e;
		--term-color-0: #182233;
		--term-color-1: #f56565;
		--term-color-10: var(--term-brightGreen);
		--term-color-11: var(--term-brightYellow);
		--term-color-12: var(--term-brightBlue);
		--term-color-13: var(--term-brightMagenta);
		--term-color-14: var(--term-brightCyan);
		--term-color-15: var(--term-brightWhite);
		--term-color-2: #48bb78;
		--term-color-3: #ecc94b;
		--term-color-4: #63b3ed;
		--term-color-5: #d6bcfa;
		--term-color-6: #4fd1c5;
		--term-color-7: #e2e8f0;
		--term-color-8: var(--term-brightBlack);
		--term-color-9: var(--term-brightRed);
		--term-cursor: #f8fafc;
		--term-fg: #e6edf6;
		--term-font-family: var(--font-mono, ui-monospace, SFMono-Regular, monospace);
		--term-font-size: 13px;
		--term-line-height: 1.52;
		--term-row-height: 20px;
		align-self: start;
		background: transparent;
		box-sizing: border-box;
		grid-area: 1 / 1;
		height: 100% !important;
		inline-size: 100%;
		justify-self: stretch;
		max-inline-size: 100%;
		min-block-size: 0;
		min-inline-size: 0;
		-webkit-overflow-scrolling: touch;
		overflow-x: auto;
		overscroll-behavior-x: contain;
		overscroll-behavior-y: contain;
		padding: 0;
		scrollbar-gutter: stable both-edges;
		touch-action: pinch-zoom pan-x pan-y;
		user-select: text;
	}

	.workspace-shell-terminal__placeholder {
		align-items: center;
		background: color-mix(in srgb, #0b1220, transparent 14%);
		color: #dbe6f4;
		display: flex;
		font-family: var(--font-mono, ui-monospace, SFMono-Regular, monospace);
		font-size: 12px;
		inset: 0;
		justify-content: center;
		position: absolute;
	}

	.workspace-shell-terminal__placeholder--error {
		color: #fecaca;
	}

	:global(.workspace-shell-terminal__host.wterm-host-reset) {
		border-radius: 0 !important;
		box-shadow: none !important;
		outline: none !important;
	}

	:global(.workspace-shell-terminal__host .term-grid) {
		box-sizing: border-box;
		inline-size: max-content;
		min-inline-size: max(100%, var(--workspace-shell-terminal-grid-min-inline-size));
		padding: 0.9rem 1rem max(1.1rem, var(--term-row-height));
	}

	:global(.workspace-shell-terminal__host .term-row) {
		min-inline-size: var(--workspace-shell-terminal-grid-min-inline-size);
		white-space: pre;
	}

	:global(.workspace-shell-terminal__host::-webkit-scrollbar) {
		block-size: 0.5rem;
		inline-size: 0.5rem;
	}

	:global(.workspace-shell-terminal__host::-webkit-scrollbar-track) {
		background: transparent;
	}

	:global(.workspace-shell-terminal__host::-webkit-scrollbar-thumb) {
		background: color-mix(in srgb, currentColor, transparent);
		border-radius: 999px;
	}
</style>
