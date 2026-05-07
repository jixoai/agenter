import { Bash, InMemoryFs, defineCommand } from "just-bash";

import { listRuntimeToolDescriptors } from "./runtime-tool-descriptors";
import {
  listWorkspaceToolBindings,
  type WorkspaceToolBinding,
  type WorkspaceToolScope,
} from "./workspace-system/tool-bindings";

export type CliCommandCatalogSource = "just-bash-builtin" | "runtime-cli" | "workspace-tool";
export type CliCommandCatalogGroupId =
  | "just-bash-builtins"
  | "root-runtime-cli"
  | "workspace-public-tools"
  | "workspace-private-tools";
export type CliCommandCatalogPerspective = "browser" | "root-workspace-shell" | "public-workspace-shell";
export type CliCommandExecutionSurface = "root-workspace" | "public-workspace";

export interface CliCommandCatalogEntry {
  id: string;
  groupId: CliCommandCatalogGroupId;
  source: CliCommandCatalogSource;
  commandLabel: string;
  displayName: string;
  description: string;
  suggestedCommand: string;
  detailHint?: string;
  preferredExecutionSurface?: CliCommandExecutionSurface;
  toolFileName?: string;
  toolScope?: WorkspaceToolScope;
  metadataState?: "registered" | "fallback";
  skillRef?: string;
}

export interface CliCommandCatalogGroup {
  id: CliCommandCatalogGroupId;
  title: string;
  description: string;
  entries: CliCommandCatalogEntry[];
}

export interface CliCommandCatalog {
  groups: CliCommandCatalogGroup[];
}

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

const JUST_BASH_BUILTINS_GROUP: Pick<CliCommandCatalogGroup, "id" | "title" | "description"> = {
  id: "just-bash-builtins",
  title: "just-bash builtins",
  description: "Shell builtins exposed by just-bash. Use `help <builtin>` for the canonical detail text.",
};

const ROOT_RUNTIME_CLI_GROUP: Pick<CliCommandCatalogGroup, "id" | "title" | "description"> = {
  id: "root-runtime-cli",
  title: "root runtime CLI",
  description: "Descriptor-backed runtime commands callable from the fixed root-workspace shell.",
};

const WORKSPACE_PUBLIC_TOOLS_GROUP: Pick<CliCommandCatalogGroup, "id" | "title" | "description"> = {
  id: "workspace-public-tools",
  title: "workspace public tools",
  description: "File-backed tool commands registered from the workspace public tools directory.",
};

const WORKSPACE_PRIVATE_TOOLS_GROUP: Pick<CliCommandCatalogGroup, "id" | "title" | "description"> = {
  id: "workspace-private-tools",
  title: "workspace private tools",
  description: "Avatar-private tool commands registered from the workspace private tools directory.",
};

const HELP_CENTER_USAGE = [
  "helpcenter [list] [--json]",
  "helpcenter <command label> [--json]",
  "",
  "Description: Show the structured CLI command catalog for the current shell surface.",
  "",
  "Examples:",
  "- `helpcenter`",
  "- `helpcenter list --json`",
  "- `helpcenter cd`",
  "- `helpcenter message send`",
  "",
].join("\n");

let builtinCatalogPromise: Promise<readonly CliCommandCatalogEntry[]> | null = null;

const buildCatalogEntryId = (groupId: CliCommandCatalogGroupId, commandLabel: string): string =>
  `${groupId}:${commandLabel}`;

const isHelpArg = (value: string): boolean => value === "--help";

const parseHelpcenterArgs = (args: readonly string[]): { jsonRequested: boolean; payloadArgs: string[] } => {
  let jsonRequested = false;
  const payloadArgs: string[] = [];
  for (const arg of args) {
    if (arg === "--json") {
      jsonRequested = true;
      continue;
    }
    payloadArgs.push(arg);
  }
  return { jsonRequested, payloadArgs };
};

const buildGroup = (
  group: Pick<CliCommandCatalogGroup, "id" | "title" | "description">,
  entries: readonly CliCommandCatalogEntry[],
): CliCommandCatalogGroup | null =>
  entries.length === 0
    ? null
    : {
        ...group,
        entries: [...entries],
      };

const cloneCatalog = (catalog: CliCommandCatalog): CliCommandCatalog => ({
  groups: catalog.groups.map((group) => ({
    ...group,
    entries: group.entries.map((entry) => ({ ...entry })),
  })),
});

const parseBuiltinNames = (helpText: string): string[] =>
  helpText
    .split(/\r?\n/u)
    .slice(3)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .flatMap((line) => line.split(/\s+/u))
    .filter((token) => token.length > 0);

const parseBuiltinDescription = (input: { name: string; helpText: string }): string => {
  const lines = input.helpText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return lines[1] ?? `Shell builtin. Use \`help ${input.name}\` for details.`;
};

