import type { CliShellManagedState } from "../managed";
import type { CliShellTuiViewState } from "./types";

export const createInitialCliShellViewState = (managed: CliShellManagedState): CliShellTuiViewState => ({
  dialogueOpen: false,
  focusTarget: "terminal",
  activeFocusTarget: "terminal",
  requestedPlacement: "smart",
  dialogueDraft: "",
  dialogueScrollTop: 0,
  managed,
  statusNotice: null,
});
