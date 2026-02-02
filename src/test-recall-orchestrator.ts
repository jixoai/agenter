#!/usr/bin/env bun
/**
 * Recall Orchestrator Integration Tests
 */
import { recallStream } from "./recall-orchestrator.js";
import { loadEnv } from "./utils.js";
loadEnv();

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function renderFrame(frame: any, index: number) {
  const ts = `[${index.toString().padStart(3, "0")}]`;

  switch (frame.type) {
    case "start":
      log(`${ts} START: "${frame.trigger}"`, "green");
      break;
    case "activate":
      log(`${ts} ACTIVATE round ${frame.round}`, "cyan");
      break;
    case "hold":
      log(`${ts} HOLD slots`, "blue");
      break;
    case "feel":
      log(`${ts} FEEL ${frame.data.valence}`, "magenta");
      break;
    case "complete":
      log(`${ts} COMPLETE`, "green");
      log(`    Goal: ${frame.state.current_goal}`, "green");
      break;
  }
}

async function testRecallFlow() {
  log("\n[TEST] Full Recall Flow", "green");

  const message = "What's my name";
  log(`Input: "${message}"`, "reset");

  const frames: any[] = [];
  const start = Date.now();

  try {
    for await (const frame of recallStream(message)) {
      frames.push(frame);
      renderFrame(frame, frames.length);
    }
    log(`OK - ${frames.length} frames, ${Date.now() - start}ms`, "green");
  } catch (err) {
    log(`FAIL: ${err}`, "red");
  }
}

async function runTests() {
  log("Recall Orchestrator Tests", "green");

  if (!process.env.DEEPSEEK_API_TOKEN) {
    log("ERROR: DEEPSEEK_API_TOKEN not set", "red");
    process.exit(1);
  }

  await testRecallFlow();

  log("\nAll tests completed", "green");
}

runTests();
