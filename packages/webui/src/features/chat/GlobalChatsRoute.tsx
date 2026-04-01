import type { GlobalRoomActorId, GlobalRoomEntry, GlobalRoomGrantEntry, GlobalRoomMessage } from "@agenter/client-sdk";
import type { WebChatNotice } from "@agenter/web-chat-view";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAppController, useRuntimeSelector } from "../../app-context";
import { ActorTokenSelect, type ActorTokenOption } from "../collaboration/ActorTokenSelect";
import { buildActorDirectory, buildActorDirectoryMap, fallbackActorLabel } from "../collaboration/actor-directory";
import { useAuthActorCatalog } from "../collaboration/use-auth-actor-catalog";
import { useIconServiceUrls } from "../profile/icon-service";
import { MessageChannelSurface } from "./MessageChannelSurface";
import { RoomUsersPanel, type RoomUserEntry } from "./RoomUsersPanel";

type RoomSnapshotState = {
  chatId: string | null;
  channel: GlobalRoomEntry | null;
  items: GlobalRoomMessage[];
  loading: boolean;
  error: string | null;
  headVersion: string;
};

type RoomGrantsState = {
  chatId: string | null;
  items: GlobalRoomGrantEntry[];
  loading: boolean;
  error: string | null;
};

const EMPTY_MESSAGES: GlobalRoomMessage[] = [];
const GLOBAL_ROOM_ACTOR_ID_RE = /^(auth|session|system):.+$/;
const TRUSTED_BOOTSTRAP_ACTOR_ID = "system:trusted-bootstrap";

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

const isSelectableRoomSeatId = (value: string | undefined): value is GlobalRoomActorId => {
  return parseGlobalRoomActorId(value) !== null && value !== TRUSTED_BOOTSTRAP_ACTOR_ID;
};

const resolveRoomActorKind = (actorId: string | undefined): RoomUserEntry["actorKind"] => {
  if (actorId?.startsWith("auth:")) {
    return "auth";
  }
  if (actorId?.startsWith("session:")) {
    return "session";
  }
  return "system";
};

