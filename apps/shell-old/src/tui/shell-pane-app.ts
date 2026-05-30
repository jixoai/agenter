import type { CliShellRoomBootstrapResult } from "../bootstrap";
import { encodeCliShellTerminalKey } from "./terminal-input";
import {
  startCliShellTerminalInstancePanel,
  type CliShellTerminalInstancePanelController,
} from "./terminal-instance-panel";

export type CliShellShellPaneTuiController = CliShellTerminalInstancePanelController;

export const startCliShellShellPaneTui = async (input: {
  attached: CliShellRoomBootstrapResult;
  renderer?: Parameters<typeof startCliShellTerminalInstancePanel>[0]["renderer"];
}): Promise<CliShellShellPaneTuiController> => {
  const terminalId = input.attached.terminal.entry.terminalId;
  const transportUrl = input.attached.terminal.entry.transportUrl;
  if (!transportUrl) {
    throw new Error(`attached terminal missing transportUrl: ${terminalId}`);
  }
  return await startCliShellTerminalInstancePanel({
    terminalId,
    transportUrl,
    initialSnapshot: input.attached.terminal.entry.snapshot ?? null,
    renderer: input.renderer,
    geometryRole: "authority",
    encodeKey: (key) => encodeCliShellTerminalKey(key, { homeEndFallback: true }),
  });
};
