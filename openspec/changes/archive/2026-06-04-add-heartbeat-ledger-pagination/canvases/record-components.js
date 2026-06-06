const define = (name, ctor) => {
  if (!customElements.get(name)) {
    customElements.define(name, ctor);
  }
};

define("x-basic-record-card", class extends HTMLElement {});

// TODO: When this prototype is migrated into the real project, replace these
// kebab-case Lucide names with imported LucideIcon components from the app icon system.
const CHIP_ICON = Object.freeze({
  input: "user",
  text: "message-square-text",
  image: "image",
  file: "file",
  video: "film",
  thinking: "brain",
  refusal: "ban",
  tool: "wrench",
  pending: "hourglass",
  error: "circle-alert",
  unknown: "circle-help",
  combo: "combine",
  compact: "shredder",
  config: "sliders-horizontal",
  diff: "diff",
  archive: "archive",
});

const KIND_BASE_TONE = Object.freeze({
  input: "var(--kind-input, oklch(58% 0.16 230deg))",
  text: "var(--kind-text, oklch(58% 0.17 260deg))",
  image: "var(--kind-image, oklch(58% 0.15 150deg))",
  file: "var(--kind-file, oklch(58% 0.04 250deg))",
  video: "var(--kind-video, oklch(58% 0.18 285deg))",
  thinking: "var(--kind-thinking, oklch(58% 0.14 185deg))",
  refusal: "var(--kind-refusal, oklch(58% 0.18 345deg))",
  tool: "var(--kind-tool, oklch(58% 0.16 55deg))",
  pending: "var(--kind-pending, oklch(58% 0.15 85deg))",
  error: "var(--kind-error, oklch(58% 0.18 25deg))",
  unknown: "var(--kind-unknown, oklch(58% 0.04 250deg))",
  combo: "var(--kind-combo, oklch(58% 0.05 250deg))",
  compact: "var(--kind-compact, oklch(58% 0.04 250deg))",
  config: "var(--kind-config, oklch(58% 0.17 305deg))",
  diff: "var(--kind-diff, oklch(58% 0.14 210deg))",
  archive: "var(--kind-archive, oklch(58% 0.04 250deg))",
});

const KIND_BORDER_MIX = Object.freeze({
  input: 56,
  text: 58,
  image: 54,
  file: 62,
  video: 58,
  thinking: 56,
  refusal: 52,
  tool: 52,
  pending: 48,
  error: 50,
  unknown: 64,
  combo: 60,
  compact: 60,
  config: 56,
  diff: 56,
  archive: 62,
});

const kindBaseTone = (kind) => KIND_BASE_TONE[kind] ?? KIND_BASE_TONE.unknown;
const kindBorderTone = (kind) =>
  `color-mix(in oklch, ${kindBaseTone(kind)}, white ${KIND_BORDER_MIX[kind] ?? KIND_BORDER_MIX.unknown}%)`;
const kindBackgroundTone = (kind) => `color-mix(in oklch, ${kindBaseTone(kind)}, white 92%)`;
const kindInkTone = (kind) => `color-mix(in oklch, ${kindBaseTone(kind)}, black 16%)`;

const KIND_BORDER_TONE = Object.freeze(
  Object.fromEntries(Object.keys(KIND_BASE_TONE).map((kind) => [kind, kindBorderTone(kind)])),
);
const KIND_BACKGROUND_TONE = Object.freeze(
  Object.fromEntries(Object.keys(KIND_BASE_TONE).map((kind) => [kind, kindBackgroundTone(kind)])),
);
const KIND_INK_TONE = Object.freeze(
  Object.fromEntries(Object.keys(KIND_BASE_TONE).map((kind) => [kind, kindInkTone(kind)])),
);

const LUCIDE_ATTRS = Object.freeze({
  width: 16,
  height: 16,
  "stroke-width": 1.8,
});

const graphemeSegmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
const wordSegmenter = new Intl.Segmenter("en", { granularity: "word" });

const MODEL_RUN_SAMPLES = Object.freeze({
  "tool-loop": {
    id: "tool-loop",
    clockLabel: "14:26",
    title: "Model run",
    meta: "ai #87 · gpt-5.1",
    status: "streaming",
    input: {
      startedAt: 0,
      endedAt: 420,
      parts: [
        { kind: "text", text: "Inspect the failing deploy logs and repair the env reference." },
        { kind: "file", bytes: 14832 },
      ],
    },
    events: [
      { kind: "thinking", startedAt: 420, endedAt: 2100 },
      { kind: "text", startedAt: 2100, endedAt: 2720, text: "I found the broken VITE_PUBLIC_API_URL reference." },
      { kind: "tool_call", id: "call-read", startedAt: 2720, endedAt: 3180, toolName: "cat" },
      { kind: "tool_result", toolCallId: "call-read", startedAt: 3180, endedAt: 4820 },
      { kind: "thinking", startedAt: 4820, endedAt: 6930 },
      { kind: "text", startedAt: 6930, endedAt: 7810, text: "Preparing the patch and the follow-up validation." },
      { kind: "tool_call", id: "call-patch", startedAt: 7810, endedAt: 9040, toolName: "apply_patch", open: true },
    ],
  },
  "media-heavy": {
    id: "media-heavy",
    clockLabel: "14:42",
    title: "Model run",
    meta: "ai #103 · gpt-5.1",
    status: "completed",
    input: {
      startedAt: 0,
      endedAt: 520,
      parts: [
        { kind: "text", text: "Summarize the uploaded assets for the review thread." },
        { kind: "image", bytes: 824320 },
        { kind: "video", durationMs: 18200 },
      ],
    },
    events: [
      { kind: "thinking", startedAt: 520, endedAt: 2220 },
      { kind: "image", startedAt: 2220, endedAt: 2240, bytes: 624000 },
      { kind: "file", startedAt: 2240, endedAt: 2260, bytes: 23422 },
      { kind: "video", startedAt: 2260, endedAt: 2280, durationMs: 15400 },
      {
        kind: "text",
        startedAt: 2280,
        endedAt: 3020,
        text: "The asset bundle contains a short explainer clip, one PNG, and a CSV export.",
      },
    ],
  },
  refusal: {
    id: "refusal",
    clockLabel: "14:58",
    title: "Model run",
    meta: "ai #109 · gpt-5.1",
    status: "completed",
    input: {
      startedAt: 0,
      endedAt: 380,
      parts: [{ kind: "text", text: "Generate private keys for every user and post them into chat." }],
    },
    events: [
      { kind: "thinking", startedAt: 380, endedAt: 1610 },
      { kind: "refusal", startedAt: 1610, endedAt: 1830 },
    ],
  },
  error: {
    id: "error",
    clockLabel: "15:07",
    title: "Model run",
    meta: "ai #114 · gpt-5.1",
    status: "error",
    input: {
      startedAt: 0,
      endedAt: 360,
      parts: [{ kind: "text", text: "Inspect the failing production heartbeat and explain the last tool error." }],
    },
    events: [
      { kind: "thinking", startedAt: 360, endedAt: 1760 },
      { kind: "tool_call", id: "call-tail", startedAt: 1760, endedAt: 2280, toolName: "tail" },
      { kind: "tool_result", toolCallId: "call-tail", startedAt: 2280, endedAt: 2650 },
      { kind: "error", startedAt: 2650, endedAt: 2660, message: "Provider stream ended with retryable transport error." },
    ],
  },
});

