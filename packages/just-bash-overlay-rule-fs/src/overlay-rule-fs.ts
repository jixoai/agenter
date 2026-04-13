import { posix } from "node:path";

import {
  ReadWriteFs,
  type BufferEncoding,
  type CpOptions,
  type FsStat,
  type IFileSystem,
  type MkdirOptions,
  type RmOptions,
} from "just-bash";

import {
  normalizeOverlayRulePattern,
  normalizeOverlayRuleSubjectPath,
  resolveOverlayRuleMode,
  type OverlayRuleMode,
  type OverlayRuleRecordLike,
} from "./grants";

type ReadFileOptions = Parameters<IFileSystem["readFile"]>[1];
type WriteFileOptions = Parameters<IFileSystem["writeFile"]>[2];
type DirentEntry = Awaited<ReturnType<NonNullable<IFileSystem["readdirWithFileTypes"]>>>[number];

export interface OverlayRulePatternRule {
  pattern: string;
  mode: OverlayRuleMode;
}

export interface OverlayRuleFsConfig<TRule extends OverlayRuleRecordLike = OverlayRuleRecordLike> {
  rules: readonly TRule[];
  extraRules?: readonly OverlayRulePatternRule[];
  hiddenPaths?: readonly string[];
}

export interface OverlayRuleFsOptions<TRule extends OverlayRuleRecordLike = OverlayRuleRecordLike> {
  root: string;
  config: OverlayRuleFsConfig<TRule>;
  allowSymlinks?: boolean;
  maxFileReadSize?: number;
}

const joinChildPath = (parentPath: string, name: string): string =>
  normalizeOverlayRuleSubjectPath(parentPath === "/" ? `/${name}` : posix.join(parentPath, name));

const isReadableMode = (mode: OverlayRuleMode | "none"): mode is OverlayRuleMode => mode === "ro" || mode === "rw";

export class OverlayRuleFs<TRule extends OverlayRuleRecordLike = OverlayRuleRecordLike> implements IFileSystem {
  private readonly fs: ReadWriteFs;
  private config: OverlayRuleFsConfig<TRule>;

  constructor(options: OverlayRuleFsOptions<TRule>) {
    this.fs = new ReadWriteFs({
      root: options.root,
      allowSymlinks: options.allowSymlinks,
      maxFileReadSize: options.maxFileReadSize,
    });
    this.config = {
      rules: [...options.config.rules],
      extraRules: [...(options.config.extraRules ?? [])],
      hiddenPaths: [...(options.config.hiddenPaths ?? [])],
    };
  }

  replaceConfig(config: OverlayRuleFsConfig<TRule>): void {
    this.config = {
      rules: [...config.rules],
      extraRules: [...(config.extraRules ?? [])],
      hiddenPaths: [...(config.hiddenPaths ?? [])],
    };
  }

  setRules(rules: readonly TRule[]): void {
    this.config = {
      ...this.config,
      rules: [...rules],
    };
  }

  getConfig(): Readonly<OverlayRuleFsConfig<TRule>> {
    return this.config;
  }

  private normalizePath(path: string): string {
    return normalizeOverlayRuleSubjectPath(path);
  }

  private normalizeHiddenPath(path: string): string {
    return normalizeOverlayRulePattern(path);
  }

  private getEffectiveRules(): OverlayRuleRecordLike[] {
    const extraRules =
      this.config.extraRules?.map((rule, index) => ({
        grantId: `overlay-rule-extra-${index}`,
        pattern: normalizeOverlayRulePattern(rule.pattern),
        mode: rule.mode,
        ruleIndex: this.config.rules.length + index,
        createdAt: new Date(0).toISOString(),
      })) ?? [];
    return [...this.config.rules, ...extraRules];
  }

  private isHidden(path: string): boolean {
    const normalizedPath = this.normalizePath(path);
    return (this.config.hiddenPaths ?? []).some((hiddenPath) => {
      const normalizedHiddenPath = this.normalizeHiddenPath(hiddenPath);
      return normalizedPath === normalizedHiddenPath || normalizedPath.startsWith(`${normalizedHiddenPath}/`);
    });
  }

  private exactMode(path: string): OverlayRuleMode | "none" {
    return resolveOverlayRuleMode(this.normalizePath(path), this.getEffectiveRules());
  }

  private partialMode(path: string): OverlayRuleMode | "none" {
    return resolveOverlayRuleMode(this.normalizePath(path), this.getEffectiveRules(), { partial: true });
  }

  private createDeniedError(action: string, path: string): Error {
    const error = new Error(`EACCES: overlay rule denies ${action} on ${this.normalizePath(path)}`);
    Object.assign(error, { code: "EACCES" });
    return error;
  }

  private async safeStat(path: string): Promise<FsStat | null> {
    try {
      return await this.fs.stat(path);
    } catch {
      return null;
    }
  }

  private async ensureReadable(path: string): Promise<void> {
    if (this.isHidden(path)) {
      throw this.createDeniedError("read", path);
    }
    if (isReadableMode(this.exactMode(path))) {
      return;
    }
    if (!isReadableMode(this.partialMode(path))) {
      throw this.createDeniedError("read", path);
    }
    const stat = await this.safeStat(path);
    if (!stat?.isDirectory) {
      throw this.createDeniedError("read", path);
    }
  }

