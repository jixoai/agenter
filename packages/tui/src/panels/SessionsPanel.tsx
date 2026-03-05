import type { SessionEntry } from "@agenter/client-sdk";

interface SessionsPanelProps {
  sessions: SessionEntry[];
  activeSessionId: string | null;
}

export const SessionsPanel = ({ sessions, activeSessionId }: SessionsPanelProps) => {
  return (
    <box border borderColor="gray" padding={1} width="33%" flexDirection="column" title="sessions">
      <text fg="gray">Ctrl+N new / Ctrl+Tab switch</text>
      <scrollbox flexGrow={1} stickyScroll stickyStart="top">
        <box flexDirection="column">
          {sessions.length === 0 ? <text fg="gray">(empty)</text> : null}
          {sessions.map((session) => (
            <box key={session.id} marginTop={1}>
              <text fg={session.id === activeSessionId ? "cyan" : "white"}>
                {session.id === activeSessionId ? "●" : "○"} {session.name} [{session.status}]
              </text>
            </box>
          ))}
        </box>
      </scrollbox>
    </box>
  );
};
