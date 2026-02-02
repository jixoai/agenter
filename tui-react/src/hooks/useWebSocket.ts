import { useEffect, useRef, useState, useCallback } from "react";
import type { LogEntry, WSMessage } from "../types";

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);

  const addLog = useCallback((level: LogEntry["level"], message: string) => {
    setLogs((prev) => [
      ...prev.slice(-9),
      { time: new Date().toLocaleTimeString(), level, message },
    ]);
  }, []);

  useEffect(() => {
    let reconnectCount = 0;

    const connect = () => {
      const ws = new WebSocket("ws://127.0.0.1:3457/ws");

      ws.onopen = () => {
        setIsConnected(true);
        reconnectCount = 0;
        setReconnectAttempt(0);
        addLog("info", "Connected");
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (reconnectCount < 5) {
          reconnectCount++;
          setReconnectAttempt(reconnectCount);
          setTimeout(connect, 2000);
        }
      };

      ws.onerror = () => addLog("error", "WebSocket error");

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
        } catch {}
      };

      wsRef.current = ws;
    };

    connect();
    return () => wsRef.current?.close();
  }, [addLog]);

  const send = useCallback((msg: { type: string; tab_id: number; message?: string; current_draft?: string }) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { isConnected, reconnectAttempt, logs, lastMessage, send };
}
