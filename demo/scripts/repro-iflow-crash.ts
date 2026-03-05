import { spawn, spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { argv, cwd as getCwd, kill as killProcess } from "node:process";

interface ReproConfig {
  runs: number;
  durationMs: number;
  agentCwd: string;
}

interface ReproCase {
  id: string;
  command: string[];
  token: string;
}

interface ReproResult {
  caseId: string;
  run: number;
  endedEarly: boolean;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  hasCrashMarker: boolean;
  markers: string[];
  bytes: number;
  logFile: string;
}

const DEFAULT_RUNS = 5;
const DEFAULT_DURATION_MS = 7000;
const MARKERS = ["bun.report", "panic:", "Segmentation fault", "AddressSanitizer"] as const;

const sleep = (ms: number): Promise<void> => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

const parseArgs = (rawArgs: string[]): ReproConfig => {
  let runs = DEFAULT_RUNS;
  let durationMs = DEFAULT_DURATION_MS;
  let agentCwd = resolve(getCwd(), "tmp");

  for (const arg of rawArgs) {
    if (arg.startsWith("--runs=")) {
      const parsed = Number.parseInt(arg.slice("--runs=".length), 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        runs = parsed;
      }
    } else if (arg.startsWith("--duration-ms=")) {
      const parsed = Number.parseInt(arg.slice("--duration-ms=".length), 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        durationMs = parsed;
      }
    } else if (arg.startsWith("--cwd=")) {
      const value = arg.slice("--cwd=".length);
      if (value.length > 0) {
        agentCwd = resolve(getCwd(), value);
      }
    }
  }

  return { runs, durationMs, agentCwd };
};

const nowTag = (): string => new Date().toISOString().replace(/[:.]/g, "-");

const makeCases = (agentCwd: string): ReproCase[] => {
  const makeToken = (id: string): string => `--repro-token=${id}-${Date.now()}`;
  return [
    {
      id: "start_with_cwd",
      token: makeToken("start_with_cwd"),
      command: ["bun", "run", "src/index.terminal-devtools.tsx", `--cwd=${agentCwd}`],
    },
    {
      id: "start_without_cwd",
      token: makeToken("start_without_cwd"),
      command: ["bun", "run", "src/index.terminal-devtools.tsx"],
    },
    {
      id: "watch_with_cwd",
      token: makeToken("watch_with_cwd"),
      command: ["bun", "--watch", "run", "src/index.terminal-devtools.tsx", "--", `--cwd=${agentCwd}`],
    },
    {
      id: "watch_without_cwd",
      token: makeToken("watch_without_cwd"),
      command: ["bun", "--watch", "run", "src/index.terminal-devtools.tsx", "--"],
    },
  ].map((item) => ({
    ...item,
    command: item.command.concat(item.token),
  }));
};

const hasMarker = (content: string): string[] => MARKERS.filter((marker) => content.includes(marker));

const runOne = async (item: ReproCase, run: number, durationMs: number, rawLogDir: string): Promise<ReproResult> => {
  const logFile = resolve(rawLogDir, `${item.id}.run-${run}.log`);
  const child = spawn("script", ["-q", logFile, ...item.command], {
    cwd: getCwd(),
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  let endedEarly = false;
  const startedAt = Date.now();
  while (Date.now() - startedAt < durationMs) {
    const exitCode = child.exitCode;
    if (exitCode !== null) {
      endedEarly = true;
      break;
    }
    await sleep(150);
  }

  const pgid = -child.pid;
  if (!endedEarly) {
    try {
      killProcess(pgid, "SIGTERM");
    } catch {
      // ignore cleanup race
    }
    await sleep(500);
    if (child.exitCode === null) {
      try {
        killProcess(pgid, "SIGKILL");
      } catch {
        // ignore cleanup race
      }
    }
  }

  // script sometimes leaves Bun watch children alive; clean by unique token.
  spawnSync("pkill", ["-9", "-f", "--", item.token], { stdio: "ignore" });

  const content = await readFile(logFile, "utf8").catch(() => "");
  const markers = hasMarker(content);
  return {
    caseId: item.id,
    run,
    endedEarly,
    exitCode: child.exitCode,
    signal: child.signalCode,
    hasCrashMarker: markers.length > 0,
    markers,
    bytes: content.length,
    logFile,
  };
};

const toMarkdown = (results: ReproResult[], config: ReproConfig): string => {
  const lines: string[] = [];
  lines.push(`# terminal-devtools crash repro report`);
  lines.push("");
  lines.push(`- generatedAt: ${new Date().toISOString()}`);
  lines.push(`- runs: ${config.runs}`);
  lines.push(`- durationMs: ${config.durationMs}`);
  lines.push(`- agentCwd: ${config.agentCwd}`);
  lines.push("");
  lines.push("| case | run | endedEarly | exitCode | signal | crashMarker | bytes |");
  lines.push("| --- | ---: | :---: | ---: | :---: | :---: | ---: |");
  for (const item of results) {
    lines.push(
      `| ${item.caseId} | ${item.run} | ${item.endedEarly ? "yes" : "no"} | ${item.exitCode ?? ""} | ${item.signal ?? ""} | ${
        item.hasCrashMarker ? "yes" : "no"
      } | ${item.bytes} |`,
    );
  }

  const crashCount = results.filter((item) => item.hasCrashMarker).length;
  lines.push("");
  lines.push(`- crashMarkerCount: ${crashCount}/${results.length}`);
  return lines.join("\n");
};

const main = async (): Promise<void> => {
  const config = parseArgs(argv.slice(2));
  const outRoot = resolve(getCwd(), "logs/terminal-devtools/analysis");
  const rawLogDir = resolve(outRoot, "raw");
  await mkdir(rawLogDir, { recursive: true });

  const cases = makeCases(config.agentCwd);
  const allResults: ReproResult[] = [];
  for (const item of cases) {
    for (let run = 1; run <= config.runs; run += 1) {
      const result = await runOne(item, run, config.durationMs, rawLogDir);
      allResults.push(result);
      const markerText = result.markers.length > 0 ? result.markers.join(",") : "none";
      console.log(
        `[${item.id}] run=${run} early=${result.endedEarly ? "yes" : "no"} code=${result.exitCode ?? "null"} signal=${
          result.signal ?? "null"
        } marker=${markerText}`,
      );
    }
  }

  const tag = nowTag();
  const jsonFile = resolve(outRoot, `report-${tag}.json`);
  const mdFile = resolve(outRoot, `report-${tag}.md`);
  await writeFile(jsonFile, `${JSON.stringify({ config, results: allResults }, null, 2)}\n`, "utf8");
  await writeFile(mdFile, `${toMarkdown(allResults, config)}\n`, "utf8");
  console.log(`saved: ${jsonFile}`);
  console.log(`saved: ${mdFile}`);
};

await main();
