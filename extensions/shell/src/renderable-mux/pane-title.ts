export const truncatePaneTitle = (title: string, width: number): string => {
  const safeWidth = Math.max(0, Math.trunc(width));
  if (safeWidth <= 0) {
    return "";
  }
  if (title.length <= safeWidth) {
    return title;
  }
  if (safeWidth <= 1) {
    return title.slice(0, safeWidth);
  }
  return `${title.slice(0, safeWidth - 1)}…`;
};
