import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "bun:test";

import { AgenticTerminal } from "../src/agentic-terminal";

const waitUntil = async (predicate: () => boolean, timeoutMs = 1500): Promise<void> => {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("timeout waiting condition");
    }
    await Bun.sleep(25);
  }
};

const hasGit = (): boolean => {
  const result = Bun.spawnSync({
    cmd: ["git", "--version"],
    stdout: "pipe",
    stderr: "pipe",
  });
  return result.exitCode === 0;
};

test("AgenticTerminal writes semantic html files in workspace", async () => {
  const terminal = new AgenticTerminal("sh", ["-lc", "printf 'hello\\n'"], {
    debounceMs: 20,
    throttleMs: 120,
    maxLinesPerFile: 50,
    cols: 80,
    rows: 10,
  });

  terminal.start();
  await Bun.sleep(180);
  await terminal.forceCommit();

  const workspace = terminal.workspace;
  const latest = join(workspace, "output", "latest.log.html");

  await waitUntil(() => existsSync(latest), 1200);
  const content = readFileSync(latest, "utf8");
  expect(content).toContain("meta:");
  expect(content).toContain('status: "');
  expect(content.toLowerCase()).toContain("hello");

  await terminal.destroy(true);
  rmSync(workspace, { recursive: true, force: true });
});

test("AgenticTerminal exposes structured snapshots", async () => {
  const terminal = new AgenticTerminal("sh", ["-lc", "printf 'structured\\n'"], {
    debounceMs: 20,
    throttleMs: 120,
    cols: 80,
    rows: 10,
  });

  let seen = 0;
  let latestText = "";
  const stopStructured = terminal.onStructured((snapshot) => {
    seen += 1;
    const line = snapshot.richLines.find((item) => item.spans.length > 0);
    latestText = line?.spans.map((span) => span.text).join("") ?? latestText;
  });

  terminal.start();
  await Bun.sleep(180);
  await terminal.forceCommit();

  const latest = terminal.getLatestStructured();
  expect(seen).toBeGreaterThan(0);
  expect(latest.seq).toBeGreaterThan(0);
  expect(latest.status === "BUSY" || latest.status === "IDLE").toBe(true);
  expect(latest.rows).toBe(10);
  expect(latest.cols).toBe(80);
  expect(latestText.toLowerCase()).toContain("structured");

  stopStructured();
  const workspace = terminal.workspace;
  await terminal.destroy(true);
  rmSync(workspace, { recursive: true, force: true });
});

test("AgenticTerminal consumes mixed input files from input/pending", async () => {
  const terminal = new AgenticTerminal("cat", [], {
    debounceMs: 20,
    throttleMs: 120,
    cols: 60,
    rows: 8,
  });

  terminal.start();
  const workspace = terminal.workspace;
  const pending = join(workspace, "input", "pending", "001.xml");
  writeFileSync(pending, `hello<key data="enter"/>`, "utf8");

  await Bun.sleep(350);
  await terminal.forceCommit();

  const latest = readFileSync(join(workspace, "output", "latest.log.html"), "utf8");
  expect(latest.toLowerCase()).toContain("hello");
  expect(existsSync(join(workspace, "input", "done", "001.xml.done"))).toBe(true);

  await Bun.sleep(2200);
  const latestAfterIdle = readFileSync(join(workspace, "output", "latest.log.html"), "utf8");
  expect(latestAfterIdle).toContain('status: "IDLE"');

  await terminal.destroy(true);
  rmSync(workspace, { recursive: true, force: true });
});

test("AgenticTerminal writes plain log lines when logStyle=plain", async () => {
  const terminal = new AgenticTerminal("sh", ["-lc", "printf '\\033[31mred\\033[0m <x>\\n'"], {
    debounceMs: 20,
    throttleMs: 120,
    maxLinesPerFile: 50,
    cols: 80,
    rows: 10,
    logStyle: "plain",
  });

  terminal.start();
  await Bun.sleep(180);
  await terminal.forceCommit();

  const workspace = terminal.workspace;
  const latest = join(workspace, "output", "latest.log.html");
  await waitUntil(() => existsSync(latest), 1200);
  const content = readFileSync(latest, "utf8");
  expect(content).toContain('log-style: "plain"');
  expect(content).not.toContain("<red>");
  expect(content).toContain("red &lt;x&gt;");

  await terminal.destroy(true);
  rmSync(workspace, { recursive: true, force: true });
});

test("AgenticTerminal keeps <cursor/> in plain logStyle", async () => {
  const terminal = new AgenticTerminal("cat", [], {
    debounceMs: 20,
    throttleMs: 120,
    cols: 60,
    rows: 8,
    logStyle: "plain",
  });

  terminal.start();
  await Bun.sleep(220);
  await terminal.forceCommit();

  const workspace = terminal.workspace;
  const latest = readFileSync(join(workspace, "output", "latest.log.html"), "utf8");
  expect(latest).toContain('log-style: "plain"');
  expect(latest).toContain("<cursor/>");

  await terminal.destroy(true);
  rmSync(workspace, { recursive: true, force: true });
});

test("AgenticTerminal git-log normal creates workspace git history", async () => {
  if (!hasGit()) {
    return;
  }
  const terminal = new AgenticTerminal("sh", ["-lc", "printf 'git-log\\n'"], {
    debounceMs: 20,
    throttleMs: 120,
    cols: 80,
    rows: 10,
    gitLog: "normal",
  });

  terminal.start();
  await Bun.sleep(300);
  await terminal.forceCommit();
  await Bun.sleep(2200);
  await terminal.destroy(true);

  const workspace = terminal.workspace;
  expect(existsSync(join(workspace, ".git"))).toBe(true);
  expect(existsSync(join(workspace, "debug", "git-log.ndjson"))).toBe(true);

  const history = Bun.spawnSync({
    cmd: ["git", "-C", workspace, "log", "--pretty=%s", "-n", "8"],
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(history.exitCode).toBe(0);
  const subject = new TextDecoder().decode(history.stdout);
  expect(subject).toContain("ati(log):");

  rmSync(workspace, { recursive: true, force: true });
});