  private async ensureWritable(path: string): Promise<void> {
    if (this.isHidden(path)) {
      throw this.createDeniedError("write", path);
    }
    if (this.exactMode(path) === "rw") {
      return;
    }
    if (this.partialMode(path) !== "rw") {
      throw this.createDeniedError("write", path);
    }
    const stat = await this.safeStat(path);
    if (!stat?.isDirectory) {
      throw this.createDeniedError("write", path);
    }
  }

  private ensureWritableCreate(path: string): void {
    if (this.isHidden(path) || this.exactMode(path) !== "rw") {
      throw this.createDeniedError("write", path);
    }
  }

  private ensureWritableTraversal(path: string): void {
    if (this.isHidden(path) || this.partialMode(path) !== "rw") {
      throw this.createDeniedError("write", path);
    }
  }

  private isVisibleChild(parentPath: string, entry: Pick<DirentEntry, "name" | "isDirectory">): boolean {
    const childPath = joinChildPath(parentPath, entry.name);
    if (this.isHidden(childPath)) {
      return false;
    }
    return entry.isDirectory ? isReadableMode(this.partialMode(childPath)) : isReadableMode(this.exactMode(childPath));
  }

  async readFile(path: string, options?: ReadFileOptions | BufferEncoding): Promise<string> {
    await this.ensureReadable(path);
    return await this.fs.readFile(path, options);
  }

  async readFileBuffer(path: string): Promise<Uint8Array> {
    await this.ensureReadable(path);
    return await this.fs.readFileBuffer(path);
  }

  async writeFile(path: string, content: string | Uint8Array, options?: WriteFileOptions | BufferEncoding): Promise<void> {
    this.ensureWritableCreate(path);
    await this.fs.writeFile(path, content, options);
  }

  async appendFile(path: string, content: string | Uint8Array, options?: WriteFileOptions | BufferEncoding): Promise<void> {
    this.ensureWritableCreate(path);
    await this.fs.appendFile(path, content, options);
  }

  async exists(path: string): Promise<boolean> {
    if (this.isHidden(path)) {
      return false;
    }
    if (isReadableMode(this.exactMode(path))) {
      return await this.fs.exists(path);
    }
    if (!isReadableMode(this.partialMode(path))) {
      return false;
    }
    const stat = await this.safeStat(path);
    return stat?.isDirectory ?? false;
  }

  async stat(path: string): Promise<FsStat> {
    await this.ensureReadable(path);
    return await this.fs.stat(path);
  }

  async lstat(path: string): Promise<FsStat> {
    await this.ensureReadable(path);
    return await this.fs.lstat(path);
  }

  async mkdir(path: string, options?: MkdirOptions): Promise<void> {
    this.ensureWritableTraversal(path);
    await this.fs.mkdir(path, options);
  }

  async readdir(path: string): Promise<string[]> {
    await this.ensureReadable(path);
    const entries = this.fs.readdirWithFileTypes
      ? await this.fs.readdirWithFileTypes(path)
      : (await this.fs.readdir(path)).map((name) => ({
          name,
          isFile: false,
          isDirectory: false,
          isSymbolicLink: false,
        }));
    return entries.filter((entry) => this.isVisibleChild(this.normalizePath(path), entry)).map((entry) => entry.name);
  }

  async readdirWithFileTypes(path: string): Promise<DirentEntry[]> {
    await this.ensureReadable(path);
    const entries = this.fs.readdirWithFileTypes
      ? await this.fs.readdirWithFileTypes(path)
      : (await this.fs.readdir(path)).map((name) => ({
          name,
          isFile: false,
          isDirectory: false,
          isSymbolicLink: false,
        }));
    return entries.filter((entry) => this.isVisibleChild(this.normalizePath(path), entry));
  }

  async rm(path: string, options?: RmOptions): Promise<void> {
    await this.ensureWritable(path);
    await this.fs.rm(path, options);
  }

  async cp(src: string, dest: string, options?: CpOptions): Promise<void> {
    await this.ensureReadable(src);
    this.ensureWritableCreate(dest);
    await this.fs.cp(src, dest, options);
  }

  async mv(src: string, dest: string): Promise<void> {
    await this.ensureWritable(src);
    this.ensureWritableCreate(dest);
    await this.fs.mv(src, dest);
  }

  resolvePath(base: string, path: string): string {
    return this.fs.resolvePath(base, path);
  }

  getAllPaths(): string[] {
    return this.fs
      .getAllPaths()
      .filter((path) => !this.isHidden(path))
      .filter((path) => isReadableMode(this.exactMode(path)) || isReadableMode(this.partialMode(path)));
  }

  async chmod(path: string, mode: number): Promise<void> {
    await this.ensureWritable(path);
    await this.fs.chmod(path, mode);
  }

  async symlink(target: string, linkPath: string): Promise<void> {
    this.ensureWritableCreate(linkPath);
    await this.fs.symlink(target, linkPath);
  }

  async link(existingPath: string, newPath: string): Promise<void> {
    await this.ensureReadable(existingPath);
    this.ensureWritableCreate(newPath);
    await this.fs.link(existingPath, newPath);
  }

  async readlink(path: string): Promise<string> {
    await this.ensureReadable(path);
    return await this.fs.readlink(path);
  }

  async realpath(path: string): Promise<string> {
    await this.ensureReadable(path);
    return await this.fs.realpath(path);
  }

  async utimes(path: string, atime: Date, mtime: Date): Promise<void> {
    await this.ensureWritable(path);
    await this.fs.utimes(path, atime, mtime);
  }
}
