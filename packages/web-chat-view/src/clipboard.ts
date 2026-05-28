export const writeClipboardText = async (value: string): Promise<void> => {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const element = document.createElement("textarea");
  element.value = value;
  document.body.append(element);
  element.select();
  document.execCommand("copy");
  element.remove();
};
