import { parseClientMessage, type DaemonAck } from "./daemon-protocol";
import { InstanceRegistry, type InstanceMeta } from "./instance-registry";
import { InstanceRuntime, type RuntimeEvent } from "./instance-runtime";
import type { ChatMessage } from "./types";

export interface DaemonServerOptions {
  host?: string;
  port?: number;
  registryPath?: string;
  webUiHtml?: () => string;
  logger?: {
    log: (line: {
      channel: "agent" | "error";
      level: "debug" | "info" | "warn" | "error";
      message: string;
      meta?: Record<string, string | number | boolean | null>;
    }) => void;
  };
}

interface DaemonSocketData {
  id: string;
}

interface DaemonSocket {
  data: unknown;
  send: (payload: string) => number | void;
}

interface WsClient {
  id: string;
  socket: DaemonSocket;
}

const createId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export class DaemonServer {
  private readonly registry: InstanceRegistry;
  private readonly runtimes = new Map<string, InstanceRuntime>();
  private readonly runtimeStopListeners = new Map<string, () => void>();
  private readonly clients = new Map<string, WsClient>();
  private server: ReturnType<typeof Bun.serve> | null = null;

  constructor(private readonly options: DaemonServerOptions = {}) {
    this.registry = new InstanceRegistry({ filePath: options.registryPath });
  }

  async start(): Promise<{ host: string; port: number }> {
    if (this.server) {
      return {
        host: this.options.host ?? "127.0.0.1",
        port: this.server.port ?? this.options.port ?? 4580,
      };
    }

    const host = this.options.host ?? "127.0.0.1";
    const port = this.options.port ?? 4580;

    this.server = Bun.serve({
      hostname: host,
      port,
      fetch: (request, server) => {
        const url = new URL(request.url);
        if (url.pathname === "/ws") {
          const upgraded = server.upgrade(request, { data: { id: createId() } });
          if (upgraded) {
            return undefined;
          }
          return new Response("upgrade failed", { status: 400 });
        }

        if (url.pathname === "/health") {
          return Response.json({ ok: true, port: this.server?.port ?? port });
        }

        if (url.pathname === "/api/instances") {
          return Response.json({ instances: this.registry.list() });
        }

        if (url.pathname === "/" && this.options.webUiHtml) {
          return new Response(this.options.webUiHtml(), {
            headers: {
              "content-type": "text/html; charset=utf-8",
            },
          });
        }

        return new Response("not found", { status: 404 });
      },
      websocket: {
        open: (socket) => {
          const id = this.readSocketId(socket);
          if (!id) {
            socket.close(1008, "invalid socket data");
            return;
          }
          this.clients.set(id, { id, socket });
          this.send(socket, {
            type: "instance.snapshot",
            timestamp: Date.now(),
            payload: {
              instances: this.registry.list(),
            },
          });
        },
        message: async (socket, data) => {
          const raw = typeof data === "string" ? data : new TextDecoder().decode(data);
          await this.handleClientMessage(socket, raw);
        },
        close: (socket) => {
          const id = this.readSocketId(socket);
          if (!id) {
            return;
          }
          this.clients.delete(id);
        },
      },
    });

    for (const meta of this.registry.list()) {
      if (!meta.autoStart) {
        continue;
      }
      await this.startInstance(meta.id);
    }

    const boundPort = this.server.port ?? port;
    this.log("info", "daemon.started", { host, port: boundPort });
    return { host, port: boundPort };
  }

  async stop(): Promise<void> {
    for (const runtime of this.runtimes.values()) {
      await runtime.stop();
    }
    this.runtimes.clear();

    if (this.server) {
      this.server.stop(true);
      this.server = null;
    }
    this.clients.clear();
  }

  getAddress(): { host: string; port: number } | null {
    if (!this.server) {
      return null;
    }
    return {
      host: this.options.host ?? "127.0.0.1",
      port: this.server.port ?? this.options.port ?? 4580,
    };
  }

  private async handleClientMessage(socket: DaemonSocket, raw: string): Promise<void> {
    try {
      const message = parseClientMessage(raw);
      if (message.type === "instance.list") {
        this.ack(socket, {
          type: "ack",
          requestId: message.requestId,
          ok: true,
          data: { instances: this.registry.list() },
        });
        return;
      }

      if (message.type === "instance.create") {
        const instance = this.registry.create({
          cwd: message.payload.cwd,
          name: message.payload.name,
          autoStart: message.payload.autoStart,
        });
        this.broadcast({
          type: "instance.updated",
          timestamp: Date.now(),
          payload: { instance },
        });
        if (instance.autoStart) {
          await this.startInstance(instance.id);
        }
        this.ack(socket, {
          type: "ack",
          requestId: message.requestId,
          ok: true,
          data: { instance },
        });
        return;
      }

      if (message.type === "instance.update") {
        const instance = this.registry.update(message.payload.instanceId, {
          name: message.payload.name,
          autoStart: message.payload.autoStart,
        });
        this.broadcast({
          type: "instance.updated",
          timestamp: Date.now(),
          payload: { instance },
        });
        this.ack(socket, {
          type: "ack",
          requestId: message.requestId,
          ok: true,
          data: { instance },
        });
        return;
      }

      if (message.type === "instance.delete") {
        const runtime = this.runtimes.get(message.payload.instanceId);
        if (runtime) {
          await runtime.stop();
          this.detachRuntime(message.payload.instanceId);
        }
        const removed = this.registry.remove(message.payload.instanceId);
        this.broadcast({
          type: "instance.deleted",
          timestamp: Date.now(),
          payload: { instanceId: message.payload.instanceId, removed },
        });
        this.ack(socket, {
          type: "ack",
          requestId: message.requestId,
          ok: removed,
          data: { removed },
          error: removed
            ? undefined
            : {
                code: "NOT_FOUND",
                message: `instance not found: ${message.payload.instanceId}`,
              },
        });
        return;
      }

      if (message.type === "instance.start") {
        const instance = await this.startInstance(message.payload.instanceId);
        this.ack(socket, {
          type: "ack",
          requestId: message.requestId,
          ok: true,
          data: { instance },
        });
        return;
      }

      if (message.type === "instance.stop") {
        await this.stopInstance(message.payload.instanceId);
        const instance = this.registry.update(message.payload.instanceId, { status: "stopped", lastError: undefined });
        this.broadcast({
          type: "instance.updated",
          timestamp: Date.now(),
          payload: { instance },
        });
        this.ack(socket, {
          type: "ack",
          requestId: message.requestId,
          ok: true,
          data: { instance },
        });
        return;
      }

      if (message.type === "instance.focusTerminal") {
        const runtime = this.runtimes.get(message.payload.instanceId);
        if (!runtime) {
          this.ack(socket, {
            type: "ack",
            requestId: message.requestId,
            ok: false,
            error: {
              code: "NOT_RUNNING",
              message: `instance not running: ${message.payload.instanceId}`,
            },
          });
          return;
        }
        const ok = runtime.focusTerminal(message.payload.terminalId);
        this.ack(socket, {
          type: "ack",
          requestId: message.requestId,
          ok,
          data: { terminalId: message.payload.terminalId },
          error: ok
            ? undefined
            : {
                code: "NOT_FOUND",
                message: `terminal not found: ${message.payload.terminalId}`,
              },
        });
        return;
      }

      if (message.type === "chat.send") {
        const runtime = this.runtimes.get(message.payload.instanceId);
        if (!runtime) {
          this.ack(socket, {
            type: "ack",
            requestId: message.requestId,
            ok: false,
            error: {
              code: "NOT_RUNNING",
              message: `instance not running: ${message.payload.instanceId}`,
            },
          });
          return;
        }
        runtime.pushUserChat(message.payload.text);
        this.ack(socket, {
          type: "ack",
          requestId: message.requestId,
          ok: true,
        });
        return;
      }

      if (message.type === "settings.read") {
        const runtime = await this.ensureRuntime(message.payload.instanceId);
        const file = await runtime.readEditable(message.payload.kind);
        this.ack(socket, {
          type: "ack",
          requestId: message.requestId,
          ok: true,
          data: file,
        });
        return;
      }

      if (message.type === "settings.save") {
        const runtime = await this.ensureRuntime(message.payload.instanceId);
        const result = await runtime.saveEditable(
          message.payload.kind,
          message.payload.content,
          message.payload.baseMtimeMs,
        );
        if (!result.ok) {
          this.ack(socket, {
            type: "ack",
            requestId: message.requestId,
            ok: false,
            error: {
              code: "CONFLICT",
              message: "file modified by another editor",
              details: result.latest,
            },
          });
          return;
        }
        this.ack(socket, {
          type: "ack",
          requestId: message.requestId,
          ok: true,
          data: result.file,
        });
        return;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.ack(socket, {
        type: "ack",
        ok: false,
        error: {
          code: "BAD_REQUEST",
          message,
        },
      });
    }
  }

  private async ensureRuntime(instanceId: string): Promise<InstanceRuntime> {
    if (this.runtimes.has(instanceId)) {
      return this.runtimes.get(instanceId)!;
    }
    await this.startInstance(instanceId);
    const runtime = this.runtimes.get(instanceId);
    if (!runtime) {
      throw new Error(`runtime not found for instance ${instanceId}`);
    }
    return runtime;
  }

  private async startInstance(instanceId: string): Promise<InstanceMeta> {
    const meta = this.registry.get(instanceId);
    if (!meta) {
      throw new Error(`instance not found: ${instanceId}`);
    }

    const existing = this.runtimes.get(instanceId);
    if (existing?.isStarted()) {
      return this.registry.update(instanceId, { status: "running", lastError: undefined });
    }

    this.registry.update(instanceId, { status: "starting", lastError: undefined });
    const runtime = new InstanceRuntime({
      instanceId: meta.id,
      cwd: meta.cwd,
      logger: this.options.logger,
    });

    const unsubscribe = runtime.onEvent((event) => {
      this.handleRuntimeEvent(meta.id, event);
    });

    this.runtimes.set(instanceId, runtime);
    this.runtimeStopListeners.set(instanceId, unsubscribe);

    try {
      await runtime.start();
      const updated = this.registry.update(instanceId, { status: "running", lastError: undefined });
      this.broadcast({
        type: "instance.updated",
        timestamp: Date.now(),
        payload: { instance: updated },
      });
      this.broadcast({
        type: "runtime.snapshot",
        timestamp: Date.now(),
        payload: {
          instanceId,
          snapshot: runtime.snapshot(),
        },
      });
      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.detachRuntime(instanceId);
      const failed = this.registry.update(instanceId, { status: "error", lastError: message });
      this.broadcast({
        type: "instance.updated",
        timestamp: Date.now(),
        payload: { instance: failed },
      });
      throw error;
    }
  }

  private async stopInstance(instanceId: string): Promise<void> {
    const runtime = this.runtimes.get(instanceId);
    if (!runtime) {
      return;
    }
    await runtime.stop();
    this.detachRuntime(instanceId);
  }

  private detachRuntime(instanceId: string): void {
    this.runtimes.delete(instanceId);
    const unsubscribe = this.runtimeStopListeners.get(instanceId);
    if (unsubscribe) {
      unsubscribe();
      this.runtimeStopListeners.delete(instanceId);
    }
  }

  private handleRuntimeEvent(instanceId: string, event: RuntimeEvent): void {
    switch (event.type) {
      case "chat":
        this.broadcast({
          type: "chat.message",
          timestamp: event.timestamp,
          payload: {
            instanceId,
            message: event.payload as ChatMessage,
          },
        });
        return;
      case "terminalSnapshot":
        this.broadcast({
          type: "terminal.snapshot",
          timestamp: event.timestamp,
          payload: {
            instanceId,
            terminalId: event.payload.terminalId,
            snapshot: event.payload.snapshot,
          },
        });
        return;
      case "terminalStatus":
        this.broadcast({
          type: "terminal.status",
          timestamp: event.timestamp,
          payload: {
            instanceId,
            ...event.payload,
          },
        });
        return;
      case "phase":
        this.broadcast({
          type: "runtime.phase",
          timestamp: event.timestamp,
          payload: {
            instanceId,
            phase: event.payload.phase,
          },
        });
        return;
      case "stage":
        this.broadcast({
          type: "runtime.stage",
          timestamp: event.timestamp,
          payload: {
            instanceId,
            stage: event.payload.stage,
          },
        });
        return;
      case "stats":
        this.broadcast({
          type: "runtime.stats",
          timestamp: event.timestamp,
          payload: {
            instanceId,
            stats: event.payload,
          },
        });
        return;
      case "focusedTerminal":
        this.broadcast({
          type: "runtime.focusedTerminal",
          timestamp: event.timestamp,
          payload: {
            instanceId,
            terminalId: event.payload.terminalId,
          },
        });
        return;
      case "error":
        this.broadcast({
          type: "runtime.error",
          timestamp: event.timestamp,
          payload: {
            instanceId,
            message: event.payload.message,
          },
        });
        return;
    }
  }

  private ack(socket: DaemonSocket, message: DaemonAck): void {
    this.send(socket, message);
  }

  private send(socket: DaemonSocket, payload: unknown): void {
    socket.send(JSON.stringify(payload));
  }

  private broadcast(payload: unknown): void {
    const text = JSON.stringify(payload);
    for (const client of this.clients.values()) {
      client.socket.send(text);
    }
  }

  private log(level: "debug" | "info" | "warn" | "error", message: string, meta?: Record<string, string | number | boolean | null>): void {
    this.options.logger?.log({
      channel: level === "error" ? "error" : "agent",
      level,
      message,
      meta,
    });
  }

  private readSocketId(socket: DaemonSocket): string | null {
    if (!socket.data || typeof socket.data !== "object") {
      return null;
    }
    const value = socket.data as Partial<DaemonSocketData>;
    if (typeof value.id !== "string" || value.id.length === 0) {
      return null;
    }
    return value.id;
  }
}

export const createDaemonServer = (options: DaemonServerOptions = {}): DaemonServer => new DaemonServer(options);
