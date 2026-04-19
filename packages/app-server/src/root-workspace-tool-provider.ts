import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";

import type { AgentToolProvider } from "./agenter-ai";
import {
  getRuntimeToolDescriptor,
  parseRuntimeToolCliInput,
  type RuntimeLocalApiHandlers,
  type RuntimeToolNamespace,
} from "./runtime-tool-descriptors";
import type { RuntimeWorkspaceSurface } from "./runtime-tool-views";

export type RootWorkspaceToolListPayload = Record<string, unknown> & {
  rootWorkspace: {
    path: string;
    commandNames: string[];
    toolNames: string[];
    skillRoots: string[];
  };
  attentionApi: {
    baseUrl: string;
    principalId: string | null;
  } | null;
  workspaces: RuntimeWorkspaceSurface[];
};

export interface InProcessRootWorkspaceToolProviderInput {
  handlers: RuntimeLocalApiHandlers;
  list: () => RootWorkspaceToolListPayload;
}

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

const splitShellWords = (value: string): string[] => {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let escaped = false;
  for (const char of value) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (quote === "'") {
      if (char === "'") {
        quote = null;
        continue;
      }
      current += char;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (quote === '"') {
      if (char === '"') {
        quote = null;
        continue;
      }
      current += char;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (/\s/u.test(char)) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (escaped) {
    current += "\\";
  }
  if (quote !== null) {
    throw new Error("unterminated quoted shell command");
  }
  if (current.length > 0) {
    tokens.push(current);
  }
  return tokens;
};

const isRuntimeNamespace = (value: string): value is RuntimeToolNamespace =>
  value === "attention" || value === "message" || value === "workspace" || value === "terminal";

const executeInProcessRootWorkspaceCommand = async (input: {
  command: string;
  stdin?: string;
  cwd?: string;
  handlers: RuntimeLocalApiHandlers;
  rootWorkspacePath: string;
}): Promise<{ stdout: string; stderr: string; exitCode: number; cwd: string }> => {
  try {
    const tokens = splitShellWords(input.command.trim());
    const [namespaceName, toolName, ...rest] = tokens;
    if (!namespaceName || !toolName) {
      throw new Error("root_workspace_bash requires a runtime CLI command");
    }
    if (!isRuntimeNamespace(namespaceName)) {
      throw new Error(`unsupported root workspace command: ${namespaceName}`);
    }
    const descriptor = getRuntimeToolDescriptor(namespaceName, toolName);
    if (!descriptor) {
      throw new Error(`unknown ${namespaceName} subcommand: ${toolName}`);
    }
    const { helpRequested, compactMode, payloadArgs } = parseRuntimeSubcommandArgs(rest);
    if (helpRequested) {
      throw new Error("in-process root workspace helper does not support --help");
    }
    const body = parseRuntimeToolCliInput(descriptor, payloadArgs, input.stdin ?? "", compactMode ? "compact" : "object");
    const result = await descriptor.handler(body, input.handlers);
    return {
      stdout: `${JSON.stringify({ ok: true, ...result }, null, 2)}\n`,
      stderr: "",
      exitCode: 0,
      cwd: input.cwd ?? input.rootWorkspacePath,
    };
  } catch (error) {
    return {
      stdout: "",
      stderr: `${error instanceof Error ? error.message : String(error)}\n`,
      exitCode: 1,
      cwd: input.cwd ?? input.rootWorkspacePath,
    };
  }
};

export const createInProcessRootWorkspaceToolProvider = (
  input: InProcessRootWorkspaceToolProviderInput,
): AgentToolProvider => ({
  name: "root-workspace",
  createTools: ({ traceTool }) => {
    const traceWithContext = <TInput, TOutput>(
      toolName: string,
      toolInput: TInput,
      handler: () => Promise<TOutput>,
      context?: { toolCallId?: string },
    ): Promise<TOutput> => traceTool(toolName, toolInput, handler, { invocationId: context?.toolCallId });

    const listTool = toolDefinition({
      name: "root_workspace_list",
      description: "List the fixed avatar root workspace, mounted workspaces, grants, and shell commands.",
      outputSchema: z.record(z.string(), z.unknown()),
    }).server(async (_rawInput, context) =>
      traceWithContext(
        "root_workspace_list",
        {},
        async () => input.list(),
        context,
      ),
    );

    const bashTool = toolDefinition({
      name: "root_workspace_bash",
      description: "Execute runtime CLI commands inside the fixed avatar root workspace.",
      inputSchema: z.object({
        command: z.string(),
        cwd: z.string().optional(),
        env: z.record(z.string(), z.string()).optional(),
        stdin: z.string().optional(),
      }),
      outputSchema: z.object({
        stdout: z.string(),
        stderr: z.string(),
        exitCode: z.number(),
        cwd: z.string(),
      }),
    }).server(async (rawInput, context) => {
      const parsed = z
        .object({
          command: z.string(),
          cwd: z.string().optional(),
          env: z.record(z.string(), z.string()).optional(),
          stdin: z.string().optional(),
        })
        .parse(rawInput);
      return await traceWithContext(
        "root_workspace_bash",
        parsed,
        async () =>
          await executeInProcessRootWorkspaceCommand({
            command: parsed.command,
            stdin: parsed.stdin,
            cwd: parsed.cwd,
            handlers: input.handlers,
            rootWorkspacePath: input.list().rootWorkspace.path,
          }),
        context,
      );
    });

    return [listTool, bashTool];
  },
});
