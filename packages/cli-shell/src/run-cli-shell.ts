import { createAgenterClient, createRuntimeStore } from "@agenter/client-sdk";

import { parseCliShellArgs } from "./argv";
import { bootstrapCliShell } from "./bootstrap";
import { startCliShellTui } from "./tui/run-cli-shell-tui";

const formatCreatedState = (created: boolean): string => (created ? "created" : "reused");

export const runCliShell = async (argvInput = process.argv): Promise<void> => {
  const args = parseCliShellArgs(argvInput.slice(2));
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
    });

    if (process.stdout.isTTY && process.stdin.isTTY) {
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
