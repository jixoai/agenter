import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import type { PageMeta, RenderResult } from "./types";

const ARCHIVE_FILE = /^(\d+)~(\d+)\.log\.html$/;
const META_PRE_FILE = /^\s*pre-file:\s*(.+)\s*$/m;
const LEGACY_META_PRE_FILE = /^\s*meta\.pre-file:\s*(.+)\s*$/m;

interface ArchiveRange {
  name: string;
  start: number;
  end: number;
}

interface SourceMeta {
  fileName: string;
  preFile: string | null;
  nextFile?: string | null;
  updatedAt: string;
}

interface ArchiveMetaSeed {
  cursorRow: number;
  cursorCol: number;
  viewportBase: number;
  logStyle?: PageMeta["logStyle"];
  rows?: number;
  cols?: number;
}

interface SplitMeta {
  reason: "TERMINAL_RESIZED";
  lastUpdated: string;
  nextFile: string;
}

const toLineNumber = (value: number): number => value + 1;

const parseArchiveName = (name: string): ArchiveRange | null => {
  const match = ARCHIVE_FILE.exec(name);
  if (!match) {
    return null;
  }
  const start = Number.parseInt(match[1], 10);
  const end = Number.parseInt(match[2], 10);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0 || end < start) {
    return null;
  }
  return { name, start, end };
};

const listArchives = (dir: string): ArchiveRange[] =>
  readdirSync(dir)
    .map((name) => parseArchiveName(name))
    .filter((item): item is ArchiveRange => item !== null)
    .sort((a, b) => a.start - b.start);

const latestArchive = (dir: string): ArchiveRange | null => {
  const items = listArchives(dir);
  if (items.length === 0) {
    return null;
  }
  return items[items.length - 1];
};

const stripSourceComments = (raw: string): string => raw.replace(/<!--\s*ati-source:(head|tail)[\s\S]*?-->\n?/g, "");

const stripResizeFooterComments = (raw: string): string =>
  raw.replace(/<!--[\s\S]*?-->\n?/g, (block) => {
    if (block.includes("split-reason: TERMINAL_RESIZED")) {
      return "";
    }
    return block;
  });

const stripLeadingMetaComment = (raw: string): string => {
  const trim = raw.trimStart();
  if (!trim.startsWith("<!--")) {
    return raw;
  }
  const marker = trim.indexOf("-->");
  if (marker < 0) {
    return raw;
  }
  return trim.slice(marker + 3);
};

const readBodyLines = (filePath: string): string[] => {
  if (!existsSync(filePath)) {
    return [];
  }
  const raw = readFileSync(filePath, "utf8");
  const withoutMeta = stripLeadingMetaComment(raw);
  const withoutSource = stripSourceComments(withoutMeta);
  const withoutResizeFooter = stripResizeFooterComments(withoutSource);
  const lines = withoutResizeFooter.split("\n").map((line) => line.trimEnd());
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
};

const parsePreFileFromLatest = (latestPath: string): string | null => {
  if (!existsSync(latestPath)) {
    return null;
  }
  const raw = readFileSync(latestPath, "utf8");
  const match = META_PRE_FILE.exec(raw) ?? LEGACY_META_PRE_FILE.exec(raw);
  if (!match) {
    return null;
  }
  let value = match[1].trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  if (value.length === 0 || value === "none") {
    return null;
  }
  return value;
};

const buildMetaHeader = (
  meta: PageMeta,
  eventTag?: string | null,
  includeStatus = true,
  splitMeta?: SplitMeta,
): string => {
  const preFile = meta.preFile ?? "none";
  const size =
    Number.isFinite(meta.rows) && Number.isFinite(meta.cols) && (meta.rows ?? 0) > 0 && (meta.cols ?? 0) > 0
      ? `${meta.rows}x${meta.cols}`
      : "unknown";
  const lines = ["<!--", "meta:"];
  if (includeStatus) {
    lines.push(`  status: ${JSON.stringify(meta.status)}`);
  }
  lines.push(
    "  cursor:",
    `    row: ${meta.cursorRow}`,
    `    col: ${meta.cursorCol}`,
    `  log-style: ${JSON.stringify(meta.logStyle)}`,
    `  size: ${JSON.stringify(size)}`,
    `  pre-file: ${JSON.stringify(preFile)}`,
    `  viewport-base: ${meta.viewportBase}`,
  );
  if (eventTag) {
    lines.push(`  event: ${JSON.stringify(eventTag)}`);
  }
  if (splitMeta) {
    lines.push(
      `  split-reason: ${splitMeta.reason}`,
      `  last-updated: ${JSON.stringify(splitMeta.lastUpdated)}`,
      `  next-file: ${JSON.stringify(splitMeta.nextFile)}`,
    );
  }
  lines.push("ati-source:");
  return lines.join("\n");
};

