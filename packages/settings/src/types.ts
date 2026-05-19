import type { AiProviderSettings } from "./provider";

export type BuiltinSettingsSource = "user" | "project" | "local";

export type SettingsSourceInput = BuiltinSettingsSource | string;

export interface SettingsSourceDescriptor {
  id: string;
  kind: "builtin" | "file";
  builtin?: BuiltinSettingsSource;
  uri: string;
  path: string;
}

export interface PromptSettings {}

export interface TaskSettings {
  sources?: Array<{
    name: string;
    path: string;
  }>;
}

export type SettingsGraphLayerKind = "default" | "file" | "avatar" | "derived";

export interface SettingsGraphLayer {
  layerId: string;
  sourceId: string;
  kind: SettingsGraphLayerKind;
  path: string;
  exists: boolean;
  note?: string;
}

export interface SettingsProvenanceOrigin {
  layerId: string;
  sourceId: string;
  kind: SettingsGraphLayerKind;
  path: string;
  pointer: string;
  value: unknown;
  note?: string;
}

export interface SettingsPointerJumpTarget {
  layerId: string;
  pointer: string;
}

export interface SettingsProvenanceEntry {
  pointer: string;
  origins: SettingsProvenanceOrigin[];
  jumpTarget?: SettingsPointerJumpTarget;
}

export interface SettingsGraph {
  effective: {
    value: AgenterSettings;
    content: string;
  };
  layers: SettingsGraphLayer[];
  provenance: Record<string, SettingsProvenanceEntry>;
  schema: Record<string, unknown>;
}

export interface TerminalPresetSettings {
  command: string[];
  cwd?: string;
  helpSource?: string;
}

export interface TerminalBootEntryObject {
  id: string;
  focus?: boolean;
  autoRun?: boolean;
}

export type TerminalBootEntry = string | TerminalBootEntryObject;

export interface AgentSettings {
  defaultAssignee?: string;
}

export interface TerminalSettings {
  terminalId?: string;
  command?: string[];
  outputRoot?: string;
  gitLog?: false | "normal" | "verbose";
  presets?: Record<string, TerminalPresetSettings>;
  helpSources?: Record<string, string>;
}

export interface TerminalFeatureSettings {
  bootTerminals?: TerminalBootEntry[];
}

export interface MessageChannelParticipantSettings {
  id: string;
  label?: string;
}

export interface MessageChatMainDefaultsSettings {
  title?: string;
  participants?: MessageChannelParticipantSettings[];
  metadata?: Record<string, unknown>;
  adminToken?: string;
}

export interface MessageFeatureSettings {
  chatMainDefaults?: MessageChatMainDefaultsSettings;
  maxFocusedRoomCount?: number;
  maxBatchReadRoomMessageCount?: number;
}

export interface FeatureSettings {
  terminal?: TerminalFeatureSettings;
  message?: MessageFeatureSettings;
}

export type {
  AiApiStandard,
  AiProviderInputSettings,
  AiProviderKind,
  AiProviderPricingBandSettings,
  AiProviderPricingSettings,
  LegacyAiProviderKind,
} from "./provider";

export interface AiThinkingSettings {
  enabled?: boolean;
  budgetTokens?: number;
}

export interface AiSettings {
  activeProvider?: string;
  temperature?: number;
  topK?: number;
  maxToken?: number;
  thinking?: AiThinkingSettings;
  providers?: Record<string, AiProviderSettings>;
}

export interface LoopRetryPolicySettings {
  mode?: "exponential";
  maxAttempts?: number | null;
  initialBackoffMs?: number;
  multiplier?: number;
  maxBackoffMs?: number;
  resetOnExternalInput?: boolean;
  resetOnProgress?: boolean;
}

export interface LoopCompactThresholdSettings {
  enabled?: boolean;
  promptFraction?: number;
}

export interface LoopCompactRecoverySettings {
  attentionRetry?: boolean;
  contextOverflow?: boolean;
  externalContinuationLimit?: boolean;
  timeout?: boolean;
}

export interface LoopCompactPolicySettings {
  threshold?: LoopCompactThresholdSettings;
  recovery?: LoopCompactRecoverySettings;
}

export interface LoopSettings {
  sliceDirty?: {
    wait?: boolean;
    timeoutMs?: number;
    pollMs?: number;
  };
  retryPolicy?: LoopRetryPolicySettings;
  compactPolicy?: LoopCompactPolicySettings;
}

export interface AgenterSettings {
  settingsSource?: SettingsSourceInput[];
  avatar?: string;
  profileReference?: string;
  sessionStoreTarget?: "global" | "workspace";
  lang?: string;
  agentCwd?: string;
  agent?: AgentSettings;
  terminal?: TerminalSettings;
  features?: FeatureSettings;
  ai?: AiSettings;
  loop?: LoopSettings;
  prompt?: PromptSettings;
  tasks?: TaskSettings;
}

export interface LoadedSettings {
  settings: AgenterSettings;
  graph: SettingsGraph;
  meta: {
    sources: Array<{
      id: string;
      path: string;
      exists: boolean;
      error?: string;
    }>;
  };
}

export interface LoadSettingsOptions {
  sources?: SettingsSourceInput[];
  avatar?: string;
  projectRoot: string;
  cwd?: string;
  homeDir?: string;
  loader?: import("./resource-loader").ResourceLoader;
}
