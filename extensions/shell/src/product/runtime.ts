import type { AttentionQueryItem, RuntimeClientState } from "@agenter/client-sdk";
import type { ShellKeybindings, ShellSettings } from "../product-room/settings";
import { ensureShellAuthenticated } from "./auth";
import type { ShellRoomBootstrapResult } from "./bootstrap";
import { cleanupShellResources, formatShellCleanupResult, hasShellCleanupFailures } from "./cleanup";

import type { ShellAppInput } from "../app/shell-app";
import type { PaneSource } from "../renderable-mux/pane-source";
import { createShellRuntimeApprovalStore } from "./approval-store";
import type { ShellAttachArgs, ShellCleanupArgs } from "./argv";
import {
  createShellTerminalRoomLifecycleReaction,
  type ShellTerminalRoomLifecycleReaction,
} from "./lifecycle-reaction";
import {
  defaultShellProductRunDependencies,
  type ShellProductRunDependencies,
  type ShellRuntimeStore,
} from "./runtime-dependencies";

export { defaultShellProductRunDependencies } from "./runtime-dependencies";
export type { ShellProductRunDependencies } from "./runtime-dependencies";

export interface ShellProductRunResult {
  readonly exitCode: number;
}

const formatCreatedState = (created: boolean): string => (created ? "created" : "reused");

const attentionSummary = (
  items: readonly AttentionQueryItem[],
): NonNullable<ShellAppInput["initialStatus"]>["attention"] => {
  let focused = 0;
  let background = 0;
  let muted = 0;
  for (const item of items) {
    const focusState = item.context.focusState;
    if (focusState === "focused") {
      focused += 1;
    } else if (focusState === "muted") {
      muted += 1;
    } else {
      background += 1;
    }
  }
  return { focused, background, muted };
};

type ShellRuntimeModelCall = RuntimeClientState["modelCallsBySession"][string][number];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readNonNegativeNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;

const readUsageRecord = (value: unknown): Record<string, unknown> | null => {
  const record = isRecord(value) ? value : null;
  return record ? (isRecord(record.usage) ? record.usage : record) : null;
};

const readContextUsedTokens = (value: unknown): number | null => {
  const usage = readUsageRecord(value);
  if (!usage) {
    return null;
  }
  return (
    readNonNegativeNumber(usage.inputTokens) ??
    readNonNegativeNumber(usage.promptTokens) ??
    readNonNegativeNumber(usage.totalTokens)
  );
};

const resolveAiContextSummary = (
  state: Partial<RuntimeClientState>,
  sessionId: string,
): NonNullable<ShellAppInput["initialStatus"]>["aiContext"] => {
  const calls: readonly ShellRuntimeModelCall[] = state.modelCallsBySession?.[sessionId] ?? [];
  for (let index = calls.length - 1; index >= 0; index -= 1) {
    const call = calls[index];
    const maxTokens = readNonNegativeNumber(call.providerSnapshot?.maxContextTokens);
    if (!maxTokens || maxTokens <= 0) {
      continue;
    }
    const usedTokens = readContextUsedTokens(call.response) ?? readContextUsedTokens(call.outcome);
    if (usedTokens === null) {
      continue;
    }
    return {
      usedTokens,
      maxTokens,
    };
  }
  return undefined;
};

const resolveRuntimeMacroLabel = (heartbeat: string): string => {
  const normalized = heartbeat.trim();
  if (!normalized || normalized.startsWith("Idle") || normalized.startsWith("\u25c9")) {
    return "Idle";
  }
  return "Active";
};

type ShellTerminalEntry = RuntimeClientState["globalTerminals"]["data"][number];

const resolveTerminalTitleFromState = (state: Partial<RuntimeClientState>, terminalId: string): string | null => {
  const terminalLists: readonly (readonly ShellTerminalEntry[] | undefined)[] = [
    state.globalTerminals?.data,
    state.globalTerminalIndex?.data,
    state.globalTerminalHistory?.data,
    state.globalTerminalArchive?.data,
  ];
  for (const terminals of terminalLists) {
    const terminal = terminals?.find((item) => item.terminalId === terminalId);
    const title = terminal?.currentTitle?.trim() || terminal?.configuredTitle?.trim() || null;
    if (title) {
      return title;
    }
  }
  return null;
};

const buildLiveStatus = (input: {
  state: Partial<RuntimeClientState>;
  sessionId: string;
  initial: NonNullable<ShellAppInput["initialStatus"]>;
}): NonNullable<ShellAppInput["initialStatus"]> => {
  const activity = input.state.activityBySession?.[input.sessionId];
  return {
    ...input.initial,
    runtime: {
      label: activity === undefined ? input.initial.runtime.label : activity === "active" ? "Active" : "Idle",
    },
    aiContext: resolveAiContextSummary(input.state, input.sessionId) ?? input.initial.aiContext,
  };
};