const toRefName = (value: string | null | undefined): string => {
  if (!value || value.length === 0) {
    return "none";
  }
  return value;
};

const buildSourceYaml = (meta: SourceMeta, includeNextFile: boolean): string => {
  const lines = [`  file: ${JSON.stringify(meta.fileName)}`, `  pre-file: ${JSON.stringify(toRefName(meta.preFile))}`];
  if (includeNextFile) {
    lines.push(`  next-file: ${JSON.stringify(toRefName(meta.nextFile))}`);
  }
  lines.push(`  updated-at: ${JSON.stringify(meta.updatedAt)}`, "-->");
  return lines.join("\n");
};

const joinHtmlLines = (lines: string[]): string => (lines.length === 0 ? "" : `${lines.join("\n")}\n`);

const buildArchiveContent = (meta: PageMeta, source: SourceMeta, lines: string[], splitMeta?: SplitMeta): string => {
  const head = `${buildMetaHeader(meta, null, false, splitMeta)}\n${buildSourceYaml(source, true)}`;
  const body = joinHtmlLines(lines);
  return `${head}\n${body}`;
};

const buildLatestContent = (meta: PageMeta, source: SourceMeta, lines: string[], eventTag?: string | null): string => {
  const head = `${buildMetaHeader(meta, eventTag)}\n${buildSourceYaml(source, false)}`;
  return `${head}\n${joinHtmlLines(lines)}`;
};

const writeArchiveFile = (
  filePath: string,
  meta: PageMeta,
  source: SourceMeta,
  lines: string[],
  splitMeta?: SplitMeta,
): void => {
  writeFileSync(filePath, buildArchiveContent(meta, source, lines, splitMeta), "utf8");
};

const writeLatestFile = (
  filePath: string,
  meta: PageMeta,
  source: SourceMeta,
  lines: string[],
  eventTag?: string | null,
): void => {
  writeFileSync(filePath, buildLatestContent(meta, source, lines, eventTag), "utf8");
};

const appendResizeSplitFooter = (filePath: string, splitMeta: SplitMeta): void => {
  const footer = [
    "<!--",
    "meta:",
    `  split-reason: ${splitMeta.reason}`,
    `  last-updated: ${JSON.stringify(splitMeta.lastUpdated)}`,
    `  next-file: ${JSON.stringify(splitMeta.nextFile)}`,
    "-->",
    "",
  ].join("\n");
  appendFileSync(filePath, footer, "utf8");
};

export class HtmlPaginationStore {
  private readonly outputDir: string;
  private readonly latestPath: string;
  private latestStartLine: number;
  private archiveChain: string[];
  private lastLoggedAbsoluteY: number;
  private latestPrefixLines: string[] = [];
  private latestEventTag: string | null = null;

  constructor(
    private readonly workspace: string,
    private readonly maxLinesPerFile: number,
  ) {
    mkdirSync(this.workspace, { recursive: true });
    this.outputDir = join(this.workspace, "output");
    mkdirSync(this.outputDir, { recursive: true });
    this.latestPath = join(this.outputDir, "latest.log.html");
    const state = this.restoreState();
    this.latestStartLine = state.latestStartLine;
    this.archiveChain = state.archiveChain;
    this.lastLoggedAbsoluteY = state.lastLoggedAbsoluteY;
  }

