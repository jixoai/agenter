#!/usr/bin/env bun
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

interface ScaffoldArgs {
  appId?: string;
  command?: string;
  packageName?: string;
  agenterRange?: string;
  target?: string;
  repoRoot?: string;
  repo: boolean;
  force: boolean;
}

interface GeneratedPackageJson {
  name: string;
  version: string;
  type: "module";
  files: string[];
  bin: Record<string, string>;
  exports: Record<string, string>;
  scripts: Record<string, string>;
  keywords: string[];
  peerDependencies: Record<"agenter", string>;
  engines: Record<"bun", string>;
  publishConfig: Record<"access", "public">;
  agenter: {
    app: {
      appId: string;
      command: string;
      bin: string;
      descriptor: string;
    };
  };
}

const parseArgs = (argv: readonly string[]): ScaffoldArgs => {
  const args: ScaffoldArgs = { repo: false, force: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = (): string => {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(`${token} requires a value`);
      }
      index += 1;
      return value;
    };
    if (token === "--repo") args.repo = true;
    else if (token === "--force") args.force = true;
    else if (token === "--target") args.target = next();
    else if (token === "--repo-root") args.repoRoot = next();
    else if (token === "--app-id") args.appId = next();
    else if (token === "--command") args.command = next();
    else if (token === "--package-name") args.packageName = next();
    else if (token === "--agenter-range") args.agenterRange = next();
    else throw new Error(`unknown argument: ${token}`);
  }
  return args;
};

const requireText = (value: string | undefined, name: string): string => {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`${name} is required`);
  }
  return trimmed;
};

const assertKebab = (value: string, name: string): void => {
  if (!/^[a-z0-9][a-z0-9-]*$/u.test(value)) {
    throw new Error(`${name} must be kebab-case`);
  }
};

const assertPackageName = (value: string): void => {
  if (!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u.test(value)) {
    throw new Error("package-name must be a valid lowercase npm package name");
  }
};

const toPascalCase = (value: string): string =>
  value
    .split("-")
    .filter((part) => part.length > 0)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join("");

const jsonString = (value: string): string => JSON.stringify(value);

const resolveTarget = (args: ScaffoldArgs, appId: string): string => {
  if (args.target?.trim()) {
    return resolve(args.target);
  }
  if (args.repo) {
    // Repo mode is the only mode that assumes Agenter's first-party apps/* layout.
    return resolve(args.repoRoot?.trim() || process.cwd(), "apps", appId);
  }
  return resolve(process.cwd());
};

const writeText = async (path: string, content: string): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
};

const scaffold = async (args: ScaffoldArgs): Promise<string> => {
  const appId = requireText(args.appId, "--app-id");
  const command = requireText(args.command, "--command");
  const packageName = requireText(args.packageName, "--package-name");
  const agenterRange = requireText(args.agenterRange, "--agenter-range");
  assertKebab(appId, "--app-id");
  assertKebab(command, "--command");
  assertPackageName(packageName);

  const target = resolveTarget(args, appId);
  const packageJsonPath = join(target, "package.json");
  if (existsSync(packageJsonPath) && !args.force) {
    throw new Error(`target already contains package.json: ${packageJsonPath}; pass --force to overwrite scaffold files`);
  }

  const binName = `agenter-${command}`;
  const runnerName = `run${toPascalCase(command)}App`;
  const packageJson: GeneratedPackageJson = {
    name: packageName,
    version: "0.0.0",
    type: "module",
    files: ["src"],
    bin: {
      [binName]: `./src/bin/${binName}.ts`,
    },
    exports: {
      ".": "./src/index.ts",
      "./package.json": "./package.json",
    },
    scripts: {
      test: "bun test",
      typecheck: "bunx tsc --noEmit",
    },
    keywords: ["agenter-app"],
    peerDependencies: {
      agenter: agenterRange,
    },
    engines: {
      bun: ">=1.3.10",
    },
    publishConfig: {
      access: "public",
    },
    agenter: {
      app: {
        appId,
        command,
        bin: binName,
        descriptor: "./src/app.ts",
      },
    },
  };

  await writeText(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
  await writeText(
    join(target, "src", "app.ts"),
    [
      "export const appDescriptor = {",
      `  appId: ${jsonString(appId)},`,
      `  command: ${jsonString(command)},`,
      `  packageName: ${jsonString(packageName)},`,
      "  bin: {",
      `    name: ${jsonString(binName)},`,
      `    path: ${jsonString(`./src/bin/${binName}.ts`)},`,
      `    mainExport: ${jsonString(runnerName)},`,
      "  },",
      "  sourcePolicy: {",
      '    resolutionOrder: ["workspace", "installed", "remote"],',
      "    allowWorkspace: true,",
      "    allowInstalled: true,",
      "    allowRemote: true,",
      "  },",
      "  capabilityHints: {",
      "    interactive: true,",
      "    foregroundProcess: true,",
      "    requiresDaemon: true,",
      '    runtimePlanes: ["launch", "resources", "assistant", "attention"],',
      "  },",
      "} as const;",
      "",
      `export const ${runnerName} = async (argv: readonly string[] = process.argv.slice(2)): Promise<void> => {`,
      `  console.log(${jsonString(`${packageName} received argv:`)}, argv.join(" "));`,
      "};",
      "",
    ].join("\n"),
  );
  await writeText(
    join(target, "src", "bin", `${binName}.ts`),
    ["#!/usr/bin/env bun", `import { ${runnerName} } from "../app";`, "", `await ${runnerName}(process.argv.slice(2));`, ""].join(
      "\n",
    ),
  );
  await writeText(join(target, "src", "index.ts"), 'export { appDescriptor } from "./app";\n');
  return target;
};

try {
  const target = await scaffold(parseArgs(process.argv.slice(2)));
  console.log(`created Agenter app scaffold at ${target}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