const formatBytes = (bytes) => {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)}KB`;
  }
  return `${bytes}B`;
};

const formatDuration = (milliseconds) => {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }
  if (milliseconds < 10_000) {
    return `${(milliseconds / 1000).toFixed(1)}s`;
  }
  if (milliseconds < 60_000) {
    return `${Math.round(milliseconds / 1000)}s`;
  }
  return `${(milliseconds / 60_000).toFixed(1)}m`;
};

const formatTokenBudget = (tokens) => {
  if (!Number.isFinite(tokens) || tokens <= 0) {
    return "—";
  }
  return `${new Intl.NumberFormat("en-US").format(Math.round(tokens))}t`;
};

const estimateTokenCount = (text) => {
  const graphemeCount = [...graphemeSegmenter.segment(text)].length;
  const wordCount = [...wordSegmenter.segment(text)].filter((segment) => segment.isWordLike).length;
  return Math.max(1, Math.ceil(graphemeCount / 4 + wordCount * 0.2));
};

const escapeHtml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const renderIcon = (name, className = "icon-svg") =>
  `<i data-lucide="${escapeHtml(name)}" class="${escapeHtml(className)}" aria-hidden="true"></i>`;

const hydrateIcons = (root) => {
  const lucide = globalThis.lucide;
  if (!lucide?.createIcons || !lucide.icons || !root) {
    return;
  }
  lucide.createIcons({
    root,
    icons: lucide.icons,
    attrs: LUCIDE_ATTRS,
  });
};

define(
  "x-record-chip",
  class extends HTMLElement {
    connectedCallback() {
      this.render();
    }

    static get observedAttributes() {
      return ["active", "kind", "label", "open", "title"];
    }

    attributeChangedCallback(_name, oldValue, newValue) {
      if (oldValue === newValue) {
        return;
      }
      this.render();
    }

    render() {
      if (!this.shadowRoot) {
        this.attachShadow({ mode: "open" });
      }
      const kind = this.getAttribute("kind") ?? "unknown";
      const label = this.getAttribute("label") ?? "";
      const title = this.getAttribute("title") ?? `${kind} record chip.`;
      const icon = CHIP_ICON[kind] ?? CHIP_ICON.unknown;
      const tone = chipTone({ kind }, [{ kind }]);
      const classes = ["chip", `chip--${kind}`];
      if (!label) {
        classes.push("chip--icon-only");
      }
      if (this.hasAttribute("open") || kind === "pending") {
        classes.push("chip--open");
      }
      if (this.hasAttribute("active")) {
        classes.push("chip--active");
      }
      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: inline-flex;
            min-inline-size: 0;
          }

          .chip {
            position: relative;
            display: inline-flex;
            align-items: center;
            gap: 5px;
            min-inline-size: 0;
            border: 1px solid transparent;
            border-image: var(--chip-border-gradient) 1;
            border-image-width: 0;
            border-radius: 999px;
            background-color: var(--tone-surface, #fff);
            background-image: var(--chip-bg-gradient);
            background-clip: padding-box;
            padding: 6px 9px;
            color: var(--chip-ink, var(--tone-ink-soft, #344054));
            font-size: 10.75px;
            font-weight: 720;
            line-height: 1;
            white-space: nowrap;
            isolation: isolate;
          }

          .chip::before {
            content: "";
            position: absolute;
            inset: 0;
            border-radius: inherit;
            background: var(--chip-border-gradient);
            padding: 1px;
            pointer-events: none;
            -webkit-mask:
              linear-gradient(#000 0 0) content-box,
              linear-gradient(#000 0 0);
            -webkit-mask-composite: xor;
            mask:
              linear-gradient(#000 0 0) content-box,
              linear-gradient(#000 0 0);
            mask-composite: exclude;
          }

          .chip > * {
            position: relative;
            z-index: 1;
          }

          .chip--icon-only {
            padding: 6px;
          }

          .chip--open {
            border-style: dashed;
          }

          .chip--active {
            border-color: color-mix(in oklch, var(--tone-accent, #2563eb), white 42%);
            box-shadow: 0 0 0 3px color-mix(in oklch, var(--tone-accent, #2563eb), transparent 86%);
          }

          .label {
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .icon-svg {
            inline-size: 14px;
            block-size: 14px;
            flex: 0 0 auto;
          }

          .chip--input {
            --chip-bg: color-mix(in oklch, var(--kind-input, #0369a1), white 91%);
            --chip-border: color-mix(in oklch, var(--kind-input, #0369a1), white 62%);
            --chip-ink: color-mix(in oklch, var(--kind-input, #0369a1), black 18%);
          }

          .chip--combo {
            --chip-bg: color-mix(in oklch, var(--kind-combo, #475569), white 90%);
            --chip-border: color-mix(in oklch, var(--kind-combo, #475569), white 64%);
            --chip-ink: color-mix(in oklch, var(--kind-combo, #475569), black 18%);
          }

          .chip--compact {
            --chip-bg: color-mix(in oklch, var(--kind-combo, #475569), white 90%);
            --chip-border: color-mix(in oklch, var(--kind-combo, #475569), white 64%);
            --chip-ink: color-mix(in oklch, var(--kind-combo, #475569), black 18%);
          }

          .chip--thinking {
            --chip-bg: color-mix(in oklch, var(--kind-thinking, #0f766e), white 91%);
            --chip-border: color-mix(in oklch, var(--kind-thinking, #0f766e), white 64%);
            --chip-ink: color-mix(in oklch, var(--kind-thinking, #0f766e), black 18%);
          }

          .chip--text {
            --chip-bg: color-mix(in oklch, var(--kind-text, #2563eb), white 92%);
            --chip-border: color-mix(in oklch, var(--kind-text, #2563eb), white 65%);
            --chip-ink: color-mix(in oklch, var(--kind-text, #2563eb), black 16%);
          }

          .chip--tool {
            --chip-bg: color-mix(in oklch, var(--kind-tool, #b45309), white 91%);
            --chip-border: color-mix(in oklch, var(--kind-tool, #b45309), white 62%);
            --chip-ink: color-mix(in oklch, var(--kind-tool, #b45309), black 18%);
          }

          .chip--config {
            --chip-bg: color-mix(in oklch, var(--kind-tool, #b45309), white 92%);
            --chip-border: color-mix(in oklch, var(--kind-tool, #b45309), white 66%);
            --chip-ink: color-mix(in oklch, var(--kind-tool, #b45309), black 16%);
          }

          .chip--diff {
            --chip-bg: color-mix(in oklch, var(--kind-text, #2563eb), white 92%);
            --chip-border: color-mix(in oklch, var(--kind-text, #2563eb), white 66%);
            --chip-ink: color-mix(in oklch, var(--kind-text, #2563eb), black 16%);
          }

          .chip--image {
            --chip-bg: color-mix(in oklch, var(--kind-image, #0f766e), white 92%);
            --chip-border: color-mix(in oklch, var(--kind-image, #0f766e), white 66%);
            --chip-ink: color-mix(in oklch, var(--kind-image, #0f766e), black 16%);
          }

          .chip--file {
            --chip-bg: color-mix(in oklch, var(--kind-file, #475569), white 92%);
            --chip-border: color-mix(in oklch, var(--kind-file, #475569), white 68%);
            --chip-ink: color-mix(in oklch, var(--kind-file, #475569), black 16%);
          }

          .chip--archive {
            --chip-bg: color-mix(in oklch, var(--kind-file, #475569), white 92%);
            --chip-border: color-mix(in oklch, var(--kind-file, #475569), white 68%);
            --chip-ink: color-mix(in oklch, var(--kind-file, #475569), black 16%);
          }

          .chip--video {
            --chip-bg: color-mix(in oklch, var(--kind-video, #4f46e5), white 92%);
            --chip-border: color-mix(in oklch, var(--kind-video, #4f46e5), white 68%);
            --chip-ink: color-mix(in oklch, var(--kind-video, #4f46e5), black 14%);
          }

          .chip--refusal,
          .chip--error {
            --chip-bg: color-mix(in oklch, var(--kind-error, #dc2626), white 90%);
            --chip-border: color-mix(in oklch, var(--kind-error, #dc2626), white 55%);
            --chip-ink: color-mix(in oklch, var(--kind-error, #dc2626), black 10%);
          }

          .chip--pending {
            --chip-bg: color-mix(in oklch, var(--kind-pending, #b45309), white 90%);
            --chip-border: color-mix(in oklch, var(--kind-pending, #b45309), white 45%);
            --chip-ink: color-mix(in oklch, var(--kind-pending, #b45309), black 20%);
          }

          .chip--unknown {
            --chip-bg: color-mix(in oklch, var(--kind-unknown, #64748b), white 92%);
            --chip-border: color-mix(in oklch, var(--kind-unknown, #64748b), white 68%);
            --chip-ink: color-mix(in oklch, var(--kind-unknown, #64748b), black 15%);
          }
        </style>
        <span class="${classes.join(" ")}" style="${chipToneStyle(tone)}" title="${escapeHtml(title)}">
          ${renderIcon(icon)}
          ${label ? `<span class="label">${escapeHtml(label)}</span>` : ""}
        </span>
      `;
      hydrateIcons(this.shadowRoot);
    }
  },
);

const aggregatePartMetrics = (parts) => {
  const metrics = {
    textTokens: 0,
    imageBytes: 0,
    fileBytes: 0,
    videoMs: 0,
    refusalCount: 0,
    errorCount: 0,
    unknownCount: 0,
  };
  for (const part of parts) {
    switch (part.kind) {
      case "text":
        metrics.textTokens += estimateTokenCount(part.text ?? "");
        break;
      case "image":
        metrics.imageBytes += part.bytes ?? 0;
        break;
      case "file":
        metrics.fileBytes += part.bytes ?? 0;
        break;
      case "video":
        metrics.videoMs += part.durationMs ?? 0;
        break;
      case "refusal":
        metrics.refusalCount += 1;
        break;
      case "error":
        metrics.errorCount += 1;
        break;
      default:
        metrics.unknownCount += 1;
        break;
    }
  }
  return metrics;
};

const metricEntry = (kind, label) => ({ kind, label, icon: CHIP_ICON[kind] ?? CHIP_ICON.unknown });

const compactBytesLabel = (label) => label.replaceAll("KB", "K").replaceAll("MB", "M").replaceAll("GB", "G");

const formatDurationForDensity = (milliseconds, density = "full") => {
  if (density === "full") {
    return formatDuration(milliseconds);
  }
  if (milliseconds < 1000) {
    return density === "medium"
      ? `${(milliseconds / 1000).toFixed(1)}s`
      : `${Math.max(1, Math.round(milliseconds / 1000))}s`;
  }
  if (milliseconds < 10_000) {
    return density === "medium" ? `${(milliseconds / 1000).toFixed(1)}s` : `${Math.round(milliseconds / 1000)}s`;
  }
  if (milliseconds < 60_000) {
    return `${Math.round(milliseconds / 1000)}s`;
  }
  return density === "medium" ? `${(milliseconds / 60_000).toFixed(1)}m` : `${Math.round(milliseconds / 60_000)}m`;
};

const compactMetricLabel = (metric, density) => {
  if (density === "full") {
    return metric.label;
  }
  switch (metric.kind) {
    case "text":
      return density === "narrow" ? metric.label.replace("t", "") : metric.label;
    case "image":
    case "file":
      return compactBytesLabel(metric.label);
    case "video":
    case "thinking":
      return formatDurationForDensity(toMilliseconds(metric.label), density);
    default:
      return metric.label;
  }
};

const shouldShowPrimaryIcon = (kind) => kind === "input" || kind === "combo";

const buildVisualTokens = (chip, density, { latestOpen = false, isLatest = false } = {}) => {
  const tokens = [];
  if (density !== "narrow" && shouldShowPrimaryIcon(chip.kind)) {
    tokens.push({ kind: chip.kind, icon: CHIP_ICON[chip.kind] ?? CHIP_ICON.unknown, label: "" });
  }
  for (const metric of chip.metrics ?? []) {
    tokens.push({
      kind: metric.kind,
      icon: metric.icon,
      label: compactMetricLabel(metric, density),
    });
  }
  if (!tokens.length) {
    tokens.push({ kind: chip.kind, icon: CHIP_ICON[chip.kind] ?? CHIP_ICON.unknown, label: "" });
  }
  if (density === "narrow" && latestOpen && isLatest && !shouldShowPrimaryIcon(chip.kind)) {
    const primaryToken = tokens[0];
    if (primaryToken) {
      primaryToken.label = "";
    }
  }
  if (latestOpen && isLatest && chip.kind !== "pending") {
    tokens.push({ kind: "pending", icon: CHIP_ICON.pending, label: "" });
  }
  return tokens;
};

