export const defaultWsUrl = (): string => {
  const envUrl = import.meta.env.VITE_AGENTER_WS_URL;
  if (typeof envUrl === "string" && envUrl.trim().length > 0) {
    return envUrl.trim();
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/trpc`;
};
