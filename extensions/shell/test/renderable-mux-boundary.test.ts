import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const renderableMuxRoot = join(import.meta.dir, "..", "src", "renderable-mux");
const shellSrcRoot = join(import.meta.dir, "..", "src");
const forbiddenTokens = [
  "@agenter/app-server",
  "@agenter/client-sdk",
  "@agenter/message-system",
  "Avatar",
  "MessageRoom",
  "TerminalSystem",
  "AttentionSystem",
  "tmux-host",
  "tmux-statusbar",
  "tmux-action",
];

const readSourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      return readSourceFiles(path);
    }
    return path.endsWith(".ts") ? [path] : [];
  });

describe("Feature: shell renderable mux boundary", () => {
  test("Scenario: Given renderable mux source files When inspected Then product and tmux-host concepts stay outside the core", () => {
    const files = readSourceFiles(renderableMuxRoot);
    const violations = files.flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return forbiddenTokens
        .filter((token) => source.includes(token))
        .map((token) => `${file.replace(`${renderableMuxRoot}/`, "")}:${token}`);
    });

    expect(violations).toEqual([]);
  });

  test("Scenario: Given shell source files When inspected Then legacy shell package imports stay out of shell", () => {
    const files = readSourceFiles(shellSrcRoot);
    const forbiddenImports = [
      'from "agenter-ext-shell',
      "from 'agenter-ext-shell",
      'require("agenter-ext-shell',
      "require('agenter-ext-shell",
      "extensions/shell-old",
      'from "../shell-old',
      "from '../shell-old",
      "CliShell",
      "cliShell",
    ];
    const violations = files.flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return forbiddenImports
        .filter((token) => source.includes(token))
        .map((token) => `${file.replace(`${shellSrcRoot}/`, "")}:${token}`);
    });

    expect(violations).toEqual([]);
  });
});