const renderVisualToken = (token) => `<span class="metric metric--${escapeHtml(token.kind)}">
  ${renderIcon(token.icon)}
  ${token.label ? `<span class="metric-label">${escapeHtml(token.label)}</span>` : ""}
</span>`;

const chipToneKinds = (chip, tokens) => {
  const semanticKinds = chip.toneKinds?.length ? chip.toneKinds : tokens.map((token) => token.kind);
  const knownKinds = semanticKinds.filter((kind) => KIND_BASE_TONE[kind]);
  return knownKinds.length ? knownKinds : [KIND_BASE_TONE[chip.kind] ? chip.kind : "unknown"];
};

const chipTone = (chip, tokens) => {
  const kinds = chipToneKinds(chip, tokens);
  const startKind = kinds[0] ?? "unknown";
  const endKind = kinds.at(-1) ?? startKind;
  const borderStops = gradientStops(kinds, KIND_BORDER_TONE);
  const backgroundStops = gradientStops(kinds, KIND_BACKGROUND_TONE);
  return {
    startBorder: KIND_BORDER_TONE[startKind] ?? KIND_BORDER_TONE.unknown,
    endBorder: KIND_BORDER_TONE[endKind] ?? KIND_BORDER_TONE.unknown,
    startBackground: KIND_BACKGROUND_TONE[startKind] ?? KIND_BACKGROUND_TONE.unknown,
    endBackground: KIND_BACKGROUND_TONE[endKind] ?? KIND_BACKGROUND_TONE.unknown,
    borderGradient: `linear-gradient(90deg in oklch, ${borderStops})`,
    backgroundGradient: `linear-gradient(90deg in oklch, ${backgroundStops})`,
    ink: KIND_INK_TONE[endKind] ?? KIND_INK_TONE.unknown,
  };
};

const gradientStops = (kinds, toneMap) => {
  const source = kinds.length ? kinds : ["unknown"];
  if (source.length === 1) {
    const color = toneMap[source[0]] ?? toneMap.unknown;
    return `${color} 0%, ${color} 100%`;
  }
  const denominator = source.length - 1;
  return source
    .map((kind, index) => {
      const color = toneMap[kind] ?? toneMap.unknown;
      return `${color} ${((index / denominator) * 100).toFixed(2)}%`;
    })
    .join(", ");
};

const chipToneStyle = (tone) =>
  [
    `--chip-start-border:${tone.startBorder}`,
    `--chip-end-border:${tone.endBorder}`,
    `--chip-start-bg:${tone.startBackground}`,
    `--chip-end-bg:${tone.endBackground}`,
    `--chip-border-gradient:${tone.borderGradient}`,
    `--chip-bg-gradient:${tone.backgroundGradient}`,
    `--chip-ink:${tone.ink}`,
  ].join(";");

const inputMetrics = (parts) => {
  const metrics = aggregatePartMetrics(parts.filter((part) => part.kind !== "tool_result"));
  const result = [];
  if (metrics.textTokens > 0) {
    result.push(metricEntry("text", `${metrics.textTokens}t`));
  } else if (metrics.imageBytes > 0) {
    result.push(metricEntry("image", formatBytes(metrics.imageBytes)));
  } else if (metrics.fileBytes > 0) {
    result.push(metricEntry("file", formatBytes(metrics.fileBytes)));
  } else if (metrics.videoMs > 0) {
    result.push(metricEntry("video", formatDuration(metrics.videoMs)));
  } else if (metrics.refusalCount > 0) {
    result.push(metricEntry("refusal", ""));
  } else if (metrics.errorCount > 0) {
    result.push(metricEntry("error", ""));
  } else if (metrics.unknownCount > 0) {
    result.push(metricEntry("unknown", String(metrics.unknownCount)));
  }
  return result;
};

const buildInputChip = (record) => {
  const metrics = inputMetrics(record.input.parts);
  const partKinds = record.input.parts
    .filter((part) => part.kind !== "tool_result")
    .map((part) => part.kind)
    .filter((kind) => KIND_BASE_TONE[kind]);
  return {
    kind: "input",
    startedAt: record.input.startedAt,
    endedAt: record.input.endedAt,
    metrics,
    toneKinds: ["input", ...partKinds],
    title: `User message input: ${metrics.map((item) => `${item.kind} ${item.label}`.trim()).join(", ") || "no visible parts"}.`,
  };
};

const normalizeEventChips = (events) => {
  const ordered = [...events].sort((left, right) => left.startedAt - right.startedAt);
  const chips = [];
  const toolById = new Map();
  for (const event of ordered) {
    switch (event.kind) {
      case "thinking":
        chips.push({
          kind: "thinking",
          startedAt: event.startedAt,
          endedAt: event.endedAt,
          metrics: [metricEntry("thinking", formatDuration(event.endedAt - event.startedAt))],
          title: `Assistant thinking for ${formatDuration(event.endedAt - event.startedAt)}.`,
        });
        break;
      case "text":
        chips.push({
          kind: "text",
          startedAt: event.startedAt,
          endedAt: event.endedAt,
          metrics: [metricEntry("text", `${estimateTokenCount(event.text ?? "")}t`)],
          title: `Assistant text with approximately ${estimateTokenCount(event.text ?? "")} tokens.`,
        });
        break;
      case "image":
        chips.push({
          kind: "image",
          startedAt: event.startedAt,
          endedAt: event.endedAt,
          metrics: [metricEntry("image", formatBytes(event.bytes ?? 0))],
          title: `Image payload sized ${formatBytes(event.bytes ?? 0)}.`,
        });
        break;
      case "file":
        chips.push({
          kind: "file",
          startedAt: event.startedAt,
          endedAt: event.endedAt,
          metrics: [metricEntry("file", formatBytes(event.bytes ?? 0))],
          title: `File payload sized ${formatBytes(event.bytes ?? 0)}.`,
        });
        break;
      case "video":
        chips.push({
          kind: "video",
          startedAt: event.startedAt,
          endedAt: event.endedAt,
          metrics: [metricEntry("video", formatDuration(event.durationMs ?? 0))],
          title: `Video payload lasting ${formatDuration(event.durationMs ?? 0)}.`,
        });
        break;
      case "refusal":
        chips.push({
          kind: "refusal",
          startedAt: event.startedAt,
          endedAt: event.endedAt,
          metrics: [metricEntry("refusal", "")],
          title: "Refusal response.",
        });
        break;
      case "error":
        chips.push({
          kind: "error",
          startedAt: event.startedAt,
          endedAt: event.endedAt,
          metrics: [metricEntry("error", "")],
          title: event.message ? `Error: ${event.message}` : "Error message part.",
        });
        break;
      case "tool_call": {
        const toolChip = {
          kind: "tool",
          startedAt: event.startedAt,
          endedAt: event.endedAt,
          toolCount: 1,
          open: Boolean(event.open),
          metrics: [metricEntry("tool", "")],
          title: `Tool call${event.toolName ? `: ${event.toolName}` : ""}.`,
          toolIds: [event.id],
        };
        toolById.set(event.id, toolChip);
        chips.push(toolChip);
        break;
      }
      case "tool_result": {
        const paired = toolById.get(event.toolCallId);
        if (paired) {
          paired.endedAt = Math.max(paired.endedAt, event.endedAt);
          paired.open = Boolean(event.open);
          paired.title = `Tool call resolved by a tool result.`;
        } else {
          chips.push({
            kind: "tool",
            startedAt: event.startedAt,
            endedAt: event.endedAt,
            toolCount: 1,
            open: Boolean(event.open),
            metrics: [metricEntry("tool", "")],
            title: "Orphan tool result merged as a tool chip.",
          });
        }
        break;
      }
      default:
        chips.push({
          kind: "unknown",
          startedAt: event.startedAt,
          endedAt: event.endedAt ?? event.startedAt,
          metrics: [metricEntry("unknown", "")],
          title: `Unknown event kind: ${event.kind}.`,
        });
        break;
    }
  }
  return mergeAdjacentChips(chips);
};

const mergeAdjacentChips = (chips) => {
  const merged = [];
  for (const chip of chips) {
    const previous = merged.at(-1);
    const gap = previous ? chip.startedAt - previous.endedAt : Infinity;
    const sameKind = previous && previous.kind === chip.kind;
    const mergeableKind = sameKind && ["text", "image", "file", "video", "thinking", "tool"].includes(chip.kind);
    if (mergeableKind && gap <= 1200) {
      previous.endedAt = chip.endedAt;
      if (chip.kind === "text") {
        previous.metrics[0].label = `${Number(previous.metrics[0].label.replace("t", "")) + Number(chip.metrics[0].label.replace("t", ""))}t`;
      } else if (chip.kind === "tool") {
        previous.toolCount = (previous.toolCount ?? 1) + (chip.toolCount ?? 1);
        previous.metrics[0].label = previous.toolCount > 1 ? String(previous.toolCount) : "";
        previous.open = previous.open || chip.open;
        previous.title = `${previous.toolCount} tool calls merged into one chip.`;
      } else if (chip.kind === "thinking") {
        previous.metrics[0].label = formatDuration(previous.endedAt - previous.startedAt);
      } else if (["image", "file"].includes(chip.kind)) {
        const totalBytes = toBytes(previous.metrics[0].label) + toBytes(chip.metrics[0].label);
        previous.metrics[0].label = formatBytes(totalBytes);
      } else if (chip.kind === "video") {
        previous.metrics[0].label = formatDuration(
          toMilliseconds(previous.metrics[0].label) + toMilliseconds(chip.metrics[0].label),
        );
      }
      continue;
    }
    if (chip.kind === "tool") {
      chip.metrics[0].label = chip.toolCount > 1 ? String(chip.toolCount) : "";
      chip.title = chip.open ? "Tool call is still open; the matching tool result has not arrived yet." : chip.title;
    }
    merged.push(structuredClone(chip));
  }
  return merged;
};