const loadBuiltinCatalogEntries = async (): Promise<readonly CliCommandCatalogEntry[]> => {
  const bash = new Bash({
    fs: new InMemoryFs(),
    cwd: "/",
  });
  const helpList = await bash.exec("help");
  const builtinNames = parseBuiltinNames(helpList.stdout);
  const entries = await Promise.all(
    builtinNames.map(async (name) => {
      const detail = await bash.exec(`help ${name}`);
      return {
        id: buildCatalogEntryId(JUST_BASH_BUILTINS_GROUP.id, name),
        groupId: JUST_BASH_BUILTINS_GROUP.id,
        source: "just-bash-builtin" as const,
        commandLabel: name,
        displayName: name,
        description: parseBuiltinDescription({
          name,
          helpText: detail.stdout,
        }),
        suggestedCommand: `help ${name}`,
        detailHint: `help ${name}`,
      } satisfies CliCommandCatalogEntry;
    }),
  );
  return entries;
};

const listBuiltinCatalogEntries = async (): Promise<readonly CliCommandCatalogEntry[]> => {
  builtinCatalogPromise ??= loadBuiltinCatalogEntries();
  return await builtinCatalogPromise;
};

const listRootRuntimeCliCatalogEntries = (): CliCommandCatalogEntry[] =>
  listRuntimeToolDescriptors()
    .map((descriptor) => {
      const commandLabel = `${descriptor.namespace} ${descriptor.name}`;
      return {
        id: buildCatalogEntryId(ROOT_RUNTIME_CLI_GROUP.id, commandLabel),
        groupId: ROOT_RUNTIME_CLI_GROUP.id,
        source: "runtime-cli" as const,
        commandLabel,
        displayName: descriptor.name,
        description: descriptor.description,
        suggestedCommand: `${commandLabel} --help`,
        detailHint: `${commandLabel} --help`,
        preferredExecutionSurface: "root-workspace",
      } satisfies CliCommandCatalogEntry;
    })
    .sort((left, right) => left.commandLabel.localeCompare(right.commandLabel));

const toWorkspaceToolGroup = (
  scope: WorkspaceToolScope,
): Pick<CliCommandCatalogGroup, "id" | "title" | "description"> =>
  scope === "public" ? WORKSPACE_PUBLIC_TOOLS_GROUP : WORKSPACE_PRIVATE_TOOLS_GROUP;

const listWorkspaceToolCatalogEntries = (input: { workspacePath: string; avatar: string }): CliCommandCatalogEntry[] =>
  listWorkspaceToolBindings(input)
    .map((binding) => {
      const group = toWorkspaceToolGroup(binding.scope);
      return toWorkspaceToolCatalogEntry(group.id, binding);
    })
    .sort((left, right) => left.commandLabel.localeCompare(right.commandLabel));

const toWorkspaceToolCatalogEntry = (
  groupId: CliCommandCatalogGroupId,
  binding: WorkspaceToolBinding,
): CliCommandCatalogEntry => ({
  id: buildCatalogEntryId(groupId, binding.commandName),
  groupId,
  source: "workspace-tool",
  commandLabel: binding.commandName,
  displayName: binding.helpcenter.name,
  description: binding.helpcenter.description,
  suggestedCommand: `${binding.commandName} --help`,
  detailHint: `${binding.commandName} --help`,
  preferredExecutionSurface: "public-workspace",
  toolFileName: binding.fileName,
  toolScope: binding.scope,
  metadataState: binding.helpcenter.registered ? "registered" : "fallback",
  skillRef: binding.helpcenter.skillRef,
});

const groupWorkspaceToolEntries = (
  entries: readonly CliCommandCatalogEntry[],
): {
  publicEntries: CliCommandCatalogEntry[];
  privateEntries: CliCommandCatalogEntry[];
} => ({
  publicEntries: entries.filter((entry) => entry.groupId === WORKSPACE_PUBLIC_TOOLS_GROUP.id),
  privateEntries: entries.filter((entry) => entry.groupId === WORKSPACE_PRIVATE_TOOLS_GROUP.id),
});

const findCatalogEntry = (
  catalog: CliCommandCatalog,
  commandLabel: string,
): { group: CliCommandCatalogGroup; entry: CliCommandCatalogEntry } | null => {
  for (const group of catalog.groups) {
    const entry = group.entries.find((item) => item.commandLabel === commandLabel);
    if (entry) {
      return { group, entry };
    }
  }
  return null;
};

export const buildRootWorkspaceCliCommandCatalog = async (): Promise<CliCommandCatalog> => {
  const [builtinEntries, runtimeEntries] = await Promise.all([
    listBuiltinCatalogEntries(),
    Promise.resolve(listRootRuntimeCliCatalogEntries()),
  ]);
  return {
    groups: [
      buildGroup(JUST_BASH_BUILTINS_GROUP, builtinEntries),
      buildGroup(ROOT_RUNTIME_CLI_GROUP, runtimeEntries),
    ].filter((group): group is CliCommandCatalogGroup => group !== null),
  };
};

