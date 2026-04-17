<script lang="ts">
  import type { WebChatSocketFactory, WebChatSocketLike, WebChatTransportMessage } from "@agenter/web-chat-view";

  import WebChatViewHost from "@perf-target-web-chat-view/web-chat-view-host.svelte";

  import { getRoomChatPerfScenario, type RoomChatPerfScenarioId } from "./web-chat-fixtures";
  import { scrollViewportToHistoryStart, waitForAnimationFrames } from "./viewport-helpers";

  declare global {
    interface Window {
      __reverseFlowPerf?: {
        appendHeartbeatLatestGroup?: () => void;
        appendRoomBatch?: () => void;
        growHeartbeatLatestGroup?: () => void;
        loadRoomOlder?: () => Promise<void>;
        scrollRoomAwayFromLatest?: () => Promise<void>;
      };
    }
  }

  let { scenarioId }: { scenarioId: RoomChatPerfScenarioId } = $props();

  const scenario = $derived(getRoomChatPerfScenario(scenarioId));
  const supportsOlderPage = $derived(scenarioId === "room-chat-load-older");

  let snapshotReady = $state(false);
  let olderLoaded = $state(false);
  let appendSeq = $state(0);

  class PerfSocket implements WebChatSocketLike {
    static readonly OPEN = 1;
    readyState = 0;
    private deliveredOlder = false;
    private listeners = new Map<string, Array<(event: Event | MessageEvent) => void>>();
    private nextBatchIndex = 0;

    constructor() {
      queueMicrotask(() => {
        this.readyState = PerfSocket.OPEN;
        this.emit("open", new Event("open"));
        this.emitTransport({
          type: "snapshot",
          chatId: scenario.channel.chatId,
          snapshot: {
            channel: scenario.channel,
            headVersion: String(scenario.latestMessages.at(-1)?.rowId ?? 0),
            hasMoreBefore: supportsOlderPage,
            items: scenario.latestMessages,
            nextBefore: supportsOlderPage
              ? {
                  beforeId: scenario.latestMessages[0]!.rowId,
                  beforeTimeMs: scenario.latestMessages[0]!.createdAt,
                }
              : null,
          },
        });
        snapshotReady = true;
      });
    }

    addEventListener(type: string, listener: (event: Event | MessageEvent) => void): void {
      const queue = this.listeners.get(type) ?? [];
      queue.push(listener);
      this.listeners.set(type, queue);
    }

    removeEventListener(type: string, listener: (event: Event | MessageEvent) => void): void {
      const queue = this.listeners.get(type) ?? [];
      this.listeners.set(
        type,
        queue.filter((entry) => entry !== listener),
      );
    }

    send(data: string): void {
      const payload = JSON.parse(data) as { type?: string };
      if (payload.type === "page" && supportsOlderPage && !this.deliveredOlder) {
        this.deliveredOlder = true;
        olderLoaded = true;
        this.emitTransport({
          type: "page",
          chatId: scenario.channel.chatId,
          page: {
            hasMoreBefore: false,
            items: scenario.olderMessages,
            nextBefore: null,
          },
        });
      }
    }

    close(): void {
      this.readyState = 3;
      this.emit("close", new Event("close"));
    }

    appendRoomBatch(): void {
      if (this.nextBatchIndex > 0) {
        return;
      }
      this.nextBatchIndex += 1;
      appendSeq += 1;
      this.emitTransport({
        type: "messages",
        chatId: scenario.channel.chatId,
        headVersion: String(scenario.appendBatch.at(-1)?.rowId ?? 0),
        items: scenario.appendBatch,
      });
    }

    private emit(type: string, event: Event | MessageEvent): void {
      for (const listener of this.listeners.get(type) ?? []) {
        listener(event);
      }
    }

    private emitTransport(message: WebChatTransportMessage): void {
      this.emit("message", new MessageEvent("message", { data: JSON.stringify(message) }));
    }
  }

  let socketRef = $state<PerfSocket | null>(null);
  const socketFactory: WebChatSocketFactory = () => {
    const socket = new PerfSocket();
    socketRef = socket;
    return socket;
  };

  const getRoomViewport = (): HTMLElement | null => {
    const viewport = document.querySelector('[data-testid="web-chat-scroll-viewport"]');
    return viewport instanceof HTMLElement ? viewport : null;
  };

  const scrollRoomAwayFromLatest = async (): Promise<void> => {
    const viewport = getRoomViewport();
    if (!viewport) {
      return;
    }
    await scrollViewportToHistoryStart(viewport);
  };

  const loadRoomOlder = async (): Promise<void> => {
    await scrollRoomAwayFromLatest();
    await waitForAnimationFrames();
    if (olderLoaded) {
      return;
    }
    socketRef?.send(JSON.stringify({ type: "page" }));
  };

  $effect(() => {
    window.__reverseFlowPerf = {
      appendRoomBatch: () => {
        socketRef?.appendRoomBatch();
      },
      loadRoomOlder,
      scrollRoomAwayFromLatest,
    };
    return () => {
      delete window.__reverseFlowPerf;
    };
  });
</script>

<div class="grid h-[48rem] min-h-0 rounded-[1.35rem] border border-border/70 bg-background p-4" data-testid="perf-room-chat">
  <div class="sr-only" data-testid="perf-room-snapshot-ready">{snapshotReady ? "yes" : "no"}</div>
  <div class="sr-only" data-testid="perf-room-older-loaded">{olderLoaded ? "yes" : "no"}</div>
  <div class="sr-only" data-testid="perf-room-append-seq">{appendSeq}</div>
  <WebChatViewHost
    channel={scenario.channel}
    class="h-full"
    initialMessages={[]}
    initialSnapshotResolved={false}
    showHeader={false}
    {socketFactory}
  />
</div>
