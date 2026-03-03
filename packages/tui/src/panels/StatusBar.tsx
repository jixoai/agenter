interface StatusBarProps {
  host: string;
  port: number;
  connected: boolean;
  instanceCount: number;
  phaseText: string;
}

export const StatusBar = ({ host, port, connected, instanceCount, phaseText }: StatusBarProps) => {
  return (
    <box border borderColor="gray" padding={1} justifyContent="space-between" title="status">
      <text>
        agenter-tui · {host}:{port}
      </text>
      <text fg={connected ? "green" : "yellow"}>{connected ? "connected" : "connecting"}</text>
      <text fg="gray">instances={instanceCount}</text>
      <text fg="gray">{phaseText}</text>
    </box>
  );
};