export const buildWorkspaceCliCommandCatalog = async (input: {
  workspacePath: string;
  avatar: string;
  perspective: CliCommandCatalogPerspective;
}): Promise<CliCommandCatalog> => {
  const [builtinEntries, workspaceToolEntries, runtimeEntries] = await Promise.all([
    listBuiltinCatalogEntries(),
    Promise.resolve(listWorkspaceToolCatalogEntries(input)),
    input.perspective === "browser" ? Promise.resolve(listRootRuntimeCliCatalogEntries()) : Promise.resolve([]),
  ]);
  const groupedWorkspaceTools = groupWorkspaceToolEntries(workspaceToolEntries);
  const groups = [
    buildGroup(JUST_BASH_BUILTINS_GROUP, builtinEntries),
    input.perspective === "browser" ? buildGroup(ROOT_RUNTIME_CLI_GROUP, runtimeEntries) : null,
    buildGroup(WORKSPACE_PUBLIC_TOOLS_GROUP, groupedWorkspaceTools.publicEntries),
    buildGroup(WORKSPACE_PRIVATE_TOOLS_GROUP, groupedWorkspaceTools.privateEntries),
  ].filter((group): group is CliCommandCatalogGroup => group !== null);
  return { groups };
};

export const renderCliCommandCatalog = (catalog: CliCommandCatalog): string => {
  const lines = ["helpcenter", "", "Grouped command catalog for this shell surface.", ""];
  for (const group of catalog.groups) {
    lines.push(group.title);
    lines.push(group.description);
    for (const entry of group.entries) {
      const hint = entry.detailHint ? ` (${entry.detailHint})` : "";
      lines.push(`- ${entry.commandLabel}: ${entry.description}${hint}`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
};

export const renderCliCommandCatalogEntry = (input: {
  group: CliCommandCatalogGroup;
  entry: CliCommandCatalogEntry;
}): string => {
  const lines = [
    input.entry.commandLabel,
    "",
    `Group: ${input.group.title}`,
    `Description: ${input.entry.description}`,
  ];
  if (input.entry.displayName !== input.entry.commandLabel) {
    lines.push(`Display name: ${input.entry.displayName}`);
  }
  lines.push(`Suggested command: ${input.entry.suggestedCommand}`);
  if (input.entry.detailHint) {
    lines.push(`Detail hint: ${input.entry.detailHint}`);
  }
  if (input.entry.preferredExecutionSurface) {
    lines.push(`Preferred browser surface: ${input.entry.preferredExecutionSurface}`);
  }
  if (input.entry.toolFileName) {
    lines.push(`Tool file: ${input.entry.toolFileName}`);
  }
  if (input.entry.metadataState === "fallback") {
    lines.push("Metadata: fallback description (no registered helpcenter metadata)");
  }
  if (input.entry.skillRef) {
    lines.push(`Skill ref: ${input.entry.skillRef}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
};

const buildHelpcenterCommand = (getCatalog: () => Promise<CliCommandCatalog>) =>
  defineCommand("helpcenter", async (args) => {
    try {
      const [firstArg] = args;
      if (isHelpArg(firstArg ?? "")) {
        return {
          stdout: `${HELP_CENTER_USAGE}\n`,
          stderr: "",
          exitCode: 0,
        };
      }
      const { jsonRequested, payloadArgs } = parseHelpcenterArgs(args);
      const catalog = cloneCatalog(await getCatalog());
      if (payloadArgs.length === 0 || (payloadArgs[0] === "list" && payloadArgs.length === 1)) {
        return {
          stdout: jsonRequested ? json(catalog) : renderCliCommandCatalog(catalog),
          stderr: "",
          exitCode: 0,
        };
      }
      const commandLabel =
        payloadArgs[0] === "show" ? payloadArgs.slice(1).join(" ").trim() : payloadArgs.join(" ").trim();
      if (commandLabel.length === 0) {
        return {
          stdout: `${HELP_CENTER_USAGE}\n`,
          stderr: "",
          exitCode: 0,
        };
      }
      const match = findCatalogEntry(catalog, commandLabel);
      if (!match) {
        return {
          stdout: "",
          stderr: `unknown helpcenter command: ${commandLabel}\n`,
          exitCode: 1,
        };
      }
      return {
        stdout: jsonRequested ? json(match) : renderCliCommandCatalogEntry(match),
        stderr: "",
        exitCode: 0,
      };
    } catch (error) {
      return {
        stdout: "",
        stderr: `${error instanceof Error ? error.message : String(error)}\n`,
        exitCode: 1,
      };
    }
  });

export const createRootWorkspaceHelpcenterCommand = () => buildHelpcenterCommand(buildRootWorkspaceCliCommandCatalog);

export const createWorkspaceHelpcenterCommand = (input: { workspacePath: string; avatar: string }) =>
  buildHelpcenterCommand(
    async () =>
      await buildWorkspaceCliCommandCatalog({
        workspacePath: input.workspacePath,
        avatar: input.avatar,
        perspective: "public-workspace-shell",
      }),
  );
