import type { TerminalBackendKind } from "@agenter/termless-core";

export interface OpenComposeInteractionEnhancementProfile {
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
} as const satisfies OpenComposeInteractionEnhancementProfile;

const nativeProfile = {
  semanticWordSelection: true,
  semanticRowSelection: true,
  wordNavigation: true,
  followCursorOnInput: true,
  homeEndFallback: true,
} as const satisfies OpenComposeInteractionEnhancementProfile;

export const OPENCOMPOSE_DEFAULT_INTERACTION_PROFILE: OpenComposeInteractionEnhancementProfile = requiredProfile;

export const OPENCOMPOSE_BACKEND_INTERACTION_RECOMMENDATIONS = {
  xterm: requiredProfile,
  "ghostty-native": nativeProfile,
} as const satisfies Record<TerminalBackendKind, OpenComposeInteractionEnhancementProfile>;

export const resolveOpenComposeInteractionEnhancementProfile = (
  backend: TerminalBackendKind | undefined,
): OpenComposeInteractionEnhancementProfile => ({
  ...OPENCOMPOSE_DEFAULT_INTERACTION_PROFILE,
  ...(backend ? OPENCOMPOSE_BACKEND_INTERACTION_RECOMMENDATIONS[backend] : null),
});
