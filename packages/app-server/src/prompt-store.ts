import { extname, isAbsolute, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { PROMPTS as EN_PROMPTS } from "@agenter/i18n-en";
import { ResourceLoader } from "@agenter/settings";

import { loadPromptDocsByLang } from "./i18n";
import { PromptBuilder, type PromptBuildContext } from "./prompt-builder";
import {
  type PromptDocKey,
  type PromptDocRecord,
  type PromptDocument,
  type PromptDocumentSource,
  type PromptSyntax,
} from "./prompt-docs";

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

export interface PromptRootLayer {
  publicRootDir?: string;
  privateRootDir?: string;
}

interface PromptStorePaths {
  rootDir?: string;
  publicRootDir?: string;
  privateRootDir?: string;
  globalRootDir?: string;
  promptLayers?: readonly PromptRootLayer[];
  agenterPath?: string;
  lang?: string;
  defaultDocs?: PromptDocRecord;
  loader?: ResourceLoader;
}

const URI_PATTERN = /^([a-z][a-z0-9+.-]*):/i;
const isUriLike = (value: string): boolean => URI_PATTERN.test(value);
const withTrailingSlash = (value: string): string => (value.endsWith("/") ? value : `${value}/`);
const stripLeadingSlash = (value: string): string => value.replace(/^\/+/u, "");
const stripQueryAndHash = (value: string): string => value.replace(/[?#].*$/u, "");

const joinRef = (base: string, target: string): string => {
  if (isUriLike(base)) {
    return new URL(target, withTrailingSlash(base)).toString();
  }
  return join(base, target);
};

const toFileUri = (path: string): string => pathToFileURL(path).toString();
const isFileUri = (value: string): boolean => value.startsWith("file://");
const toReadableFilePath = (value: string): string | null => {
  if (!isFileUri(value)) {
    return null;
  }
  return fileURLToPath(value);
};

const parseScheme = (uri: string): string => {
  const index = uri.indexOf(":");
  return index > 0 ? uri.slice(0, index).toLowerCase() : "file";
};

const toUri = (pathOrUri: string): string => (isUriLike(pathOrUri) ? pathOrUri : toFileUri(pathOrUri));

const toPathSource = (input: {
  pathOrUri: string;
  rootUri?: string;
  relativePath?: string;
  rootKind?: "private" | "public" | "global";
  privateRootUri?: string;
  publicRootUri?: string;
  globalRootUri?: string;
  superRootUri?: string;
  superUri?: string;
}): PromptDocumentSource => {
  const uri = toUri(input.pathOrUri);
  return {
    uri,
    scheme: parseScheme(uri),
    path: toReadableFilePath(uri) ?? (isUriLike(input.pathOrUri) ? undefined : input.pathOrUri),
    rootUri: input.rootUri,
    relativePath: input.relativePath,
    rootKind: input.rootKind,
    privateRootUri: input.privateRootUri,
    publicRootUri: input.publicRootUri,
    globalRootUri: input.globalRootUri,
    superRootUri: input.superRootUri,
    superUri: input.superUri,
  };
};

const isPathInsideRoot = (path: string, root: string): boolean => {
  const normalizedPath = resolve(path);
  const normalizedRoot = resolve(root);
  const rel = relative(normalizedRoot, normalizedPath);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
};

const safeRelativePath = (value: string): string => {
  const stripped = stripLeadingSlash(stripQueryAndHash(value)).trim();
  if (stripped.length === 0) {
    return "";
  }
  const normalized = normalize(stripped);
  if (normalized === "." || normalized.startsWith(`..${sep}`) || normalized === ".." || isAbsolute(normalized)) {
    return "";
  }
  return normalized.split(sep).join("/");
};

const relativeFromFileRoot = (path: string, root: string): string | null => {
  if (!isPathInsideRoot(path, root)) {
    return null;
  }
  const rel = relative(resolve(root), resolve(path));
  return rel.split(sep).join("/");
};

const rootToUri = (root: string): string => withTrailingSlash(isUriLike(root) ? root : pathToFileURL(root).toString());

const sameFileRoot = (left: string | undefined, right: string | undefined): boolean => {
  if (!left || !right) {
    return false;
  }
  return normalize(left) === normalize(right);
};

const resolveLangToken = (value: string, lang: string | undefined): string =>
  value.replace(/\$LANG|\$\{LANG\}/gu, lang ?? "en");

const isMissingResourceError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return (
    normalized.includes("enoent") || normalized.includes("not found") || normalized.includes("request failed (404)")
  );
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

const cloneDoc = (doc: PromptDocument): PromptDocument => ({
  ...doc,
  source: doc.source ? { ...doc.source } : undefined,
});

const cloneDocs = (docs: PromptDocRecord): PromptDocRecord => ({
  AGENTER: cloneDoc(docs.AGENTER),
  AGENTER_SYSTEM: cloneDoc(docs.AGENTER_SYSTEM),
  SYSTEM_TEMPLATE: cloneDoc(docs.SYSTEM_TEMPLATE),
  RESPONSE_CONTRACT: cloneDoc(docs.RESPONSE_CONTRACT),
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
    return this.builder.buildMd(document, {
      ...context,
      readSlot: context.readSlot ?? ((input) => this.readSlot(input, context)),
    });
  }

  private async load(): Promise<PromptSnapshot> {
    const rootDir = this.paths.rootDir;
    const sources: Record<PromptDocKey, string | undefined> = {
      AGENTER: this.paths.agenterPath ?? (rootDir ? joinRef(rootDir, "AGENTER.mdx") : undefined),
      AGENTER_SYSTEM: undefined,
      SYSTEM_TEMPLATE: undefined,
      RESPONSE_CONTRACT: undefined,
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
        source: this.toDocumentSource(sourcePath, key),
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

  private toDocumentSource(pathOrUri: string | undefined, key: PromptDocKey): PromptDocumentSource | undefined {
    if (!pathOrUri) {
      return undefined;
    }
    const uri = toUri(pathOrUri);
    const filePath = toReadableFilePath(uri);
    const layers = this.getPromptLayers();
    if (filePath) {
      for (let index = layers.length - 1; index >= 0; index -= 1) {
        const layer = layers[index];
        if (layer?.privateRootDir) {
          const rel = relativeFromFileRoot(filePath, layer.privateRootDir);
          if (rel !== null) {
            const parent = this.findParentLayerRoot(layers, index, "private");
            return toPathSource({
              pathOrUri: uri,
              rootUri: rootToUri(layer.privateRootDir),
              relativePath: rel,
              rootKind: "private",
              privateRootUri: layer.privateRootDir ? rootToUri(layer.privateRootDir) : undefined,
              publicRootUri: layer.publicRootDir ? rootToUri(layer.publicRootDir) : undefined,
              globalRootUri: this.paths.globalRootDir ? rootToUri(this.paths.globalRootDir) : undefined,
              superRootUri: parent ? rootToUri(parent) : undefined,
              superUri: parent ? new URL(rel, rootToUri(parent)).toString() : undefined,
            });
          }
        }
        if (layer?.publicRootDir) {
          const rel = relativeFromFileRoot(filePath, layer.publicRootDir);
          if (rel !== null) {
            const parent = this.findParentLayerRoot(layers, index, "public");
            return toPathSource({
              pathOrUri: uri,
              rootUri: rootToUri(layer.publicRootDir),
              relativePath: rel,
              rootKind: "public",
              privateRootUri: layer.privateRootDir ? rootToUri(layer.privateRootDir) : undefined,
              publicRootUri: layer.publicRootDir ? rootToUri(layer.publicRootDir) : undefined,
              globalRootUri: this.paths.globalRootDir ? rootToUri(this.paths.globalRootDir) : undefined,
              superRootUri: parent ? rootToUri(parent) : undefined,
              superUri: parent ? new URL(rel, rootToUri(parent)).toString() : undefined,
            });
          }
        }
      }
      if (this.paths.globalRootDir) {
        const rel = relativeFromFileRoot(filePath, this.paths.globalRootDir);
        if (rel !== null) {
          return toPathSource({
            pathOrUri: uri,
            rootUri: rootToUri(this.paths.globalRootDir),
            relativePath: rel,
            rootKind: "global",
            globalRootUri: rootToUri(this.paths.globalRootDir),
          });
        }
      }
    }
    return toPathSource({
      pathOrUri: uri,
      relativePath: `${key}.mdx`,
    });
  }

  private getPromptLayers(): PromptRootLayer[] {
    if (this.paths.promptLayers?.length) {
      return this.paths.promptLayers.map((layer) => ({ ...layer }));
    }
    const privateRoot = this.paths.privateRootDir ?? this.paths.rootDir;
    return this.paths.publicRootDir || privateRoot
      ? [
          {
            publicRootDir: this.paths.publicRootDir,
            privateRootDir: privateRoot,
          },
        ]
      : [];
  }

  private findParentLayerRoot(
    layers: readonly PromptRootLayer[],
    currentIndex: number,
    rootKind: "private" | "public",
  ): string | undefined {
    const currentRoot = layers[currentIndex]?.[rootKind === "private" ? "privateRootDir" : "publicRootDir"];
    for (let index = currentIndex - 1; index >= 0; index -= 1) {
      const candidate = layers[index]?.[rootKind === "private" ? "privateRootDir" : "publicRootDir"];
      if (candidate && !sameFileRoot(candidate, currentRoot)) {
        return candidate;
      }
    }
    return undefined;
  }

  private resolveSlotUri(src: string, source?: PromptDocumentSource): string {
    const url = new URL(src);
    const scheme = url.protocol.slice(0, -1).toLowerCase();
    if (scheme !== "super" && scheme !== "private" && scheme !== "public" && scheme !== "global") {
      return src;
    }
    const rawPath = safeRelativePath(resolveLangToken(`${url.hostname}${url.pathname}`, this.paths.lang));
    if (scheme === "super") {
      if (rawPath.length === 0) {
        return source?.superUri ?? "";
      }
      return source?.superRootUri ? new URL(rawPath, source.superRootUri).toString() : "";
    }
    if (scheme === "private") {
      const root = this.paths.privateRootDir ?? this.paths.rootDir;
      return root && rawPath.length > 0 ? new URL(rawPath, rootToUri(root)).toString() : "";
    }
    if (scheme === "public") {
      const root = this.paths.publicRootDir;
      return root && rawPath.length > 0 ? new URL(rawPath, rootToUri(root)).toString() : "";
    }
    if (scheme === "global") {
      const root = this.paths.globalRootDir;
      return root && rawPath.length > 0 ? new URL(rawPath, rootToUri(root)).toString() : "";
    }
    return src;
  }

  private async readSlot(
    input: {
      src: string;
      document: PromptDocument;
      source?: PromptDocumentSource;
    },
    context: PromptBuildContext = {},
  ): Promise<string> {
    const uri = this.resolveSlotUri(input.src, input.source ?? input.document.source);
    if (uri.length === 0) {
      return "";
    }
    const content = await this.readMaybe(uri);
    if (content === undefined) {
      return "";
    }
    const document: PromptDocument = {
      syntax: detectSyntax(uri, "mdx"),
      content,
      source: this.toDocumentSource(uri, "AGENTER"),
    };
    return await this.buildMd(document, {
      ...context,
      source: document.source,
    });
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
