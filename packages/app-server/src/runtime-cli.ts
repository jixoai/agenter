import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { defineCommand } from "just-bash";

import { buildRuntimeToolExecCommand } from "./runtime-tool-exec";
import {
  getRuntimeToolDescriptor,
  listRuntimeToolDescriptors,
  parseRuntimeToolCliInput,
  renderRuntimeNamespaceHelp,
  renderRuntimeToolHelp,
  type RuntimeToolNamespace,
} from "./runtime-tool-descriptors";
import {
  buildRuntimeSkillsList,
  findRuntimeSkill,
  listRuntimeSkills,
  readRuntimeSkillContent,
  type RuntimeSkillRecord,
} from "./runtime-skills";
import {
  getBuiltinRuntimeToolDescriptor,
  listRuntimeToolFiles,
  materializeBuiltinRuntimeTools,
  renderBuiltinRuntimeToolHelp,
} from "./runtime-tools";

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
const isHelpArg = (value: string): boolean => value === "--help";
const renderToolNamespaceHelp = (toolFiles: readonly string[]): string =>
  [
    "tool <file>",
    "",
    "Description: Run helper scripts from ~/tools using JSON payloads or script-specific help.",
    "",
    "Quick start:",
    "- `ls ~/tools`",
    "- `tool <file> --help`",
    "- `tool <file> '{\"key\":\"value\"}'`",
    "- `cat <<'EOF' | tool <file>`",
    "  {",
    '    "key": "value"',
    "  }",
    "  EOF",
    "",
    toolFiles.length > 0 ? `Available files: ${toolFiles.join(", ")}` : "Available files: none",
    "",
  ].join("\n");

const callRuntimeApi = async <TResult>(input: {
  baseUrl: string;
  privateKey: string;
  route: string;
  body?: unknown;
}): Promise<TResult> => {
  const response = await fetch(`${input.baseUrl}${input.route}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-agenter-principal-key": input.privateKey,
    },
    body: JSON.stringify(input.body ?? {}),
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

const findSkillByName = (skills: readonly RuntimeSkillRecord[], name: string): RuntimeSkillRecord | null => {
  const normalized = name.trim().toLowerCase();
  return skills.find((skill) => skill.name === normalized || skill.path === name.trim()) ?? null;
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
      if (rest.length === 1 && isHelpArg(rest[0]!)) {
        return {
          stdout: renderRuntimeToolHelp(descriptor),
          stderr: "",
          exitCode: 0,
        };
      }
      const body = parseRuntimeToolCliInput(descriptor, rest, ctx.stdin);
      return {
        stdout: json(
          await callRuntimeApi({
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
  privateKey: string;
  homeDir?: string;
  rootWorkspacePath: string;
  principalId?: string;
}) => {
  materializeBuiltinRuntimeTools({
    rootWorkspacePath: input.rootWorkspacePath,
    homeDir: input.homeDir,
  });
  const runtimeNamespaces = (["attention", "message", "workspace", "terminal"] as const).map((namespace) =>
    createRuntimeNamespaceCommand({
      namespace,
      baseUrl: input.baseUrl,
      privateKey: input.privateKey,
    }),
  );

  const ccski = defineCommand("ccski", async (args) => {
    try {
      const [subcommand = "list", ...rest] = args;
      const skills = listRuntimeSkills({
        homeDir: input.homeDir,
        rootWorkspacePath: input.rootWorkspacePath,
        principalId: input.principalId,
      });
      const jsonMode = rest.includes("--json");
      const normalizedRest = rest.filter((item) => item !== "--json");
      if (subcommand === "list") {
        if (jsonMode) {
          return { stdout: json(skills), stderr: "", exitCode: 0 };
        }
        return {
          stdout: `${buildRuntimeSkillsList(skills)}\n`,
          stderr: "",
          exitCode: 0,
        };
      }
      if (subcommand === "search") {
        const query = normalizedRest.join(" ");
        const matched = findRuntimeSkill({
          homeDir: input.homeDir,
          rootWorkspacePath: input.rootWorkspacePath,
          principalId: input.principalId,
          query,
        });
        if (jsonMode) {
          return { stdout: json(matched), stderr: "", exitCode: 0 };
        }
        return {
          stdout: `${buildRuntimeSkillsList(matched)}\n`,
          stderr: "",
          exitCode: 0,
        };
      }
      if (subcommand === "info") {
        const name = normalizedRest[0];
        if (!name) {
          throw new Error("ccski info requires <skill-name>");
        }
        const skill = findSkillByName(skills, name);
        if (!skill) {
          throw new Error(`skill not found: ${name}`);
        }
        if (jsonMode) {
          return {
            stdout: json({
              ...skill,
              content: readRuntimeSkillContent(skill),
            }),
            stderr: "",
            exitCode: 0,
          };
        }
        return {
          stdout: [`# ${skill.name}`, "", `Path: ${skill.path}`, "", readRuntimeSkillContent(skill)].join("\n"),
          stderr: "",
          exitCode: 0,
        };
      }
      return { stdout: "", stderr: `unknown ccski subcommand: ${subcommand}\n`, exitCode: 1 };
    } catch (error) {
      return { stdout: "", stderr: `${error instanceof Error ? error.message : String(error)}\n`, exitCode: 1 };
    }
  });

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

  return [...runtimeNamespaces, ccski, tool];
};

export const listRuntimeShellCommandNames = (): string[] => [
  ...new Set([
    ...listRuntimeToolDescriptors().map((descriptor) => descriptor.namespace),
    "ccski",
    "tool",
  ]),
];
