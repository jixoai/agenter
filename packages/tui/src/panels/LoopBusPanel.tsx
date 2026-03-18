interface LoopBusPanelProps {
  phaseText: string;
  traces: Array<{
    id: number;
    cycleId: number;
    seq: number;
    step: string;
    status: "ok" | "error" | "running";
    endedAt: number;
  }>;
  modelCalls: Array<{
    id: number;
    cycleId: number;
    provider: string;
    model: string;
    createdAt: number;
    error?: unknown;
  }>;
  apiRecording: { enabled: boolean; refCount: number };
}

const formatTime = (timestamp: number): string => new Date(timestamp).toTimeString().slice(0, 8);

export const LoopBusPanel = ({ phaseText, traces, modelCalls, apiRecording }: LoopBusPanelProps) => {
  const latestTrace = traces.at(-1);
  const latestModelCall = modelCalls.at(-1);

  return (
    <box border borderColor="gray" padding={1} flexGrow={1} flexDirection="column" title="loopbus">
      <text>
        phase: {phaseText} | record: {apiRecording.enabled ? `on(${apiRecording.refCount})` : "off"}
      </text>
      <text>
        trace:{" "}
        {latestTrace ? `#${latestTrace.cycleId}.${latestTrace.seq} ${latestTrace.step} ${latestTrace.status}` : "none"}
      </text>
      <text>
        model:{" "}
        {latestModelCall
          ? `${latestModelCall.provider}/${latestModelCall.model} ${latestModelCall.error ? "error" : "ok"} @${formatTime(latestModelCall.createdAt)}`
          : "none"}
      </text>
      <scrollbox flexGrow={1} stickyScroll stickyStart="top">
        <box flexDirection="column">
          {traces.slice(-12).map((trace) => (
            <text key={`trace-${trace.id}`} fg={trace.status === "error" ? "red" : "gray"}>
              [{formatTime(trace.endedAt)}] #{trace.cycleId}.{trace.seq} {trace.step} {trace.status}
            </text>
          ))}
          {modelCalls.slice(-6).map((call) => (
            <text key={`model-${call.id}`} fg={call.error ? "red" : "green"}>
              [{formatTime(call.createdAt)}] cycle#{call.cycleId} {call.provider}/{call.model}
            </text>
          ))}
        </box>
      </scrollbox>
    </box>
  );
};
