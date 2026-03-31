import type { GlobalRoomActorId, GlobalRoomEntry, GlobalRoomMessage } from "@agenter/client-sdk";
import type { WebChatNotice } from "@agenter/web-chat-view";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAppController, useRuntimeSelector } from "../../app-context";
import { MessageChannelSurface } from "./MessageChannelSurface";

type RoomSnapshotState = {
  chatId: string | null;
  items: GlobalRoomMessage[];
  loading: boolean;
  error: string | null;
  headVersion: string;
};

const EMPTY_MESSAGES: GlobalRoomMessage[] = [];
const GLOBAL_ROOM_ACTOR_ID_RE = /^(auth|session|system):.+$/;

const isGlobalRoomActorId = (value: string): value is GlobalRoomActorId => {
  return value.startsWith("auth:") || value.startsWith("session:") || value.startsWith("system:");
};

const parseGlobalRoomActorId = (value: string | undefined): GlobalRoomActorId | null => {
  if (!value || !GLOBAL_ROOM_ACTOR_ID_RE.test(value)) {
    return null;
  }
  if (isGlobalRoomActorId(value)) {
    return value;
  }
  return null;
};

export const GlobalChatsRoute = ({ preferredRoomId }: { preferredRoomId?: string | null }) => {
  const controller = useAppController();
  const connected = useRuntimeSelector((state) => state.connected);
  const [rooms, setRooms] = useState<GlobalRoomEntry[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<RoomSnapshotState>({
    chatId: null,
    items: [],
    loading: false,
    error: null,
    headVersion: "0",
  });

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.chatId === selectedRoomId) ?? rooms[0] ?? null,
    [rooms, selectedRoomId],
  );

  const refreshRooms = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      try {
        const items = await controller.listGlobalRooms();
        setRooms(items);
        setSelectedRoomId((current) => {
          if (current && items.some((item) => item.chatId === current)) {
            return current;
          }
          return items[0]?.chatId ?? null;
        });
        setError(null);
      } catch (refreshError) {
        setError(refreshError instanceof Error ? refreshError.message : String(refreshError));
      } finally {
        if (silent) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [controller],
  );

  const loadSnapshot = useCallback(
    async (room: GlobalRoomEntry | null) => {
      if (!room) {
        setSnapshot({
          chatId: null,
          items: [],
          loading: false,
          error: null,
          headVersion: "0",
        });
        return;
      }
      setSnapshot((current) => ({
        chatId: room.chatId,
        items: current.chatId === room.chatId ? current.items : [],
        loading: true,
        error: null,
        headVersion: current.chatId === room.chatId ? current.headVersion : "0",
      }));
      try {
        const next = await controller.snapshotGlobalRoom({
          chatId: room.chatId,
          accessToken: room.accessToken,
          limit: 120,
        });
        setSnapshot({
          chatId: room.chatId,
          items: next.items,
          loading: false,
          error: null,
          headVersion: next.headVersion,
        });
      } catch (loadError) {
        setSnapshot((current) => ({
          ...current,
          chatId: room.chatId,
          loading: false,
          error: loadError instanceof Error ? loadError.message : String(loadError),
        }));
      }
    },
    [controller],
  );

  useEffect(() => {
    if (!connected) {
      return;
    }
    void refreshRooms();
  }, [connected, refreshRooms]);

  useEffect(() => {
    if (!connected) {
      return;
    }
    const timer = window.setInterval(() => {
      void refreshRooms({ silent: true });
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [connected, refreshRooms]);

  useEffect(() => {
    if (!preferredRoomId || !rooms.some((room) => room.chatId === preferredRoomId)) {
      return;
    }
    setSelectedRoomId(preferredRoomId);
  }, [preferredRoomId, rooms]);

  useEffect(() => {
    void loadSnapshot(selectedRoom);
  }, [loadSnapshot, selectedRoom?.accessToken, selectedRoom?.chatId]);

  const routeNotice = useMemo<WebChatNotice | null>(() => {
    const message = snapshot.error ?? error;
    if (!message) {
      return null;
    }
    return {
      tone: "destructive",
      message,
    };
  }, [error, snapshot.error]);

  return (
    <MessageChannelSurface
      sessionId="global-room"
      workspacePath={null}
      channels={rooms}
      selectedChatId={selectedRoom?.chatId ?? null}
      channelsLoading={loading || refreshing}
      channelsError={error}
      disabled={!selectedRoom}
      imageCompatible={false}
      routeNotice={routeNotice}
      initialMessages={selectedRoom?.chatId === snapshot.chatId ? snapshot.items : EMPTY_MESSAGES}
      assistantAvatarLabel={selectedRoom?.owner ?? "Assistant"}
      userAvatarLabel="You"
      onSelectChannel={(chatId) => {
        setSelectedRoomId(chatId);
        const room = rooms.find((item) => item.chatId === chatId);
        void controller
          .focusGlobalRooms({
            op: "replace",
            channels: [{ chatId, accessToken: room?.accessToken }],
          })
          .then(() => refreshRooms({ silent: true }))
          .catch((focusError) => {
            setError(focusError instanceof Error ? focusError.message : String(focusError));
          });
      }}
      onCreateChannel={async (input) => {
        const created = await controller.createGlobalRoom({
          title: input.title,
          participants: input.participants,
          metadata: input.metadata,
          adminToken: input.adminToken,
          focus: true,
        });
        await refreshRooms();
        setSelectedRoomId(created.chatId);
      }}
      onFocusChannel={async (channel) => {
        await controller.focusGlobalRooms({
          op: channel.focused ? "remove" : "add",
          channels: [{ chatId: channel.chatId, accessToken: channel.accessToken }],
        });
        await refreshRooms({ silent: true });
      }}
      onArchiveChannel={async (channel) => {
        await controller.archiveGlobalRoom({
          chatId: channel.chatId,
          accessToken: channel.accessToken,
        });
        await refreshRooms();
      }}
      onSendMessage={({ channel, payload }) =>
        controller
          .sendGlobalRoomMessage({
            chatId: channel.chatId,
            accessToken: channel.accessToken,
            payload,
          })
          .then(async () => {
            await loadSnapshot(channel);
          })
      }
      onUpdateChannel={async (input) => {
        const updated = await controller.updateGlobalRoom({
          chatId: input.channel.chatId,
          accessToken: input.channel.accessToken,
          patch: input.patch,
        });
        await refreshRooms({ silent: true });
        return updated;
      }}
      onListChannelGrants={async (channel) =>
        await controller.listGlobalRoomGrants({
          chatId: channel.chatId,
          accessToken: channel.accessToken,
        })
      }
      onIssueChannelGrant={async (input) =>
        (() => {
          const participantId = parseGlobalRoomActorId(input.participantId);
          if (!participantId) {
            throw new Error("participantId is required for global room grants.");
          }
          return controller.issueGlobalRoomGrant({
            chatId: input.channel.chatId,
            accessToken: input.channel.accessToken,
            role: input.role,
            label: input.label,
            participantId,
          });
        })()
      }
      onRevokeChannelGrant={async (input) =>
        await controller.revokeGlobalRoomGrant({
          chatId: input.channel.chatId,
          accessToken: input.channel.accessToken,
          grantId: input.grantId,
        })
      }
    />
  );
};
