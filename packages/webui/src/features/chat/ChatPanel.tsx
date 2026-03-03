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
    <section className="panel panel--chat">
      <header className="panel__header">
        <h2>{activeInstanceName ? `Chat · ${activeInstanceName}` : "Chat"}</h2>
        <span className="status">{aiStatus}</span>
      </header>
      <div className="chat-list">
        {messages.length === 0 ? <p className="empty">No messages yet.</p> : null}
        {messages.map((message) => (
          <article
            key={message.id}
            className={message.role === "user" ? "chat-item chat-item--user" : "chat-item chat-item--assistant"}
          >
            <span className="chat-item__role">{message.role === "user" ? "You" : "Assistant"}</span>
            <p>{message.content}</p>
          </article>
        ))}
      </div>
      <div className="chat-composer">
        <textarea
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder="Type your message"
          disabled={disabled}
        />
        <button onClick={onSend} disabled={disabled || input.trim().length === 0}>
          Send
        </button>
      </div>
    </section>
  );
};
