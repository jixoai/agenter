export const SHELL_ASSISTANT_DISPLAY_NAME = "Shell Assistant";

const shellAssistantAgenterSeedUrl = new URL("./AGENTER.mdx", import.meta.url);

export const loadShellAssistantPromptSeed = async (): Promise<string> =>
  await Bun.file(shellAssistantAgenterSeedUrl).text();
