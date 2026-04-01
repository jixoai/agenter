import {
  DEFAULT_QUICKSTART_BOOTSTRAP_CONFIG,
  type QuickstartBootstrapConfig,
  type QuickstartRoomConfig,
  type QuickstartRoomParticipant,
  type QuickstartTerminalConfig,
} from "./quickstart-bootstrap-types";

const DEFAULT_TERMINAL_COMMAND = ["bash", "-i"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readRecord = (value: unknown): Record<string, unknown> | null => (isRecord(value) ? value : null);

const readString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const readBoolean = (value: unknown): boolean | undefined => (typeof value === "boolean" ? value : undefined);

const readStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
};

const normalizeParticipant = (value: unknown): QuickstartRoomParticipant | null => {
  const record = readRecord(value);
  if (!record) {
    return null;
  }
  const id = readString(record.id);
  if (!id) {
    return null;
  }
  return {
    id,
    label: readString(record.label),
  };
};

const cloneRecord = (value: Record<string, unknown>): Record<string, unknown> =>
  JSON.parse(JSON.stringify(value)) as Record<string, unknown>;

const sanitizeRoomConfig = (room: QuickstartRoomConfig): QuickstartRoomConfig => {
  return {
    title: room.title.trim(),
    participants: room.participants
      .map((participant) => ({
        id: participant.id.trim(),
        label: participant.label?.trim(),
      }))
      .filter((participant) => participant.id.length > 0)
      .map((participant) => ({
        id: participant.id,
        label: participant.label && participant.label.length > 0 ? participant.label : undefined,
      })),
    metadata: readRecord(room.metadata) ? cloneRecord(room.metadata) : {},
    adminToken: room.adminToken.trim(),
  };
};

const sanitizeTerminals = (terminals: QuickstartTerminalConfig[]): QuickstartTerminalConfig[] => {
  const seen = new Set<string>();
  const normalized: QuickstartTerminalConfig[] = [];
  for (const terminal of terminals) {
    const terminalId = terminal.terminalId.trim();
    if (terminalId.length === 0 || seen.has(terminalId)) {
      continue;
    }
    seen.add(terminalId);
    normalized.push({
      terminalId,
      command: terminal.command.map((part) => part.trim()).filter((part) => part.length > 0),
      cwd: terminal.cwd?.trim() || undefined,
      focus: terminal.focus,
      autoRun: terminal.autoRun,
    });
  }
  return normalized.map((terminal, index) => ({
    ...terminal,
    command: terminal.command.length > 0 ? terminal.command : [...DEFAULT_TERMINAL_COMMAND],
    focus: normalized.some((item) => item.focus) ? terminal.focus : index === 0,
  }));
};

export const normalizeQuickstartBootstrapConfig = (value: QuickstartBootstrapConfig): QuickstartBootstrapConfig => {
  return {
    room: sanitizeRoomConfig(value.room),
    terminals: sanitizeTerminals(value.terminals),
  };
};

const readExistingBootTerminalIds = (settingsValue: Record<string, unknown>): string[] => {
  const featureRecord = readRecord(settingsValue.features);
  const terminalFeature = readRecord(featureRecord?.terminal);
  const boot = terminalFeature?.bootTerminals;
  if (!Array.isArray(boot)) {
    return [];
  }
  const ids: string[] = [];
  for (const entry of boot) {
    if (typeof entry === "string") {
      const normalized = entry.trim();
      if (normalized.length > 0 && !ids.includes(normalized)) {
        ids.push(normalized);
      }
      continue;
    }
    const record = readRecord(entry);
    const normalized = record ? readString(record.id) : undefined;
    if (normalized && !ids.includes(normalized)) {
      ids.push(normalized);
    }
  }
  return ids;
};

