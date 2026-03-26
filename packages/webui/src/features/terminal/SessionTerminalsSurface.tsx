import { useAppController, useRuntimeSelector } from "../../app-context";
import { TerminalPanel } from "./TerminalPanel";

interface SessionTerminalsSurfaceProps {
  sessionId: string;
  loading: boolean;
}

export const SessionTerminalsSurface = ({ sessionId, loading }: SessionTerminalsSurfaceProps) => {
  const controller = useAppController();
  const runtime = useRuntimeSelector((state) => state.runtimes[sessionId]);
  const snapshots = useRuntimeSelector((state) => state.terminalSnapshotsBySession[sessionId]);
  const terminalReads = useRuntimeSelector((state) => state.terminalReadsBySession[sessionId]);
  const terminalActivityByTerminal = useRuntimeSelector((state) => state.terminalActivityBySession[sessionId]);

  return (
    <TerminalPanel
      sessionId={sessionId}
      runtime={runtime}
      snapshots={snapshots}
      terminalReads={runtime?.terminalReads ?? terminalReads}
      terminalActivityByTerminal={terminalActivityByTerminal}
      getTerminalActivityPagingState={(terminalId) =>
        controller.getLongListPagingState({ resource: "terminal-activity", sessionId, detailId: terminalId })
      }
      onLoadTerminalActivity={controller.loadTerminalActivity}
      onLoadMoreTerminalActivity={controller.loadMoreTerminalActivity}
      loading={loading}
    />
  );
};
