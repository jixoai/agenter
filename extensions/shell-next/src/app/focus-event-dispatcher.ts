import type { KeyEvent } from "@opentui/core";

import { isShellNextKeyHandled, markShellNextKeyHandled, type ShellNextKeyScope } from "./key-event-scope";

export type ShellNextKeyEventScope = ShellNextKeyScope;

export type ShellNextKeyEventPhase = "capture" | "target" | "bubble";

export interface ShellNextKeyDispatchContext {
  readonly phase: ShellNextKeyEventPhase;
  readonly nodeId: string;
  readonly targetId: string;
  readonly path: readonly ShellNextFocusableKeyNode[];
}

export type ShellNextKeyHandler = (key: KeyEvent, context: ShellNextKeyDispatchContext) => boolean | void;

export interface ShellNextFocusableKeyNode {
  readonly id: string;
  readonly scope: ShellNextKeyEventScope;
  readonly parentId?: string | null;
  readonly active: () => boolean;
  readonly focused?: () => boolean;
  readonly onKeyCapture?: ShellNextKeyHandler;
  readonly onKey?: ShellNextKeyHandler;
  readonly onKeyBubble?: ShellNextKeyHandler;
}

export class ShellNextFocusEventDispatcher {
  readonly #nodes = new Map<string, ShellNextFocusableKeyNode>();
  readonly #order: string[] = [];

  register(node: ShellNextFocusableKeyNode): () => void {
    if (this.#nodes.has(node.id)) {
      throw new Error(`duplicate shell-next focus node: ${node.id}`);
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
    return isShellNextKeyHandled(key);
  }

  #resolveActivePath(): ShellNextFocusableKeyNode[] {
    const activeNodes = this.#order
      .map((id) => this.#nodes.get(id))
      .filter((node): node is ShellNextFocusableKeyNode => node !== undefined && node.active());
    const target = activeNodes.filter((node) => node.focused?.() === true).at(-1) ?? activeNodes.at(-1);
    if (!target) {
      return [];
    }
    const path: ShellNextFocusableKeyNode[] = [];
    const seen = new Set<string>();
    let cursor: ShellNextFocusableKeyNode | undefined = target;
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
    node: ShellNextFocusableKeyNode,
    target: ShellNextFocusableKeyNode,
    path: readonly ShellNextFocusableKeyNode[],
    phase: ShellNextKeyEventPhase,
    key: KeyEvent,
    handler: ShellNextKeyHandler | undefined,
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
    if (handled === true && !isShellNextKeyHandled(key)) {
      markShellNextKeyHandled(key, node.scope);
    }
    return handled === true || isShellNextKeyHandled(key);
  }
}
