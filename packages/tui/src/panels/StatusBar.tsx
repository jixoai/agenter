interface StatusBarProps {
  host: string;
  port: number;
  connected: boolean;
  sessionCount: number;
  phaseText: string;
}

export const StatusBar = ({ host, port, connected, sessionCount, phaseText }: StatusBarProps) => {
  return (
    <box border borderColor="gray" padding={1} justifyContent="space-between" title="status">
      <text>
        agenter-tui · {host}:{port}
      </text>
      <text fg={connected ? "green" : "yellow"}>{connected ? "connected" : "connecting"}</text>
      <text fg="gray">sessions={sessionCount}</text>
      <text fg="gray">{phaseText}</text>
    </box>
  );
};
