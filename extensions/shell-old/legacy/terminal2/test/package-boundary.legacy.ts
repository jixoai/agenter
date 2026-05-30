import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const packageRoot = join(import.meta.dir, "..");

describe("Feature: cli-shell package boundary", () => {
  test("Scenario: Given the external cli-shell package When inspecting its dependencies Then it consumes daemon-facing contracts without importing core runtime internals", () => {
    const pkg = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      bin?: Record<string, string>;
      files?: string[];
      private?: boolean;
      publishConfig?: { access?: string };
      scripts?: Record<string, string>;
    };
    const binSource = readFileSync(join(packageRoot, "src", "bin", "agenter-cli-shell.ts"), "utf8");
    const argvSource = readFileSync(join(packageRoot, "src", "argv.ts"), "utf8");
    const productSource = readFileSync(join(packageRoot, "src", "product.ts"), "utf8");
    const bootstrapSource = readFileSync(join(packageRoot, "src", "bootstrap.ts"), "utf8");
    const managedSource = readFileSync(join(packageRoot, "src", "managed.ts"), "utf8");
    const indexSource = readFileSync(join(packageRoot, "src", "index.ts"), "utf8");
    const canvasSource = readFileSync(join(packageRoot, "src", "tui", "canvas.ts"), "utf8");
    const frameSource = readFileSync(join(packageRoot, "src", "tui", "frame.ts"), "utf8");
    const tuiAppSource = readFileSync(join(packageRoot, "src", "tui", "core-app.ts"), "utf8");
    const tuiRunnerSource = readFileSync(join(packageRoot, "src", "tui", "run-cli-shell-tui.ts"), "utf8");
    const startupTuiSource = readFileSync(join(packageRoot, "src", "tui", "startup-shell-tui.ts"), "utf8");
    const backendFrameSource = readFileSync(join(packageRoot, "src", "tui", "backend-frame-renderable.ts"), "utf8");
    const backendScrollbarSource = readFileSync(join(packageRoot, "src", "tui", "backend-scrollbar.ts"), "utf8");
    const shellTerminalViewSource = readFileSync(join(packageRoot, "src", "tui", "shell-terminal-view.ts"), "utf8");
    const liveMirrorSource = readFileSync(join(packageRoot, "src", "tui", "live-terminal-mirror.ts"), "utf8");
    const webHostSource = readFileSync(join(packageRoot, "src", "web", "start-cli-shell-web-host.ts"), "utf8");
    const runCliShellSource = readFileSync(join(packageRoot, "src", "run-cli-shell.ts"), "utf8");
    const termlessWalkthroughSource = readFileSync(
      join(packageRoot, "test", "cli-shell-termless-walkthrough.test.ts"),
      "utf8",
    );

    expect(pkg.dependencies).toEqual({
      "@agenter/client-sdk": "workspace:*",
      "@agenter/product-extension-runtime": "workspace:*",
      "@agenter/terminal-view": "workspace:*",
      "@agenter/termless-core": "workspace:*",
      "@agenter/terminal-transport-protocol": "workspace:*",
      "@opentui/core": "latest",
      vite: "^8.0.3",
      "yargs": "^17.7.2",
    });
    expect(pkg.devDependencies?.["@agenter/client-sdk"]).toBeUndefined();
    expect(pkg.devDependencies?.["@agenter/product-extension-runtime"]).toBeUndefined();
    expect(pkg.private).toBeUndefined();
    expect(pkg.bin).toEqual({ "agenter-cli-shell": "./src/bin/agenter-cli-shell.ts" });
    expect(pkg.files).toEqual(["SPEC.md", "src"]);
    expect(pkg.publishConfig).toEqual({ access: "public" });
    expect(pkg.scripts?.test).toBe("bun test --max-concurrency=1");
    expect(pkg.scripts?.build).toBeUndefined();
    expect(pkg.scripts?.prepack).toBeUndefined();
    expect(binSource).toContain('await runCliShell(process.argv)');
    expect(argvSource).toContain("AGENTER_DAEMON_HOST");
    expect(argvSource).toContain("AGENTER_DAEMON_PORT");
    expect(argvSource).toContain("AGENTER_AUTH_SERVICE_ENDPOINT");
    expect(productSource).toContain('from "@agenter/client-sdk"');
    expect(productSource).toContain('from "@agenter/product-extension-runtime"');
    expect(managedSource).toContain('from "@agenter/client-sdk"');
    expect(managedSource).toContain('from "@agenter/product-extension-runtime"');
    expect(managedSource).not.toContain("@agenter/app-server");
    expect(managedSource).not.toContain("session-runtime");
    expect(pkg.dependencies).not.toHaveProperty("@opentui/react");
    expect(pkg.dependencies).not.toHaveProperty("react");
    expect(tuiAppSource).toContain('from "@opentui/core"');
    expect(tuiAppSource).toContain("export class CliShellCoreApp");
    expect(tuiAppSource).toContain("new ShellTerminalViewRenderable");
    expect(tuiAppSource).not.toContain("new BackendScrollbarRenderable");
    expect(tuiAppSource).not.toContain("@opentui/react");
    expect(tuiAppSource).not.toContain("createRoot");
    expect(tuiAppSource).not.toContain("useState");
    expect(tuiAppSource).not.toContain("useEffect");
    expect(tuiRunnerSource).toContain('from "@opentui/core"');
    expect(tuiRunnerSource).toContain("new CliShellCoreApp");
    expect(tuiRunnerSource).not.toContain("@opentui/react");
    expect(tuiRunnerSource).not.toContain("createRoot");
    expect(tuiRunnerSource).not.toContain("extend(");
    expect(startupTuiSource).toContain('from "@opentui/core"');
    expect(startupTuiSource).not.toContain("@opentui/react");
    expect(startupTuiSource).not.toContain("createRoot");
    expect(startupTuiSource).not.toContain("extend(");
    expect(indexSource).toContain('from "./tui/canvas"');
    expect(indexSource).toContain('from "./tui/core-app"');
    expect(indexSource).toContain("createTerminalCanvas");
    expect(indexSource).toContain("layoutCliShellTuiFrame");
    expect(canvasSource).toContain("export const createTerminalCanvas");
    expect(canvasSource).toContain("export const writeCanvasStyledText");
    expect(canvasSource).toContain("export const drawCanvasRectangle");
    expect(frameSource).toContain('from "./canvas"');
    expect(frameSource).toContain("createTerminalCanvas");
    expect(frameSource).toContain("renderCanvasStyledLines");
    expect(frameSource).toContain("projectTerminalViewport");
    expect(frameSource).not.toContain("@agenter/terminal-view");
    expect(backendFrameSource).toContain('from "@opentui/core"');
    expect(backendFrameSource).toContain("FrameBufferRenderable");
    expect(backendFrameSource).toContain("this.frameBuffer.drawText");
    expect(backendFrameSource).not.toContain("this.frameBuffer.setCell");
    expect(backendScrollbarSource).toContain('from "@opentui/core"');
    expect(backendScrollbarSource).toContain("ScrollBarRenderable");
    expect(shellTerminalViewSource).toContain("BackendFrameRenderable");
    expect(shellTerminalViewSource).toContain("selectionRegions");
    expect(shellTerminalViewSource).not.toContain("@agenter/terminal-view");
    expect(shellTerminalViewSource).not.toContain("@opentui/react");
    expect(shellTerminalViewSource).not.toContain("xterm");
    expect(shellTerminalViewSource).not.toContain("ghostty-web");
    expect(liveMirrorSource).toContain('from "@agenter/terminal-transport-protocol"');
    expect(liveMirrorSource).toContain('from "@agenter/termless-core"');
    expect(liveMirrorSource).not.toContain("@agenter/termless-xterm-backend");
    expect(liveMirrorSource).not.toContain("@agenter/app-server");
    expect(liveMirrorSource).not.toContain("session-runtime");
    expect(tuiAppSource).not.toContain("@agenter/tui");
    expect(tuiRunnerSource).not.toContain("@agenter/tui");
    expect(runCliShellSource).toContain("ws://${args.host}:${args.port}/trpc");
    expect(runCliShellSource).toContain('await import("./tui/run-cli-shell-tui")');
    expect(runCliShellSource).toContain('await import("./web")');
    expect(runCliShellSource).not.toContain('import { startCliShellTui } from "./tui/run-cli-shell-tui"');
    expect(runCliShellSource).not.toContain("Bun.spawn");
    expect(runCliShellSource).not.toContain("child_process");
    expect(runCliShellSource).not.toContain("node-pty");
    expect(runCliShellSource).not.toContain("terminal-2 child");
    expect(runCliShellSource).not.toContain("cells-to-ansi");
    expect(runCliShellSource).not.toContain("port-file");
    expect(runCliShellSource).not.toContain("daemon-port");
    expect(runCliShellSource).not.toContain(".agenter");
    expect(termlessWalkthroughSource).toContain('from "@agenter/termless-core"');
    expect(termlessWalkthroughSource).toContain("new CliShellCoreApp");
    expect(termlessWalkthroughSource).not.toContain("@opentui/react");
    expect(termlessWalkthroughSource).not.toContain("createRoot");
    expect(termlessWalkthroughSource).not.toContain("React.createElement");
    expect(termlessWalkthroughSource).toContain("createTerminal({");
    expect(termlessWalkthroughSource).toContain("backend: createXtermBackend()");
    expect(termlessWalkthroughSource).toContain('term.press("Meta+j")');
    expect(termlessWalkthroughSource).toContain('term.press("Meta+m")');
    expect(termlessWalkthroughSource).toContain('term.press("Escape")');
    expect(termlessWalkthroughSource).toContain("term.click(79, 0)");
    expect(bootstrapSource).not.toContain("@agenter/app-server");
    expect(bootstrapSource).not.toContain("../app-server");
    expect(bootstrapSource).not.toContain("session-runtime");
    expect(bootstrapSource).not.toContain("app-kernel");
    expect(webHostSource).toContain('import { TERMINAL_VIEW_TAG, defineTerminalView } from "@agenter/terminal-view";');
    expect(webHostSource).toContain("view.transportUrl = config.transportUrl;");
    expect(webHostSource).toContain("view.liveTransportEnabled = true;");
    expect(webHostSource).not.toContain("ShellTerminalViewRenderable");
    expect(webHostSource).not.toContain("buildCliShellComposedSurface");
  });
});
