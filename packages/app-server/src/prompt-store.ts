import { extname, join } from "node:path";

import { PROMPTS as EN_PROMPTS } from "@agenter/i18n-en";
import { ResourceLoader } from "@agenter/settings";

import { type PromptDocKey, type PromptDocRecord, type PromptDocument, type PromptSyntax } from "./prompt-docs";
import { loadPromptDocsByLang } from "./i18n";
import { PromptBuilder, type PromptBuildContext } from "./prompt-builder";

export interface PromptSnapshot {
  docs: PromptDocRecord;
  loadedAt: number;
  source: "file";
}

export interface PromptStore {
  getSnapshot(): PromptSnapshot;
  getDocs(): PromptDocRecord;
  getDoc(key: PromptDocKey): PromptDocument;
  reload(): Promise<PromptSnapshot>;
  buildMd(document: PromptDocument, context?: PromptBuildContext): Promise<string>;
}

interface PromptStorePaths {
  rootDir?: string;
  agenterPath?: string;
  agenterSystemPath?: string;
  systemTemplatePath?: string;
  responseContractPath?: string;
  lang?: string;
  defaultDocs?: PromptDocRecord;
  loader?: ResourceLoader;
}

const URI_PATTERN = /^([a-z][a-z0-9+.-]*):/i;
const isUriLike = (value: string): boolean => URI_PATTERN.test(value);
const withTrailingSlash = (value: string): string => (value.endsWith("/") ? value : `${value}/`);

const joinRef = (base: string, target: string): string => {
  if (isUriLike(base)) {
    return new URL(target, withTrailingSlash(base)).toString();
  }
  return join(base, target);
};

const isMissingResourceError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return normalized.includes("enoent") || normalized.includes("not found") || normalized.includes("request failed (404)");
};

const detectSyntax = (pathLike: string | undefined, fallback: PromptSyntax): PromptSyntax => {
  if (!pathLike) {
    return fallback;
  }
  const extension = extname(pathLike).toLowerCase();
  if (extension === ".md") {
    return "md";
  }
  if (extension === ".mdx") {
    return "mdx";
  }
  return fallback;
};

const DEFAULT_BOOTSTRAP_DOCS: PromptDocRecord = {
  AGENTER: { ...EN_PROMPTS.AGENTER },
  AGENTER_SYSTEM: { ...EN_PROMPTS.AGENTER_SYSTEM },
  SYSTEM_TEMPLATE: { ...EN_PROMPTS.SYSTEM_TEMPLATE },
  RESPONSE_CONTRACT: { ...EN_PROMPTS.RESPONSE_CONTRACT },
};

const cloneDocs = (docs: PromptDocRecord): PromptDocRecord => ({
  AGENTER: { ...docs.AGENTER },
  AGENTER_SYSTEM: { ...docs.AGENTER_SYSTEM },
  SYSTEM_TEMPLATE: { ...docs.SYSTEM_TEMPLATE },
  RESPONSE_CONTRACT: { ...docs.RESPONSE_CONTRACT },
});

export class FilePromptStore implements PromptStore {
  private snapshot: PromptSnapshot = {
    docs: cloneDocs(DEFAULT_BOOTSTRAP_DOCS),
    loadedAt: Date.now(),
    source: "file",
  };
  private readonly loader: ResourceLoader;
  private readonly builder = new PromptBuilder();
  private loadedDefaultDocs: PromptDocRecord | null = null;

  constructor(private readonly paths: PromptStorePaths = {}) {
    this.loader =
      this.paths.loader ??
      new ResourceLoader({
        context: {
          projectRoot: process.cwd(),
          cwd: process.cwd(),
        },
      });
  }

  getSnapshot(): PromptSnapshot {
    return this.snapshot;
  }

  getDocs(): PromptDocRecord {
    return this.snapshot.docs;
  }

  getDoc(key: PromptDocKey): PromptDocument {
    return this.snapshot.docs[key];
  }

  async reload(): Promise<PromptSnapshot> {
    this.snapshot = await this.load();
    return this.snapshot;
  }

  async buildMd(document: PromptDocument, context: PromptBuildContext = {}): Promise<string> {
    return this.builder.buildMd(document, context);
  }

  private async load(): Promise<PromptSnapshot> {
    const rootDir = this.paths.rootDir;
    const sources: Record<PromptDocKey, string | undefined> = {
      AGENTER: this.paths.agenterPath ?? (rootDir ? joinRef(rootDir, "AGENTER.mdx") : undefined),
      AGENTER_SYSTEM: this.paths.agenterSystemPath ?? (rootDir ? joinRef(rootDir, "internal/AGENTER_SYSTEM.mdx") : undefined),
      SYSTEM_TEMPLATE: this.paths.systemTemplatePath ?? (rootDir ? joinRef(rootDir, "internal/SYSTEM_TEMPLATE.mdx") : undefined),
      RESPONSE_CONTRACT: this.paths.responseContractPath ?? (rootDir ? joinRef(rootDir, "internal/RESPONSE_CONTRACT.mdx") : undefined),
    };

    const docs = await this.loadDefaultDocs();
    for (const key of Object.keys(sources) as PromptDocKey[]) {
      const sourcePath = sources[key];
      const loaded = await this.readMaybe(sourcePath);
      if (loaded === undefined) {
        continue;
      }
      docs[key] = {
        syntax: detectSyntax(sourcePath, docs[key].syntax),
        content: loaded,
      };
    }

    return {
      docs,
      loadedAt: Date.now(),
      source: "file",
    };
  }

  private async readMaybe(path: string | undefined): Promise<string | undefined> {
    if (!path) {
      return undefined;
    }
    try {
      return await this.loader.readText(path);
    } catch (error) {
      if (isMissingResourceError(error)) {
        return undefined;
      }
      throw error;
    }
  }

  private async loadDefaultDocs(): Promise<PromptDocRecord> {
    if (this.paths.defaultDocs) {
      return cloneDocs(this.paths.defaultDocs);
    }
    if (!this.loadedDefaultDocs) {
      this.loadedDefaultDocs = await loadPromptDocsByLang({ lang: this.paths.lang });
    }
    return cloneDocs(this.loadedDefaultDocs);
  }
}