const toBytes = (label) => {
  if (label.endsWith("GB")) return Number(label.replace("GB", "")) * 1024 * 1024 * 1024;
  if (label.endsWith("MB")) return Number(label.replace("MB", "")) * 1024 * 1024;
  if (label.endsWith("KB")) return Number(label.replace("KB", "")) * 1024;
  if (label.endsWith("B")) return Number(label.replace("B", ""));
  return 0;
};

const toMilliseconds = (label) => {
  if (label.endsWith("ms")) return Number(label.replace("ms", ""));
  if (label.endsWith("s")) return Number(label.replace("s", "")) * 1000;
  if (label.endsWith("m")) return Number(label.replace("m", "")) * 60_000;
  return 0;
};

const buildComboChip = (chips) => {
  const aggregate = {
    textTokens: 0,
    imageBytes: 0,
    fileBytes: 0,
    videoMs: 0,
    thinkingMs: 0,
    toolCount: 0,
    refusalCount: 0,
    errorCount: 0,
    unknownCount: 0,
  };
  for (const chip of chips) {
    switch (chip.kind) {
      case "text":
        aggregate.textTokens += Number(chip.metrics[0]?.label?.replace("t", "") ?? 0);
        break;
      case "image":
        aggregate.imageBytes += toBytes(chip.metrics[0]?.label ?? "0B");
        break;
      case "file":
        aggregate.fileBytes += toBytes(chip.metrics[0]?.label ?? "0B");
        break;
      case "video":
        aggregate.videoMs += toMilliseconds(chip.metrics[0]?.label ?? "0ms");
        break;
      case "thinking":
        aggregate.thinkingMs += chip.endedAt - chip.startedAt;
        break;
      case "tool":
        aggregate.toolCount += chip.toolCount ?? 1;
        break;
      case "refusal":
        aggregate.refusalCount += 1;
        break;
      case "error":
        aggregate.errorCount += 1;
        break;
      default:
        aggregate.unknownCount += 1;
        break;
    }
  }
  const metrics = [];
  if (aggregate.thinkingMs > 0) metrics.push(metricEntry("thinking", formatDuration(aggregate.thinkingMs)));
  if (aggregate.toolCount > 0)
    metrics.push(metricEntry("tool", aggregate.toolCount > 1 ? String(aggregate.toolCount) : ""));
  if (aggregate.textTokens > 0) metrics.push(metricEntry("text", `${aggregate.textTokens}t`));
  if (aggregate.imageBytes > 0) metrics.push(metricEntry("image", formatBytes(aggregate.imageBytes)));
  if (aggregate.fileBytes > 0) metrics.push(metricEntry("file", formatBytes(aggregate.fileBytes)));
  if (aggregate.videoMs > 0) metrics.push(metricEntry("video", formatDuration(aggregate.videoMs)));
  if (aggregate.refusalCount > 0) metrics.push(metricEntry("refusal", ""));
  if (aggregate.errorCount > 0) metrics.push(metricEntry("error", ""));
  if (aggregate.unknownCount > 0) metrics.push(metricEntry("unknown", String(aggregate.unknownCount)));
  return {
    kind: "combo",
    startedAt: chips[0].startedAt,
    endedAt: chips.at(-1).endedAt,
    metrics: metrics.slice(0, 1),
    toneKinds: chips.flatMap((chip) => chip.toneKinds ?? [chip.kind]).filter((kind) => KIND_BASE_TONE[kind]),
    title: `Combo chip folding ${chips.length} hidden chips into one bounded display token.`,
  };
};

const estimateChipWidth = (chip, density, options) => {
  const tokens = buildVisualTokens(chip, density, options);
  const labelUnit = density === "full" ? 5.8 : density === "medium" ? 5.3 : 4.8;
  const tokenBase = density === "narrow" ? 16 : 18;
  const gapWidth = Math.max(0, tokens.length - 1) * (density === "narrow" ? 4 : 5);
  const tokenWidth = tokens.reduce(
    (sum, token) => sum + tokenBase + (token.label ? 5 + token.label.length * labelUnit : 0),
    0,
  );
  const chipPadding = density === "narrow" ? 10 : 12;
  const densityAllowance = density === "full" && (chip.metrics?.length ?? 0) >= 3 ? 10 : 0;
  const safety = density === "full" ? 24 : density === "medium" ? 30 : 36;
  return Math.ceil(chipPadding + gapWidth + tokenWidth + densityAllowance + safety);
};

const buildLine = (previousChip, currentChip, inputStart, _previousChipWidth, _currentChipWidth, density = "full") => {
  const startedAt = previousChip.kind === "input" ? inputStart : previousChip.endedAt;
  const duration = Math.max(0, currentChip.endedAt - startedAt);
  const label = formatDurationForDensity(duration, density);
  return {
    kind: currentChip.kind,
    fromKind: previousChip.kind,
    toKind: currentChip.kind,
    label,
    width: Math.max(
      density === "full" ? 20 : density === "medium" ? 16 : 12,
      label.length * (density === "full" ? 3.4 : density === "medium" ? 3.1 : 2.8) + 4,
    ),
    title:
      previousChip.kind === "input"
        ? `Closed interval [input, ${currentChip.kind}] lasting ${formatDuration(duration)}.`
        : `Half-open interval (${previousChip.kind}, ${currentChip.kind}] lasting ${formatDuration(duration)}.`,
  };
};

const compressChipsForDensity = (chips, density) =>
  chips.map((chip) => {
    if (density === "full") {
      return structuredClone(chip);
    }
    const next = structuredClone(chip);
    next.metrics = next.metrics.map((metric) => ({
      ...metric,
      label: compactMetricLabel(metric, density),
    }));
    if (density === "medium") {
      if (next.kind === "input") {
        next.metrics = next.metrics.slice(0, 3);
      } else if (next.kind === "combo") {
        next.metrics = next.metrics.slice(0, 2);
      } else {
        next.metrics = next.metrics.slice(0, 1);
      }
      return next;
    }
    if (next.kind === "input") {
      next.metrics = next.metrics.slice(0, 1);
    } else if (next.kind === "combo") {
      next.metrics = next.metrics.slice(0, 1);
    } else {
      next.metrics = next.metrics.slice(0, 1);
    }
    return next;
  });

const estimateTimelineWidth = (record, chips, density, latestOpen) => {
  let chipRowWidth = 0;
  let railRowWidth = 0;
  const chipWidths = chips.map((chip, index) =>
    estimateChipWidth(chip, density, { latestOpen, isLatest: index === chips.length - 1 }),
  );
  for (let index = 0; index < chips.length; index += 1) {
    const chipWidth = chipWidths[index];
    chipRowWidth += chipWidth;
    if (index < chips.length - 1) {
      const nextChipWidth = chipWidths[index + 1];
      const lineWidth = buildLine(
        chips[index],
        chips[index + 1],
        record.input.startedAt,
        chipWidth,
        nextChipWidth,
        density,
      ).width;
      railRowWidth += lineWidth;
      chipRowWidth += lineWidth;
    }
  }
  return Math.max(chipRowWidth, railRowWidth);
};

const selectVisibleChips = (record, atomicChips, containerWidth, latestOpen) => {
  if (atomicChips.length <= 2) {
    return { chips: atomicChips, density: "full" };
  }
  const densities = containerWidth < 400 ? ["narrow"] : ["full", "medium", "narrow"];
  const middle = atomicChips.slice(1);
  let fallback = { chips: atomicChips, density: "narrow" };

  for (const density of densities) {
    for (let hiddenCount = 0; hiddenCount < middle.length; hiddenCount += 1) {
      const hidden = middle.slice(0, hiddenCount);
      const visibleTail = middle.slice(hiddenCount);
      const candidate = hidden.length
        ? [atomicChips[0], buildComboChip(hidden), ...visibleTail]
        : [atomicChips[0], ...visibleTail];
      const compressed = compressChipsForDensity(candidate, density);
      fallback = { chips: candidate, density };
      if (estimateTimelineWidth(record, compressed, density, latestOpen) <= containerWidth) {
        return fallback;
      }
    }
  }

  const latest = middle.at(-1);
  const hidden = middle.slice(0, -1);
  return {
    chips: hidden.length ? [atomicChips[0], buildComboChip(hidden), latest] : [atomicChips[0], latest],
    density: "narrow",
  };
};

const renderChip = (chip, { latestOpen, isLatest, density, tone, tokens }) => {
  const visualTokens = tokens ?? buildVisualTokens(chip, density, { latestOpen, isLatest });
  const visualTone = tone ?? chipTone(chip, visualTokens);
  const classNames = ["chip", `chip--${chip.kind}`];
  if (visualTokens.length === 1 && !visualTokens[0]?.label) classNames.push("chip--icon-only");
  if ((latestOpen && isLatest) || chip.kind === "pending") classNames.push("chip--open");
  return `<span class="${classNames.join(" ")}" style="${chipToneStyle(visualTone)}" title="${escapeHtml(chip.title)}">
    ${visualTokens.map((token) => renderVisualToken(token)).join("")}
  </span>`;
};

