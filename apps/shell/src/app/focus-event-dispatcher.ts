import type { KeyEvent } from "@opentui/core";

import { isShellKeyHandled, markShellKeyHandled, type ShellKeyScope } from "./key-event-scope";

export type ShellKeyEventScope = ShellKeyScope;

export type ShellKeyEventPhase = "capture" | "target" | "bubble";

export interface ShellKeyDispatchContext {
  readonly phase: ShellKeyEventPhase;
  readonly nodeId: string;
  readonly targetId: string;
  readonly path: readonly ShellFocusableKeyNode[];
}

export type ShellKeyHandler = (key: KeyEvent, context: ShellKeyDispatchContext) => boolean | void;

export interface ShellFocusableKeyNode {
  readonly id: string;
  readonly scope: ShellKeyEventScope;
  readonly parentId?: string | null;
  readonly active: () => boolean;
  readonly focused?: () => boolean;
  readonly onKeyCapture?: ShellKeyHandler;
  readonly onKey?: ShellKeyHandler;
  readonly onKeyBubble?: ShellKeyHandler;
}

export class ShellFocusEventDispatcher {
  readonly #nodes = new Map<string, ShellFocusableKeyNode>();
  readonly #order: string[] = [];

  register(node: ShellFocusableKeyNode): () => void {
    if (this.#nodes.has(node.id)) {
      throw new Error(`duplicate shell focus node: ${node.id}`);
    }
    this.#nodes.set(node.id, node);
    this.#order.push(node.id);
    return () => {
      this.#nodes.delete(node.id);
      const index = this.#order.indexOf(node.id);
      if (index >= 0) {
        this.#order.splice(index, 1);
      }
    };
  }

  dispatch(key: KeyEvent): boolean {
    const path = this.#resolveActivePath();
    if (path.length === 0) {
      return false;
    }
    const target = path[path.length - 1];
    for (const node of path.slice(0, -1)) {
      if (this.#invoke(node, target, path, "capture", key, node.onKeyCapture)) {
        return true;
      }
    }
    if (this.#invoke(target, target, path, "target", key, target.onKey)) {
      return true;
    }
    for (const node of path.slice(0, -1).reverse()) {
      if (this.#invoke(node, target, path, "bubble", key, node.onKeyBubble)) {
        return true;
      }
    }
    return isShellKeyHandled(key);
  }

  #resolveActivePath(): ShellFocusableKeyNode[] {
    const activeNodes = this.#order
      .map((id) => this.#nodes.get(id))
      .filter((node): node is ShellFocusableKeyNode => node !== undefined && node.active());
    const target = activeNodes.filter((node) => node.focused?.() === true).at(-1) ?? activeNodes.at(-1);
    if (!target) {
      return [];
    }
    const path: ShellFocusableKeyNode[] = [];
    const seen = new Set<string>();
    let cursor: ShellFocusableKeyNode | undefined = target;
    while (cursor) {
      if (seen.has(cursor.id) || !cursor.active()) {
        return [];
      }
      seen.add(cursor.id);
      path.unshift(cursor);
      const parentId: string | null = cursor.parentId ?? null;
      cursor = parentId ? this.#nodes.get(parentId) : undefined;
    }
    return path;
  }

  #invoke(
    node: ShellFocusableKeyNode,
    target: ShellFocusableKeyNode,
    path: readonly ShellFocusableKeyNode[],
    phase: ShellKeyEventPhase,
    key: KeyEvent,
    handler: ShellKeyHandler | undefined,
  ): boolean {
    if (!handler) {
      return false;
    }
    const handled = handler(key, {
      phase,
      nodeId: node.id,
      targetId: target.id,
      path,
    });
    if (handled === true && !isShellKeyHandled(key)) {
      markShellKeyHandled(key, node.scope);
    }
    return handled === true || isShellKeyHandled(key);
  }
}
