import { createPaneSourceId, type PaneSource } from "../renderable-mux/pane-source";
import {
  createLocalBunPtyPaneSource,
  resolveDefaultShellLaunch,
} from "../sources/bun-terminal-protocol-source";
import type { ShellNextTerminalSourcePolicy, ShellNextTerminalSourceRequest } from "./shell-next-app-types";

const SHELL_CONTENT_INSET_X = 2;
const SHELL_CONTENT_INSET_Y = 3;

export const createDefaultShellNextShellSource = (input: ShellNextTerminalSourceRequest): PaneSource => {
  const launch = input.command
    ? { command: input.command[0], args: input.command.slice(1), cwd: input.cwd }
    : resolveDefaultShellLaunch(input.cwd);
  return createLocalBunPtyPaneSource({
    id: createPaneSourceId(input.id),
    launch,
    initialSize: {
      cols: Math.max(1, input.node.rect.width - SHELL_CONTENT_INSET_X),
      rows: Math.max(1, input.node.rect.height - SHELL_CONTENT_INSET_Y),
    },
    backend: "ghostty-native",
    onExit: input.onExit,
  });
};

export const createDefaultShellNextTerminalSourcePolicy = (): ShellNextTerminalSourcePolicy => ({
  createInitialSource: createDefaultShellNextShellSource,
  createSplitSource: createDefaultShellNextShellSource,
});
