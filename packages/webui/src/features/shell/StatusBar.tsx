import { Badge } from "../../components/ui/badge";

interface StatusBarProps {
  notice: string;
  connected: boolean;
  aiStatus: string;
  activeSessionLabel: string | null;
}

export const StatusBar = ({ notice, connected, aiStatus, activeSessionLabel }: StatusBarProps) => (
  <div className="border-b border-slate-200 bg-white/90 px-3 py-2">
    <div className="mx-auto flex items-center gap-2 overflow-auto">
      {notice ? <Badge variant="destructive">{notice}</Badge> : null}
      <Badge variant="secondary">{connected ? "Connected" : "Reconnecting"}</Badge>
      <Badge variant={aiStatus === "error" ? "destructive" : aiStatus === "idle" ? "secondary" : "warning"}>
        AI: {aiStatus}
      </Badge>
      {activeSessionLabel ? (
        <Badge variant="secondary">{activeSessionLabel}</Badge>
      ) : (
        <Badge variant="warning">No session</Badge>
      )}
    </div>
  </div>
);