export const parseQuickstartBootstrapConfig = (settingsValue: unknown): QuickstartBootstrapConfig => {
  const root = readRecord(settingsValue) ?? {};
  const features = readRecord(root.features);
  const messageFeature = readRecord(features?.message);
  const chatMainDefaults = readRecord(messageFeature?.chatMainDefaults);
  const terminalFeature = readRecord(features?.terminal);
  const terminalSettings = readRecord(root.terminal);
  const presets = readRecord(terminalSettings?.presets);
  const roomMetadata = readRecord(chatMainDefaults?.metadata);

  const room: QuickstartRoomConfig = {
    title: readString(chatMainDefaults?.title) ?? DEFAULT_QUICKSTART_BOOTSTRAP_CONFIG.room.title,
    participants: Array.isArray(chatMainDefaults?.participants)
      ? chatMainDefaults.participants.map(normalizeParticipant).filter((item): item is QuickstartRoomParticipant => item !== null)
      : [],
    metadata: roomMetadata ? cloneRecord(roomMetadata) : {},
    adminToken: readString(chatMainDefaults?.adminToken) ?? "",
  };

  const rawBootEntries = Array.isArray(terminalFeature?.bootTerminals) ? terminalFeature.bootTerminals : [];
  const terminals: QuickstartTerminalConfig[] = [];
  for (const entry of rawBootEntries) {
    const descriptor =
      typeof entry === "string"
        ? {
            terminalId: entry,
            focus: false,
            autoRun: true,
          }
        : (() => {
            const record = readRecord(entry);
            const terminalId = record ? readString(record.id) : undefined;
            if (!terminalId) {
              return null;
            }
            const focus = readBoolean(record?.focus) ?? false;
            const autoRun = readBoolean(record?.autoRun) ?? true;
            return {
              terminalId,
              focus,
              autoRun,
            };
          })();
    if (!descriptor || descriptor.terminalId.trim().length === 0) {
      continue;
    }
    const preset = readRecord(presets?.[descriptor.terminalId]);
    terminals.push({
      terminalId: descriptor.terminalId,
      command: readStringArray(preset?.command),
      cwd: readString(preset?.cwd),
      focus: descriptor.focus,
      autoRun: descriptor.autoRun,
    });
  }

  if (terminals.length === 0) {
    const fallbackId = readString(terminalSettings?.terminalId);
    if (fallbackId) {
      const preset = readRecord(presets?.[fallbackId]);
      if (preset) {
        terminals.push({
          terminalId: fallbackId,
          command: readStringArray(preset.command),
          cwd: readString(preset.cwd),
          focus: true,
          autoRun: true,
        });
      }
    }
  }

  return normalizeQuickstartBootstrapConfig({
    room,
    terminals,
  });
};

const pruneEmptyRecord = (value: Record<string, unknown>): Record<string, unknown> | undefined =>
  Object.keys(value).length > 0 ? value : undefined;

export const applyQuickstartBootstrapConfigToSettings = (
  settingsValue: unknown,
  config: QuickstartBootstrapConfig,
): Record<string, unknown> => {
  const base = readRecord(settingsValue) ? cloneRecord(settingsValue as Record<string, unknown>) : {};
  const normalized = normalizeQuickstartBootstrapConfig(config);
  const previousBootIds = readExistingBootTerminalIds(base);

  const features = readRecord(base.features) ? cloneRecord(base.features as Record<string, unknown>) : {};
  const messageFeature = readRecord(features.message) ? cloneRecord(features.message as Record<string, unknown>) : {};
  const terminalFeature = readRecord(features.terminal) ? cloneRecord(features.terminal as Record<string, unknown>) : {};
  const terminalSettings = readRecord(base.terminal) ? cloneRecord(base.terminal as Record<string, unknown>) : {};
  const presets = readRecord(terminalSettings.presets)
    ? cloneRecord(terminalSettings.presets as Record<string, unknown>)
    : {};

  const room = normalized.room;
  const roomPayload: Record<string, unknown> = {};
  if (room.title.length > 0) {
    roomPayload.title = room.title;
  }
  if (room.participants.length > 0) {
    roomPayload.participants = room.participants.map((participant) => ({
      id: participant.id,
      label: participant.label,
    }));
  }
  if (Object.keys(room.metadata).length > 0) {
    roomPayload.metadata = cloneRecord(room.metadata);
  }
  if (room.adminToken.length > 0) {
    roomPayload.adminToken = room.adminToken;
  }

  if (Object.keys(roomPayload).length > 0) {
    messageFeature.chatMainDefaults = roomPayload;
  } else {
    delete messageFeature.chatMainDefaults;
  }

  const nextTerminalIds = new Set(normalized.terminals.map((terminal) => terminal.terminalId));
  for (const previousId of previousBootIds) {
    if (!nextTerminalIds.has(previousId)) {
      delete presets[previousId];
    }
  }

  for (const terminal of normalized.terminals) {
    presets[terminal.terminalId] = {
      command: [...terminal.command],
      ...(terminal.cwd ? { cwd: terminal.cwd } : {}),
    };
  }

  if (Object.keys(presets).length > 0) {
    terminalSettings.presets = presets;
  } else {
    delete terminalSettings.presets;
  }

  if (normalized.terminals.length > 0) {
    terminalFeature.bootTerminals = normalized.terminals.map((terminal) => ({
      id: terminal.terminalId,
      focus: terminal.focus,
      autoRun: terminal.autoRun,
    }));
    terminalSettings.terminalId = normalized.terminals[0]?.terminalId;
  } else {
    delete terminalFeature.bootTerminals;
  }

  const nextMessageFeature = pruneEmptyRecord(messageFeature);
  const nextTerminalFeature = pruneEmptyRecord(terminalFeature);
  if (nextMessageFeature) {
    features.message = nextMessageFeature;
  } else {
    delete features.message;
  }
  if (nextTerminalFeature) {
    features.terminal = nextTerminalFeature;
  } else {
    delete features.terminal;
  }

  const nextFeatures = pruneEmptyRecord(features);
  if (nextFeatures) {
    base.features = nextFeatures;
  } else {
    delete base.features;
  }

  const nextTerminalSettings = pruneEmptyRecord(terminalSettings);
  if (nextTerminalSettings) {
    base.terminal = nextTerminalSettings;
  } else {
    delete base.terminal;
  }

  return base;
};