const createAttachedStatusProvider = (input: {
  store: ShellRuntimeStore;
  attached: ShellRoomBootstrapResult;
  initialStatus: NonNullable<ShellAppInput["initialStatus"]>;
}): NonNullable<ShellAppInput["statusProvider"]> => {
  let current = buildLiveStatus({
    state: input.store.getState(),
    sessionId: input.attached.session.id,
    initial: input.initialStatus,
  });
  return {
    getStatus: () => current,
    subscribe: (listener) =>
      input.store.subscribe(() => {
        current = buildLiveStatus({
          state: input.store.getState(),
          sessionId: input.attached.session.id,
          initial: input.initialStatus,
        });
        listener();
      }),
  };
};

const ensureAttachSelection = async (
  input: {
    args: ShellAttachArgs;
    store: ShellRuntimeStore;
    settings: ShellSettings;
    tty: boolean;
  },
  dependencies: ShellProductRunDependencies,
): Promise<{
  args: ShellAttachArgs;
  settings: ShellSettings;
}> => {
  if (input.args.sessionExplicit && input.args.avatarExplicit) {
    return { args: input.args, settings: input.settings };
  }
  if (!input.tty) {
    throw new Error("shell requires --session and --avatar when stdin/stdout is not a TTY");
  }
  await ensureShellAuthenticated(input.store);
  const selection = await dependencies.startNavigationTui({
    store: input.store,
    settings: input.settings,
    needsShell: !input.args.sessionExplicit,
    needsAvatar: !input.args.avatarExplicit,
    initialShellName: input.args.sessionExplicit ? input.args.shellName : undefined,
    initialAvatarNickname: input.args.avatarExplicit ? input.args.avatarNickname : undefined,
  });
  const nextArgs = {
    ...input.args,
    shellName: input.args.sessionExplicit ? input.args.shellName : selection.shellName,
    avatarNickname: input.args.avatarExplicit ? input.args.avatarNickname : selection.avatarNickname,
    createAvatar: input.args.createAvatar || selection.createAvatar,
    sessionExplicit: true,
    avatarExplicit: true,
  };
  const nextSettings: ShellSettings = {
    ...input.settings,
    startup: {
      lastShellName: nextArgs.shellName,
      lastAvatarNickname: nextArgs.avatarNickname,
    },
  };
  await dependencies.saveSettings(nextSettings);
  return {
    args: nextArgs,
    settings: nextSettings,
  };
};

const createAttachedTerminalSourcePolicy = (input: {
  attached: ShellRoomBootstrapResult;
  store: ShellRuntimeStore;
  dependencies: ShellProductRunDependencies;
  lifecycleReaction: ShellTerminalRoomLifecycleReaction;
}): NonNullable<ShellAppInput["terminalSourcePolicy"]> => {
  return {
    createInitialSource: (sourceInput): PaneSource => {
      const terminalId = input.attached.terminal.entry.terminalId;
      const transportUrl = input.attached.terminal.entry.transportUrl;
      if (!transportUrl) {
        throw new Error(`attached terminal missing transportUrl: ${terminalId}`);
      }
      return input.dependencies.createLiveTerminalSource({
        id: sourceInput.id,
        terminalId,
        transportUrl,
        initialSnapshot: input.attached.terminal.entry.snapshot ?? null,
        initialTitle:
          input.attached.terminal.entry.currentTitle ??
          input.attached.terminal.entry.configuredTitle ??
          input.attached.terminal.entry.terminalId,
        configuredTitle: input.attached.terminal.entry.configuredTitle ?? null,
        currentTitle: input.attached.terminal.entry.currentTitle ?? null,
        readTitle: () => resolveTerminalTitleFromState(input.store.getState(), terminalId),
        terminateTerminal: async () => {
          const result = await input.store.stopGlobalTerminal({ terminalId });
          if (result.ok) {
            await input.lifecycleReaction.archiveBoundRoom();
          }
        },
      });
    },
    describeSplitUnavailable: () => "Product-bound terminal split is not implemented",
  };
};

const buildInitialStatus = async (input: {
  store: ShellRuntimeStore;
  attached: ShellRoomBootstrapResult;
  dependencies: ShellProductRunDependencies;
}): Promise<NonNullable<ShellAppInput["initialStatus"]>> => {
  const heartbeat = await input.dependencies.readHeartbeatStatus({
    store: input.store,
    runtimeSessionId: input.attached.session.id,
    shellName: input.attached.binding.resourceKey,
  });
  const state = input.store.getState();
  const attention = await input.store
    .queryAttention({
      sessionId: input.attached.session.id,
      query: "minscore:0",
    })
    .then(attentionSummary)
    .catch(() => ({
      focused: 0,
      background: 0,
      muted: 0,
    }));
  return {
    runtime: { label: resolveRuntimeMacroLabel(heartbeat) },
    attention,
    aiContext: resolveAiContextSummary(state, input.attached.session.id),
    actions: ["Help", "Chat"],
  };
};

