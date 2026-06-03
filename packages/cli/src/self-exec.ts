import { existsSync } from "node:fs";
import { resolve } from "node:path";

export interface CurrentCliRuntimeOptions {
  argv?: readonly string[];
  bunExecutable?: string | null;
  cliEntryPath: string;
  execPath?: string;
  importMetaUrl?: string;
}

const BUN_COMPILED_FS_MARKER = "/$bunfs/";

export const isBunCompiledExecutable = (importMetaUrl = import.meta.url): boolean =>
  importMetaUrl.includes(BUN_COMPILED_FS_MARKER);

export const resolveCurrentLauncherEntrypoint = (options: CurrentCliRuntimeOptions): string => {
  // Bun compiled executables replace argv[1] with a bunfs virtual module path,
  // so the native executable path must come from process.execPath instead.
  if (isBunCompiledExecutable(options.importMetaUrl)) {
    return resolve(options.execPath ?? process.execPath);
  }
  const entrypoint = options.argv?.[1];
  if (entrypoint && existsSync(entrypoint)) {
    return resolve(entrypoint);
  }
  return resolve(options.cliEntryPath);
};

export const resolveCurrentLauncherSourceKind = (
  entrypoint: string,
  options: Pick<CurrentCliRuntimeOptions, "importMetaUrl"> = {},
): "package" | "workspace" => {
  if (isBunCompiledExecutable(options.importMetaUrl)) {
    return "package";
  }
  return entrypoint.includes("/node_modules/") ? "package" : "workspace";
};

export const resolveCurrentCliEntrypointArgv = (options: CurrentCliRuntimeOptions): string[] => {
  if (isBunCompiledExecutable(options.importMetaUrl)) {
    return [];
  }
  const entrypoint = options.argv?.[1];
  if (entrypoint && existsSync(entrypoint)) {
    return [resolve(entrypoint)];
  }
  return ["run", resolve(options.cliEntryPath)];
};

export const resolveCurrentSelfExec = (
  options: CurrentCliRuntimeOptions,
): { command: string; argvPrefix: string[] } => {
  if (isBunCompiledExecutable(options.importMetaUrl)) {
    return {
      command: resolve(options.execPath ?? process.execPath),
      argvPrefix: [],
    };
  }
  return {
    command: options.bunExecutable ?? options.execPath ?? process.execPath,
    argvPrefix: resolveCurrentCliEntrypointArgv(options),
  };
};
