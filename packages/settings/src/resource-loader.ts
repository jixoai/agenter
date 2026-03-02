import { homedir } from "node:os";
import { isAbsolute, join, normalize, resolve } from "node:path";

export interface ResourceLoaderContext {
  projectRoot: string;
  cwd: string;
  homeDir: string;
}

export interface ResolvedResource {
  original: string;
  uri: string;
  scheme: string;
  path?: string;
}

export type ResourceAliasResolver = (ctx: ResourceLoaderContext) => string;

export interface ResourceProtocolHandler {
  readText: (resource: ResolvedResource) => Promise<string>;
}

const SCHEME_PATTERN = /^([a-z][a-z0-9+.-]*):/i;

const isUriLike = (value: string): boolean => SCHEME_PATTERN.test(value);
const isDirectoryLike = (path: string): boolean => !path.endsWith(".json");

const isPathLike = (token: string): boolean =>
  token === "~" || token.startsWith("~/") || token.startsWith("/") || token.startsWith("./") || token.startsWith("../");

const toFilePath = (input: string, context: ResourceLoaderContext): string => {
  const expanded = input === "~" ? context.homeDir : input.startsWith("~/") ? join(context.homeDir, input.slice(2)) : input;
  if (isAbsolute(expanded)) {
    return normalize(expanded);
  }
  return normalize(resolve(context.cwd, expanded));
};

const resolveFileUri = (path: string): string => `file://${path}`;

const defaultFileHandler: ResourceProtocolHandler = {
  readText: async (resource) => {
    if (!resource.path) {
      throw new Error(`file resource missing path: ${resource.uri}`);
    }
    return Bun.file(resource.path).text();
  },
};

const defaultHttpHandler: ResourceProtocolHandler = {
  readText: async (resource) => {
    const response = await fetch(resource.uri);
    if (!response.ok) {
      throw new Error(`request failed (${response.status}) for ${resource.uri}`);
    }
    return response.text();
  },
};

export interface ResourceLoaderOptions {
  context: {
    projectRoot: string;
    cwd?: string;
    homeDir?: string;
  };
}

/**
 * ResourceLoader is the single resolver/reader for settings and prompt resources.
 * It supports aliases (user/project/local), file-like paths, and URI protocols.
 */
export class ResourceLoader {
  private readonly context: ResourceLoaderContext;
  private readonly aliases = new Map<string, ResourceAliasResolver>();
  private readonly protocols = new Map<string, ResourceProtocolHandler>();

  constructor(options: ResourceLoaderOptions) {
    this.context = {
      projectRoot: options.context.projectRoot,
      cwd: options.context.cwd ?? options.context.projectRoot,
      homeDir: options.context.homeDir ?? homedir(),
    };
    this.registerBuiltinAliases();
    this.registerProtocol("file", defaultFileHandler);
    this.registerProtocol("http", defaultHttpHandler);
    this.registerProtocol("https", defaultHttpHandler);
  }

  registerAlias(name: string, resolver: ResourceAliasResolver): void {
    this.aliases.set(name, resolver);
  }

  registerProtocol(scheme: string, handler: ResourceProtocolHandler): void {
    this.protocols.set(scheme.toLowerCase(), handler);
  }

  resolve(input: string, options?: { forSettings?: boolean }): ResolvedResource {
    const token = input.trim();
    if (!token) {
      throw new Error("empty resource token");
    }

    const aliasTarget = this.aliases.get(token)?.(this.context);
    const source = aliasTarget ?? token;

    if (source.startsWith("file://")) {
      const url = new URL(source);
      let path = normalize(url.pathname);
      if (options?.forSettings && isDirectoryLike(path)) {
        path = join(path, "settings.json");
      }
      return {
        original: input,
        uri: resolveFileUri(path),
        scheme: "file",
        path,
      };
    }

    if (isUriLike(source)) {
      const scheme = source.slice(0, source.indexOf(":")).toLowerCase();
      return {
        original: input,
        uri: source,
        scheme,
      };
    }

    const filePath = toFilePath(source, this.context);
    const path = options?.forSettings && isDirectoryLike(filePath) ? join(filePath, "settings.json") : filePath;
    return {
      original: input,
      uri: resolveFileUri(path),
      scheme: "file",
      path,
    };
  }

  async readText(input: string | ResolvedResource, options?: { forSettings?: boolean }): Promise<string> {
    const resource = typeof input === "string" ? this.resolve(input, options) : input;
    const handler = this.protocols.get(resource.scheme.toLowerCase());
    if (!handler) {
      throw new Error(`unsupported resource scheme: ${resource.scheme}`);
    }
    return handler.readText(resource);
  }

  private registerBuiltinAliases(): void {
    this.registerAlias("user", (ctx) => join(ctx.homeDir, ".agenter", "settings.json"));
    this.registerAlias("project", (ctx) => join(ctx.projectRoot, ".agenter", "settings.json"));
    this.registerAlias("local", (ctx) => join(ctx.projectRoot, ".agenter", "settings.local.json"));
  }
}

