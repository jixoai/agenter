import type { AppStatus } from "../../core/protocol";

interface StatusBarProps {
  status: AppStatus;
  logsFile: string;
  sessionFile: string;
}

export const StatusBar = ({ status, logsFile, sessionFile }: StatusBarProps) => {
  const cwd = status.cwd ?? process.cwd();
  const terminal = status.terminal ?? "n/a";
  const focusedTerminalId = status.focusedTerminalId ?? "n/a";
  const dirtyTerminalCount = status.dirtyTerminalCount ?? 0;
  const seq = status.terminalSeq ?? 0;
  const cursor = status.terminalCursor ?? { x: 0, y: 0 };
  const size = status.terminalSize ?? { cols: 0, rows: 0 };
  const loops = status.loopCount ?? 0;
  const calls = status.aiCallCount ?? 0;
  const context = status.contextChars ?? 0;
  const totalContext = status.totalContextChars ?? 0;
  const promptTokens = status.promptTokens ?? 0;
  const totalPromptTokens = status.totalPromptTokens ?? 0;
  return (
    <box border borderColor="gray" padding={1} flexDirection="column">
      <box flexDirection="row" justifyContent="space-between">
        <text>
          stage=<strong>{status.stage}</strong> process=<strong>{status.process}</strong> render=
          <strong>{status.renderSource}</strong> terminal=
          <strong>{terminal}</strong> focus=<strong>{focusedTerminalId}</strong> dirty(unfocused)=
          <strong>{dirtyTerminalCount}</strong> size=
          <strong>
            {size.cols}x{size.rows}
          </strong>{" "}
          seq=<strong>{seq}</strong> cursor=
          <strong>
            {cursor.x},{cursor.y}
          </strong>
        </text>
        <text>
          loop=<strong>{loops}</strong> aiCalls=<strong>{calls}</strong> ctx(chars)=<strong>{context}</strong>/
          <strong>{totalContext}</strong> prompt(tokens)=
          <strong>{promptTokens}</strong>/<strong>{totalPromptTokens}</strong>
        </text>
      </box>
      <box flexDirection="row" justifyContent="space-between">
        <text>cwd={cwd}</text>
        <text>
          logs={logsFile} session={sessionFile}
        </text>
      </box>
    </box>
  );
};
