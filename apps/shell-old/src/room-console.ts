import type { GlobalRoomMessage } from "@agenter/client-sdk";

import type { CliShellInteractiveHostStore, CliShellRoomBootstrapResult } from "./bootstrap";

export interface CliShellRoomConsoleInput {
  store: CliShellInteractiveHostStore;
  attached: CliShellRoomBootstrapResult;
  stdin?: NodeJS.ReadStream;
  stdout?: NodeJS.WriteStream;
}

const formatMessage = (message: GlobalRoomMessage): string => {
  const sender = message.from ?? message.senderContactId ?? "unknown";
  const text = message.content ?? "";
  return `[${sender}] ${text}`;
};

export const startCliShellRoomConsole = async (input: CliShellRoomConsoleInput): Promise<void> => {
  const stdin = input.stdin ?? process.stdin;
  const stdout = input.stdout ?? process.stdout;
  const chatId = input.attached.room.entry.chatId;
  const accessToken = input.attached.room.entry.accessToken;
  await input.store.connect();
  const release = input.store.retainGlobalRoomSnapshot(chatId);
  try {
    const snapshot = await input.store.hydrateGlobalRoomSnapshot({
      chatId,
      accessToken,
      force: true,
    });
    stdout.write(`cli-shell room ${input.attached.room.entry.title ?? chatId} @${input.attached.avatar.nickname}\n`);
    for (const message of snapshot?.items ?? []) {
      stdout.write(`${formatMessage(message)}\n`);
    }
    stdout.write("> ");
    stdin.setEncoding("utf8");
    for await (const chunk of stdin) {
      const lines = String(chunk).split(/\r?\n/u);
      for (const line of lines) {
        const text = line.trim();
        if (text.length === 0) {
          continue;
        }
        if (text === "/quit" || text === "/exit") {
          return;
        }
        const result = await input.store.sendGlobalRoomMessage({
          chatId,
          accessToken,
          text,
        });
        if (!result.ok) {
          stdout.write(`send failed: ${result.reason ?? "unknown"}\n`);
        }
        stdout.write("> ");
      }
    }
  } finally {
    release();
    input.store.disconnect();
  }
};
