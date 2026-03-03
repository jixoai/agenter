import { useEffect, useMemo, useRef, useState } from "react";
import { createCliRenderer } from "@opentui/core";
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react";
import type { TextareaRenderable } from "@opentui/core";
import { createRoot } from "@opentui/react";

export interface TuiClientOptions {
  host?: string;
  port?: number;
}

interface InstanceMeta {
  id: string;
  name: string;
  cwd: string;
  status: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

const buildWsUrl = (host: string, port: number): string => `ws://${host}:${port}/ws`;

const createId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const App = ({ host, port }: { host: string; port: number }) => {
  const renderer = useRenderer();
  const { width, height } = useTerminalDimensions();

  const [instances, setInstances] = useState<InstanceMeta[]>([]);
  const [activeInstanceId, setActiveInstanceId] = useState<string | null>(null);
  const [chatByInstance, setChatByInstance] = useState<Record<string, ChatMessage[]>>({});
  const [statusText, setStatusText] = useState("connecting");
  const [input, setInput] = useState("");

  const inputRef = useRef<TextareaRenderable | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reqMapRef = useRef(
    new Map<
      string,
      {
        resolve: (value: unknown) => void;
        reject: (error: Error) => void;
      }
    >(),
  );

  const activeMessages = useMemo(() => {
    if (!activeInstanceId) {
      return [];
    }
    return chatByInstance[activeInstanceId] ?? [];
  }, [activeInstanceId, chatByInstance]);

  const sendRaw = (payload: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }
    ws.send(JSON.stringify(payload));
  };

  const request = (type: string, payload?: Record<string, unknown>): Promise<unknown> => {
    const requestId = createId();
    return new Promise((resolve, reject) => {
      reqMapRef.current.set(requestId, { resolve, reject });
      sendRaw({ type, requestId, payload });
      setTimeout(() => {
        const pending = reqMapRef.current.get(requestId);
        if (!pending) {
          return;
        }
        reqMapRef.current.delete(requestId);
        reject(new Error(`${type} timeout`));
      }, 10_000);
    });
  };

