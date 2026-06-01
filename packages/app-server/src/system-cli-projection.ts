import { projectNoteCliCapabilities } from "@agenter/note-system";

import {
  AVATAR_HOME_ENV,
  SKILLS_HOME_ENV,
  deriveEnvSkillsHome,
  parseEnvAvatarHome,
  parseEnvSkillsHome,
  serializeEnvAvatarHome,
  serializeEnvSkillsHome,
} from "./workspace-system";

export type SystemCliCommandName = "skill" | "note";
export type SystemCliCapability = "workspace-pwd" | "avatar-private";
export type SystemCliSourceEnv = typeof AVATAR_HOME_ENV | typeof SKILLS_HOME_ENV;

export interface WorkspaceSystemCliProjectionInput {
  mountId?: string;
  runtimeId?: string;
  runtimeWorkspaceId?: number;
  workspacePath: string;
  workspaceAlias?: string;
  defaultCwd: string;
  env: Record<string, string | undefined>;
}

export interface SystemCliProjection {
  command: SystemCliCommandName;
  systemId: "skillSystem" | "noteSystem";
  capability: SystemCliCapability;
  sourceEnv: SystemCliSourceEnv;
  sourcePaths: string[];
  workspacePath: string;
  workspaceAlias?: string;
  runtimeId?: string;
  runtimeWorkspaceId?: number;
  mountId?: string;
}

export type WorkspaceSystemCliProjectionProvider = (
  workspace: WorkspaceSystemCliProjectionInput,
) => readonly SystemCliProjection[];

const cloneProjection = (projection: SystemCliProjection): SystemCliProjection => ({
  ...projection,
  sourcePaths: [...projection.sourcePaths],
});

const readWorkspaceAvatarHome = (workspace: WorkspaceSystemCliProjectionInput): string[] =>
  parseEnvAvatarHome(workspace.env[AVATAR_HOME_ENV]);

const readWorkspaceSkillsHome = (workspace: WorkspaceSystemCliProjectionInput): string[] => {
  const explicit = parseEnvSkillsHome(workspace.env[SKILLS_HOME_ENV]);
  if (explicit.length > 0) {
    return explicit;
  }
  return deriveEnvSkillsHome({
    pwd: workspace.defaultCwd,
    avatarHome: readWorkspaceAvatarHome(workspace),
  });
};

const buildProjectionBase = (
  workspace: WorkspaceSystemCliProjectionInput,
): Pick<SystemCliProjection, "workspacePath" | "workspaceAlias" | "runtimeId" | "runtimeWorkspaceId" | "mountId"> => ({
  workspacePath: workspace.workspacePath,
  workspaceAlias: workspace.workspaceAlias,
  runtimeId: workspace.runtimeId,
  runtimeWorkspaceId: workspace.runtimeWorkspaceId,
  mountId: workspace.mountId,
});

export const projectSkillSystemCli = (
  workspace: WorkspaceSystemCliProjectionInput,
): readonly SystemCliProjection[] => {
  const sourcePaths = readWorkspaceSkillsHome(workspace);
  if (sourcePaths.length === 0) {
    return [];
  }
  return [
    {
      ...buildProjectionBase(workspace),
      command: "skill",
      systemId: "skillSystem",
      capability: "workspace-pwd",
      sourceEnv: SKILLS_HOME_ENV,
      sourcePaths,
    },
  ];
};

export const projectNoteSystemCli = (
  workspace: WorkspaceSystemCliProjectionInput,
): readonly SystemCliProjection[] =>
  projectNoteCliCapabilities({
    avatarHome: readWorkspaceAvatarHome(workspace),
  }).map((projection) => ({
    ...buildProjectionBase(workspace),
    command: projection.command,
    systemId: "noteSystem",
    capability: projection.capability,
    sourceEnv: AVATAR_HOME_ENV,
    sourcePaths: [projection.writableRoot],
  }));

export const DEFAULT_SYSTEM_CLI_PROJECTION_PROVIDERS = [
  projectSkillSystemCli,
  projectNoteSystemCli,
] as const satisfies readonly WorkspaceSystemCliProjectionProvider[];

export const projectWorkspaceSystemClis = (
  workspace: WorkspaceSystemCliProjectionInput,
  providers: readonly WorkspaceSystemCliProjectionProvider[] = DEFAULT_SYSTEM_CLI_PROJECTION_PROVIDERS,
): SystemCliProjection[] => providers.flatMap((provider) => provider(workspace).map(cloneProjection));

export const buildWorkspaceCapabilityEnv = (input: {
  avatarHome: readonly string[];
  skillsHome: readonly string[];
}): Record<string, string> => ({
  [AVATAR_HOME_ENV]: serializeEnvAvatarHome(input.avatarHome),
  [SKILLS_HOME_ENV]: serializeEnvSkillsHome(input.skillsHome),
});

export class WorkspaceSystemCliProjectionController {
  private readonly projectionsByMount = new Map<string, SystemCliProjection[]>();

  constructor(
    private readonly providers: readonly WorkspaceSystemCliProjectionProvider[] =
      DEFAULT_SYSTEM_CLI_PROJECTION_PROVIDERS,
  ) {}

  handleWorkspaceCreated(workspace: WorkspaceSystemCliProjectionInput): SystemCliProjection[] {
    return this.recomputeWorkspace(workspace);
  }

  handleWorkspaceUpdated(workspace: WorkspaceSystemCliProjectionInput): SystemCliProjection[] {
    return this.recomputeWorkspace(workspace);
  }

  handleWorkspaceDetached(input: { mountId: string }): SystemCliProjection[] {
    this.projectionsByMount.delete(input.mountId);
    return this.list();
  }

  recomputeWorkspace(workspace: WorkspaceSystemCliProjectionInput): SystemCliProjection[] {
    if (!workspace.mountId) {
      return projectWorkspaceSystemClis(workspace, this.providers);
    }
    const projections = projectWorkspaceSystemClis(workspace, this.providers);
    this.projectionsByMount.set(workspace.mountId, projections);
    return projections.map(cloneProjection);
  }

  list(): SystemCliProjection[] {
    return [...this.projectionsByMount.values()].flatMap((items) => items.map(cloneProjection));
  }
}
