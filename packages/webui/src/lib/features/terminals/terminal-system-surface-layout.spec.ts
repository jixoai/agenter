import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const terminalSystemSurfaceSource = readFileSync(
  resolve(import.meta.dirname, "terminal-system-surface.svelte"),
  "utf8",
);
const terminalPageToolbarSource = readFileSync(
  resolve(import.meta.dirname, "terminal-page-toolbar-content.svelte"),
  "utf8",
);
const terminalWindowSurfaceSource = readFileSync(
  resolve(import.meta.dirname, "terminal-window-surface.svelte"),
  "utf8",
);
const terminalViewHostSource = readFileSync(
  resolve(import.meta.dirname, "../../components/terminal-view-host.svelte"),
  "utf8",
);
const terminalsWorkbenchLayoutSource = readFileSync(
  resolve(import.meta.dirname, "terminals-workbench-layout.svelte"),
  "utf8",
);
const terminalUsersDialogSource = readFileSync(resolve(import.meta.dirname, "terminal-users-dialog.svelte"), "utf8");

describe("Feature: Terminal surface layout ownership contract", () => {
  test("Scenario: Given the terminal route owns page-toolbar identity When reading the surface source Then it portals route-local toolbar content instead of reviving static shell copy", () => {
    expect(terminalSystemSurfaceSource).toContain(
      "import WorkbenchPageToolbar from '$lib/features/navigation/workbench-page-toolbar.svelte';",
    );
    expect(terminalSystemSurfaceSource).toContain(
      "import WorkbenchPageContent from '$lib/features/navigation/workbench-page-content.svelte';",
    );
    expect(terminalSystemSurfaceSource).toContain("<WorkbenchPageToolbar>");
    expect(terminalSystemSurfaceSource).toContain("<TerminalPageToolbarContent");
  });

  test("Scenario: Given the terminal detail rail is now actions-only When reading the source Then the rail owns a full-height actions scroll surface instead of a second local tabs stack", () => {
    expect(terminalSystemSurfaceSource).toContain('bodyClass="h-full"');
    expect(terminalSystemSurfaceSource).toContain('data-terminal-detail-panel-view="actions"');
    expect(terminalSystemSurfaceSource).toContain('class="grid h-full grid-rows-[minmax(0,1fr)]"');
    expect(terminalSystemSurfaceSource).not.toContain("Actions + Users");
    expect(terminalSystemSurfaceSource).not.toContain('<Tabs.List class="mx-4 mt-4 grid grid-cols-2">');
  });

  test("Scenario: Given the terminal action composer should not revive a second footer card When reading the source Then the stage pane uses InputGroup bodies and keeps read parameters above the actor row", () => {
    expect(terminalSystemSurfaceSource).toContain('<InputGroup.Root layout="block" data-testid="terminal-write-input-group">');
    expect(terminalSystemSurfaceSource).toContain('<InputGroup.Root layout="block" data-testid="terminal-read-input-group">');
    expect(terminalSystemSurfaceSource).toContain('<InputGroup.Root layout="block" data-testid="terminal-resize-input-group">');
    expect(terminalSystemSurfaceSource).toContain('data-testid="terminal-read-parameter-panel"');
    expect(terminalSystemSurfaceSource).toContain('data-testid="terminal-resize-parameter-panel"');
    expect(terminalSystemSurfaceSource).toContain('data-testid="terminal-actions-panel"');
    expect(terminalSystemSurfaceSource).not.toContain('{#snippet footer()}');
  });

  test("Scenario: Given compact terminal detail should follow the shared sheet law When reading the source Then the surface delegates compact fallback to WorkbenchPageContent instead of stacking the actions rail below the stage", () => {
    expect(terminalSystemSurfaceSource).toContain('<WorkbenchPageContent');
    expect(terminalSystemSurfaceSource).toContain('detailLayout="split-detail"');
    expect(terminalSystemSurfaceSource).toContain('bind:detailOpen={actionsDetailOpen}');
    expect(terminalSystemSurfaceSource).toContain('bind:detailCompact={detailRailCompact}');
    expect(terminalSystemSurfaceSource).toContain("data-terminal-detail-layout={detailRailCompact ? 'sheet' : 'split'}");
    expect(terminalSystemSurfaceSource).not.toContain("'stacked'");
  });

  test("Scenario: Given seat management moved out of the right rail When reading the source Then the surface opens a dedicated users dialog instead of inline users-pane width choreography", () => {
    expect(terminalSystemSurfaceSource).toContain("let usersDialogOpen = $state(false);");
    expect(terminalSystemSurfaceSource).toContain("<TerminalUsersDialog");
    expect(terminalSystemSurfaceSource).not.toContain("resolveTerminalUsersPaneLayout");
    expect(terminalUsersDialogSource).toContain('data-testid="terminal-users-dialog"');
    expect(terminalUsersDialogSource).toContain("<ActorSelect");
    expect(terminalUsersDialogSource).toContain("data-testid={`terminal-seat-actions-${seat.actorId}`}");
  });

  test("Scenario: Given the terminal page-toolbar owns runtime status When reading the toolbar source Then the status slot derives from authoritative terminal facts", () => {
    expect(terminalPageToolbarSource).toContain(
      "import WorkbenchToolbarStatus from '$lib/features/navigation/workbench-toolbar-status.svelte';",
    );
    expect(terminalPageToolbarSource).toContain("{#snippet terminalToolbarStatus(toolbarState: WorkbenchToolbarRenderState)}");
    expect(terminalPageToolbarSource).toContain("resolveTerminalLifecycleFacts(selectedTerminal)");
    expect(terminalPageToolbarSource).toContain("{#each terminalStatusFacts as fact (fact.label)}");
    expect(terminalPageToolbarSource).toContain("status={terminalToolbarStatus}");
    expect(terminalPageToolbarSource).toContain("actionsOpen: boolean;");
    expect(terminalPageToolbarSource).toContain("usersOpen: boolean;");
    expect(terminalPageToolbarSource).toContain("pressed={actionsOpen}");
    expect(terminalPageToolbarSource).not.toContain("activeDetailView");
  });

  test("Scenario: Given terminal lifecycle actions run from the shared toolbar When reading the source Then the action button exposes explicit bootstrapping and killing pending labels instead of a silent disabled state", () => {
    expect(terminalSystemSurfaceSource).toContain("let lifecycleIntent = $state<TerminalLifecycleIntent | null>(null);");
    expect(terminalSystemSurfaceSource).toContain("lifecycleIntent = 'bootstrap';");
    expect(terminalSystemSurfaceSource).toContain("lifecycleIntent = 'stop';");
    expect(terminalSystemSurfaceSource).toContain("let stopDialogOpen = $state(false);");
    expect(terminalSystemSurfaceSource).toContain("const handleRequestLifecycleAction = (action: TerminalLifecycleAction): void => {");
    expect(terminalPageToolbarSource).toContain("lifecycleIntent?: TerminalLifecycleIntent | null;");
    expect(terminalPageToolbarSource).toContain("onRequestLifecycleAction: (action: TerminalLifecycleAction) => void;");
    expect(terminalPageToolbarSource).toContain("return 'Bootstrapping PTY…';");
    expect(terminalPageToolbarSource).toContain("return 'Killing PTY…';");
    expect(terminalPageToolbarSource).toContain("disabled={lifecycleBusy}");
    expect(terminalSystemSurfaceSource).toContain('data-testid="terminal-stop-confirm-dialog"');
    expect(terminalSystemSurfaceSource).toContain('data-testid="terminal-stop-confirm-submit"');
  });

  test("Scenario: Given terminal deletion remains destructive but titlebar chrome is minimal When reading the source Then delete is route-owned instead of a third titlebar control", () => {
    expect(terminalPageToolbarSource).toContain('label="Delete terminal"');
    expect(terminalPageToolbarSource).toContain("inlineTone=\"critical\"");
    expect(terminalWindowSurfaceSource).not.toContain('data-testid="terminal-window-close-control"');
  });

  test("Scenario: Given terminal instance identity and PTY window title diverge When reading the source Then tabs and toolbar keep the instance name while the window title uses the observed PTY title", () => {
    expect(terminalPageToolbarSource).toContain("resolveTerminalInstanceName(selectedTerminal)");
    expect(terminalsWorkbenchLayoutSource).toContain("label: resolveTerminalInstanceName(terminal)");
    expect(terminalWindowSurfaceSource).toContain("resolveTerminalWindowTitle(terminal)");
    expect(terminalWindowSurfaceSource).not.toContain("resolveTerminalInstanceName(terminal)");
  });

  test("Scenario: Given stopped terminals may still expose transport discovery When reading the route source Then transport discovery and live transport are not treated as the same truth", () => {
    expect(terminalSystemSurfaceSource).toContain("const effectiveTransportUrl = $derived(selectedTransportUrl ?? selectedTerminal?.transportUrl ?? null);");
    expect(terminalSystemSurfaceSource).toContain("const selectedTransportLabel = $derived(");
    expect(terminalSystemSurfaceSource).toContain("resolveTerminalTransportLabel(selectedTerminal)");
    expect(terminalSystemSurfaceSource).toContain("Transport: {selectedTransportLabel}");
    expect(terminalWindowSurfaceSource).toContain("const liveTransportEnabled = $derived(isTerminalRunning(terminal));");
    expect(terminalWindowSurfaceSource).toContain("{liveTransportEnabled}");
    expect(terminalWindowSurfaceSource).toContain("transportUrl={transportUrl ?? terminal.transportUrl}");
    expect(terminalViewHostSource).toContain("element.transportUrl = liveTransportEnabled ? (transportUrl ?? '') : '';");
  });

  test("Scenario: Given live terminal resizing belongs to the window frame When reading the window source Then fit-cover sizing changes the window geometry while the titlebar stays outside terminal scaling", () => {
    expect(terminalWindowSurfaceSource).toContain('data-testid="terminal-window-live-resize-handle"');
    expect(terminalWindowSurfaceSource).toContain(
      'onLiveResize?: (input: { width: number; height: number; cols: number; rows: number }) => void;',
    );
    expect(terminalWindowSurfaceSource).toContain("window.addEventListener('pointermove', handleResizeMove);");
    expect(terminalWindowSurfaceSource).toContain("window.addEventListener('pointerup', handleResizeEnd);");
    expect(terminalWindowSurfaceSource).toContain("window.addEventListener('pointercancel', handleResizeEnd);");
    expect(terminalWindowSurfaceSource).toContain(
      'reportLiveResize(nextFrameWidth, nextFrameHeight, nextGrid);',
    );
    expect(terminalWindowSurfaceSource).toContain(
      'reportLiveResize(finalFrameWidth, finalFrameHeight, nextGrid);',
    );
    expect(terminalWindowSurfaceSource).toContain('if (nextFrameWidth === dragStartWidth && nextFrameHeight === dragStartHeight) {');
    expect(terminalWindowSurfaceSource).toContain('const shouldCommitResize = dragResizeMoved;');
    expect(terminalWindowSurfaceSource).toContain("resolveTerminalWindowProjection");
    expect(terminalWindowSurfaceSource).toContain("projectionScale={viewportProjectionScale}");
    expect(terminalWindowSurfaceSource).toContain('data-terminal-window-shell-width={String(shellWidth)}');
    expect(terminalWindowSurfaceSource).toContain('data-testid="terminal-window-lifecycle-control"');
    expect(terminalWindowSurfaceSource).toContain('data-testid="terminal-window-size-info"');
    expect(terminalWindowSurfaceSource).toContain("data-terminal-window-titlebar-owner={owner}");
    expect(terminalWindowSurfaceSource).toContain("'window-container'");
    expect(terminalWindowSurfaceSource).toContain("'terminal-window'");
    expect(terminalWindowSurfaceSource).toContain("'terminal-window-cover-titlebar'");
    expect(terminalWindowSurfaceSource).toContain("'terminal-window-fit-titlebar'");
    expect(terminalWindowSurfaceSource).toContain('class="native-window-resize-handle"');
    expect(terminalWindowSurfaceSource).toContain('data-terminal-window-native-resize-handle="true"');
    expect(terminalWindowSurfaceSource).toContain("document.documentElement.style.cursor = 'se-resize';");
    expect(terminalWindowSurfaceSource).not.toContain("GripIcon");
    expect(terminalWindowSurfaceSource).not.toContain("viewportMode={viewportMode}");
    expect(terminalWindowSurfaceSource).not.toContain('transform:scale(');
    expect(terminalWindowSurfaceSource).not.toContain("window.addEventListener('mousemove', handleResizeMove);");
    expect(terminalWindowSurfaceSource).not.toContain("window.addEventListener('touchmove', handleResizeMove");
    expect(terminalWindowSurfaceSource).not.toContain('const nextFrameKey = `${liveFrameWidth}x${liveFrameHeight}`;');
  });
});
