export interface AvatarSource {
  name: string;
  path: string;
}

export interface AgenterAvatarInit {
  nickname: string;
  sources: AvatarSource[];
}

export interface ResolveAvatarInput {
  nickname?: string;
  projectRoot: string;
  homeDir: string;
}

export interface ResolvedAvatar {
  nickname: string;
  sources: AvatarSource[];
}

export interface AvatarPromptPaths {
  AGENTER?: string;
  AGENTER_SYSTEM?: string;
  SYSTEM_TEMPLATE?: string;
  RESPONSE_CONTRACT?: string;
}
