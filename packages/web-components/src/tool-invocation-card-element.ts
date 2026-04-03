import { LitElement, css, html } from "lit";
import { html as staticHtml, unsafeStatic } from "lit/static-html.js";

import { defineElement } from "./custom-element";
import { JSON_VIEWER_TAG, defineJsonViewer } from "./json-viewer-element";

export const TOOL_INVOCATION_CARD_TAG = "agenter-tool-invocation-card";

export type ToolInvocationStatus = "waiting" | "running" | "success" | "failed" | "cancelled";

export interface ToolInvocationPayloadView {
  value: unknown;
  rawText?: string;
}

export interface ToolInvocationView {
  invocationId: string;
  toolName: string;
  status: ToolInvocationStatus;
  call?: ToolInvocationPayloadView | null;
  result?: ToolInvocationPayloadView | null;
  error?: string | null;
  meta?: Record<string, unknown>;
  startedAt?: number;
  finishedAt?: number;
}

defineJsonViewer();
const jsonViewerTag = unsafeStatic(JSON_VIEWER_TAG);

const statusTone = (status: ToolInvocationStatus): string => {
  switch (status) {
    case "running":
      return "badge warning";
    case "success":
      return "badge success";
    case "failed":
      return "badge destructive";
    default:
      return "badge secondary";
  }
};

const statusLabel = (status: ToolInvocationStatus): string => status;

const hasVisiblePayload = (payload: ToolInvocationPayloadView | null | undefined): payload is ToolInvocationPayloadView => {
  if (!payload) {
    return false;
  }
  if (typeof payload.rawText === "string" && payload.rawText.trim().length > 0) {
    return true;
  }
  if (typeof payload.value === "string") {
    return payload.value.trim().length > 0;
  }
  return payload.value !== undefined && payload.value !== null;
};

const renderJsonViewer = (payload: ToolInvocationPayloadView) =>
  staticHtml`<${jsonViewerTag} .value=${payload.value} .rawText=${payload.rawText ?? ""}></${jsonViewerTag}>`;

const resolveVisibleTitle = (invocation: ToolInvocationView): string => {
  const title = invocation.meta?.title;
  return typeof title === "string" && title.trim().length > 0 ? title.trim() : invocation.toolName;
};

export class ToolInvocationCardElement extends LitElement {
  static properties = {
    invocation: { attribute: false },
  };

  static styles = css`
    :host {
      display: block;
      min-width: 0;
    }

    .card {
      display: grid;
      gap: 0.75rem;
      border: 1px solid hsl(var(--border, 214 32% 91%));
      border-radius: 1rem;
      background: color-mix(in srgb, hsl(var(--muted, 210 40% 96%)) 70%, transparent);
      padding: 0.85rem;
    }

    .header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }

    .heading {
      display: grid;
      gap: 0.15rem;
      min-width: 0;
    }

    .title {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.9375rem;
      font-weight: 600;
      color: hsl(var(--foreground, 222 47% 11%));
    }

    .tool-name {
      color: hsl(var(--muted-foreground, 215 16% 47%));
      font-size: 0.75rem;
      line-height: 1.2;
    }

    .meta {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-left: auto;
    }

    .status-dot {
      width: 0.65rem;
      height: 0.65rem;
      border-radius: 999px;
      background: currentColor;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      padding: 0.2rem 0.5rem;
      font-size: 0.6875rem;
      font-weight: 700;
      text-transform: lowercase;
    }

    .badge.secondary {
      background: hsl(var(--secondary, 210 40% 96%));
      color: hsl(var(--secondary-foreground, 222 47% 11%));
    }

    .badge.warning {
      background: rgba(245, 158, 11, 0.15);
      color: rgb(180, 83, 9);
    }

    .badge.success {
      background: rgba(16, 185, 129, 0.14);
      color: rgb(4, 120, 87);
    }

    .badge.destructive {
      background: rgba(244, 63, 94, 0.12);
      color: rgb(190, 24, 93);
    }

    .timestamp {
      color: hsl(var(--muted-foreground, 215 16% 47%));
      font-size: 0.6875rem;
    }

    .error {
      border: 1px solid rgba(244, 63, 94, 0.22);
      border-radius: 0.85rem;
      background: rgba(255, 241, 242, 0.8);
      color: rgb(159, 18, 57);
      font-size: 0.75rem;
      padding: 0.65rem 0.75rem;
    }

    .section {
      display: grid;
      gap: 0.4rem;
    }

    .section-label {
      color: hsl(var(--muted-foreground, 215 16% 47%));
      font-size: 0.6875rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
  `;

  invocation: ToolInvocationView | null = null;

  render() {
    const invocation = this.invocation;
    if (!invocation) {
      return null;
    }
    const visibleTitle = resolveVisibleTitle(invocation);
    const visibleCall = hasVisiblePayload(invocation.call) ? invocation.call : null;
    const visibleResult = hasVisiblePayload(invocation.result) ? invocation.result : null;
    return html`
      <article class="card">
        <header class="header">
          <div class="heading">
            <div class="title">
              <span class="status-dot"></span>
              <span>${visibleTitle}</span>
            </div>
            ${visibleTitle !== invocation.toolName ? html`<div class="tool-name">${invocation.toolName}</div>` : null}
          </div>
          <div class="meta">
            <span class=${statusTone(invocation.status)}>${statusLabel(invocation.status)}</span>
            ${invocation.startedAt
              ? html`<span class="timestamp"
                  >${new Date(invocation.startedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}</span
                >`
              : null}
          </div>
        </header>

        ${invocation.error ? html`<div class="error">${invocation.error}</div>` : null}

        ${visibleCall
          ? html`
              <section class="section">
                <div class="section-label">Call</div>
                ${renderJsonViewer(visibleCall)}
              </section>
            `
          : null}

        ${visibleResult
          ? html`
              <section class="section">
                <div class="section-label">Result</div>
                ${renderJsonViewer(visibleResult)}
              </section>
            `
          : null}
      </article>
    `;
  }
}

export const defineToolInvocationCard = (): void => {
  defineElement(TOOL_INVOCATION_CARD_TAG, ToolInvocationCardElement);
};

export type ToolInvocationCardElementType = HTMLElement & {
  invocation: ToolInvocationView | null;
};