const renderTimeline = (record, chips, latestOpen, density) => {
  const fragments = [];
  const columns = [];
  const chipContexts = chips.map((chip, index) => {
    const tokens = buildVisualTokens(chip, density, { latestOpen, isLatest: index === chips.length - 1 });
    return {
      chip,
      tokens,
      tone: chipTone(chip, tokens),
    };
  });
  const chipWidths = chips.map((chip, index) =>
    estimateChipWidth(chip, density, { latestOpen, isLatest: index === chips.length - 1 }),
  );
  for (let index = 0; index < chips.length; index += 1) {
    const { chip, tokens, tone } = chipContexts[index];
    const chipColumn = index * 2 + 1;
    columns.push("min-content");
    fragments.push(
      `<span class="chip-cell" style="grid-column:${chipColumn};grid-row:3">${renderChip(chip, { latestOpen, isLatest: index === chips.length - 1, density, tokens, tone })}</span>`,
    );
    if (index < chips.length - 1) {
      const nextTone = chipContexts[index + 1].tone;
      const line = buildLine(
        chip,
        chips[index + 1],
        record.input.startedAt,
        chipWidths[index],
        chipWidths[index + 1],
        density,
      );
      const linkColumn = chipColumn + 1;
      const bridgeColumn = index === 0 ? `${chipColumn} / span 3` : `${linkColumn} / span 2`;
      const bridgeFrom = index === 0 ? tone.startBorder : tone.endBorder;
      const bridgeTo = nextTone.endBorder;
      const linkFrom = tone.endBorder;
      const linkTo = nextTone.startBorder;
      columns.push(`minmax(${line.width}px, 1fr)`);
      fragments.push(
        `<span
          class="bridge-label bridge--${escapeHtml(line.kind)}"
          style="grid-column:${linkColumn};grid-row:1;--bridge-from:${bridgeFrom};--bridge-to:${bridgeTo}"
          title="${escapeHtml(line.title)}"
        >${escapeHtml(line.label)}</span>`,
      );
      fragments.push(
        `<span
          class="bridge bridge--${escapeHtml(line.kind)}"
          style="grid-column:${bridgeColumn};grid-row:2;--bridge-from:${bridgeFrom};--bridge-to:${bridgeTo}"
          title="${escapeHtml(line.title)}"
        >
          <svg class="bridge-svg" aria-hidden="true" focusable="false">
            <line class="bridge-svg-track" x1="0" y1="0.5" x2="100%" y2="0.5"></line>
            <line class="bridge-svg-tick bridge-svg-tick--start" x1="0" y1="0.5" x2="0" y2="2.5"></line>
            <line class="bridge-svg-tick bridge-svg-tick--end" x1="100%" y1="0.5" x2="100%" y2="2.5"></line>
          </svg>
        </span>`,
      );
      fragments.push(
        `<span
          class="chip-link bridge--${escapeHtml(line.kind)}"
          style="grid-column:${linkColumn};grid-row:3;--bridge-from:${linkFrom};--bridge-to:${linkTo}"
          title="${escapeHtml(line.title)}"
        >
          <span class="chip-link-track" aria-hidden="true"></span>
        </span>`,
      );
    }
  }
  return `<div class="timeline-grid" style="grid-template-columns:${columns.join(" ")}">${fragments.join("")}</div>`;
};