  useEffect(() => {
    const ws = new WebSocket(buildWsUrl(host, port));
    wsRef.current = ws;

    ws.onopen = () => {
      setStatusText("connected");
      void request("instance.list").catch((error) => {
        setStatusText(error instanceof Error ? error.message : String(error));
      });
    };

    ws.onclose = () => {
      setStatusText("disconnected");
    };

    ws.onerror = () => {
      setStatusText("socket-error");
    };

    ws.onmessage = (event) => {
      let message: unknown;
      try {
        message = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (!message || typeof message !== "object") {
        return;
      }
      const record = message as Record<string, unknown>;

      if (record.type === "ack") {
        const requestId = typeof record.requestId === "string" ? record.requestId : undefined;
        const pending = requestId ? reqMapRef.current.get(requestId) : null;
        if (!pending) {
          return;
        }
        reqMapRef.current.delete(requestId);
        if (record.ok === true) {
          pending.resolve(record.data);
        } else {
          const errorRecord =
            record.error && typeof record.error === "object" ? (record.error as Record<string, unknown>) : undefined;
          pending.reject(new Error(typeof errorRecord?.message === "string" ? errorRecord.message : "request failed"));
        }
        return;
      }

      if (record.type === "instance.snapshot") {
        const payload =
          record.payload && typeof record.payload === "object" ? (record.payload as Record<string, unknown>) : undefined;
        const instancesRaw = Array.isArray(payload?.instances) ? payload.instances : [];
        const next: InstanceMeta[] = instancesRaw
          .map((item) => {
            if (!item || typeof item !== "object") {
              return null;
            }
            const row = item as Record<string, unknown>;
            if (
              typeof row.id !== "string" ||
              typeof row.name !== "string" ||
              typeof row.cwd !== "string" ||
              typeof row.status !== "string"
            ) {
              return null;
            }
            return {
              id: row.id,
              name: row.name,
              cwd: row.cwd,
              status: row.status,
            } satisfies InstanceMeta;
          })
          .filter((item): item is InstanceMeta => item !== null);
        setInstances(next);
        setActiveInstanceId((prev) => prev ?? next[0]?.id ?? null);
        return;
      }

      if (record.type === "instance.updated") {
        const payload =
          record.payload && typeof record.payload === "object" ? (record.payload as Record<string, unknown>) : undefined;
        const raw = payload?.instance;
        if (!raw || typeof raw !== "object") {
          return;
        }
        const row = raw as Record<string, unknown>;
        if (
          typeof row.id !== "string" ||
          typeof row.name !== "string" ||
          typeof row.cwd !== "string" ||
          typeof row.status !== "string"
        ) {
          return;
        }
        const instance: InstanceMeta = {
          id: row.id,
          name: row.name,
          cwd: row.cwd,
          status: row.status,
        };
        setInstances((prev) => {
          const index = prev.findIndex((item) => item.id === instance.id);
          if (index < 0) {
            return [...prev, instance];
          }
          const next = [...prev];
          next[index] = instance;
          return next;
        });
        setActiveInstanceId((prev) => prev ?? instance.id);
        return;
      }

      if (record.type === "instance.deleted") {
        const payload =
          record.payload && typeof record.payload === "object" ? (record.payload as Record<string, unknown>) : undefined;
        const instanceId = typeof payload?.instanceId === "string" ? payload.instanceId : "";
        setInstances((prev) => prev.filter((item) => item.id !== instanceId));
        setActiveInstanceId((prev) => {
          if (prev !== instanceId) {
            return prev;
          }
          const remain = instances.filter((item) => item.id !== instanceId);
          return remain[0]?.id ?? null;
        });
        return;
      }

      if (record.type === "chat.message") {
        const payload =
          record.payload && typeof record.payload === "object" ? (record.payload as Record<string, unknown>) : undefined;
        const instanceId = typeof payload?.instanceId === "string" ? payload.instanceId : "";
        const rawMessage = payload?.message;
        if (!instanceId || !rawMessage || typeof rawMessage !== "object") {
          return;
        }
        const chatRecord = rawMessage as Record<string, unknown>;
        if (
          typeof chatRecord.id !== "string" ||
          (chatRecord.role !== "user" && chatRecord.role !== "assistant") ||
          typeof chatRecord.content !== "string" ||
          typeof chatRecord.timestamp !== "number"
        ) {
          return;
        }
        const chat: ChatMessage = {
          id: chatRecord.id,
          role: chatRecord.role,
          content: chatRecord.content,
          timestamp: chatRecord.timestamp,
        };
        setChatByInstance((prev) => {
          const next = { ...prev };
          const current = next[instanceId] ?? [];
          next[instanceId] = [...current, chat].slice(-120);
          return next;
        });
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [host, port]);

  const submit = () => {
    const value = (inputRef.current?.plainText ?? input).trim();
    if (!value || !activeInstanceId) {
      return;
    }
    setInput("");
    inputRef.current?.clear();
    void request("chat.send", {
      instanceId: activeInstanceId,
      text: value,
    }).catch((error) => {
      setStatusText(error instanceof Error ? error.message : String(error));
    });
  };

  const focusNextInstance = () => {
    if (instances.length === 0) {
      return;
    }
    const index = instances.findIndex((item) => item.id === activeInstanceId);
    const next = instances[(index + 1 + instances.length) % instances.length];
    setActiveInstanceId(next.id);
  };

  const createInstance = () => {
    const cwd = process.cwd();
    void request("instance.create", { cwd, autoStart: true }).catch((error) => {
      setStatusText(error instanceof Error ? error.message : String(error));
    });
  };

  useKeyboard((key) => {
    if (key.name === "return") {
      submit();
      return true;
    }
    if (key.ctrl && key.name === "n") {
      createInstance();
      return true;
    }
    if (key.ctrl && key.name === "tab") {
      focusNextInstance();
      return true;
    }
    if (key.ctrl && key.name === "c") {
      renderer.destroy();
      return true;
    }
    return false;
  });

  return (
    <box width="100%" height="100%" flexDirection="column" padding={1}>
      <box border borderColor="gray" padding={1} justifyContent="space-between">
        <text>agenter-tui · {host}:{port}</text>
        <text>{statusText} · instances={instances.length}</text>
      </box>

      <box flexGrow={1} flexDirection="row">
        <box width={Math.max(24, Math.floor(width * 0.32))} border borderColor="gray" marginTop={1} flexDirection="column">
          <text>instances (Ctrl+N new, Ctrl+Tab switch)</text>
          <box flexDirection="column" flexGrow={1} overflow="scroll">
            {instances.map((instance) => (
              <text key={instance.id} color={instance.id === activeInstanceId ? "cyan" : "white"}>
                {instance.id === activeInstanceId ? "●" : "○"} {instance.name} [{instance.status}]
              </text>
            ))}
          </box>
        </box>

        <box flexGrow={1} border borderColor="gray" marginTop={1} marginLeft={1} flexDirection="column">
          <text>chat · active={activeInstanceId ?? "none"}</text>
          <box flexGrow={1} overflow="scroll" flexDirection="column">
            {activeMessages.length === 0 ? <text color="gray">(no messages)</text> : null}
            {activeMessages.map((message) => (
              <text key={message.id} color={message.role === "user" ? "yellow" : "green"}>
                {message.role === "user" ? "U" : "A"}: {message.content}
              </text>
            ))}
          </box>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(nextValue) => setInput(nextValue)}
            border
            borderColor="gray"
            placeholder={activeInstanceId ? "Type and press Enter" : "Create/select an instance first"}
            height={4}
            focused
          />
        </box>
      </box>
    </box>
  );
};

export const runTuiClient = async (options: TuiClientOptions = {}): Promise<void> => {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 4580;
  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
    useMouse: true,
  });
  const root = createRoot(renderer);
  root.render(<App host={host} port={port} />);
};
