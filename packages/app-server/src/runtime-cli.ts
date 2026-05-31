import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { defineCommand } from "just-bash";

import { createRootWorkspaceHelpcenterCommand } from "./cli-command-catalog";
import { createNoteCommand } from "./note-system";
import {
  projectWorkspaceSystemClis,
  type SystemCliCommandName,
  type SystemCliProjection,
} from "./system-cli-projection";
import {
  AVATAR_HOME_ENV,
  SKILLS_HOME_ENV,
  deriveEnvSkillsHome,
  serializeEnvAvatarHome,
  serializeEnvSkillsHome,
} from "./workspace-system";
import { buildRuntimeSkillsList } from "./runtime-skills";
import {
  getRuntimeToolDescriptor,
  listRuntimeToolDescriptors,
  parseRuntimeToolCliInput,
  renderRuntimeNamespaceHelp,
  renderRuntimeToolHelp,
  type RuntimeToolNamespace,
} from "./runtime-tool-descriptors";
import { buildRuntimeToolExecCommand } from "./runtime-tool-exec";
import type {
  RuntimeSkillConfigInfoView,
  RuntimeSkillInfoView,
  RuntimeSkillMutationView,
  RuntimeSkillView,
} from "./runtime-tool-views";
import {
  getBuiltinRuntimeToolDescriptor,
  listRuntimeToolFiles,
  materializeBuiltinRuntimeTools,
  renderBuiltinRuntimeToolHelp,
} from "./runtime-tools";

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
const isHelpArg = (value: string): boolean => value === "--help";
const isCompactArg = (value: string): boolean => value === "--compact";

const parseRuntimeSubcommandArgs = (args: readonly string[]) => {
  let helpRequested = false;
  let compactMode = false;
  const payloadArgs: string[] = [];
  for (const arg of args) {
    if (isHelpArg(arg)) {
      helpRequested = true;
      continue;
    }
    if (isCompactArg(arg)) {
      compactMode = true;
      continue;
    }
    payloadArgs.push(arg);
  }
  return { helpRequested, compactMode, payloadArgs };
};

const renderToolNamespaceHelp = (toolFiles: readonly string[]): string =>
  [
    "tool <file>",
    "",
    "Description: Run helper scripts from ~/tools using JSON payloads or script-specific help.",
    "",
    "Quick start:",
    "- `ls ~/tools`",
    "- `tool <file> --help`",
    '- `tool <file> \'{"key":"value"}\'`',
    "- `cat <<'EOF' | tool <file>`",
    "  {",
    '    "key": "value"',
    "  }",
    "  EOF",
    "",
    toolFiles.length > 0 ? `Available files: ${toolFiles.join(", ")}` : "Available files: none",
    "",
  ].join("\n");

const renderSkillNamespaceHelp = (): string =>
  [
    "skill",
    "",
    "Description: Discover or mutate runtime-visible skills.",
    "",
    "Quick start:",
    "- `skill list`",
    "- `skill search terminal`",
    "- `skill info agenter-runtime`",
    "- `skill get-config agenter-runtime builtin`",
    "- `skill upsert --help`",
    "- `skill set-config --help`",
    "- `skill remove --help`",
    "- `skill refresh`",
    "",
    "Use `skill <subcommand> --help` to inspect exact usage.",
    "",
  ].join("\n");

const renderSkillSubcommandHelp = (subcommand: string): string | null => {
  if (subcommand === "list") {
    return [
      "skill list [--json]",
      "",
      "List runtime-visible skills from the current workspace `SKILLS_HOME` source order plus built-ins.",
      "",
    ].join("\n");
  }
  if (subcommand === "search") {
    return [
      "skill search <query> [--json]",
      "",
      "Search runtime-visible skills by name, summary, or `SKILLS_HOME` source path.",
      "",
    ].join("\n");
  }
  if (subcommand === "info") {
    return [
      "skill info <skill-name> [root-kind] [--json]",
      "",
      "Read one runtime-visible skill and print its rendered content plus the source filesystem path.",
      "",
    ].join("\n");
  }
  if (subcommand === "get-config") {
    return [
      "skill get-config <skill-name> [root-kind] [--json]",
      "",
      "Read one skill's ccski.config.json metadata, config path, and resolved watch targets.",
      "",
    ].join("\n");
  }
  return null;
};