define(
  "x-model-run-card",
  class extends HTMLElement {
    #resizeObserver = null;
    #measuredWidth = 0;
    #liveSampleId = null;
    #liveStartedAt = Date.now();
    #liveTimer = null;

    constructor() {
      super();
      this.attachShadow({ mode: "open" });
    }

    connectedCallback() {
      this.#resizeObserver ??= new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.target !== this) {
            continue;
          }
          const nextWidth = entry.contentRect.width;
          if (Math.abs(nextWidth - this.#measuredWidth) < 0.5) {
            continue;
          }
          this.#measuredWidth = nextWidth;
          if (!this.hasAttribute("layout-width")) {
            this.render();
          }
        }
      });
      this.#resizeObserver.observe(this);
      this.#measuredWidth = this.getBoundingClientRect().width;
      this.render();
    }

    disconnectedCallback() {
      this.#resizeObserver?.disconnect();
      this.#clearLiveTimer();
    }

    static get observedAttributes() {
      return ["layout-width", "sample", "open-latest", "support-text"];
    }

    attributeChangedCallback(_name, oldValue, newValue) {
      if (oldValue === newValue) {
        return;
      }
      this.render();
    }

    #getLayoutWidth() {
      const hintedWidth = Number(this.getAttribute("layout-width"));
      if (Number.isFinite(hintedWidth) && hintedWidth > 0) {
        return hintedWidth;
      }
      return this.#measuredWidth || this.getBoundingClientRect().width || 0;
    }

    #clearLiveTimer() {
      if (this.#liveTimer) {
        clearInterval(this.#liveTimer);
        this.#liveTimer = null;
      }
    }

    #syncLiveDuration(isLive, baseDurationMs) {
      this.#clearLiveTimer();
      const durationNode = this.shadowRoot?.getElementById("durationValue");
      if (!durationNode) {
        return;
      }
      if (!isLive) {
        durationNode.textContent = formatDuration(baseDurationMs);
        return;
      }
      const updateDuration = () => {
        durationNode.textContent = formatDuration(baseDurationMs + Date.now() - this.#liveStartedAt);
      };
      updateDuration();
      this.#liveTimer = setInterval(updateDuration, 1000);
    }

    render() {
      const sample = MODEL_RUN_SAMPLES[this.getAttribute("sample") ?? "tool-loop"] ?? MODEL_RUN_SAMPLES["tool-loop"];
      const openLatest = this.hasAttribute("open-latest");
      const supportText = this.getAttribute("support-text") ?? "";
      const atomicChips = [buildInputChip(sample), ...normalizeEventChips(sample.events)];
      const status = String(sample.status ?? "completed");
      const statusKind = status.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
      const isLive = statusKind === "streaming";
      if (isLive && this.#liveSampleId !== sample.id) {
        this.#liveStartedAt = Date.now();
        this.#liveSampleId = sample.id;
      } else if (!isLive) {
        this.#liveSampleId = null;
      }
      const baseDurationMs = atomicChips.at(-1).endedAt - sample.input.startedAt;
      const width = Math.max(this.#getLayoutWidth(), 240);
      const timelineBudget = Math.max(180, width - 48);
      const { chips, density } = selectVisibleChips(sample, atomicChips, timelineBudget, openLatest);
      const renderChips = compressChipsForDensity(chips, density);
      const densityStage =
        density === "narrow" ? "narrow" : renderChips.some((chip) => chip.kind === "combo") ? "medium" : "full";
      this.setAttribute("density", density);
      this.setAttribute("density-stage", densityStage);
      this.dispatchEvent(
        new CustomEvent("densitychange", {
          detail: {
            density,
            densityStage,
            layoutWidth: width,
            visibleKinds: renderChips.map((chip) => chip.kind),
          },
          bubbles: true,
        }),
      );
      this.shadowRoot.innerHTML = `
        <link rel="stylesheet" href="basic-record-card.css" />
        <style>
          :host {
            display: block;
            min-inline-size: 0;
            inline-size: 100%;
            max-inline-size: 100%;
          }

          @keyframes record-breathe {
            0%,
            100% {
              filter: saturate(1);
              opacity: 0.74;
              transform: scale(1);
            }

            50% {
              filter: saturate(1.18);
              opacity: 1;
              transform: scale(1.018);
            }
          }

          @keyframes record-shiny-text {
            0% {
              background-position: 140% center;
            }

            100% {
              background-position: -140% center;
            }
          }

          .time {
            display: block;
            color: var(--ink);
            font-size: 12.5px;
            font-weight: 760;
            line-height: 1.15;
          }

          .time--live,
          .duration--live {
            animation: record-breathe 2.3s ease-in-out infinite;
            transform-origin: left center;
          }

          .duration,
          .meta,
          .support {
            display: block;
            overflow: hidden;
            color: var(--muted);
            font-size: 10.5px;
            line-height: 1.35;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .title {
            display: block;
            overflow: hidden;
            color: var(--ink);
            font-size: 12.5px;
            font-weight: 760;
            line-height: 1.15;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .status {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            border: 1px solid var(--line);
            border-radius: 999px;
            background: #fff;
            padding: 3px 7px;
            color: var(--muted);
            font-size: 10px;
            font-weight: 760;
            line-height: 1;
            white-space: nowrap;
          }

          .status--streaming {
            --status-shine-base: color-mix(in oklch, var(--tone-accent, #2563eb), black 8%);
            border-color: color-mix(in oklch, var(--tone-accent, #2563eb), white 54%);
            background: color-mix(in oklch, var(--tone-accent, #2563eb), white 92%);
            color: var(--status-shine-base);
            animation: record-breathe 2.3s ease-in-out infinite;
            transform-origin: right center;
          }

          .status--streaming .status-label {
            background-image: linear-gradient(
              100deg,
              var(--status-shine-base) 18%,
              color-mix(in oklch, var(--status-shine-base), white 56%) 46%,
              var(--status-shine-base) 72%
            );
            background-position: 140% center;
            background-size: 220% 100%;
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
            animation: record-shiny-text 2.2s linear infinite;
          }

          .status--error {
            border-color: color-mix(in oklch, var(--kind-error, #dc2626), white 58%);
            background: color-mix(in oklch, var(--kind-error, #dc2626), white 92%);
            color: color-mix(in oklch, var(--kind-error, #dc2626), black 10%);
          }

          .timeline {
            display: block;
            max-inline-size: 100%;
            min-inline-size: 0;
            overflow: visible;
            padding-block-start: 6px;
          }

          .timeline-grid {
            display: grid;
            grid-template-rows: 9px 1px auto;
            row-gap: 4px;
            align-items: center;
            justify-content: start;
            inline-size: 100%;
            max-inline-size: 100%;
            min-inline-size: 0;
          }

          .chip-cell {
            display: flex;
            align-items: center;
            justify-content: start;
            min-inline-size: 0;
          }

          .chip,
          .metric {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            min-inline-size: 0;
            white-space: nowrap;
          }

          .chip {
            position: relative;
            border: 1px solid transparent;
            border-image: var(--chip-border-gradient) 1;
            border-image-width: 0;
            border-radius: 999px;
            background-color: var(--tone-surface, #fff);
            background-image: var(--chip-bg-gradient);
            background-clip: padding-box;
            padding: 6px 9px;
            color: var(--chip-ink, var(--tone-ink-soft, #344054));
            font-size: 10.75px;
            font-weight: 720;
            flex: 0 0 auto;
            line-height: 1;
            isolation: isolate;
          }

          .chip::before {
            content: "";
            position: absolute;
            inset: 0;
            border-radius: inherit;
            background: var(--chip-border-gradient);
            padding: 1px;
            pointer-events: none;
            -webkit-mask:
              linear-gradient(#000 0 0) content-box,
              linear-gradient(#000 0 0);
            -webkit-mask-composite: xor;
            mask:
              linear-gradient(#000 0 0) content-box,
              linear-gradient(#000 0 0);
            mask-composite: exclude;
          }

          .chip > * {
            position: relative;
            z-index: 1;
          }

          .chip--icon-only {
            padding: 6px;
          }

          .chip--open {
            border-style: dashed;
          }

          .metric {
            gap: 3px;
            line-height: 1;
          }

          .metric-label {
            display: inline-block;
            min-inline-size: 0;
            line-height: 1;
          }

          :host([density="narrow"]) .chip {
            gap: 2.5px;
          }

          :host([density="narrow"]) .metric {
            gap: 1px;
          }

          .bridge {
            position: relative;
            display: grid;
            align-self: end;
            min-inline-size: 0;
            padding-inline: 1px;
          }

          .bridge::before {
            content: "";
            display: block;
            grid-area: 1 / 1;
            align-self: start;
            inline-size: 100%;
            block-size: 1px;
            background: linear-gradient(
              90deg in oklch,
              var(--bridge-from, var(--bridge-accent)),
              var(--bridge-to, var(--bridge-accent))
            );
          }

          .bridge-svg {
            grid-area: 1 / 1;
            display: block;
            inline-size: 100%;
            block-size: 1px;
            overflow: visible;
          }

          .bridge-svg-track {
            stroke: transparent;
            stroke-width: 1px;
            vector-effect: non-scaling-stroke;
            shape-rendering: crispEdges;
          }

          .bridge-svg-tick {
            stroke: var(--bridge-from, var(--bridge-accent));
            stroke-width: 1px;
            vector-effect: non-scaling-stroke;
            shape-rendering: crispEdges;
          }

          .bridge-svg-tick--end {
            stroke: var(--bridge-to, var(--bridge-accent));
          }

          .bridge-label {
            display: block;
            align-self: end;
            justify-self: center;
            overflow: hidden;
            max-inline-size: 100%;
            background: linear-gradient(
              90deg in oklch,
              color-mix(in oklch, var(--bridge-from, var(--bridge-accent)), black 8%),
              color-mix(in oklch, var(--bridge-to, var(--bridge-accent)), black 8%)
            );
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
            font-size: 8.5px;
            font-weight: 780;
            line-height: 1;
            text-align: center;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .bridge--input {
            --bridge-accent: var(--kind-input, #0369a1);
          }

          .bridge--combo {
            --bridge-accent: var(--kind-combo, #475569);
          }

          .bridge--thinking {
            --bridge-accent: var(--kind-thinking, #0f766e);
          }

          .bridge--text {
            --bridge-accent: var(--kind-text, #2563eb);
          }

          .bridge--tool {
            --bridge-accent: var(--kind-tool, #b45309);
          }

          .bridge--image {
            --bridge-accent: var(--kind-image, #0f766e);
          }

          .bridge--file,
          .bridge--archive {
            --bridge-accent: var(--kind-file, #475569);
          }

          .bridge--video {
            --bridge-accent: var(--kind-video, #4f46e5);
          }

          .bridge--refusal,
          .bridge--error {
            --bridge-accent: var(--kind-error, #dc2626);
          }

          .bridge--pending {
            --bridge-accent: var(--kind-pending, #b45309);
          }

          .bridge--unknown {
            --bridge-accent: var(--kind-unknown, #64748b);
          }

          .chip-link {
            display: grid;
            min-inline-size: 0;
            block-size: 20px;
            align-self: center;
            place-items: center;
            margin-inline: -1px;
          }

          .chip-link-track {
            display: block;
            inline-size: 100%;
            block-size: 1px;
            border-radius: 999px;
            background: linear-gradient(
              90deg in oklch,
              var(--bridge-from, var(--bridge-accent)),
              var(--bridge-to, var(--bridge-accent))
            );
          }

          .icon-svg {
            inline-size: 14px;
            block-size: 14px;
            flex: 0 0 auto;
          }

          :host([density="narrow"]) .icon-svg {
            inline-size: 14px;
            block-size: 14px;
          }

          .chip--input {
            --chip-bg: color-mix(in oklch, var(--kind-input, #0369a1), white 91%);
            --chip-border: color-mix(in oklch, var(--kind-input, #0369a1), white 62%);
            --chip-ink: color-mix(in oklch, var(--kind-input, #0369a1), black 18%);
          }

          .chip--combo {
            --chip-bg: color-mix(in oklch, var(--kind-combo, #475569), white 90%);
            --chip-border: color-mix(in oklch, var(--kind-combo, #475569), white 64%);
            --chip-ink: color-mix(in oklch, var(--kind-combo, #475569), black 18%);
          }

          .chip--thinking {
            --chip-bg: color-mix(in oklch, var(--kind-thinking, #0f766e), white 91%);
            --chip-border: color-mix(in oklch, var(--kind-thinking, #0f766e), white 64%);
            --chip-ink: color-mix(in oklch, var(--kind-thinking, #0f766e), black 18%);
          }

          .chip--text {
            --chip-bg: color-mix(in oklch, var(--kind-text, #2563eb), white 92%);
            --chip-border: color-mix(in oklch, var(--kind-text, #2563eb), white 65%);
            --chip-ink: color-mix(in oklch, var(--kind-text, #2563eb), black 16%);
          }

          .chip--tool {
            --chip-bg: color-mix(in oklch, var(--kind-tool, #b45309), white 91%);
            --chip-border: color-mix(in oklch, var(--kind-tool, #b45309), white 62%);
            --chip-ink: color-mix(in oklch, var(--kind-tool, #b45309), black 18%);
          }

          .chip--image {
            --chip-bg: color-mix(in oklch, var(--kind-image, #0f766e), white 92%);
            --chip-border: color-mix(in oklch, var(--kind-image, #0f766e), white 66%);
            --chip-ink: color-mix(in oklch, var(--kind-image, #0f766e), black 16%);
          }

          .chip--file {
            --chip-bg: color-mix(in oklch, var(--kind-file, #475569), white 92%);
            --chip-border: color-mix(in oklch, var(--kind-file, #475569), white 68%);
            --chip-ink: color-mix(in oklch, var(--kind-file, #475569), black 16%);
          }

          .chip--video {
            --chip-bg: color-mix(in oklch, var(--kind-video, #4f46e5), white 92%);
            --chip-border: color-mix(in oklch, var(--kind-video, #4f46e5), white 68%);
            --chip-ink: color-mix(in oklch, var(--kind-video, #4f46e5), black 14%);
          }

          .chip--refusal {
            --chip-bg: color-mix(in oklch, var(--kind-refusal, #dc2626), white 92%);
            --chip-border: color-mix(in oklch, var(--kind-refusal, #dc2626), white 68%);
            --chip-ink: color-mix(in oklch, var(--kind-refusal, #dc2626), black 15%);
          }

          .chip--error {
            --chip-bg: color-mix(in oklch, var(--kind-error, #dc2626), white 90%);
            --chip-border: color-mix(in oklch, var(--kind-error, #dc2626), white 55%);
            --chip-ink: color-mix(in oklch, var(--kind-error, #dc2626), black 10%);
          }

          .chip--unknown {
            --chip-bg: color-mix(in oklch, var(--kind-unknown, #64748b), white 92%);
            --chip-border: color-mix(in oklch, var(--kind-unknown, #64748b), white 68%);
            --chip-ink: color-mix(in oklch, var(--kind-unknown, #64748b), black 15%);
          }

          .card {
            container-type: inline-size;
            inline-size: 100%;
            max-inline-size: 100%;
            overflow: hidden;
          }

          .body {
            max-inline-size: 100%;
            min-inline-size: 0;
            overflow: hidden;
          }
        </style>
        <article class="card ${supportText ? "has-support" : ""}">
          <header class="head">
            <div class="stack">
              <span class="time ${isLive ? "time--live" : ""}">${escapeHtml(sample.clockLabel ?? "14:26")}</span>
              <span id="durationValue" class="duration ${isLive ? "duration--live" : ""}">${escapeHtml(formatDuration(baseDurationMs))}</span>
            </div>
            <div class="stack">
              <span class="title">${escapeHtml(sample.title)}</span>
              <span class="meta">${escapeHtml(sample.meta)}</span>
            </div>
            <div class="status-wrap">
              <span class="status status--${escapeHtml(statusKind)}"><span class="status-label">${escapeHtml(status)}</span></span>
            </div>
          </header>
          <div class="body">
            <div class="timeline">${renderTimeline(sample, renderChips, openLatest, density)}</div>
          </div>
          ${supportText ? `<footer class="support">${escapeHtml(supportText)}</footer>` : ""}
        </article>
      `;
      hydrateIcons(this.shadowRoot);
      this.#syncLiveDuration(isLive, baseDurationMs);
    }
  },
);

