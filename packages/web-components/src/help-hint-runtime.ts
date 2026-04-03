type HelpHintRuntimeHandle = {
  id: string;
  isDisabled: () => boolean;
  isOpen: () => boolean;
  openPassiveFromShortcut: () => void;
  closeFromShortcut: () => void;
};

const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

const handles = new Map<string, HelpHintRuntimeHandle>();
let removeGlobalShortcutListener: (() => void) | null = null;

const isEditableElement = (value: EventTarget | null): boolean => {
  if (!(value instanceof Element)) {
    return false;
  }
  const candidate = value.closest("input, textarea, select, [contenteditable], [role='textbox']");
  if (!candidate) {
    return false;
  }
  if (candidate instanceof HTMLTextAreaElement || candidate instanceof HTMLSelectElement) {
    return true;
  }
  if (candidate instanceof HTMLInputElement) {
    return !NON_TEXT_INPUT_TYPES.has(candidate.type.toLowerCase());
  }
  return candidate instanceof HTMLElement && (candidate.isContentEditable || candidate.getAttribute("role") === "textbox");
};

const isQuestionMarkShortcut = (event: KeyboardEvent): boolean => {
  return (
    event.key === "?" &&
    !event.defaultPrevented &&
    !event.repeat &&
    !event.isComposing &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey
  );
};

const getRegisteredHandles = (): HelpHintRuntimeHandle[] => {
  return [...handles.values()].filter((handle) => !handle.isDisabled());
};

const handleGlobalShortcut = (event: KeyboardEvent): void => {
  if (!isQuestionMarkShortcut(event)) {
    return;
  }
  if (isEditableElement(event.target) || isEditableElement(document.activeElement)) {
    return;
  }
  const registeredHandles = getRegisteredHandles();
  if (registeredHandles.length === 0) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  if (registeredHandles.some((handle) => handle.isOpen())) {
    for (const handle of registeredHandles) {
      handle.closeFromShortcut();
    }
    return;
  }
  for (const handle of registeredHandles) {
    handle.openPassiveFromShortcut();
  }
};

const ensureGlobalShortcutListener = (): void => {
  if (removeGlobalShortcutListener !== null || typeof document === "undefined") {
    return;
  }
  document.addEventListener("keydown", handleGlobalShortcut);
  removeGlobalShortcutListener = () => {
    document.removeEventListener("keydown", handleGlobalShortcut);
    removeGlobalShortcutListener = null;
  };
};

const cleanupGlobalShortcutListener = (): void => {
  if (handles.size > 0) {
    return;
  }
  removeGlobalShortcutListener?.();
};

export const registerHelpHintRuntimeHandle = (handle: HelpHintRuntimeHandle): (() => void) => {
  handles.set(handle.id, handle);
  ensureGlobalShortcutListener();
  return () => {
    handles.delete(handle.id);
    cleanupGlobalShortcutListener();
  };
};