export const GlobalChatsRoute = ({ preferredRoomId }: { preferredRoomId?: string | null }) => {
  const controller = useAppController();
  const connected = useRuntimeSelector((state) => state.connected);
  const sessions = useRuntimeSelector((state) => state.sessions);
  const iconUrls = useIconServiceUrls(controller.runtimeStore);
  const { items: authActors } = useAuthActorCatalog(controller.runtimeStore, connected);
  const [rooms, setRooms] = useState<GlobalRoomEntry[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedCallerTokenByRoomId, setSelectedCallerTokenByRoomId] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<RoomSnapshotState>({
    chatId: null,
    channel: null,
    items: [],
    loading: false,
    error: null,
    headVersion: "0",
  });
  const [grants, setGrants] = useState<RoomGrantsState>({
    chatId: null,
    items: [],
    loading: false,
    error: null,
  });

  const actorDirectory = useMemo(
    () =>
      buildActorDirectory({
        sessions,
        authActors,
        iconUrls,
      }),
    [authActors, iconUrls, sessions],
  );
  const actorDirectoryById = useMemo(() => buildActorDirectoryMap(actorDirectory), [actorDirectory]);
  const actorOptions = useMemo(
    () =>
      actorDirectory
        .filter((entry): entry is typeof entry & { actorId: GlobalRoomActorId } => entry.actorId.startsWith("auth:") || entry.actorId.startsWith("session:"))
        .map((entry) => ({
          actorId: entry.actorId,
          actorKind: entry.actorKind,
          label: entry.label,
          subtitle: entry.subtitle,
          iconUrl: entry.iconUrl,
        })),
    [actorDirectory],
  );

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.chatId === selectedRoomId) ?? rooms[0] ?? null,
    [rooms, selectedRoomId],
  );
  const selectedRoomProjection = useMemo(
    () => (selectedRoom && snapshot.chatId === selectedRoom.chatId ? snapshot.channel ?? selectedRoom : selectedRoom),
    [selectedRoom, snapshot.channel, snapshot.chatId],
  );
  const latestMarkedReadBySeatRef = useRef<Record<string, string | null>>({});

  const tokenOptions = useMemo<ActorTokenOption[]>(() => {
    if (!selectedRoomProjection) {
      return [];
    }
    const options: ActorTokenOption[] = [];
    const seen = new Set<string>();
    const pushToken = (accessToken: string | undefined, input: { label: string; subtitle?: string; roleLabel?: string }) => {
      if (!accessToken || seen.has(accessToken)) {
        return;
      }
      seen.add(accessToken);
      options.push({
        accessToken,
        label: input.label,
        subtitle: input.subtitle,
        roleLabel: input.roleLabel,
      });
    };
    if (isSelectableRoomSeatId(selectedRoomProjection.participantId)) {
      const actor = actorDirectoryById.get(selectedRoomProjection.participantId!);
      pushToken(selectedRoomProjection.accessToken, {
        label: actor?.label ?? fallbackActorLabel(selectedRoomProjection.participantId!),
        subtitle: actor?.subtitle ?? selectedRoomProjection.participantId,
        roleLabel: selectedRoomProjection.accessRole,
      });
    }
    grants.items.forEach((grant) => {
      const actor = grant.participantId ? actorDirectoryById.get(grant.participantId) : null;
      pushToken(grant.accessToken, {
        label: actor?.label ?? grant.label ?? grant.participantId ?? grant.grantId,
        subtitle: actor?.subtitle ?? grant.participantId,
        roleLabel: grant.role,
      });
    });
    return options;
  }, [actorDirectoryById, grants.items, selectedRoomProjection]);

  const selectedCallerToken = useMemo(() => {
    if (!selectedRoomProjection) {
      return null;
    }
    const preferred = selectedCallerTokenByRoomId[selectedRoomProjection.chatId];
    if (preferred && tokenOptions.some((option) => option.accessToken === preferred)) {
      return preferred;
    }
    return tokenOptions[0]?.accessToken ?? null;
  }, [selectedCallerTokenByRoomId, selectedRoomProjection, tokenOptions]);

  const roomUsers = useMemo<RoomUserEntry[]>(() => {
    if (!selectedRoomProjection) {
      return [];
    }
    const latestVisibleMessageId = selectedRoomProjection.readProgress?.latestVisibleMessageId;
    const readStates = selectedRoomProjection.readStates ?? [];
    const readStateByActorId = new Map<string, (typeof readStates)[number]>(readStates.map((state) => [state.actorId, state]));
    const grantByActorId = new Map<string, (typeof grants.items)[number]>(
      grants.items.map((grant) => [grant.participantId ?? grant.grantId, grant]),
    );
    const currentProjectionActorId = selectedRoomProjection.participantId;
    const byActorId = new Map<string, RoomUserEntry>();
    selectedRoomProjection.participants.forEach((participant) => {
      if (typeof participant.id !== "string" || participant.id.length === 0) {
        return;
      }
      const actor = actorDirectoryById.get(participant.id);
      const readState = readStateByActorId.get(participant.id);
      const grant = grantByActorId.get(participant.id);
      byActorId.set(participant.id, {
        actorId: participant.id,
        actorKind: actor?.actorKind ?? resolveRoomActorKind(participant.id),
        label: actor?.label ?? participant.label ?? fallbackActorLabel(participant.id),
        subtitle: actor?.subtitle ?? participant.id,
        roleLabel: readState?.role ?? (grant?.role ?? "participant"),
        accessToken:
          grant?.accessToken ??
          (currentProjectionActorId === participant.id ? selectedRoomProjection.accessToken : undefined),
        iconUrl: actor?.iconUrl,
        currentCaller:
          (grant?.accessToken ??
            (currentProjectionActorId === participant.id ? selectedRoomProjection.accessToken : undefined)) === selectedCallerToken,
        currentAdmin: readState?.currentAdmin ?? false,
        online: readState?.online ?? false,
        focused: readState?.focused ?? false,
        invalidCredential: readState?.invalidCredential ?? false,
        readStatus: latestVisibleMessageId
          ? readState?.hasReadLatestVisible
            ? "read"
            : "unread"
          : "idle",
        readAt: readState?.readAt,
      });
    });
    readStates.forEach((readState) => {
      const actorId = readState.actorId;
      const actor = actorDirectoryById.get(actorId);
      const grant = grantByActorId.get(actorId);
      const accessToken =
        grant?.accessToken ?? (currentProjectionActorId === actorId ? selectedRoomProjection.accessToken : undefined);
      byActorId.set(actorId, {
        actorId,
        actorKind: actor?.actorKind ?? resolveRoomActorKind(actorId),
        label: actor?.label ?? grant?.label ?? readState.label ?? fallbackActorLabel(actorId),
        subtitle: actor?.subtitle ?? actorId,
        roleLabel: readState.role,
        accessToken,
        iconUrl: actor?.iconUrl,
        currentCaller: accessToken === selectedCallerToken,
        currentAdmin: readState.currentAdmin,
        online: readState.online,
        focused: readState.focused,
        invalidCredential: readState.invalidCredential,
        readStatus: latestVisibleMessageId ? (readState.hasReadLatestVisible ? "read" : "unread") : "idle",
        readAt: readState.readAt,
      });
    });
    grants.items.forEach((grant) => {
      const actorId = grant.participantId ?? grant.grantId;
      const actor = grant.participantId ? actorDirectoryById.get(grant.participantId) : null;
      const current = byActorId.get(actorId);
      const readState = grant.participantId ? readStateByActorId.get(grant.participantId) : undefined;
      byActorId.set(actorId, {
        actorId,
        actorKind: current?.actorKind ?? actor?.actorKind ?? resolveRoomActorKind(grant.participantId),
        label: current?.label ?? actor?.label ?? grant.label ?? grant.participantId ?? grant.grantId,
        subtitle: current?.subtitle ?? actor?.subtitle ?? grant.participantId ?? actorId,
        roleLabel: grant.role,
        accessToken: grant.accessToken,
        iconUrl: current?.iconUrl ?? actor?.iconUrl,
        currentCaller: grant.accessToken === selectedCallerToken,
        currentAdmin: current?.currentAdmin ?? readState?.currentAdmin ?? false,
        online: current?.online ?? readState?.online ?? false,
        focused: current?.focused ?? readState?.focused ?? false,
        invalidCredential: current?.invalidCredential ?? readState?.invalidCredential ?? false,
        readStatus:
          current?.readStatus ??
          (latestVisibleMessageId ? (readState?.hasReadLatestVisible ? "read" : "unread") : "idle"),
        readAt: current?.readAt ?? readState?.readAt,
      });
    });
    return [...byActorId.values()].sort((left, right) => {
      if (left.currentAdmin !== right.currentAdmin) {
        return left.currentAdmin ? -1 : 1;
      }
      if (left.currentCaller !== right.currentCaller) {
        return left.currentCaller ? -1 : 1;
      }
      const rank = (role: RoomUserEntry["roleLabel"]) => ({ admin: 0, member: 1, readonly: 2, participant: 3 })[role];
      const roleDiff = rank(left.roleLabel) - rank(right.roleLabel);
      if (roleDiff !== 0) {
        return roleDiff;
      }
      return left.label.localeCompare(right.label);
    });
  }, [actorDirectoryById, grants.items, selectedCallerToken, selectedRoomProjection]);

  const resolveSelectedRoomAccessToken = useCallback(
    (fallbackToken?: string) => {
      if (selectedCallerToken) {
        return selectedCallerToken;
      }
      return selectedRoomProjection && isSelectableRoomSeatId(selectedRoomProjection.participantId) ? fallbackToken : undefined;
    },
    [selectedCallerToken, selectedRoomProjection],
  );

  const resolveSelectedRoomAdminToken = useCallback(
    (fallbackToken?: string) => {
      if (selectedRoom?.accessRole === "admin" && selectedRoom.accessToken) {
        return selectedRoom.accessToken;
      }
      if (selectedRoomProjection?.accessRole === "admin" && selectedRoomProjection.accessToken) {
        return selectedRoomProjection.accessToken;
      }
      return fallbackToken;
    },
    [selectedRoom, selectedRoomProjection],
  );

  const selectedRoomChatId = selectedRoom?.chatId ?? null;
  const selectedRoomAccessRole = selectedRoom?.accessRole ?? null;
  const selectedRoomAccessToken = selectedRoom?.accessToken ?? null;
  const selectedRoomAdminToken = selectedRoomAccessRole === "admin" ? selectedRoomAccessToken : undefined;

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
    async (room: GlobalRoomEntry | null, accessToken?: string | null) => {
      if (!room) {
        setSnapshot({
          chatId: null,
          channel: null,
          items: [],
          loading: false,
          error: null,
          headVersion: "0",
        });
        return;
      }
      setSnapshot((current) => ({
        chatId: room.chatId,
        channel: current.chatId === room.chatId ? current.channel : room,
        items: current.chatId === room.chatId ? current.items : [],
        loading: true,
        error: null,
        headVersion: current.chatId === room.chatId ? current.headVersion : "0",
      }));
      try {
        const next = await controller.snapshotGlobalRoom({
          chatId: room.chatId,
          accessToken: accessToken ?? room.accessToken,
          limit: 120,
        });
        setRooms((current) => current.map((entry) => (entry.chatId === next.channel.chatId ? { ...entry, ...next.channel } : entry)));
        setSnapshot({
          chatId: room.chatId,
          channel: next.channel,
          items: next.items,
          loading: false,
          error: null,
          headVersion: next.headVersion,
        });
      } catch (loadError) {
        setSnapshot((current) => ({
          ...current,
          chatId: room.chatId,
          channel: current.chatId === room.chatId ? current.channel : room,
          loading: false,
          error: loadError instanceof Error ? loadError.message : String(loadError),
        }));
      }
    },
    [controller],
  );

  const loadGrants = useCallback(
    async (room: GlobalRoomEntry | null, accessToken?: string | null) => {
      if (!room || !accessToken) {
        setGrants({
          chatId: room?.chatId ?? null,
          items: [],
          loading: false,
          error: null,
        });
        return;
      }
      setGrants((current) => ({
        chatId: room.chatId,
        items: current.chatId === room.chatId ? current.items : [],
        loading: true,
        error: null,
      }));
      try {
        const items = await controller.listGlobalRoomGrants({
          chatId: room.chatId,
          accessToken,
        });
        setGrants({
          chatId: room.chatId,
          items,
          loading: false,
          error: null,
        });
      } catch (loadError) {
        setGrants((current) => ({
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
    void loadSnapshot(selectedRoom, selectedCallerToken);
    void loadGrants(selectedRoom, selectedRoomAdminToken);
  }, [loadGrants, loadSnapshot, selectedCallerToken, selectedRoomAccessRole, selectedRoomAccessToken, selectedRoomAdminToken, selectedRoomChatId]);

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
      selectedChatId={selectedRoomProjection?.chatId ?? null}
      channelsLoading={loading || refreshing}
      channelsError={error}
      disabled={!selectedRoomProjection || !selectedCallerToken}
      imageCompatible={false}
      routeNotice={routeNotice}
      initialMessages={selectedRoomProjection?.chatId === snapshot.chatId ? snapshot.items : EMPTY_MESSAGES}
      assistantAvatarLabel={selectedRoomProjection?.owner ?? "Assistant"}
      userAvatarLabel="You"
      readProgress={selectedRoomProjection?.readProgress}
      readStates={selectedRoomProjection?.readStates ?? []}
      renderComposerAccessory={() => (
        <ActorTokenSelect
          label="Send as"
          emptyLabel="No room token available"
          value={selectedCallerToken}
          options={tokenOptions}
          onChange={(accessToken) => {
            if (!selectedRoomProjection) {
              return;
            }
            setSelectedCallerTokenByRoomId((current) => ({
              ...current,
              [selectedRoomProjection.chatId]: accessToken,
            }));
          }}
        />
      )}
      sidePanel={
        <RoomUsersPanel
          roomId={selectedRoom?.chatId ?? null}
          loading={grants.loading}
          users={roomUsers}
        />
      }
      onSelectChannel={(chatId) => {
        setSelectedRoomId(chatId);
      }}
      onCreateChannel={async (input) => {
        const created = await controller.createGlobalRoom({
          title: input.title,
          participants: input.participants,
          metadata: input.metadata,
          adminToken: input.adminToken,
          focus: false,
        });
        await refreshRooms();
        setSelectedRoomId(created.chatId);
      }}
      onFocusChannel={async (channel) => {
        const accessToken = resolveSelectedRoomAccessToken(channel.accessToken);
        if (!accessToken) {
          return;
        }
        await controller.focusGlobalRooms({
          op: channel.focused ? "remove" : "add",
          channels: [{ chatId: channel.chatId, accessToken }],
        });
        await refreshRooms({ silent: true });
      }}
      onArchiveChannel={async (channel) => {
        await controller.archiveGlobalRoom({
          chatId: channel.chatId,
          accessToken: resolveSelectedRoomAdminToken(channel.accessToken),
        });
        await refreshRooms();
      }}
      onDeleteChannel={async (channel) => {
        await controller.deleteGlobalRoom({
          chatId: channel.chatId,
          accessToken: resolveSelectedRoomAdminToken(channel.accessToken),
        });
        await refreshRooms();
      }}
      onSendMessage={({ channel, payload }) =>
        controller
          .sendGlobalRoomMessage({
            chatId: channel.chatId,
            accessToken: resolveSelectedRoomAccessToken(channel.accessToken),
            payload,
          })
          .then(async () => {
            await loadSnapshot(channel, resolveSelectedRoomAccessToken(channel.accessToken));
          })
      }
      onUpdateChannel={async (input) => {
        const updated = await controller.updateGlobalRoom({
          chatId: input.channel.chatId,
          accessToken: resolveSelectedRoomAdminToken(input.channel.accessToken),
          patch: input.patch,
        });
        await refreshRooms({ silent: true });
        return updated;
      }}
      onListChannelGrants={async (channel) =>
        await controller.listGlobalRoomGrants({
          chatId: channel.chatId,
          accessToken: resolveSelectedRoomAdminToken(channel.accessToken),
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
            accessToken: resolveSelectedRoomAdminToken(input.channel.accessToken),
            role: input.role,
            label: input.label,
            participantId,
          });
        })()
      }
      actorOptions={actorOptions}
      onRevokeChannelGrant={async (input) =>
        await controller.revokeGlobalRoomGrant({
          chatId: input.channel.chatId,
          accessToken: resolveSelectedRoomAdminToken(input.channel.accessToken),
          grantId: input.grantId,
        })
      }
      onLatestVisibleMessageIdChange={(messageId) => {
        const room = selectedRoomProjection;
        const accessToken = room ? resolveSelectedRoomAccessToken(room.accessToken) : null;
        if (!room || !accessToken) {
          return;
        }
        const markKey = `${room.chatId}:${accessToken}`;
        if (!messageId) {
          latestMarkedReadBySeatRef.current[markKey] = null;
          return;
        }
        if (latestMarkedReadBySeatRef.current[markKey] === messageId) {
          return;
        }
        latestMarkedReadBySeatRef.current[markKey] = messageId;
        void controller
          .markGlobalRoomRead({
            chatId: room.chatId,
            accessToken,
            messageId,
          })
          .then((channel) => {
            setRooms((current) => current.map((entry) => (entry.chatId === channel.chatId ? { ...entry, ...channel } : entry)));
            setSnapshot((current) =>
              current.chatId === channel.chatId
                ? {
                    ...current,
                    channel,
                  }
                : current,
            );
          })
          .catch((markError) => {
            latestMarkedReadBySeatRef.current[markKey] = null;
            setError(markError instanceof Error ? markError.message : String(markError));
          });
      }}
    />
  );
};
