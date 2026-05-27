import type { KeyEvent } from "@opentui/core";

import { isShellNextKeyHandled, markShellNextKeyHandled, type ShellNextKeyScope } from "./key-event-scope";

export type ShellNextKeyEventScope = ShellNextKeyScope;

export interface ShellNextFocusableKeyNode {
  readonly id: string;
  readonly scope: ShellNextKeyEventScope;
  readonly active: () => boolean;
  readonly onKey: (key: KeyEvent) => boolean | void;
}

export class ShellNextFocusEventDispatcher {
  readonly #nodes: ShellNextFocusableKeyNode[] = [];

  register(node: ShellNextFocusableKeyNode): () => void {
    this.#nodes.push(node);
    return () => {
      const index = this.#nodes.indexOf(node);
      if (index >= 0) {
        this.#nodes.splice(index, 1);
      }
    };
  }

  dispatch(key: KeyEvent): boolean {
    for (const node of this.#nodes) {
      if (!node.active()) {
        continue;
      }
      const handled = node.onKey(key);
      if (handled === true && !isShellNextKeyHandled(key)) {
        markShellNextKeyHandled(key, node.scope);
      }
      if (handled === true || isShellNextKeyHandled(key)) {
        return true;
      }
    }
    return false;
  }
}
