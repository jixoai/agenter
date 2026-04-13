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

import { normalizeWorkspaceGrantSubjectPath, resolveWorkspaceGrantMode } from "./grants";
import type { WorkspaceGrantRecord } from "./types";

const joinGrantChildPath = (parentPath: string, name: string): string =>
  normalizeWorkspaceGrantSubjectPath(parentPath === "/" ? `/${name}` : posix.join(parentPath, name));

const isReadableMode = (mode: WorkspaceGrantRecord["mode"] | "none"): mode is WorkspaceGrantRecord["mode"] =>
  mode === "ro" || mode === "rw";

type ReadFileOptions = Parameters<IFileSystem["readFile"]>[1];
type WriteFileOptions = Parameters<IFileSystem["writeFile"]>[2];
type DirentEntry = Awaited<ReturnType<NonNullable<IFileSystem["readdirWithFileTypes"]>>>[number];

export interface GrantedWorkspaceFsOptions {
  workspacePath: string;
  grants: WorkspaceGrantRecord[];
  systemGrantPatterns?: Array<{
    pattern: string;
    mode: WorkspaceGrantRecord["mode"];
  }>;
}

export class GrantedWorkspaceFs implements IFileSystem {
  private readonly fs: ReadWriteFs;
  private readonly grants: WorkspaceGrantRecord[];

  constructor(options: GrantedWorkspaceFsOptions) {
    this.fs = new ReadWriteFs({
      root: options.workspacePath,
    });
    const systemGrants =
      options.systemGrantPatterns?.map((grant, index) => ({
        grantId: `system-grant-${index}`,
        mountId: "system",
        workspacePath: options.workspacePath,
        pattern: grant.pattern,
        ruleIndex: options.grants.length + index,
        mode: grant.mode,
        createdAt: new Date(0).toISOString(),
      })) ?? [];
    this.grants = [...options.grants, ...systemGrants];
  }

  private normalizePath(path: string): string {
    return normalizeWorkspaceGrantSubjectPath(path);
  }

  private exactMode(path: string): WorkspaceGrantRecord["mode"] | "none" {
    return resolveWorkspaceGrantMode(this.normalizePath(path), this.grants);
  }

  private partialMode(path: string): WorkspaceGrantRecord["mode"] | "none" {
    return resolveWorkspaceGrantMode(this.normalizePath(path), this.grants, { partial: true });
  }

  private createDeniedError(action: string, path: string): Error {
    const error = new Error(`EACCES: workspace grant denies ${action} on ${this.normalizePath(path)}`);
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
    if (this.exactMode(path) !== "rw") {
      throw this.createDeniedError("write", path);
    }
  }

  private ensureWritableTraversal(path: string): void {
    if (this.partialMode(path) !== "rw") {
      throw this.createDeniedError("write", path);
    }
  }

  private isVisibleChild(parentPath: string, entry: Pick<DirentEntry, "name" | "isDirectory">): boolean {
    const childPath = joinGrantChildPath(parentPath, entry.name);
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

  async writeFile(
    path: string,
    content: string | Uint8Array,
    options?: WriteFileOptions | BufferEncoding,
  ): Promise<void> {
    this.ensureWritableCreate(path);
    await this.fs.writeFile(path, content, options);
  }

  async appendFile(
    path: string,
    content: string | Uint8Array,
    options?: WriteFileOptions | BufferEncoding,
  ): Promise<void> {
    this.ensureWritableCreate(path);
    await this.fs.appendFile(path, content, options);
  }

  async exists(path: string): Promise<boolean> {
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