const renderSkillInfo = (result: RuntimeSkillInfoView): string =>
  [
    `# ${result.skill.name}`,
    "",
    `Root kind: ${result.skill.rootKind}`,
    `Source root: ${result.skill.root}`,
    `Path: ${result.skill.path}`,
    `Writable: ${result.skill.writable ? "yes" : "no"}`,
    "",
    result.content,
  ].join("\n");

const renderSkillConfigInfo = (result: RuntimeSkillConfigInfoView): string =>
  [
    `# ${result.skill.name}`,
    "",
    `Root kind: ${result.skill.rootKind}`,
    `Writable: ${result.writable ? "yes" : "no"}`,
    `Skill dir: ${result.skillDir}`,
    `Skill path: ${result.skillPath}`,
    `Config path: ${result.configPath}`,
    `Config exists: ${result.configExists ? "yes" : "no"}`,
    "",
    "Config:",
    JSON.stringify(result.config ?? {}, null, 2),
    result.configError ? `\nConfig error: ${result.configError}` : "",
    "",
    "Resolved watch targets:",
    ...(result.resolvedWatchTargets.length > 0 ? result.resolvedWatchTargets.map((item) => `- ${item}`) : ["- none"]),
  ]
    .filter((line) => line !== "")
    .join("\n");

const callRuntimeApi = async <TResult>(input: {
  baseUrl: string;
  privateKey: string;
  route: string;
  body?: unknown;
  signal?: AbortSignal;
}): Promise<TResult> => {
  const response = await fetch(`${input.baseUrl}${input.route}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-agenter-principal-key": input.privateKey,
    },
    body: JSON.stringify(input.body ?? {}),
    signal: input.signal,
  });
  const payload = (await response.json()) as { ok: boolean; error?: string } & Record<string, unknown>;
  if (!response.ok || payload.ok !== true) {
    throw new Error(payload.error ?? `runtime api request failed: ${input.route}`);
  }
  return payload as TResult;
};

const resolveToolRunner = (filePath: string): "bash" | "sh" | "python3" | "js-exec" => {
  if (!existsSync(filePath)) {
    throw new Error(`tool file not found: ${filePath}`);
  }
  const firstLine = readFileSync(filePath, "utf8").split(/\r?\n/u, 1)[0] ?? "";
  if (firstLine.includes("python")) {
    return "python3";
  }
  if (firstLine.includes("node") || firstLine.includes("bun") || firstLine.includes("deno")) {
    return "js-exec";
  }
  if (firstLine.includes("sh")) {
    return "sh";
  }
  if (/\.(mjs|cjs|js|ts)$/u.test(filePath)) {
    return "js-exec";
  }
  if (/\.(py)$/u.test(filePath)) {
    return "python3";
  }
  return "bash";
};

const createRuntimeNamespaceCommand = (input: {
  namespace: RuntimeToolNamespace;
  baseUrl: string;
  privateKey: string;
}) =>
  defineCommand(input.namespace, async (args, ctx) => {
    try {
      const [subcommand, ...rest] = args;
      if (!subcommand || isHelpArg(subcommand)) {
        return {
          stdout: renderRuntimeNamespaceHelp(input.namespace),
          stderr: "",
          exitCode: 0,
        };
      }
      const descriptor = getRuntimeToolDescriptor(input.namespace, subcommand);
      if (!descriptor) {
        return {
          stdout: "",
          stderr: `unknown ${input.namespace} subcommand: ${subcommand}\n`,
          exitCode: 1,
        };
      }
      const { helpRequested, compactMode, payloadArgs } = parseRuntimeSubcommandArgs(rest);
      if (helpRequested) {
        return {
          stdout: renderRuntimeToolHelp(descriptor),
          stderr: "",
          exitCode: 0,
        };
      }
      const body = parseRuntimeToolCliInput(
        descriptor,
        payloadArgs.filter((item) => item !== "--json"),
        ctx.stdin,
        compactMode ? "compact" : "object",
      );
      return {
        stdout: json(
          await callRuntimeApi({
            baseUrl: input.baseUrl,
            privateKey: input.privateKey,
            route: descriptor.route,
            body,
            signal: ctx.signal,
          }),
        ),
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

const createSkillCommand = (input: { baseUrl: string; privateKey: string }) =>
  defineCommand("skill", async (args, ctx) => {
    try {
      const [subcommand = "list", ...rest] = args;
      if (!subcommand || isHelpArg(subcommand)) {
        return {
          stdout: renderSkillNamespaceHelp(),
          stderr: "",
          exitCode: 0,
        };
      }

      const descriptor = getRuntimeToolDescriptor("skill", subcommand);
      const { helpRequested, compactMode, payloadArgs } = parseRuntimeSubcommandArgs(rest);
      const jsonMode = rest.includes("--json");
      const normalizedRest = rest.filter((item) => item !== "--json" && item !== "--compact" && item !== "--help");

      if (helpRequested) {
        const customHelp = renderSkillSubcommandHelp(subcommand);
        if (customHelp) {
          return {
            stdout: customHelp,
            stderr: "",
            exitCode: 0,
          };
        }
        if (descriptor) {
          return {
            stdout: renderRuntimeToolHelp(descriptor),
            stderr: "",
            exitCode: 0,
          };
        }
      }

      if (subcommand === "list") {
        const payload = await callRuntimeApi<{ skills: RuntimeSkillView[] }>({
          baseUrl: input.baseUrl,
          privateKey: input.privateKey,
          route: "/v1/skill/list",
        });
        return {
          stdout: jsonMode ? json(payload.skills) : `${buildRuntimeSkillsList(payload.skills)}\n`,
          stderr: "",
          exitCode: 0,
        };
      }

      if (subcommand === "search") {
        const payload = await callRuntimeApi<{ skills: RuntimeSkillView[] }>({
          baseUrl: input.baseUrl,
          privateKey: input.privateKey,
          route: "/v1/skill/search",
          body: {
            query: normalizedRest.join(" "),
          },
        });
        return {
          stdout: jsonMode ? json(payload.skills) : `${buildRuntimeSkillsList(payload.skills)}\n`,
          stderr: "",
          exitCode: 0,
        };
      }

      if (subcommand === "info") {
        const [name, rootKind] = normalizedRest;
        if (!name) {
          throw new Error("skill info requires <skill-name>");
        }
        const payload = await callRuntimeApi<{ result: RuntimeSkillInfoView }>({
          baseUrl: input.baseUrl,
          privateKey: input.privateKey,
          route: "/v1/skill/info",
          body: rootKind ? { name, rootKind } : { name },
        });
        return {
          stdout: jsonMode ? json(payload.result) : renderSkillInfo(payload.result),
          stderr: "",
          exitCode: 0,
        };
      }

      if (subcommand === "get-config") {
        const [name, rootKind] = normalizedRest;
        if (!name) {
          throw new Error("skill get-config requires <skill-name>");
        }
        const payload = await callRuntimeApi<{ result: RuntimeSkillConfigInfoView }>({
          baseUrl: input.baseUrl,
          privateKey: input.privateKey,
          route: "/v1/skill/get-config",
          body: rootKind ? { name, rootKind } : { name },
        });
        return {
          stdout: jsonMode ? json(payload.result) : `${renderSkillConfigInfo(payload.result)}\n`,
          stderr: "",
          exitCode: 0,
        };
      }

      if (!descriptor) {
        return {
          stdout: "",
          stderr: `unknown skill subcommand: ${subcommand}\n`,
          exitCode: 1,
        };
      }

      const body = parseRuntimeToolCliInput(descriptor, payloadArgs, ctx.stdin, compactMode ? "compact" : "object");
      return {
        stdout: json(
          await callRuntimeApi<{ result: RuntimeSkillMutationView }>({
            baseUrl: input.baseUrl,
            privateKey: input.privateKey,
            route: descriptor.route,
            body,
          }),
        ),
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

export const createRuntimeShellCommands = (input: {
  baseUrl: string;
  managedSeatAuthorityUrl?: string;
  privateKey: string;
  homeDir?: string;
  rootWorkspacePath: string;
  principalId?: string;
  cliProjections?: readonly SystemCliProjection[];
}) => {
  materializeBuiltinRuntimeTools({
    rootWorkspacePath: input.rootWorkspacePath,
    homeDir: input.homeDir,
  });
  const runtimeNamespaces = (
    ["attention", "message", "message-manage", "workspace", "terminal", "terminal-manage", "mcp"] as const
  ).map((namespace) =>
    createRuntimeNamespaceCommand({
      namespace,
      baseUrl: input.baseUrl,
      privateKey: input.privateKey,
    }),
  );
  const cliProjections =
    input.cliProjections ??
    projectWorkspaceSystemClis({
      workspacePath: input.rootWorkspacePath,
      workspaceAlias: "root",
      defaultCwd: input.rootWorkspacePath,
      env: {
        [AVATAR_HOME_ENV]: serializeEnvAvatarHome([input.rootWorkspacePath]),
        [SKILLS_HOME_ENV]: serializeEnvSkillsHome(
          deriveEnvSkillsHome({
            pwd: input.rootWorkspacePath,
            avatarHome: [input.rootWorkspacePath],
          }),
        ),
      },
    });
  const hasProjectedCommand = (command: SystemCliCommandName): boolean =>
    cliProjections.some((projection) => projection.command === command);
  const skill = createSkillCommand({
    baseUrl: input.baseUrl,
    privateKey: input.privateKey,
  });
  const note = createNoteCommand();
  const helpcenter = createRootWorkspaceHelpcenterCommand();

  const tool = defineCommand("tool", async (args, ctx) => {
    try {
      const toolFiles = listRuntimeToolFiles({
        rootWorkspacePath: input.rootWorkspacePath,
        homeDir: input.homeDir,
      });
      const [fileName, ...rest] = args;
      if (!fileName || isHelpArg(fileName)) {
        return {
          stdout: `${renderToolNamespaceHelp(toolFiles)}\n`,
          stderr: "",
          exitCode: 0,
        };
      }
      const builtinDescriptor = getBuiltinRuntimeToolDescriptor(fileName);
      if (rest.length === 1 && isHelpArg(rest[0]!)) {
        if (builtinDescriptor) {
          return {
            stdout: `${renderBuiltinRuntimeToolHelp(builtinDescriptor)}\n`,
            stderr: "",
            exitCode: 0,
          };
        }
      }
      const toolPath = join(input.rootWorkspacePath, "tools", fileName);
      const runner = resolveToolRunner(toolPath);
      if (!ctx.exec) {
        throw new Error("tool execution is unavailable in this shell");
      }
      const command = buildRuntimeToolExecCommand({
        runner,
        filePath: toolPath,
        args: rest,
      });
      return await ctx.exec(command, {
        cwd: ctx.cwd,
        env: Object.fromEntries(ctx.env.entries()),
        stdin: ctx.stdin,
        signal: ctx.signal,
      });
    } catch (error) {
      return { stdout: "", stderr: `${error instanceof Error ? error.message : String(error)}\n`, exitCode: 1 };
    }
  });

  return [
    ...runtimeNamespaces,
    ...(hasProjectedCommand("skill") ? [skill] : []),
    ...(hasProjectedCommand("note") ? [note] : []),
    helpcenter,
    tool,
  ];
};

export const listRuntimeShellCommandNames = (): string[] => [
  ...new Set([...listRuntimeToolDescriptors().map((descriptor) => descriptor.namespace), "note", "helpcenter", "tool"]),
];
