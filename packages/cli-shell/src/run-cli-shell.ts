import { createAgenterClient, createRuntimeStore } from "@agenter/client-sdk";

import { isCliShellMetadataOnlyArgv, parseCliShellArgs } from "./argv";
import { bootstrapCliShell } from "./bootstrap";

const formatCreatedState = (created: boolean): string => (created ? "created" : "reused");

export const runCliShell = async (argvInput = process.argv): Promise<void> => {
  const productArgv = argvInput.slice(2);
  if (isCliShellMetadataOnlyArgv(productArgv)) {
    parseCliShellArgs(productArgv);
    return;
  }
  const args = parseCliShellArgs(productArgv);
  const client = createAgenterClient({
    wsUrl: `ws://${args.host}:${args.port}/trpc`,
  });
  let activeTui: { finished: Promise<void>; destroy(): void } | null = null;

  try {
    const store = createRuntimeStore(client);
    const attached = await bootstrapCliShell({
      store,
      workspacePath: process.cwd(),
      avatarNickname: args.avatarNickname,
      shellName: args.shellName,
      backend: args.backend,
    });

    if (process.stdout.isTTY && process.stdin.isTTY) {
      const { startCliShellTui } = await import("./tui/run-cli-shell-tui");
      activeTui = await startCliShellTui({
        store,
        shellName: args.shellName,
        attached,
      });
      await activeTui.finished;
      return;
    }

    console.log(`cli-shell attached`);
    console.log(`avatar: ${attached.avatar.nickname}`);
    console.log(`runtime: ${attached.avatar.runtimeId}`);
    console.log(`terminal: ${attached.terminal.entry.terminalId} (${formatCreatedState(attached.terminal.created)})`);
    console.log(`backend: ${attached.terminal.entry.backend}`);
    console.log(`room: ${attached.room.entry.chatId} (${formatCreatedState(attached.room.created)})`);
    console.log(`managed: ${attached.managed.managed ? "on" : "off"}`);
    console.log(`source: ${process.env.AGENTER_PRODUCT_SOURCE?.trim() || "direct"}`);
    console.log(`promptSeeded: ${attached.promptSeeded ? "yes" : "no"}`);
    console.log(
      `memorySeeds: ${attached.memoryFiles.map((file) => `${file.path}:${file.created ? "created" : "kept"}`).join(", ") || "none"}`,
    );
  } finally {
    activeTui?.destroy();
    client.close();
  }
};