  write(
    render: RenderResult,
    status: PageMeta["status"],
    viewportBase: number,
    rows: number,
    cols: number,
    logStyle: PageMeta["logStyle"],
  ): void {
    const total = render.lines.length;
    const canArchiveByScrollback = viewportBase > 0;
    if (!canArchiveByScrollback) {
      // Full-screen TUI often redraws in-place with baseY=0; keep latest mutable and avoid sealing stale rows.
      this.latestStartLine = 1;
    }
    if (total < this.latestStartLine) {
      this.latestStartLine = Math.max(1, total - this.maxLinesPerFile + 1);
    }
    const archiveSeed: ArchiveMetaSeed = {
      cursorRow: toLineNumber(render.cursorAbsRow),
      cursorCol: toLineNumber(render.cursorCol),
      viewportBase,
      logStyle,
      rows,
      cols,
    };

    const pendingArchives: Array<{ name: string; path: string; lines: string[] }> = [];
    while (canArchiveByScrollback && total - this.latestStartLine + 1 > this.maxLinesPerFile) {
      const start = this.latestStartLine;
      const end = start + this.maxLinesPerFile - 1;
      const archiveName = `${start}~${end}.log.html`;
      const archivePath = join(this.outputDir, archiveName);
      const archiveLines = render.lines.slice(start - 1, end);

      pendingArchives.push({
        name: archiveName,
        path: archivePath,
        lines: archiveLines,
      });
      this.latestStartLine = end + 1;
    }

    for (const archive of pendingArchives) {
      this.ensureArchiveInChain(archive.name);
    }
    for (const archive of pendingArchives) {
      this.writeArchiveByChain(archive.name, archive.path, archive.lines, archiveSeed);
    }

    const currentLines = [...this.latestPrefixLines, ...render.lines.slice(Math.max(0, this.latestStartLine - 1))];
    const meta: PageMeta = {
      status,
      cursorRow: toLineNumber(render.cursorAbsRow),
      cursorCol: toLineNumber(render.cursorCol),
      logStyle,
      preFile: this.getLatestPreFile(),
      viewportBase,
      rows,
      cols,
    };
    const source: SourceMeta = {
      fileName: "latest.log.html",
      preFile: this.getLatestPreFile(),
      updatedAt: new Date().toISOString(),
    };
    writeLatestFile(this.latestPath, meta, source, currentLines, this.latestEventTag);
    this.lastLoggedAbsoluteY = Math.max(this.lastLoggedAbsoluteY, total);
  }

  sealForResize(currentTotalLines: number, seed: ArchiveMetaSeed): string | null {
    if (!existsSync(this.latestPath)) {
      return null;
    }
    const endLine = Math.max(this.latestStartLine, currentTotalLines);
    const archiveName = `${this.latestStartLine}~${endLine}.log.html`;
    const splitMeta: SplitMeta = {
      reason: "TERMINAL_RESIZED",
      lastUpdated: new Date().toISOString(),
      nextFile: "latest.log.html",
    };
    appendResizeSplitFooter(this.latestPath, splitMeta);

    const archivePath = join(this.outputDir, archiveName);
    if (existsSync(archivePath)) {
      rmSync(archivePath, { force: true });
    }
    renameSync(this.latestPath, archivePath);

    this.ensureArchiveInChain(archiveName);
    const bodyLines = readBodyLines(archivePath);
    this.writeArchiveByChain(archiveName, archivePath, bodyLines, seed, splitMeta);

    this.latestStartLine = endLine + 1;
    this.latestPrefixLines = [];
    this.latestEventTag = null;
    return archiveName;
  }

  writeResizeSnapshot(
    render: RenderResult,
    status: PageMeta["status"],
    viewportBase: number,
    cols: number,
    rows: number,
    preFile: string | null,
    logStyle: PageMeta["logStyle"],
  ): void {
    const snapshotStart = Math.max(0, viewportBase);
    const snapshotEnd = snapshotStart + rows;
    const snapshotLines = render.lines.slice(snapshotStart, snapshotEnd);
    this.latestStartLine = snapshotStart + 1;
    this.lastLoggedAbsoluteY = snapshotStart + rows;
    this.latestEventTag = `RESIZED_TO_${cols}x${rows}`;
    this.latestPrefixLines = [
      `<system-msg>=== Terminal Resized to ${cols}x${rows}. Historical scrollback is preserved in previous files. ===</system-msg>`,
    ];

    const lines = [...this.latestPrefixLines, ...snapshotLines];
    const meta: PageMeta = {
      status,
      cursorRow: toLineNumber(render.cursorAbsRow),
      cursorCol: toLineNumber(render.cursorCol),
      logStyle,
      preFile: preFile ?? this.getLatestPreFile(),
      viewportBase,
      rows,
      cols,
    };
    const source: SourceMeta = {
      fileName: "latest.log.html",
      preFile: preFile ?? this.getLatestPreFile(),
      updatedAt: new Date().toISOString(),
    };
    writeLatestFile(this.latestPath, meta, source, lines, this.latestEventTag);
  }

  getLatestPath(): string {
    return this.latestPath;
  }

  getLastArchiveName(): string | null {
    return this.getLatestPreFile();
  }

