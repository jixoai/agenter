import { LitElement, css, html } from "lit";

import { defineElement } from "./custom-element";

export const ASYNC_SURFACE_TAG = "agenter-async-surface";

export type AsyncSurfaceState = "empty-loading" | "empty-idle" | "ready-loading" | "ready-idle";

export const resolveAsyncSurfaceState = (input: {
  loading: boolean;
  hasData: boolean;
}): AsyncSurfaceState => {
  if (input.hasData) {
    return input.loading ? "ready-loading" : "ready-idle";
  }
  return input.loading ? "empty-loading" : "empty-idle";
};

export class AsyncSurfaceElement extends LitElement {
  static properties = {
    state: { type: String },
    emptyLoadingLabel: { type: String },
    loadingOverlayLabel: { type: String },
  };

  static styles = css`
    :host {
      display: flex;
      flex: 1 1 auto;
      min-width: 0;
      min-height: 0;
    }

    .root {
      position: relative;
      display: grid;
      width: 100%;
      min-width: 0;
      min-height: 0;
    }

    .overlay {
      position: absolute;
      top: 0.75rem;
      right: 0.75rem;
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      border: 1px solid hsl(var(--border, 214 32% 91%));
      border-radius: 999px;
      background: color-mix(in srgb, hsl(var(--background, 0 0% 100%)) 92%, transparent);
      color: hsl(var(--muted-foreground, 215 16% 47%));
      padding: 0.25rem 0.625rem;
      font-size: 0.6875rem;
      font-weight: 600;
      box-shadow: 0 0.5rem 1.25rem rgba(15, 23, 42, 0.08);
    }

    .overlay::before {
      content: "";
      width: 0.625rem;
      height: 0.625rem;
      border-radius: 999px;
      border: 1.5px solid currentColor;
      border-right-color: transparent;
      animation: spin 0.8s linear infinite;
    }

    .empty-loading,
    .empty-idle {
      display: flex;
      flex: 1 1 auto;
      min-width: 0;
      min-height: 0;
      align-items: center;
      justify-content: center;
    }

    .empty-loading-copy {
      text-align: center;
      color: hsl(var(--muted-foreground, 215 16% 47%));
      font-size: 0.875rem;
      padding: 1rem;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `;

  state: AsyncSurfaceState = "empty-idle";

  emptyLoadingLabel = "Loading…";

  loadingOverlayLabel = "Refreshing…";

  render() {
    if (this.state === "empty-loading") {
      return html`
        <div class="empty-loading" data-async-surface-state=${this.state}>
          <slot name="skeleton">
            <div class="empty-loading-copy">${this.emptyLoadingLabel}</div>
          </slot>
        </div>
      `;
    }

    if (this.state === "empty-idle") {
      return html`
        <div class="empty-idle" data-async-surface-state=${this.state}>
          <slot name="empty"></slot>
        </div>
      `;
    }

    return html`
      <div class="root" data-async-surface-state=${this.state}>
        <slot></slot>
        ${this.state === "ready-loading"
          ? html`<div class="overlay">${this.loadingOverlayLabel}</div>`
          : null}
      </div>
    `;
  }
}

export const defineAsyncSurface = (): void => {
  defineElement(ASYNC_SURFACE_TAG, AsyncSurfaceElement);
};

export type AsyncSurfaceElementType = HTMLElement & {
  state: AsyncSurfaceState;
  emptyLoadingLabel: string;
  loadingOverlayLabel: string;
};
