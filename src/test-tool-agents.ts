#!/usr/bin/env bun
/**
 * Tool AI Integration Tests
 * Using real DeepSeek API calls
 */
import {
  hippocampusActivate,
  prefrontalManage,
  amygdalaFeel,
  comparatorCompare,
} from "./llm/tool-agents.js";

// Load env (Bun内置支持)
import { loadEnv } from "./utils.js";
loadEnv();

const TEST_CONFIG = {
  model: "deepseek-chat",
  timeout: 30000,
};

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

async function testHippocampus() {
  log("\n[TEST] Hippocampus (Memory Activation)", "cyan");

  const testCases = [
    { cue: "What's my name", modality: "semantic" as const },
    { cue: "What did we discuss last time", modality: "episodic" as const },
  ];

  for (const tc of testCases) {
    log(`  Testing: "${tc.cue}"`, "yellow");
    try {
      const start = Date.now();
      const result = await hippocampusActivate(tc.cue, tc.modality);
      const duration = Date.now() - start;

      log(`  OK (${duration}ms)`, "green");
      log(`    Pattern: ${result.activation_pattern}`, "reset");
      log(`    Memories: ${result.memories.length}`, "reset");
    } catch (err) {
      log(`  FAIL: ${err}`, "red");
    }
  }
}

async function testPrefrontal() {
  log("\n[TEST] Prefrontal (Working Memory)", "blue");

  try {
    const result = await prefrontalManage("User name is Gaubee", []);
    log(`  OK - Slots: ${result.slots.filter(Boolean).length}/4`, "green");
  } catch (err) {
    log(`  FAIL: ${err}`, "red");
  }
}

async function testAmygdala() {
  log("\n[TEST] Amygdala (Emotion)", "magenta");

  const testCases = [
    "I'm very happy today",
    "I'm sad",
    "What's the time",
  ];

  for (const content of testCases) {
    log(`  Testing: "${content.slice(0, 30)}..."`, "yellow");
    try {
      const result = await amygdalaFeel(content);
      const icon = result.valence === "positive" ? "😊" : result.valence === "negative" ? "😰" : "😐";
      log(`  OK ${icon} ${result.priority}`, "green");
    } catch (err) {
      log(`  FAIL: ${err}`, "red");
    }
  }
}

async function testComparator() {
  log("\n[TEST] Comparator", "cyan");

  try {
    const result = await comparatorCompare("A", "B", "similarity");
    log(`  OK - Similarity: ${(result.similarity * 100).toFixed(0)}%`, "green");
  } catch (err) {
    log(`  FAIL: ${err}`, "red");
  }
}

async function runTests() {
  log("Starting Tool AI Integration Tests", "green");
  log(`Model: ${TEST_CONFIG.model}`, "reset");

  if (!process.env.DEEPSEEK_API_TOKEN) {
    log("ERROR: DEEPSEEK_API_TOKEN not set", "red");
    process.exit(1);
  }

  const start = Date.now();

  await testHippocampus();
  await testPrefrontal();
  await testAmygdala();
  await testComparator();

  log(`\nAll tests completed (${Date.now() - start}ms)`, "green");
}

runTests();
