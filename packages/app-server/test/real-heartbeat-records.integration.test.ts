import { describe, expect, test } from "bun:test";

import { createRealKernelHarness, REAL_MODEL_PROJECT_ROOT, waitForRealValue } from "../test-support/real-kernel-harness";
import { runRealSimpleReplyScenario } from "../test-support/real-loopbus-scenarios";
import { resolveRealModelConfig } from "../test-support/real-model-cache";

const hasRealModel =
  process.env.AGENTER_RUN_REAL_LOOPBUS === "1" && resolveRealModelConfig(REAL_MODEL_PROJECT_ROOT) !== null;
const realTest = hasRealModel ? test : test.skip;

describe("Feature: real Heartbeat record materialization", () => {
  realTest(
    "Scenario: Given real model and compact cycles When Heartbeat records are queried Then mixed records stay ascending and latest is the tail row",
    async () => {
      const harness = await createRealKernelHarness({ sessionName: "real-heartbeat-records" });
      if (!harness) {
        throw new Error("expected real kernel harness");
      }

      try {
        await runRealSimpleReplyScenario(harness);
        const afterReplyPage = await waitForRealValue(
          () => {
            const page = harness.kernel.pageHeartbeatRecords(harness.session.id, {
              pageSize: 20,
              pageCount: 1,
              anchor: { kind: "latest" },
            });
            return page.records.some((record) => record.kind === "model_call") &&
              page.records.some((record) => record.kind === "config")
              ? page
              : null;
          },
          { label: "real model Heartbeat model_call and config records", timeoutMs: 60_000 },
        );

        const compactRequest = harness.kernel.requestRuntimeCompact(harness.session.id);
        expect(compactRequest.ok).toBe(true);

        const afterCompactPage = await waitForRealValue(
          () => {
            const page = harness.kernel.pageHeartbeatRecords(harness.session.id, {
              pageSize: 20,
              pageCount: 1,
              anchor: { kind: "latest" },
            });
            return page.totalRecords > afterReplyPage.totalRecords && page.records.some((record) => record.kind === "compact")
              ? page
              : null;
          },
          { label: "real compact Heartbeat record", timeoutMs: 180_000 },
        );

        expect(afterCompactPage.totalRecords).toBeGreaterThanOrEqual(afterReplyPage.totalRecords);
        expect(afterCompactPage.records.map((record) => record.startedAt)).toEqual(
          [...afterCompactPage.records.map((record) => record.startedAt)].sort((left, right) => left - right),
        );
        expect(afterCompactPage.latestRecordId).toBe(afterCompactPage.records.at(-1)?.id ?? null);
        const recordKinds = new Set(afterCompactPage.records.map((record) => record.kind));
        expect(recordKinds.has("config")).toBe(true);
        expect(recordKinds.has("model_call")).toBe(true);
        expect(recordKinds.has("compact")).toBe(true);
      } finally {
        await harness.stop();
      }
    },
    { timeout: 300_000 },
  );
});
