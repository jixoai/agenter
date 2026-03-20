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

export interface PromptSettings {
  rootDir?: string;
  agenterPath?: string;
  internalSystemPath?: string;
  systemTemplatePath?: string;
  responseContractPath?: string;
}

export interface TaskSettings {
  sources?: Array<{
    name: string;
    path: string;
  }>;
}

export interface TerminalPresetSettings {
  command: string[];
  cwd?: string;
  submitGapMs?: number;
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
  submitGapMs?: number;
  outputRoot?: string;
  gitLog?: false | "normal" | "verbose";
  presets?: Record<string, TerminalPresetSettings>;
  helpSources?: Record<string, string>;
}

export interface TerminalFeatureSettings {
  bootTerminals?: TerminalBootEntry[];
}

export interface FeatureSettings {
  terminal?: TerminalFeatureSettings;
}

export type { AiApiStandard, AiProviderInputSettings, AiProviderKind, LegacyAiProviderKind } from "./provider";

export interface AiSettings {
  activeProvider?: string;
  providers?: Record<string, AiProviderSettings>;
}

export interface LoopSettings {
  sliceDirty?: {
    wait?: boolean;
    timeoutMs?: number;
    pollMs?: number;
  };
}

export interface AgenterSettings {
  settingsSource?: SettingsSourceInput[];
  avatar?: string;
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
