import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import { buildPromptDocsFromDir, promptDocRecordSchema, type PromptDocRecord } from "@agenter/i18n-core";
import { PROMPTS as EN_PROMPTS } from "@agenter/i18n-en";

type RuntimeMode = "dev" | "prod";

interface LanguagePackageConfig {
  lang: string;
  packageName: string;
  workspaceDirName: string;
}

interface AppServerPackageMeta {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

interface LoadPromptDocsByLangOptions {
  lang?: string;
  homeDir?: string;
}

const APP_SERVER_PACKAGE_JSON_PATH = decodeURIComponent(new URL("../package.json", import.meta.url).pathname);
export const DEFAULT_LANGUAGE = "en";

const LANG_PACKAGES: Record<string, LanguagePackageConfig> = {
  en: {
    lang: "en",
    packageName: "@agenter/i18n-en",
    workspaceDirName: "i18n-en",
  },
  "zh-Hans": {
    lang: "zh-Hans",
    packageName: "@agenter/i18n-zh-hans",
    workspaceDirName: "i18n-zh-Hans",
  },
};

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const textDecoder = new TextDecoder();

const parseLangAlias = (value: string | undefined): string => {
  if (!value) {
    return DEFAULT_LANGUAGE;
  }
  const normalized = value.trim();
  if (normalized.length === 0) {
    return DEFAULT_LANGUAGE;
  }
  if (LANG_PACKAGES[normalized]) {
    return normalized;
  }
  const lowered = normalized.toLowerCase();
  if (lowered === "en" || lowered === "en-us") {
    return "en";
  }
  if (lowered === "zh-hans" || lowered === "zh-cn" || lowered === "zh_cn") {
    return "zh-Hans";
  }
  return DEFAULT_LANGUAGE;
};

const parseVersionMode = (versionSpec: string | undefined): RuntimeMode => {
  if (!versionSpec) {
    return "dev";
  }
  if (versionSpec.startsWith("workspace:")) {
    return "dev";
  }
  if (VERSION_PATTERN.test(versionSpec)) {
    return "prod";
  }
  return "dev";
};

const parsePromptRecord = (text: string): PromptDocRecord => {
  const parsed = JSON.parse(text) as unknown;
  return promptDocRecordSchema.parse(parsed);
};

const clonePromptDocs = (docs: PromptDocRecord): PromptDocRecord => ({
  AGENTER: { ...docs.AGENTER },
  AGENTER_SYSTEM: { ...docs.AGENTER_SYSTEM },
  SYSTEM_TEMPLATE: { ...docs.SYSTEM_TEMPLATE },
  RESPONSE_CONTRACT: { ...docs.RESPONSE_CONTRACT },
});

const loadAppServerPackageMeta = async (): Promise<AppServerPackageMeta> => {
  const text = await readFile(APP_SERVER_PACKAGE_JSON_PATH, "utf8");
  return JSON.parse(text) as AppServerPackageMeta;
};

const readWorkspacePrompts = async (config: LanguagePackageConfig): Promise<PromptDocRecord> => {
  const promptsDir = decodeURIComponent(new URL(`../../${config.workspaceDirName}/prompts`, import.meta.url).pathname);
  return buildPromptDocsFromDir(promptsDir);
};

const readCachedPrompts = async (cacheDir: string): Promise<PromptDocRecord | null> => {
  const promptsPath = join(cacheDir, "prompts.json");
  if (!(await Bun.file(promptsPath).exists())) {
    return null;
  }
  const text = await Bun.file(promptsPath).text();
  return parsePromptRecord(text);
};

const runSync = (cmd: string[], cwd: string): string => {
  const result = Bun.spawnSync(cmd, {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    const stderrText = textDecoder.decode(result.stderr).trim();
    throw new Error(`${cmd.join(" ")} failed: ${stderrText}`);
  }
  return textDecoder.decode(result.stdout).trim();
};

const fetchPromptsFromNpm = async (config: LanguagePackageConfig, version: string, cacheDir: string): Promise<PromptDocRecord> => {
  const cached = await readCachedPrompts(cacheDir);
  if (cached) {
    return cached;
  }

  await mkdir(cacheDir, { recursive: true });
  const tempRoot = await mkdtemp(join(tmpdir(), "agenter-i18n-"));

  try {
    const packed = runSync(["npm", "pack", `${config.packageName}@${version}`, "--silent"], tempRoot);
    const lines = packed
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const tarName = lines[lines.length - 1];
    if (!tarName) {
      throw new Error(`npm pack did not produce a tarball for ${config.packageName}@${version}`);
    }
    runSync(["tar", "-xzf", tarName], tempRoot);
    const sourcePrompts = join(tempRoot, "package", "prompts.json");
    const sourceUi = join(tempRoot, "package", "ui.json");
    const targetPrompts = join(cacheDir, "prompts.json");
    const targetUi = join(cacheDir, "ui.json");

    if (!(await Bun.file(sourcePrompts).exists())) {
      throw new Error(`prompts.json missing in ${config.packageName}@${version}`);
    }
    await copyFile(sourcePrompts, targetPrompts);
    if (await Bun.file(sourceUi).exists()) {
      await copyFile(sourceUi, targetUi);
    }

    const text = await Bun.file(targetPrompts).text();
    return parsePromptRecord(text);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
};

const fallbackToBuiltinEnglish = (): PromptDocRecord => promptDocRecordSchema.parse(EN_PROMPTS);

export const resolveLanguage = (lang: string | undefined): string => parseLangAlias(lang);

export const loadPromptDocsByLang = async (options: LoadPromptDocsByLangOptions = {}): Promise<PromptDocRecord> => {
  const resolvedLang = parseLangAlias(options.lang);
  const config = LANG_PACKAGES[resolvedLang] ?? LANG_PACKAGES[DEFAULT_LANGUAGE];
  const homeDir = options.homeDir ?? homedir();

  try {
    const appServerPackage = await loadAppServerPackageMeta();
    const peerVersion = appServerPackage.peerDependencies?.[config.packageName];
    const mode = parseVersionMode(peerVersion);
    if (mode === "dev") {
      return clonePromptDocs(await readWorkspacePrompts(config));
    }

    const prodVersion = peerVersion ?? appServerPackage.dependencies?.[config.packageName];
    if (!prodVersion || !VERSION_PATTERN.test(prodVersion)) {
      return clonePromptDocs(fallbackToBuiltinEnglish());
    }
    const cacheDir = join(homeDir, ".agenter", "i18n", `${config.lang}@${prodVersion}`);
    return clonePromptDocs(await fetchPromptsFromNpm(config, prodVersion, cacheDir));
  } catch {
    return clonePromptDocs(fallbackToBuiltinEnglish());
  }
};