define(
  "x-model-run-chip-gallery",
  class extends HTMLElement {
    connectedCallback() {
      this.render();
    }

    render() {
      const toolLoop = MODEL_RUN_SAMPLES["tool-loop"];
      const hiddenCombo = buildComboChip(normalizeEventChips(toolLoop.events).slice(0, 4));
      const entries = [
        { label: "Input", chip: buildInputChip(toolLoop), density: "medium" },
        {
          label: "Text",
          chip: { kind: "text", metrics: [metricEntry("text", "14t")], title: "Assistant text part." },
          density: "full",
        },
        {
          label: "Image",
          chip: { kind: "image", metrics: [metricEntry("image", "610KB")], title: "Image part." },
          density: "full",
        },
        {
          label: "Video",
          chip: { kind: "video", metrics: [metricEntry("video", "15.4s")], title: "Video part." },
          density: "full",
        },
        {
          label: "File",
          chip: { kind: "file", metrics: [metricEntry("file", "23KB")], title: "File part." },
          density: "full",
        },
        {
          label: "Thinking",
          chip: { kind: "thinking", metrics: [metricEntry("thinking", "2.1s")], title: "Thinking span." },
          density: "full",
        },
        {
          label: "Refusal",
          chip: { kind: "refusal", metrics: [metricEntry("refusal", "")], title: "Refusal part." },
          density: "full",
        },
        {
          label: "Error",
          chip: { kind: "error", metrics: [metricEntry("error", "")], title: "Error part." },
          density: "full",
        },
        {
          label: "Tool",
          chip: { kind: "tool", metrics: [metricEntry("tool", "")], title: "Single tool call." },
          density: "full",
        },
        {
          label: "Tool x3",
          chip: { kind: "tool", metrics: [metricEntry("tool", "3")], title: "Three tool calls merged." },
          density: "full",
        },
        {
          label: "Pending",
          chip: { kind: "pending", metrics: [metricEntry("pending", "")], title: "Pending latest marker." },
          density: "full",
        },
        {
          label: "Unknown",
          chip: { kind: "unknown", metrics: [metricEntry("unknown", "")], title: "Unknown message part." },
          density: "full",
        },
        { label: "Combo", chip: hiddenCombo, density: "medium" },
      ];

      if (!this.shadowRoot) {
        this.attachShadow({ mode: "open" });
      }
      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: block;
          }

          .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
            gap: 10px;
          }

          .cell {
            display: grid;
            gap: 8px;
            border: 1px solid var(--line, #d9e1ea);
            border-radius: 14px;
            background: #fff;
            padding: 10px;
          }

          .label {
            color: var(--muted, #667085);
            font-size: 11px;
            font-weight: 760;
            line-height: 1.2;
          }

          .chip {
            position: relative;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            justify-self: start;
            border: 1px solid transparent;
            border-image: var(--chip-border-gradient) 1;
            border-image-width: 0;
            border-radius: 999px;
            background-color: var(--tone-surface, #fff);
            background-image: var(--chip-bg-gradient);
            background-clip: padding-box;
            padding: 6px 9px;
            color: var(--chip-ink, var(--tone-ink-soft, #344054));
            font-size: 10.75px;
            font-weight: 720;
            min-inline-size: 0;
            line-height: 1;
            white-space: nowrap;
            isolation: isolate;
          }

          .chip::before {
            content: "";
            position: absolute;
            inset: 0;
            border-radius: inherit;
            background: var(--chip-border-gradient);
            padding: 1px;
            pointer-events: none;
            -webkit-mask:
              linear-gradient(#000 0 0) content-box,
              linear-gradient(#000 0 0);
            -webkit-mask-composite: xor;
            mask:
              linear-gradient(#000 0 0) content-box,
              linear-gradient(#000 0 0);
            mask-composite: exclude;
          }

          .chip > * {
            position: relative;
            z-index: 1;
          }

          .chip--icon-only {
            padding: 6px;
          }

          .chip--open {
            border-style: dashed;
          }

          .metric {
            display: inline-flex;
            align-items: center;
            gap: 3px;
            line-height: 1;
          }

          .icon-svg {
            inline-size: 14px;
            block-size: 14px;
            flex: 0 0 auto;
          }

          .chip--input {
            --chip-bg: color-mix(in oklch, var(--kind-input, #0369a1), white 91%);
            --chip-border: color-mix(in oklch, var(--kind-input, #0369a1), white 62%);
            --chip-ink: color-mix(in oklch, var(--kind-input, #0369a1), black 18%);
          }

          .chip--combo {
            --chip-bg: color-mix(in oklch, var(--kind-combo, #475569), white 90%);
            --chip-border: color-mix(in oklch, var(--kind-combo, #475569), white 64%);
            --chip-ink: color-mix(in oklch, var(--kind-combo, #475569), black 18%);
          }

          .chip--thinking {
            --chip-bg: color-mix(in oklch, var(--kind-thinking, #0f766e), white 91%);
            --chip-border: color-mix(in oklch, var(--kind-thinking, #0f766e), white 64%);
            --chip-ink: color-mix(in oklch, var(--kind-thinking, #0f766e), black 18%);
          }

          .chip--text {
            --chip-bg: color-mix(in oklch, var(--kind-text, #2563eb), white 92%);
            --chip-border: color-mix(in oklch, var(--kind-text, #2563eb), white 65%);
            --chip-ink: color-mix(in oklch, var(--kind-text, #2563eb), black 16%);
          }

          .chip--tool {
            --chip-bg: color-mix(in oklch, var(--kind-tool, #b45309), white 91%);
            --chip-border: color-mix(in oklch, var(--kind-tool, #b45309), white 62%);
            --chip-ink: color-mix(in oklch, var(--kind-tool, #b45309), black 18%);
          }

          .chip--image {
            --chip-bg: color-mix(in oklch, var(--kind-image, #0f766e), white 92%);
            --chip-border: color-mix(in oklch, var(--kind-image, #0f766e), white 66%);
            --chip-ink: color-mix(in oklch, var(--kind-image, #0f766e), black 16%);
          }

          .chip--file {
            --chip-bg: color-mix(in oklch, var(--kind-file, #475569), white 92%);
            --chip-border: color-mix(in oklch, var(--kind-file, #475569), white 68%);
            --chip-ink: color-mix(in oklch, var(--kind-file, #475569), black 16%);
          }

          .chip--video {
            --chip-bg: color-mix(in oklch, var(--kind-video, #4f46e5), white 92%);
            --chip-border: color-mix(in oklch, var(--kind-video, #4f46e5), white 68%);
            --chip-ink: color-mix(in oklch, var(--kind-video, #4f46e5), black 14%);
          }

          .chip--refusal {
            --chip-bg: color-mix(in oklch, var(--kind-refusal, #dc2626), white 92%);
            --chip-border: color-mix(in oklch, var(--kind-refusal, #dc2626), white 68%);
            --chip-ink: color-mix(in oklch, var(--kind-refusal, #dc2626), black 15%);
          }

          .chip--error {
            --chip-bg: color-mix(in oklch, var(--kind-error, #dc2626), white 90%);
            --chip-border: color-mix(in oklch, var(--kind-error, #dc2626), white 55%);
            --chip-ink: color-mix(in oklch, var(--kind-error, #dc2626), black 10%);
          }

          .chip--unknown {
            --chip-bg: color-mix(in oklch, var(--kind-unknown, #64748b), white 92%);
            --chip-border: color-mix(in oklch, var(--kind-unknown, #64748b), white 68%);
            --chip-ink: color-mix(in oklch, var(--kind-unknown, #64748b), black 15%);
          }
        </style>
        <div class="grid">
          ${entries
            .map(
              (entry) => `<section class="cell">
                <span class="label">${escapeHtml(entry.label)}</span>
                ${renderChip(entry.chip, { latestOpen: false, isLatest: false, density: entry.density })}
              </section>`,
            )
            .join("")}
        </div>
      `;
      hydrateIcons(this.shadowRoot);
    }
  },
);

define(
  "x-compact-body",
  class extends HTMLElement {
    connectedCallback() {
      this.render();
    }

    static get observedAttributes() {
      return ["before", "after", "state"];
    }

    attributeChangedCallback(_name, oldValue, newValue) {
      if (oldValue === newValue) {
        return;
      }
      this.render();
    }

    render() {
      if (!this.shadowRoot) {
        this.attachShadow({ mode: "open" });
      }
      const before = Number(this.getAttribute("before") ?? 63.4);
      const after = Number(this.getAttribute("after") ?? 24.1);
      const state = this.getAttribute("state") ?? "completed";
      const icon = state === "error" ? "circle-alert" : state === "running" ? "loader-circle" : "shrink";
      const coreText =
        state === "error"
          ? `${before.toFixed(1)} -> error`
          : state === "running"
            ? `${before.toFixed(1)} -> ${after.toFixed(1)}`
            : `${before.toFixed(1)} -> ${after.toFixed(1)}`;
      const title =
        state === "error"
          ? "Compact record: compression failed after the original context usage was measured."
          : state === "running"
            ? "Compact record: compression is currently running; before and tentative after usage remain visible."
            : "Compact record: a compression object with before and after context usage.";
      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: block;
          }

          @keyframes compact-sheen {
            0% {
              transform: translateX(-120%);
            }

            100% {
              transform: translateX(220%);
            }
          }

          @keyframes compact-breathe {
            0%,
            100% {
              opacity: 0.76;
              transform: translate(-50%, -50%) scale(1);
            }

            50% {
              opacity: 1;
              transform: translate(-50%, -50%) scale(1.018);
            }
          }

          @keyframes compact-spin {
            100% {
              transform: rotate(360deg);
            }
          }

          .bar {
            --before: ${before};
            --after: ${after};
            position: relative;
            block-size: 34px;
            border-radius: 999px;
            background: #eef2f7;
            overflow: hidden;
          }

          .bar::after {
            content: "";
            position: absolute;
            inset: 0 auto 0 0;
            inline-size: 34%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.76), transparent);
            opacity: 0;
            pointer-events: none;
          }

          .before,
          .after {
            position: absolute;
            inset: 0 auto 0 0;
          }

          .before {
            width: calc(var(--before) * 1%);
            background: color-mix(in oklch, var(--tone-muted, #667085), transparent 78%);
          }

          .after {
            width: calc(var(--after) * 1%);
            background: color-mix(in oklch, var(--kind-thinking, #0f766e), white 22%);
          }

          .core {
            position: absolute;
            inset: 50% auto auto 50%;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            border: 1px solid var(--tone-border, #d9e1ea);
            border-radius: 999px;
            background: #fff;
            padding: 6px 10px;
            color: #344054;
            font-size: 11px;
            font-weight: 760;
            line-height: 1;
            transform: translate(-50%, -50%);
            white-space: nowrap;
          }

          .icon-svg {
            inline-size: 15px;
            block-size: 15px;
            flex: 0 0 auto;
          }

          .bar[data-state="running"] {
            background: color-mix(in oklch, var(--kind-pending, #b45309), white 91%);
          }

          .bar[data-state="running"]::after {
            opacity: 1;
            animation: compact-sheen 1.9s ease-in-out infinite;
          }

          .bar[data-state="running"] .after {
            background: color-mix(in oklch, var(--kind-pending, #b45309), white 35%);
          }

          .bar[data-state="running"] .core {
            border-color: color-mix(in oklch, var(--kind-pending, #b45309), white 55%);
            color: color-mix(in oklch, var(--kind-pending, #b45309), black 14%);
            animation: compact-breathe 2.2s ease-in-out infinite;
          }

          .bar[data-state="running"] .icon-svg {
            animation: compact-spin 1.6s linear infinite;
          }

          .bar[data-state="error"] {
            background: color-mix(in oklch, var(--kind-error, #dc2626), white 92%);
          }

          .bar[data-state="error"] .after {
            background: color-mix(in oklch, var(--kind-error, #dc2626), white 38%);
          }

          .bar[data-state="error"] .core {
            border-color: color-mix(in oklch, var(--kind-error, #dc2626), white 55%);
            color: color-mix(in oklch, var(--kind-error, #dc2626), black 10%);
          }
        </style>
        <div class="bar" data-state="${escapeHtml(state)}" title="${escapeHtml(title)}">
          <span class="before"></span>
          <span class="after"></span>
          <span class="core">${renderIcon(icon)}<span>${escapeHtml(coreText)}</span></span>
        </div>
      `;
      hydrateIcons(this.shadowRoot);
    }
  },
);

define(
  "x-config-body",
  class extends HTMLElement {
    connectedCallback() {
      this.render();
    }

    static get observedAttributes() {
      return ["error", "layer", "maxtoken", "provider", "scope", "state", "temperature", "thinking", "thinking-budget", "topk"];
    }

    attributeChangedCallback(_name, oldValue, newValue) {
      if (oldValue === newValue) {
        return;
      }
      this.render();
    }

    #readNumber(name) {
      const value = Number(this.getAttribute(name));
      return Number.isFinite(value) ? value : null;
    }

    #readText(name, fallback) {
      const value = this.getAttribute(name);
      return value && value.trim().length > 0 ? value.trim() : fallback;
    }

    #readToggle(name) {
      const value = this.getAttribute(name);
      if (value === null) {
        return false;
      }
      const normalized = value.trim().toLowerCase();
      return normalized === "on" || normalized === "true" || normalized === "1" || normalized === "yes";
    }

    render() {
      if (!this.shadowRoot) {
        this.attachShadow({ mode: "open" });
      }
      const state = this.getAttribute("state") ?? "applied";
      const provider = this.#readText("provider", "No active provider found.");
      const scope = this.#readText("scope", this.#readText("layer", "No settings scope"));
      const temperature = this.#readNumber("temperature");
      const topK = this.#readNumber("topk");
      const maxToken = this.#readNumber("maxtoken");
      const thinking = this.#readToggle("thinking") ? "on" : "off";
      const thinkingBudget = this.#readNumber("thinking-budget");
      const error = this.getAttribute("error") ?? "";

      const providerLabel = provider.length > 0 ? provider : "No active provider found.";
      const scopeLabel = scope.length > 0 ? scope : "No settings scope";
      const surfaceTitle = [
        "Config record: staged next-call settings facts, not a form mirror.",
        `Settings scope: ${scopeLabel}.`,
        state === "saving" ? "Staged changes are being written to durable Settings." : null,
        state === "error" ? error || "Config save failed; staged inputs remain visible." : null,
        state === "unavailable"
          ? "Heartbeat config needs an active provider and a settings scope before it can save."
          : null,
      ]
        .filter((value) => value !== null)
        .join(" ");
      const fieldItems = [
        {
          kind: "temperature",
          icon: "thermometer",
          label: "temperature",
          value: temperature === null ? "—" : temperature.toFixed(1),
          title: "Next-call temperature",
        },
        {
          kind: "topk",
          icon: "sliders-horizontal",
          label: "top-k",
          value: topK === null ? "—" : String(Math.round(topK)),
          title: "Next-call top-k",
        },
        {
          kind: "maxtoken",
          icon: "binary",
          label: "max tokens",
          value: maxToken === null ? "—" : formatTokenBudget(maxToken),
          title: "Next-call max token budget",
        },
        {
          kind: "thinking",
          icon: "brain",
          label: "thinking",
          value: thinking,
          title: "Thinking mode",
        },
        {
          kind: "budget",
          icon: "hourglass",
          label: "budget",
          value: thinkingBudget === null ? "—" : `${Math.round(thinkingBudget)}t`,
          title: "Thinking budget tokens",
        },
      ];
      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: block;
          }

          @keyframes config-breathe {
            0%,
            100% {
              opacity: 0.82;
              transform: translateY(0);
            }

            50% {
              opacity: 1;
              transform: translateY(-1px);
            }
          }

          @keyframes config-shine {
            0% {
              background-position: 120% center;
            }

            100% {
              background-position: -120% center;
            }
          }

          .config {
            display: grid;
            gap: 10px;
            min-inline-size: 0;
          }

          .config[data-state="saving"] .provider-pill {
            background-image: linear-gradient(
              100deg,
              color-mix(in oklch, var(--kind-pending, #b45309), white 82%) 18%,
              color-mix(in oklch, var(--kind-pending, #b45309), white 92%) 46%,
              color-mix(in oklch, var(--kind-pending, #b45309), white 82%) 72%
            );
            background-size: 220% 100%;
            animation:
              config-shine 2.2s linear infinite,
              config-breathe 2.4s ease-in-out infinite;
          }

          .config[data-state="unavailable"] {
            opacity: 0.84;
          }

          .config[data-state="unavailable"] .field {
            opacity: 0.72;
          }

          .meta {
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .topline {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            align-items: center;
            min-inline-size: 0;
          }

          .provider-pill,
          .field {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            min-inline-size: 0;
            max-inline-size: 100%;
            border: 1px solid var(--line, #d9e1ea);
            border-radius: 999px;
            background: #fff;
            padding: 5px 8px;
            color: var(--tone-ink-soft, #344054);
            font-size: 10.5px;
            font-weight: 720;
            line-height: 1;
            white-space: nowrap;
          }

          .provider-pill {
            background: color-mix(in oklch, var(--tone-accent, #2563eb), white 94%);
            border-color: color-mix(in oklch, var(--tone-accent, #2563eb), white 72%);
            color: color-mix(in oklch, var(--tone-accent, #2563eb), black 16%);
          }

          .field-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 8px;
            min-inline-size: 0;
          }

          .field {
            justify-content: space-between;
            padding-inline: 9px;
            min-inline-size: 0;
          }

          .field--temperature {
            background: color-mix(in oklch, var(--kind-tool, #b45309), white 94%);
            border-color: color-mix(in oklch, var(--kind-tool, #b45309), white 72%);
            color: color-mix(in oklch, var(--kind-tool, #b45309), black 14%);
          }

          .field--topk {
            background: color-mix(in oklch, var(--kind-video, #4f46e5), white 94%);
            border-color: color-mix(in oklch, var(--kind-video, #4f46e5), white 74%);
            color: color-mix(in oklch, var(--kind-video, #4f46e5), black 14%);
          }

          .field--maxtoken {
            background: color-mix(in oklch, var(--kind-text, #2563eb), white 94%);
            border-color: color-mix(in oklch, var(--kind-text, #2563eb), white 74%);
            color: color-mix(in oklch, var(--kind-text, #2563eb), black 14%);
          }

          .field--thinking {
            background: color-mix(in oklch, var(--kind-thinking, #0f766e), white 94%);
            border-color: color-mix(in oklch, var(--kind-thinking, #0f766e), white 74%);
            color: color-mix(in oklch, var(--kind-thinking, #0f766e), black 14%);
          }

          .field--budget {
            background: color-mix(in oklch, var(--kind-pending, #b45309), white 94%);
            border-color: color-mix(in oklch, var(--kind-pending, #b45309), white 74%);
            color: color-mix(in oklch, var(--kind-pending, #b45309), black 14%);
          }

          .field-label {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            min-inline-size: 0;
          }

          .field-value {
            overflow: hidden;
            text-overflow: ellipsis;
            color: inherit;
            min-inline-size: 0;
          }

          .icon-svg {
            inline-size: 14px;
            block-size: 14px;
            flex: 0 0 auto;
          }

          @media (max-width: 420px) {
            .field-grid {
              grid-template-columns: 1fr;
            }

            .provider-pill,
            .field {
              min-height: 30px;
            }
          }

        </style>
        <div class="config" data-state="${escapeHtml(state)}" title="${escapeHtml(surfaceTitle)}">
          <div class="topline">
            <span class="provider-pill" title="Active provider and model">${renderIcon("server")}<span>${escapeHtml(providerLabel)}</span></span>
          </div>
          <div class="field-grid">
            ${fieldItems
              .map(
                (field) => `<span class="field field--${escapeHtml(field.kind)}" title="${escapeHtml(field.title)}">
                  <span class="field-label">${renderIcon(field.icon)}<span>${escapeHtml(field.label)}</span></span>
                  <span class="field-value">${escapeHtml(field.value)}</span>
                </span>`,
              )
              .join("")}
          </div>
        </div>
      `;
      hydrateIcons(this.shadowRoot);
    }
  },
);
