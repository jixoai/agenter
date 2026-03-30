import { useAppController, useRuntimeSelector } from "../../app-context";
import { TerminalPanel } from "./TerminalPanel";

interface SessionTerminalsSurfaceProps {
  sessionId: string;
  loading: boolean;
}

const EMPTY_UNREAD_BY_TERMINAL: Record<string, number> = {};

export const SessionTerminalsSurface = ({ sessionId, loading }: SessionTerminalsSurfaceProps) => {
  const controller = useAppController();
  const runtime = useRuntimeSelector((state) => state.runtimes[sessionId]);
  const snapshots = useRuntimeSelector((state) => state.terminalSnapshotsBySession[sessionId]);
  const terminalReads = useRuntimeSelector((state) => state.terminalReadsBySession[sessionId]);
  const terminalActivityByTerminal = useRuntimeSelector((state) => state.terminalActivityBySession[sessionId]);
  const unreadByTerminal = useRuntimeSelector((state) => state.unreadByTerminal[sessionId] ?? EMPTY_UNREAD_BY_TERMINAL);

  return (
    <TerminalPanel
      sessionId={sessionId}
      runtime={runtime}
      snapshots={snapshots}
      terminalReads={runtime?.terminalReads ?? terminalReads}
      terminalActivityByTerminal={terminalActivityByTerminal}
      unreadByTerminal={unreadByTerminal}
      getTerminalActivityPagingState={(terminalId) =>
        controller.getLongListPagingState({ resource: "terminal-activity", sessionId, detailId: terminalId })
      }
      onLoadTerminalActivity={controller.loadTerminalActivity}
      onLoadMoreTerminalActivity={controller.loadMoreTerminalActivity}
      onSetTerminalVisibility={controller.setTerminalVisibility}
      onConsumeNotifications={async (input) => {
        await controller.consumeNotifications(input);
      }}
      onCreateTerminal={controller.createTerminal}
      onFocusTerminals={controller.focusTerminals}
      onDeleteTerminal={controller.deleteTerminal}
      loading={loading}
    />
  );
};
