import { SendHorizontal } from "lucide-react";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Textarea } from "../../components/ui/textarea";
import { cn } from "../../lib/utils";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface ChatPanelProps {
  activeInstanceName: string | null;
  messages: ChatMessage[];
  input: string;
  aiStatus: string;
  disabled: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
}

export const ChatPanel = ({
  activeInstanceName,
  messages,
  input,
  aiStatus,
  disabled,
  onInputChange,
  onSend,
}: ChatPanelProps) => {
  return (
    <Card className="col-span-1 min-h-[50dvh] lg:col-span-2">
      <CardHeader className="border-b border-slate-200">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{activeInstanceName ? `Chat · ${activeInstanceName}` : "Chat"}</CardTitle>
          <Badge variant={aiStatus === "connected" ? "success" : "warning"}>{aiStatus}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-1">
        {messages.length === 0 ? <p className="text-xs text-slate-500">No messages yet.</p> : null}
        {messages.map((message) => (
          <article
            key={message.id}
            className={cn(
              "max-w-[80%] rounded-xl border px-3 py-2 text-sm",
              message.role === "user"
                ? "ml-auto border-blue-200 bg-blue-50 text-slate-900"
                : "mr-auto border-emerald-200 bg-emerald-50 text-slate-900",
            )}
          >
            <span className="text-[11px] text-slate-600">{message.role === "user" ? "You" : "Assistant"}</span>
            <p className="mt-1 whitespace-pre-wrap">{message.content}</p>
          </article>
        ))}
        </div>
        <div className="flex gap-2 border-t border-slate-200 pt-3">
          <Textarea
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder="Type your message"
          disabled={disabled}
            className="min-h-[84px]"
          />
          <Button onClick={onSend} disabled={disabled || input.trim().length === 0} className="h-auto self-end px-3">
            <SendHorizontal className="h-4 w-4" />
            Send
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