  private getLatestPreFile(): string | null {
    if (this.archiveChain.length === 0) {
      return null;
    }
    return this.archiveChain[this.archiveChain.length - 1];
  }

  private ensureArchiveInChain(name: string): void {
    if (this.archiveChain.includes(name)) {
      return;
    }
    this.archiveChain.push(name);
  }

  private getArchiveSourceByName(name: string): SourceMeta {
    const index = this.archiveChain.indexOf(name);
    if (index < 0) {
      throw new Error(`Archive not found in chain: ${name}`);
    }
    const preFile = index > 0 ? this.archiveChain[index - 1] : null;
    const nextFile = index < this.archiveChain.length - 1 ? this.archiveChain[index + 1] : "latest.log.html";
    return {
      fileName: name,
      preFile,
      nextFile,
      updatedAt: new Date().toISOString(),
    };
  }

  private writeArchiveByChain(
    name: string,
    filePath: string,
    bodyLines?: string[],
    seed?: ArchiveMetaSeed,
    splitMeta?: SplitMeta,
  ): void {
    const source = this.getArchiveSourceByName(name);
    const lines = bodyLines ?? readBodyLines(filePath);
    const meta: PageMeta = {
      status: "IDLE",
      cursorRow: seed?.cursorRow ?? 1,
      cursorCol: seed?.cursorCol ?? 1,
      logStyle: seed?.logStyle ?? "rich",
      preFile: source.preFile,
      viewportBase: seed?.viewportBase ?? 0,
      rows: seed?.rows,
      cols: seed?.cols,
    };
    writeArchiveFile(filePath, meta, source, lines, splitMeta);
  }

  private restoreState(): { latestStartLine: number; archiveChain: string[]; lastLoggedAbsoluteY: number } {
    const archives = listArchives(this.outputDir);
    const chain = archives.map((item) => item.name);
    const lastArchive = latestArchive(this.outputDir);
    let latestStartLine = (lastArchive?.end ?? 0) + 1;
    let lastLoggedAbsoluteY = lastArchive?.end ?? 0;

    if (!existsSync(this.latestPath)) {
      return {
        latestStartLine: Math.max(1, latestStartLine),
        archiveChain: chain,
        lastLoggedAbsoluteY,
      };
    }

    const latestLines = readBodyLines(this.latestPath);
    lastLoggedAbsoluteY += latestLines.length;
    if (latestLines.length === 0) {
      return {
        latestStartLine: Math.max(1, latestStartLine),
        archiveChain: chain,
        lastLoggedAbsoluteY,
      };
    }

    const fromMetaPreFile = parsePreFileFromLatest(this.latestPath);
    if (fromMetaPreFile) {
      const parsed = parseArchiveName(fromMetaPreFile);
      if (parsed) {
        latestStartLine = parsed.end + 1;
      }
    }

    const latestStart = Math.max(1, latestStartLine);
    const latestEnd = latestStart + latestLines.length - 1;
    const archivedName = `${latestStart}~${latestEnd}.log.html`;
    const archivedPath = join(this.outputDir, archivedName);

    if (!existsSync(archivedPath)) {
      renameSync(this.latestPath, archivedPath);
    } else {
      rmSync(this.latestPath, { force: true });
    }

    if (!chain.includes(archivedName)) {
      chain.push(archivedName);
    }
    const archivedSource = this.getArchiveSourceByIndex(chain, chain.indexOf(archivedName));
    writeArchiveFile(
      archivedPath,
      {
        status: "IDLE",
        cursorRow: 1,
        cursorCol: 1,
        logStyle: "rich",
        preFile: archivedSource.preFile,
        viewportBase: 0,
      },
      archivedSource,
      latestLines,
    );

    return {
      latestStartLine: latestEnd + 1,
      archiveChain: chain,
      lastLoggedAbsoluteY: Math.max(lastLoggedAbsoluteY, latestEnd),
    };
  }

  private getArchiveSourceByIndex(chain: string[], index: number): SourceMeta {
    if (index < 0 || index >= chain.length) {
      throw new Error(`Invalid archive chain index: ${index}`);
    }
    const fileName = chain[index];
    const preFile = index > 0 ? chain[index - 1] : null;
    const nextFile = index < chain.length - 1 ? chain[index + 1] : "latest.log.html";
    return {
      fileName,
      preFile,
      nextFile,
      updatedAt: new Date().toISOString(),
    };
  }
}
