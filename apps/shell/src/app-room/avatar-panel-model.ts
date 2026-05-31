import type {
  GlobalAvatarCatalogEntry,
  GlobalRoomActorId,
  GlobalRoomGrantEntry,
  GlobalTerminalActorId,
  GlobalTerminalGrantEntry,
} from "@agenter/client-sdk";

export const shellAvatarRoomRoles = ["admin", "member", "readonly"] as const;
export const shellAvatarTerminalRoles = ["admin", "writer", "guard", "readonly"] as const;

export type ShellAvatarRoomRole = (typeof shellAvatarRoomRoles)[number];
export type ShellAvatarTerminalRole = (typeof shellAvatarTerminalRoles)[number];

export interface ShellAvatarPanelItem {
  nickname: string;
  displayName: string;
  actorId: string;
  roomGrantId: string | null;
  roomRole: ShellAvatarRoomRole | null;
  terminalGrantId: string | null;
  terminalRole: ShellAvatarTerminalRole | null;
}

export interface ShellAvatarPanelState {
  items: ShellAvatarPanelItem[];
  selectedIndex: number;
  loading: boolean;
  notice: string | null;
}

export const defaultShellAvatarRoomRole: ShellAvatarRoomRole = "member";
export const defaultShellAvatarTerminalRole: ShellAvatarTerminalRole = "writer";

export const toShellAvatarActorId = (avatar: GlobalAvatarCatalogEntry): string | null => {
  const principalId = avatar.avatarPrincipalId?.trim();
  return principalId && principalId.length > 0 ? principalId : null;
};

const compareAvatarItems = (left: ShellAvatarPanelItem, right: ShellAvatarPanelItem): number =>
  left.nickname.localeCompare(right.nickname);

const isRoomRole = (value: string): value is ShellAvatarRoomRole =>
  shellAvatarRoomRoles.includes(value as ShellAvatarRoomRole);

const isTerminalRole = (value: string): value is ShellAvatarTerminalRole =>
  shellAvatarTerminalRoles.includes(value as ShellAvatarTerminalRole);

export const buildShellAvatarPanelItems = (input: {
  avatars: readonly GlobalAvatarCatalogEntry[];
  roomGrants: readonly GlobalRoomGrantEntry[];
  terminalGrants: readonly GlobalTerminalGrantEntry[];
  excludedActorIds?: readonly string[];
}): ShellAvatarPanelItem[] => {
  const excluded = new Set(input.excludedActorIds ?? []);
  return input.avatars
    .map((avatar): ShellAvatarPanelItem | null => {
      const actorId = toShellAvatarActorId(avatar);
      if (!actorId || excluded.has(actorId)) {
        return null;
      }
      const roomGrant = input.roomGrants.find((grant) => grant.participantId === actorId);
      const terminalGrant = input.terminalGrants.find((grant) => grant.participantId === actorId);
      return {
        nickname: avatar.nickname,
        displayName: avatar.displayName?.trim() || avatar.nickname,
        actorId,
        roomGrantId: roomGrant?.grantId ?? null,
        roomRole: roomGrant && isRoomRole(roomGrant.role) ? roomGrant.role : null,
        terminalGrantId: terminalGrant?.grantId ?? null,
        terminalRole: terminalGrant && isTerminalRole(terminalGrant.role) ? terminalGrant.role : null,
      };
    })
    .filter((item): item is ShellAvatarPanelItem => item !== null)
    .sort(compareAvatarItems);
};

const cycleValue = <T extends string>(values: readonly T[], current: T | null, fallback: T): T => {
  if (!current) {
    return fallback;
  }
  const index = values.indexOf(current);
  return values[(index + 1) % values.length] ?? fallback;
};

export const nextShellAvatarRoomRole = (current: ShellAvatarRoomRole | null): ShellAvatarRoomRole =>
  cycleValue(shellAvatarRoomRoles, current, defaultShellAvatarRoomRole);

export const nextShellAvatarTerminalRole = (current: ShellAvatarTerminalRole | null): ShellAvatarTerminalRole =>
  cycleValue(shellAvatarTerminalRoles, current, defaultShellAvatarTerminalRole);

export const formatShellAvatarPanelOption = (item: ShellAvatarPanelItem): string => {
  const room = item.roomRole ?? "none";
  const terminal = item.terminalRole ?? "none";
  return `@${item.nickname}  room:${room}  terminal:${terminal}`;
};

export const toRoomActorId = (actorId: string): GlobalRoomActorId => actorId as GlobalRoomActorId;
export const toTerminalActorId = (actorId: string): GlobalTerminalActorId => actorId as GlobalTerminalActorId;