const writeAttachSummary = (
  attached: ShellRoomBootstrapResult,
  stdout: Pick<NodeJS.WriteStream, "write">,
): void => {
  stdout.write(`shell attached\n`);
  stdout.write(`avatar: ${attached.avatar.nickname}\n`);
  stdout.write(`runtime: ${attached.avatar.runtimeId}\n`);
  stdout.write(`terminal: ${attached.terminal.entry.terminalId} (${formatCreatedState(attached.terminal.created)})\n`);
  stdout.write(`room: ${attached.room.entry.chatId} (${formatCreatedState(attached.room.created)})\n`);
  stdout.write(`managed: ${attached.managed.managed ? "on" : "off"}\n`);
};

const buildAttachedRoomInput = (input: {
  store: ShellRuntimeStore;
  attached: ShellRoomBootstrapResult;
  settings: ShellSettings;
  keybindings: ShellKeybindings;
}): NonNullable<ShellAppInput["room"]> => ({
  store: input.store,
  attached: input.attached,
  shellName: input.attached.binding.resourceKey,
  settings: input.settings,
  keybindings: input.keybindings,
});

const buildRootPaneForView = (view: ShellAttachArgs["view"]): NonNullable<ShellAppInput["rootPane"]> =>
  view === "none" || view === "shell"
    ? { id: "pane-1", sourceId: "source-1", sourceKind: "terminal-protocol" }
    : { id: "pane-1", sourceId: `view-${view}`, sourceKind: "opentui-renderable" };

export const runShellCleanup = async (
  args: ShellCleanupArgs,
  dependencies: ShellProductRunDependencies = defaultShellProductRunDependencies,
): Promise<ShellProductRunResult> => {
  const client = dependencies.createClient(args);
  try {
    const store = dependencies.createStore(client);
    const result = await cleanupShellResources(store, {
      shellName: args.shellName,
      confirm: args.confirm,
    });
    dependencies.stdout.write(formatShellCleanupResult(result));
    return { exitCode: hasShellCleanupFailures(result) ? 1 : 0 };
  } finally {
    client.close();
  }
};

export const runShellProductAttach = async (
  args: ShellAttachArgs,
  dependencies: ShellProductRunDependencies = defaultShellProductRunDependencies,
): Promise<ShellProductRunResult> => {
  const client = dependencies.createClient(args);
  try {
    const store = dependencies.createStore(client);
    const settings = await dependencies.readSettings();
    const selection = await ensureAttachSelection(
      {
        args,
        store,
        settings,
        tty: dependencies.stdinIsTty() && dependencies.stdoutIsTty(),
      },
      dependencies,
    );
    const keybindings = await dependencies.readKeybindings();
    const attached = await dependencies.bootstrapRoom({
      store,
      workspacePath: process.cwd(),
      avatarNickname: selection.args.avatarNickname,
      shellName: selection.args.shellName,
      createAvatar: selection.args.createAvatar,
      clearAvatar: selection.args.clearAvatar,
    });
    const status = await buildInitialStatus({ store, attached, dependencies });
    const statusProvider = createAttachedStatusProvider({
      store,
      attached,
      initialStatus: status,
    });
    if (!dependencies.stdinIsTty() || !dependencies.stdoutIsTty()) {
      writeAttachSummary(attached, dependencies.stdout);
      return { exitCode: 0 };
    }
    await store.connect();
    const lifecycleReaction = createShellTerminalRoomLifecycleReaction({
      store,
      binding: attached.binding,
      room: attached.room.entry,
    });
    try {
      const app = await dependencies.startApp({
        rootPane: buildRootPaneForView(args.view),
        terminalSourcePolicy: createAttachedTerminalSourcePolicy({
          attached,
          store,
          dependencies,
          lifecycleReaction,
        }),
        approvalStore: createShellRuntimeApprovalStore({
          store,
          terminalId: attached.terminal.entry.terminalId,
        }),
        room: buildAttachedRoomInput({ store, attached, settings: selection.settings, keybindings }),
        initialStatus: status,
        statusProvider,
        showStatusbar: args.view === "none",
        syncStatusbarWithLayout: false,
        initialSurfaces: args.view === "none" ? [] : [],
        showTopLayer: false,
      });
      await app.finished;
    } finally {
      lifecycleReaction.dispose();
      store.disconnect();
    }
    return { exitCode: 0 };
  } finally {
    client.close();
  }
};
