import { createCliRenderer, type CliRenderer, type CliRendererConfig } from "@opentui/core";

export const shellRendererDefaults: CliRendererConfig = {
  exitOnCtrlC: false,
  useMouse: true,
  enableMouseMovement: true,
  useKittyKeyboard: { events: true },
};

export const createShellRenderer = async (config: CliRendererConfig = {}): Promise<CliRenderer> =>
  await createCliRenderer({
    ...shellRendererDefaults,
    ...config,
  });
