import { createCliRenderer, type CliRenderer, type CliRendererConfig } from "@opentui/core";

export const shellNextRendererDefaults: CliRendererConfig = {
  exitOnCtrlC: false,
  useMouse: true,
  enableMouseMovement: true,
  useKittyKeyboard: { events: true },
};

export const createShellNextRenderer = async (config: CliRendererConfig = {}): Promise<CliRenderer> =>
  await createCliRenderer({
    ...shellNextRendererDefaults,
    ...config,
  });
