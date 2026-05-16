import type { TerminalBackendKind } from "@agenter/termless-core";

export interface CliShellInteractionEnhancementProfile {
  semanticWordSelection: boolean;
  semanticRowSelection: boolean;
  wordNavigation: boolean;
  followCursorOnInput: boolean;
  homeEndFallback: boolean;
}

const requiredProfile = {
  semanticWordSelection: true,
  semanticRowSelection: true,
  wordNavigation: true,
  followCursorOnInput: true,
  homeEndFallback: true,
} as const satisfies CliShellInteractionEnhancementProfile;

const nativeProfile = {
  semanticWordSelection: true,
  semanticRowSelection: true,
  wordNavigation: true,
  followCursorOnInput: true,
  homeEndFallback: true,
} as const satisfies CliShellInteractionEnhancementProfile;

export const CLI_SHELL_DEFAULT_INTERACTION_PROFILE: CliShellInteractionEnhancementProfile = requiredProfile;

export const CLI_SHELL_BACKEND_INTERACTION_RECOMMENDATIONS = {
  xterm: requiredProfile,
  "ghostty-native": nativeProfile,
} as const satisfies Record<TerminalBackendKind, CliShellInteractionEnhancementProfile>;

export const resolveCliShellInteractionEnhancementProfile = (
  backend: TerminalBackendKind | undefined,
): CliShellInteractionEnhancementProfile => ({
  ...CLI_SHELL_DEFAULT_INTERACTION_PROFILE,
  ...(backend ? CLI_SHELL_BACKEND_INTERACTION_RECOMMENDATIONS[backend] : null),
});
