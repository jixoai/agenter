import { z } from "zod";

import type { LoopCompactPolicySettings, LoopRetryPolicySettings } from "./types";

export interface ResolvedLoopRetryPolicy {
  mode: "exponential";
  maxAttempts: number | null;
  initialBackoffMs: number;
  multiplier: number;
  maxBackoffMs: number;
  resetOnExternalInput: boolean;
  resetOnProgress: boolean;
}

export interface ResolvedLoopCompactPolicy {
  threshold: {
    enabled: boolean;
    promptFraction: number | null;
  };
  recovery: {
    attentionRetry: boolean;
    contextOverflow: boolean;
    externalContinuationLimit: boolean;
    timeout: boolean;
  };
}

export const loopRetryPolicySchema = z
  .object({
    mode: z.literal("exponential").describe("Retry progression mode.").optional(),
    maxAttempts: z
      .number()
      .int()
      .positive()
      .nullable()
      .describe("Maximum equivalent failure attempts before entering blocked state. Null means never hard-block.")
      .optional(),
    initialBackoffMs: z.number().int().positive().describe("Initial recovery backoff in milliseconds.").optional(),
    multiplier: z.number().gt(1).describe("Exponential backoff multiplier for equivalent failures.").optional(),
    maxBackoffMs: z.number().int().positive().describe("Maximum recovery backoff in milliseconds.").optional(),
    resetOnExternalInput: z
      .boolean()
      .describe("Whether new external input resets equivalent-failure retry progression.")
      .optional(),
    resetOnProgress: z
      .boolean()
      .describe("Whether durable runtime progress resets equivalent-failure retry progression.")
      .optional(),
  })
  .describe("Durable runtime retry policy for attention containment and scheduler recovery.");

export const loopCompactPolicySchema = z
  .object({
    threshold: z
      .object({
        enabled: z.boolean().describe("Whether prompt-threshold compaction is enabled.").optional(),
        promptFraction: z
          .number()
          .gt(0)
          .lte(1)
          .describe("Prompt-token fraction that triggers threshold compaction when maxToken is known.")
          .optional(),
      })
      .describe("Threshold-based prompt-window compaction policy.")
      .optional(),
    recovery: z
      .object({
        attentionRetry: z.boolean().describe("Whether attention no-progress recovery may trigger compact.").optional(),
        contextOverflow: z.boolean().describe("Whether context-overflow recovery may trigger compact.").optional(),
        externalContinuationLimit: z
          .boolean()
          .describe("Whether external continuation limit may trigger compact.")
          .optional(),
        timeout: z.boolean().describe("Whether timeout recovery may trigger compact.").optional(),
      })
      .describe("Recovery-triggered compact policy.")
      .optional(),
  })
  .describe("Durable runtime compact policy for threshold and recovery-driven compaction.");

export const DEFAULT_LOOP_RETRY_POLICY: ResolvedLoopRetryPolicy = {
  mode: "exponential",
  maxAttempts: null,
  initialBackoffMs: 600,
  multiplier: 2,
  maxBackoffMs: 5_000,
  resetOnExternalInput: true,
  resetOnProgress: true,
};

export const DEFAULT_LOOP_COMPACT_POLICY: ResolvedLoopCompactPolicy = {
  threshold: {
    enabled: true,
    promptFraction: 0.75,
  },
  recovery: {
    attentionRetry: true,
    contextOverflow: true,
    externalContinuationLimit: true,
    timeout: false,
  },
};

export const resolveLoopRetryPolicy = (
  input?: LoopRetryPolicySettings | null,
): ResolvedLoopRetryPolicy => ({
  mode: "exponential",
  maxAttempts:
    typeof input?.maxAttempts === "number" && Number.isInteger(input.maxAttempts) && input.maxAttempts > 0
      ? input.maxAttempts
      : input?.maxAttempts === null
        ? null
        : DEFAULT_LOOP_RETRY_POLICY.maxAttempts,
  initialBackoffMs:
    typeof input?.initialBackoffMs === "number" && Number.isInteger(input.initialBackoffMs) && input.initialBackoffMs > 0
      ? input.initialBackoffMs
      : DEFAULT_LOOP_RETRY_POLICY.initialBackoffMs,
  multiplier:
    typeof input?.multiplier === "number" && Number.isFinite(input.multiplier) && input.multiplier > 1
      ? input.multiplier
      : DEFAULT_LOOP_RETRY_POLICY.multiplier,
  maxBackoffMs:
    typeof input?.maxBackoffMs === "number" && Number.isInteger(input.maxBackoffMs) && input.maxBackoffMs > 0
      ? input.maxBackoffMs
      : DEFAULT_LOOP_RETRY_POLICY.maxBackoffMs,
  resetOnExternalInput:
    typeof input?.resetOnExternalInput === "boolean"
      ? input.resetOnExternalInput
      : DEFAULT_LOOP_RETRY_POLICY.resetOnExternalInput,
  resetOnProgress:
    typeof input?.resetOnProgress === "boolean" ? input.resetOnProgress : DEFAULT_LOOP_RETRY_POLICY.resetOnProgress,
});

export const resolveLoopCompactPolicy = (
  input?: LoopCompactPolicySettings | null,
  legacy?: {
    compactThreshold?: number | null;
  },
): ResolvedLoopCompactPolicy => {
  const explicitThresholdFraction =
    typeof input?.threshold?.promptFraction === "number" &&
    Number.isFinite(input.threshold.promptFraction) &&
    input.threshold.promptFraction > 0 &&
    input.threshold.promptFraction <= 1
      ? input.threshold.promptFraction
      : null;
  const legacyThresholdFraction =
    typeof legacy?.compactThreshold === "number" &&
    Number.isFinite(legacy.compactThreshold) &&
    legacy.compactThreshold > 0 &&
    legacy.compactThreshold <= 1
      ? legacy.compactThreshold
      : null;
  const thresholdFraction =
    explicitThresholdFraction ??
    legacyThresholdFraction ??
    DEFAULT_LOOP_COMPACT_POLICY.threshold.promptFraction;
  const thresholdConfigured = explicitThresholdFraction !== null || legacyThresholdFraction !== null;

  return {
    threshold: {
      enabled:
        typeof input?.threshold?.enabled === "boolean"
          ? input.threshold.enabled
          : thresholdConfigured
            ? true
            : DEFAULT_LOOP_COMPACT_POLICY.threshold.enabled,
      promptFraction: thresholdFraction,
    },
    recovery: {
      attentionRetry:
        typeof input?.recovery?.attentionRetry === "boolean"
          ? input.recovery.attentionRetry
          : DEFAULT_LOOP_COMPACT_POLICY.recovery.attentionRetry,
      contextOverflow:
        typeof input?.recovery?.contextOverflow === "boolean"
          ? input.recovery.contextOverflow
          : DEFAULT_LOOP_COMPACT_POLICY.recovery.contextOverflow,
      externalContinuationLimit:
        typeof input?.recovery?.externalContinuationLimit === "boolean"
          ? input.recovery.externalContinuationLimit
          : DEFAULT_LOOP_COMPACT_POLICY.recovery.externalContinuationLimit,
      timeout:
        typeof input?.recovery?.timeout === "boolean"
          ? input.recovery.timeout
          : DEFAULT_LOOP_COMPACT_POLICY.recovery.timeout,
    },
  };
};
