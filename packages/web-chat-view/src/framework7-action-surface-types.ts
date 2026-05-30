export interface Framework7ActionSurfaceItem {
  id: string;
  label: string;
  detail?: string;
  tone?: "default" | "destructive";
  disabled?: boolean;
  onSelect?: () => void | Promise<void>;
}

export type Framework7ActionSurfaceAnchor =
  | {
      targetEl: Element | string;
    }
  | {
      targetX: number;
      targetY: number;
      targetWidth: number;
      targetHeight: number;
    };

export interface Framework7ActionsInstance {
  open: (animate?: boolean) => void;
  close: (animate?: boolean) => void;
  destroy: () => void;
}

export interface Framework7ActionsButton {
  text: string;
  color?: string;
  bold?: boolean;
  disabled?: boolean;
  close?: boolean;
  onClick?: () => void;
}

export interface Framework7AppWithActions {
  actions: {
    create: (params: {
      buttons: Framework7ActionsButton[][];
      backdrop?: boolean;
      closeByBackdropClick?: boolean;
      closeByOutsideClick?: boolean;
      convertToPopover?: boolean;
      forceToPopover?: boolean;
      targetEl?: Element | string;
      targetX?: number;
      targetY?: number;
      targetWidth?: number;
      targetHeight?: number;
      containerEl?: string;
      on?: {
        closed?: () => void;
      };
    }) => Framework7ActionsInstance;
  };
}
