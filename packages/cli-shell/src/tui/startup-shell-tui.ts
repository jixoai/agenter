import { BoxRenderable, createCliRenderer, TextRenderable } from "@opentui/core";

import { fitTerminalText, measureTerminalText } from "./cell-width";
import { formatCliShellShortcut, resolveCliShellTuiKeybindings } from "./keybindings";
import { projectMarkdownLastLine } from "./markdown-projection";
import { ShellTerminalViewRenderable } from "./shell-terminal-view";

const STARTUP_LEFT = "◉ terminal";
const STARTUP_MANAGED = "托管 off";
const STARTUP_UNREAD = `✉ 0 ${formatCliShellShortcut(resolveCliShellTuiKeybindings(null).openDialogue)}`;

export interface CliShellStartupAppProps {
  shellName: string;
  heartbeat: string;
}

export interface CliShellStartupTuiController {
  finished: Promise<void>;
  destroy(): void;
  setHeartbeat(nextHeartbeat: string): void;
}

const buildToolbarLine = (heartbeat: string, width: number): string => {
  if (width <= 0) {
    return "";
  }
  const separator = " │ ";
  const reserved =
    measureTerminalText(STARTUP_LEFT) +
    measureTerminalText(STARTUP_MANAGED) +
    measureTerminalText(STARTUP_UNREAD) +
    measureTerminalText(separator) * 3;
  if (reserved >= width) {
    return fitTerminalText(heartbeat, width, { ellipsis: true });
  }
  const heartbeatWidth = width - reserved;
  return `${STARTUP_LEFT}${separator}${fitTerminalText(heartbeat, heartbeatWidth, { ellipsis: true })}${separator}${STARTUP_MANAGED}${separator}${STARTUP_UNREAD}`;
};

export const startCliShellStartupTui = async (
  input: CliShellStartupAppProps,
): Promise<CliShellStartupTuiController> => {
  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
    useMouse: true,
  });
  let heartbeat = input.heartbeat;
  let heartbeatProjection = input.heartbeat;
  let done = false;
  let resolveFinished = () => {};
  const finished = new Promise<void>((resolve) => {
    resolveFinished = resolve;
  });
  const root = new BoxRenderable(renderer, {
    id: "cli-shell-startup-root",
    width: "100%",
    height: "100%",
    position: "absolute",
    top: 0,
    left: 0,
  });
  const terminalView = new ShellTerminalViewRenderable(renderer, {
    id: "cli-shell-startup-terminal-view",
    width: Math.max(1, renderer.width),
    height: Math.max(1, renderer.height - 1),
    focused: true,
    lines: [],
  });
  const toolbar = new TextRenderable(renderer, {
    id: "cli-shell-startup-toolbar",
    position: "absolute",
    left: 0,
    top: Math.max(0, renderer.height - 1),
    width: Math.max(1, renderer.width),
    height: 1,
    content: "",
  });
  root.add(terminalView);
  root.add(toolbar);
  renderer.root.add(root);

  const render = (): void => {
    const width = Math.max(1, renderer.width);
    const height = Math.max(1, renderer.height);
    const bodyHeight = Math.max(1, height - 1);
    root.width = width;
    root.height = height;
    terminalView.width = width;
    terminalView.height = bodyHeight;
    terminalView.lines = Array.from({ length: bodyHeight }, (_, row) => ({
      spans:
        row === 0
          ? [
              {
                text: `${input.shellName}: waiting for terminal attach`,
              },
            ]
          : [],
    }));
    toolbar.top = Math.max(0, height - 1);
    toolbar.width = width;
    toolbar.content = buildToolbarLine(heartbeatProjection, width);
    renderer.requestRender();
  };

  const projectHeartbeat = (): void => {
    const separator = " │ ";
    const width = Math.max(1, renderer.width);
    const reserved =
      measureTerminalText(STARTUP_LEFT) +
      measureTerminalText(STARTUP_MANAGED) +
      measureTerminalText(STARTUP_UNREAD) +
      measureTerminalText(separator) * 3;
    const projectionWidth = reserved >= width ? width : Math.max(1, width - reserved);
    void projectMarkdownLastLine({
      content: heartbeat,
      width: projectionWidth,
    }).then((projection) => {
      if (done || projection === heartbeatProjection) {
        return;
      }
      heartbeatProjection = projection;
      render();
    });
  };

  const handleResize = (): void => {
    projectHeartbeat();
    render();
  };

  renderer.on("resize", handleResize);
  render();
  projectHeartbeat();

  const destroy = () => {
    if (done) {
      return;
    }
    done = true;
    renderer.off("resize", handleResize);
    root.destroyRecursively();
    renderer.destroy();
    resolveFinished();
  };

  return {
    finished,
    destroy,
    setHeartbeat(nextHeartbeat: string) {
      if (done || heartbeat === nextHeartbeat) {
        return;
      }
      heartbeat = nextHeartbeat;
      projectHeartbeat();
      render();
    },
  };
};
