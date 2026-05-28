import { MouseButton, type MouseEvent } from "@opentui/core";

export interface ShellNextButtonPressControllerInput<ActionId extends string> {
  readonly resolveAction: (event: MouseEvent) => ActionId | null;
  readonly onClick: (action: ActionId, event: MouseEvent) => void;
  readonly onHoverChange?: (action: ActionId | null) => void;
}

export class ShellNextButtonPressController<ActionId extends string> {
  readonly #resolveAction: (event: MouseEvent) => ActionId | null;
  readonly #onClick: (action: ActionId, event: MouseEvent) => void;
  readonly #onHoverChange: ((action: ActionId | null) => void) | undefined;
  #armedAction: ActionId | null = null;
  #hoveredAction: ActionId | null = null;

  constructor(input: ShellNextButtonPressControllerInput<ActionId>) {
    this.#resolveAction = input.resolveAction;
    this.#onClick = input.onClick;
    this.#onHoverChange = input.onHoverChange;
  }

  handleMouseDown(event: MouseEvent): boolean {
    if (event.button !== MouseButton.LEFT) {
      return false;
    }
    const action = this.#resolveAction(event);
    this.#armedAction = action;
    if (!action) {
      return false;
    }
    event.preventDefault();
    return true;
  }

  handleMouseUp(event: MouseEvent): boolean {
    if (event.button !== MouseButton.LEFT) {
      return false;
    }
    const action = this.#resolveAction(event);
    const armedAction = this.#armedAction;
    this.#armedAction = null;
    if (action) {
      event.preventDefault();
    }
    if (!action || armedAction !== action) {
      return false;
    }
    this.#onClick(action, event);
    return true;
  }

  handleMouseMove(event: MouseEvent): boolean {
    const action = this.#resolveAction(event);
    if (action !== this.#hoveredAction) {
      this.#hoveredAction = action;
      this.#onHoverChange?.(action);
    }
    if (!action) {
      return false;
    }
    event.preventDefault();
    return true;
  }

  reset(): void {
    this.#armedAction = null;
    if (this.#hoveredAction === null) {
      return;
    }
    this.#hoveredAction = null;
    this.#onHoverChange?.(null);
  }
}
