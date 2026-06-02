import { createHash } from "node:crypto";
import { extname, isAbsolute, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { defaultAvatarNickname, normalizeAvatarNickname } from "@agenter/avatar";
import {
  ReactiveContext,
  listWatcherRuntimeStatuses,
  reactiveReadFile,
  reactiveStat,
  type WatcherRuntimeStatus,
} from "@jixo/reactive-fs";
import { PROMPTS as EN_PROMPTS } from "@agenter/i18n-en";
import { ResourceLoader, type ResolvedResource } from "@agenter/settings";

import { loadPromptDocsByLang } from "./i18n";
import { PromptBuilder, type PromptBuildContext } from "./prompt-builder";
import {
  PROMPT_DOC_KEYS,
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

export type PromptOwnershipPolicy = "user-owned-seed-if-missing" | "daemon-managed-locked-fallback";
export type PromptDependencyOwnerKind = "avatar" | "builtin" | "package" | "file" | "network";
export type PromptDependencyReadKind = "file" | "network";

export interface PromptDependencyNode {
  originalUri: string;
  expandedUri: string;
  resolvedUri: string;
  resolvedPath?: string;
  scheme: string;
  ownerKind: PromptDependencyOwnerKind;
  readKind: PromptDependencyReadKind;
  freshnessIdentity: string;
  mtimeMs?: number | null;
}

export interface PromptRenderDiagnostic {
  kind: "missing_resource" | "missing_builtin_prompt" | "render_fallback";
  message: string;
  originalUri: string;
  expandedUri: string;
  resolvedPath?: string;
}

export interface PromptRenderResult {
  text: string;
  sourceIdentity: string;
  renderHash: string;
  renderedAt: number;
  canonicalPromptPath?: string;
  ownershipPolicy: PromptOwnershipPolicy;
  dependencies: PromptDependencyNode[];
  diagnostics: PromptRenderDiagnostic[];
}

export interface RuntimePromptRender extends PromptRenderResult {
  avatarName: string;
  agenterSystem: string;
  agenter: string;
  responseContract: string;
  systemPrompt: string;
}

export interface RuntimePromptState {
  canonicalPromptPath?: string;
  ownershipPolicy: PromptOwnershipPolicy;
  dirty: boolean;
  current: RuntimePromptRender | null;
  pending: RuntimePromptRender | null;
  diagnostics: PromptRenderDiagnostic[];
  watcherStatuses: readonly WatcherRuntimeStatus[];
}

export interface PromptStore {
  getSnapshot(): PromptSnapshot;
  getDocs(): PromptDocRecord;
  getDoc(key: PromptDocKey): PromptDocument;
  reload(): Promise<PromptSnapshot>;
  buildMd(document: PromptDocument, context?: PromptBuildContext): Promise<string>;
  buildRender(document: PromptDocument, context?: PromptBuildContext): Promise<PromptRenderResult>;
  renderRuntimePrompt(input: { avatarName: string }): Promise<RuntimePromptRender>;
  inspectRuntimePromptState(): RuntimePromptState;
  dispose(): void;
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
  avatarNickname?: string;
  lang?: string;
  defaultDocs?: PromptDocRecord;
  loader?: ResourceLoader;
}

interface PromptRenderTracker {
  readonly dependencies: Map<string, PromptDependencyNode>;
  readonly diagnostics: Map<string, PromptRenderDiagnostic>;
}

interface RuntimePromptStreamState {
  key: string;
  controller: AbortController;
  ready: Promise<RuntimePromptRender>;
  resolveReady: (render: RuntimePromptRender) => void;
  rejectReady: (reason?: unknown) => void;
  task: Promise<void>;
  current: RuntimePromptRender | null;
  pending: RuntimePromptRender | null;
  dirty: boolean;
  diagnostics: PromptRenderDiagnostic[];
}

interface PromiseWithResolvers<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

interface ReadResourceResult {
  content: string | undefined;
  source: PromptDocumentSource;
}

interface PromptResourceReference {
  originalUri: string;
  expandedUri?: string;
  resolvedUri?: string;
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
    normalized.includes("enoent") ||
    normalized.includes("not found") ||
    normalized.includes("no such file or directory") ||
    normalized.includes("request failed (404)")
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

const createPromiseWithResolvers = <T>(): PromiseWithResolvers<T> => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const createRenderTracker = (): PromptRenderTracker => ({
  dependencies: new Map(),
  diagnostics: new Map(),
});

const hashText = (value: string): string => createHash("sha256").update(value).digest("hex");

export class FilePromptStore implements PromptStore {
  private snapshot: PromptSnapshot = {
    docs: cloneDocs(DEFAULT_BOOTSTRAP_DOCS),
    loadedAt: Date.now(),
    source: "file",
  };
  private readonly loader: ResourceLoader;
  private readonly builder = new PromptBuilder();
  private loadedDefaultDocs: PromptDocRecord | null = null;
  private runtimePromptStream: RuntimePromptStreamState | null = null;

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

  dispose(): void {
    this.runtimePromptStream?.controller.abort("prompt-store.dispose");
    this.runtimePromptStream = null;
  }

  async buildMd(document: PromptDocument, context: PromptBuildContext = {}): Promise<string> {
    return (await this.buildRender(document, context)).text;
  }

  async buildRender(document: PromptDocument, context: PromptBuildContext = {}): Promise<PromptRenderResult> {
    const tracker = createRenderTracker();
    const text = await this.renderDocument(document, context, tracker);
    const dependencies = this.sortDependencies([...tracker.dependencies.values()]);
    const diagnostics = [...tracker.diagnostics.values()];
    const sourceIdentity = hashText(
      JSON.stringify(
        dependencies.map((node) => ({
          originalUri: node.originalUri,
          expandedUri: node.expandedUri,
          resolvedPath: node.resolvedPath ?? null,
          freshnessIdentity: node.freshnessIdentity,
        })),
      ),
    );
    return {
      text,
      sourceIdentity,
      renderHash: hashText(text),
      renderedAt: Date.now(),
      canonicalPromptPath: this.getCanonicalPromptPath(),
      ownershipPolicy: this.getOwnershipPolicy(),
      dependencies,
      diagnostics,
    };
  }

  async renderRuntimePrompt(input: { avatarName: string }): Promise<RuntimePromptRender> {
    const avatarName = input.avatarName.trim();
    const state = await this.ensureRuntimePromptStream(avatarName);
    await state.ready;
    if (state.dirty && state.pending) {
      state.current = state.pending;
      state.pending = null;
      state.dirty = false;
      state.diagnostics = state.current.diagnostics;
    }
    if (!state.current) {
      throw new Error(`runtime prompt render unavailable for ${avatarName}`);
    }
    return state.current;
  }

  inspectRuntimePromptState(): RuntimePromptState {
    return {
      canonicalPromptPath: this.getCanonicalPromptPath(),
      ownershipPolicy: this.getOwnershipPolicy(),
      dirty: this.runtimePromptStream?.dirty ?? false,
      current: this.runtimePromptStream?.current ?? null,
      pending: this.runtimePromptStream?.pending ?? null,
      diagnostics: this.runtimePromptStream?.diagnostics ?? [],
      watcherStatuses: listWatcherRuntimeStatuses(),
    };
  }

  private async load(): Promise<PromptSnapshot> {
    const rootDir = this.paths.rootDir;
    const docs = await this.loadDefaultDocs();
    const agenterSourcePath = this.paths.agenterPath ?? (rootDir ? joinRef(rootDir, "AGENTER.mdx") : undefined);
    if (agenterSourcePath) {
      const loaded = await this.readMaybe(agenterSourcePath);
      docs.AGENTER = {
        syntax: detectSyntax(agenterSourcePath, docs.AGENTER.syntax),
        content: loaded ?? docs.AGENTER.content,
        source: this.toDocumentSource(agenterSourcePath, "AGENTER"),
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

  private expandSlotUri(src: string): string {
    return resolveLangToken(src, this.paths.lang);
  }

  private resolveSlotUri(expandedSrc: string, source?: PromptDocumentSource): string {
    const url = new URL(expandedSrc);
    const scheme = url.protocol.slice(0, -1).toLowerCase();
    if (scheme !== "super" && scheme !== "private" && scheme !== "public" && scheme !== "global") {
      return expandedSrc;
    }
    const rawPath = safeRelativePath(`${url.hostname}${url.pathname}`);
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
    return expandedSrc;
  }

  private async renderDocument(
    document: PromptDocument,
    context: PromptBuildContext,
    tracker: PromptRenderTracker,
  ): Promise<string> {
    const hydrated = await this.materializeDocument(document, tracker);
    return await this.builder.buildMd(hydrated, {
      ...context,
      source: context.source ?? hydrated.source,
      readSlot: async ({ src, source }) => {
        const expandedUri = this.expandSlotUri(src);
        const resolvedUri = this.resolveSlotUri(expandedUri, source ?? hydrated.source);
        if (resolvedUri.length === 0) {
          return "";
        }
        const slotDocument = await this.readResourceDocument(
          {
            originalUri: src,
            expandedUri,
            resolvedUri,
          },
          "mdx",
          tracker,
        );
        if (!slotDocument) {
          return "";
        }
        return await this.renderDocument(
          slotDocument,
          {
            ...context,
            source: slotDocument.source,
          },
          tracker,
        );
      },
    });
  }

  private async materializeDocument(document: PromptDocument, tracker: PromptRenderTracker): Promise<PromptDocument> {
    if (!document.source?.uri) {
      return document;
    }
    const resource = await this.readResourceWithDependency(
      {
        originalUri: document.source.uri,
        expandedUri: document.source.expandedUri,
        resolvedUri: document.source.resolvedUri ?? document.source.path,
      },
      document.content,
      tracker,
    );
    return {
      syntax: detectSyntax(resource.source.path ?? resource.source.resolvedUri ?? document.source.uri, document.syntax),
      content: resource.content ?? document.content,
      source: resource.source,
    };
  }

  private async readResourceDocument(
    reference: PromptResourceReference,
    fallbackSyntax: PromptSyntax,
    tracker: PromptRenderTracker,
  ): Promise<PromptDocument | null> {
    const resource = await this.readResourceWithDependency(reference, undefined, tracker);
    if (resource.content === undefined) {
      return null;
    }
    return {
      syntax: detectSyntax(resource.source.path ?? resource.source.resolvedUri ?? reference.originalUri, fallbackSyntax),
      content: resource.content,
      source: resource.source,
    };
  }

  private async readResourceWithDependency(
    reference: PromptResourceReference,
    fallbackContent: string | undefined,
    tracker: PromptRenderTracker,
  ): Promise<ReadResourceResult> {
    const expandedUri = reference.expandedUri ?? resolveLangToken(reference.originalUri, this.paths.lang);
    const resolvedResource = this.loader.resolve(reference.resolvedUri ?? expandedUri);
    if (resolvedResource.scheme === "file" && resolvedResource.path) {
      const [content, statInfo] = await Promise.all([reactiveReadFile(resolvedResource.path), reactiveStat(resolvedResource.path)]);
      this.recordDependency(
        tracker,
        this.buildDependencyNode({
          originalUri: reference.originalUri,
          expandedUri,
          resolvedResource,
          statInfo,
        }),
      );
      if (content === null) {
        this.recordDiagnostic(
          tracker,
          this.buildMissingResourceDiagnostic(reference.originalUri, expandedUri, resolvedResource.path),
        );
        if (fallbackContent !== undefined) {
          this.recordDiagnostic(
            tracker,
            this.buildRenderFallbackDiagnostic(reference.originalUri, expandedUri, resolvedResource.path),
          );
        }
        return {
          content: fallbackContent,
          source: this.buildSourceFromResolvedResource(reference.originalUri, expandedUri, resolvedResource),
        };
      }
      return {
        content,
        source: this.buildSourceFromResolvedResource(reference.originalUri, expandedUri, resolvedResource),
      };
    }

    try {
      const content = await this.loader.readText(resolvedResource);
      this.recordDependency(
        tracker,
        this.buildDependencyNode({
          originalUri: reference.originalUri,
          expandedUri,
          resolvedResource,
          statInfo: null,
        }),
      );
      return {
        content,
        source: this.buildSourceFromResolvedResource(reference.originalUri, expandedUri, resolvedResource),
      };
    } catch (error) {
      if (!isMissingResourceError(error)) {
        throw error;
      }
      this.recordDiagnostic(
        tracker,
        this.buildMissingResourceDiagnostic(reference.originalUri, expandedUri, resolvedResource.path),
      );
      if (fallbackContent !== undefined) {
        this.recordDiagnostic(
          tracker,
          this.buildRenderFallbackDiagnostic(reference.originalUri, expandedUri, resolvedResource.path),
        );
      }
      return {
        content: fallbackContent,
        source: this.buildSourceFromResolvedResource(reference.originalUri, expandedUri, resolvedResource),
      };
    }
  }

  private buildSourceFromResolvedResource(
    originalUri: string,
    expandedUri: string,
    resource: ResolvedResource,
  ): PromptDocumentSource {
    const baseSource = resource.path
      ? (this.toDocumentSource(resource.path, "AGENTER") ?? {
          uri: originalUri,
          scheme: parseScheme(originalUri),
        })
      : ({
          uri: originalUri,
          scheme: parseScheme(originalUri),
        } satisfies PromptDocumentSource);
    return {
      ...baseSource,
      uri: originalUri,
      expandedUri,
      resolvedUri: resource.uri,
      scheme: parseScheme(originalUri),
      path: resource.path ?? baseSource.path,
    };
  }

  private buildDependencyNode(input: {
    originalUri: string;
    expandedUri: string;
    resolvedResource: ResolvedResource;
    statInfo:
      | {
          isDirectory: boolean;
          isFile: boolean;
          mtime: number;
          birthtime: number;
        }
      | null;
  }): PromptDependencyNode {
    return {
      originalUri: input.originalUri,
      expandedUri: input.expandedUri,
      resolvedUri: input.resolvedResource.uri,
      resolvedPath: input.resolvedResource.path,
      scheme: input.resolvedResource.scheme,
      ownerKind: this.inferOwnerKind(input.originalUri, input.resolvedResource.path),
      readKind: input.resolvedResource.scheme === "file" ? "file" : "network",
      freshnessIdentity: input.statInfo
        ? `${input.statInfo.isDirectory ? "dir" : "file"}:${input.statInfo.mtime}:${input.statInfo.birthtime}`
        : input.resolvedResource.scheme === "file"
          ? "missing"
          : `network:${input.resolvedResource.uri}`,
      mtimeMs: input.statInfo?.mtime ?? null,
    };
  }

  private inferOwnerKind(originalUri: string, resolvedPath: string | undefined): PromptDependencyOwnerKind {
    if (resolvedPath && this.paths.agenterPath && resolve(resolvedPath) === resolve(this.paths.agenterPath)) {
      return "avatar";
    }
    if (resolvedPath && this.isBuiltinPath(resolvedPath)) {
      return "builtin";
    }
    if (originalUri.startsWith("app:") || originalUri.startsWith("npm:")) {
      return "package";
    }
    if (originalUri.startsWith("http:") || originalUri.startsWith("https:")) {
      return "network";
    }
    return "file";
  }

  private isBuiltinPath(path: string): boolean {
    if (!this.paths.globalRootDir) {
      return false;
    }
    const builtinRoot = join(this.paths.globalRootDir, "builtin");
    return isPathInsideRoot(path, builtinRoot);
  }

  private buildMissingResourceDiagnostic(
    originalUri: string,
    expandedUri: string,
    resolvedPath: string | undefined,
  ): PromptRenderDiagnostic {
    return {
      kind: resolvedPath && this.isBuiltinPath(resolvedPath) ? "missing_builtin_prompt" : "missing_resource",
      message:
        resolvedPath && this.isBuiltinPath(resolvedPath)
          ? `builtin prompt file is missing: ${resolvedPath}`
          : `prompt resource is missing: ${expandedUri}`,
      originalUri,
      expandedUri,
      resolvedPath,
    };
  }

  private buildRenderFallbackDiagnostic(
    originalUri: string,
    expandedUri: string,
    resolvedPath: string | undefined,
  ): PromptRenderDiagnostic {
    return {
      kind: "render_fallback",
      message:
        resolvedPath && this.isBuiltinPath(resolvedPath)
          ? `prompt render fell back to bundled builtin content because the managed file is missing: ${resolvedPath}`
          : `prompt render fell back to bundled content because the resource is missing: ${expandedUri}`,
      originalUri,
      expandedUri,
      resolvedPath,
    };
  }

  private recordDependency(tracker: PromptRenderTracker, node: PromptDependencyNode): void {
    const key = `${node.originalUri}::${node.resolvedPath ?? node.resolvedUri}`;
    tracker.dependencies.set(key, node);
  }

  private recordDiagnostic(tracker: PromptRenderTracker, diagnostic: PromptRenderDiagnostic): void {
    const key = `${diagnostic.kind}::${diagnostic.originalUri}::${diagnostic.resolvedPath ?? diagnostic.expandedUri}`;
    tracker.diagnostics.set(key, diagnostic);
  }

  private sortDependencies(nodes: PromptDependencyNode[]): PromptDependencyNode[] {
    return nodes.sort((left, right) => {
      const leftKey = left.resolvedPath ?? left.resolvedUri;
      const rightKey = right.resolvedPath ?? right.resolvedUri;
      return leftKey.localeCompare(rightKey);
    });
  }

  private getCanonicalPromptPath(): string | undefined {
    return this.paths.agenterPath;
  }

  private getOwnershipPolicy(): PromptOwnershipPolicy {
    return normalizeAvatarNickname(this.paths.avatarNickname ?? defaultAvatarNickname()) === defaultAvatarNickname()
      ? "daemon-managed-locked-fallback"
      : "user-owned-seed-if-missing";
  }

  private async ensureRuntimePromptStream(avatarName: string): Promise<RuntimePromptStreamState> {
    if (this.runtimePromptStream?.key === avatarName) {
      return this.runtimePromptStream;
    }

    this.dispose();
    const controller = new AbortController();
    const ready = createPromiseWithResolvers<RuntimePromptRender>();
    const state: RuntimePromptStreamState = {
      key: avatarName,
      controller,
      ready: ready.promise,
      resolveReady: ready.resolve,
      rejectReady: ready.reject,
      task: Promise.resolve(),
      current: null,
      pending: null,
      dirty: false,
      diagnostics: [],
    };
    state.task = this.runRuntimePromptStream(state, avatarName);
    this.runtimePromptStream = state;
    return state;
  }

  private async runRuntimePromptStream(state: RuntimePromptStreamState, avatarName: string): Promise<void> {
    const context = new ReactiveContext();
    let first = true;
    try {
      for await (const render of context.stream(async () => await this.computeRuntimePrompt(avatarName), state.controller.signal)) {
        if (first) {
          state.current = render;
          state.diagnostics = render.diagnostics;
          state.resolveReady(render);
          first = false;
          continue;
        }
        state.pending = render;
        // File changes stay observable as dirty state until the next safe model
        // boundary adopts this rerender; no in-flight request is mutated here.
        state.dirty = true;
        state.diagnostics = render.diagnostics;
      }
    } catch (error) {
      if (!state.controller.signal.aborted) {
        state.rejectReady(error);
      }
    }
  }

  private async computeRuntimePrompt(avatarName: string): Promise<RuntimePromptRender> {
    const promptDocs = this.snapshot.docs;
    const sharedPromptSlots = {
      AVATAR_NAME: avatarName,
    };
    const agenterSystem = await this.buildRender(promptDocs.AGENTER_SYSTEM, {
      slots: sharedPromptSlots,
    });
    const agenter = await this.buildRender(promptDocs.AGENTER, {
      slots: sharedPromptSlots,
    });
    const contract = await this.buildRender(promptDocs.RESPONSE_CONTRACT);
    const systemPrompt = await this.buildRender(promptDocs.SYSTEM_TEMPLATE, {
      slots: {
        AGENTER_SYSTEM: agenterSystem.text,
        SYSTEMS_GUIDE: "",
        AGENTER: agenter.text,
        RESPONSE_CONTRACT: contract.text,
      },
    });

    const dependencies = this.sortDependencies(
      [...agenterSystem.dependencies, ...agenter.dependencies, ...contract.dependencies, ...systemPrompt.dependencies].reduce<
        PromptDependencyNode[]
      >((items, next) => {
        if (
          items.some(
            (existing) =>
              existing.originalUri === next.originalUri &&
              existing.resolvedUri === next.resolvedUri &&
              existing.resolvedPath === next.resolvedPath,
          )
        ) {
          return items;
        }
        items.push(next);
        return items;
      }, []),
    );
    const diagnostics = [...agenterSystem.diagnostics, ...agenter.diagnostics, ...contract.diagnostics, ...systemPrompt.diagnostics]
      .reduce<PromptRenderDiagnostic[]>((items, next) => {
        if (
          items.some(
            (existing) =>
              existing.kind === next.kind &&
              existing.originalUri === next.originalUri &&
              existing.resolvedPath === next.resolvedPath,
          )
        ) {
          return items;
        }
        items.push(next);
        return items;
      }, []);
    const sourceIdentity = hashText(
      JSON.stringify(
        dependencies.map((node) => ({
          originalUri: node.originalUri,
          expandedUri: node.expandedUri,
          resolvedPath: node.resolvedPath ?? null,
          freshnessIdentity: node.freshnessIdentity,
        })),
      ),
    );
    return {
      avatarName,
      agenterSystem: agenterSystem.text,
      agenter: agenter.text,
      responseContract: contract.text,
      systemPrompt: systemPrompt.text,
      text: systemPrompt.text,
      sourceIdentity,
      renderHash: hashText(systemPrompt.text),
      renderedAt: Date.now(),
      canonicalPromptPath: this.getCanonicalPromptPath(),
      ownershipPolicy: this.getOwnershipPolicy(),
      dependencies,
      diagnostics,
    };
  }

  private async loadDefaultDocs(): Promise<PromptDocRecord> {
    if (this.paths.defaultDocs) {
      return cloneDocs(this.paths.defaultDocs);
    }
    if (!this.loadedDefaultDocs) {
      this.loadedDefaultDocs = await loadPromptDocsByLang({ lang: this.paths.lang });
    }
    const docs = cloneDocs(this.loadedDefaultDocs);
    if (!this.paths.globalRootDir) {
      return docs;
    }
    const builtinRoot = join(this.paths.globalRootDir, "builtin", this.paths.lang ?? "en");
    // File truth: once builtin prompt docs are materialized into ~/.agenter,
    // reads should prefer those managed files. Bundled package content remains
    // only as a cold-start seed and missing-file fallback.
    for (const key of PROMPT_DOC_KEYS) {
      const sourcePath = join(builtinRoot, `${key}.mdx`);
      const loaded = await this.readMaybe(sourcePath);
      docs[key] = {
        syntax: detectSyntax(sourcePath, docs[key].syntax),
        content: loaded ?? docs[key].content,
        source: this.toDocumentSource(sourcePath, key),
      };
    }
    return docs;
  }
}
