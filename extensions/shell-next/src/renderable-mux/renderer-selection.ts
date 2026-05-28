import { MouseButton, type MouseEvent } from "@opentui/core";

export const preserveRendererSelectionOnMiddleClick = (event: MouseEvent): boolean => {
  if (event.button !== MouseButton.MIDDLE) {
    return false;
  }
  event.preventDefault();
  event.stopPropagation();
  return true;
};
