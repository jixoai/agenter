export const formatRuntimeTimestamp = (value?: number | string | null): string => {
  if (!value) {
    return "Unknown";
  }
  return new Date(value).toLocaleString();
};

const padTwoDigits = (value: number): string => String(value).padStart(2, "0");

export const formatRuntimeCompactTimestamp = (value?: number | string | null): string => {
  if (!value) {
    return "Unknown";
  }
  const date = new Date(value);
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${padTwoDigits(date.getHours())}:${padTwoDigits(date.getMinutes())}:${padTwoDigits(date.getSeconds())}`;
};

export const formatRuntimeDuration = (valueMs?: number | null): string => {
  if (valueMs === null || valueMs === undefined || !Number.isFinite(valueMs)) {
    return "0ms";
  }
  const durationMs = Math.max(0, valueMs);
  if (durationMs < 1_000) {
    return `${Math.round(durationMs)}ms`;
  }
  if (durationMs < 10_000) {
    return `${(durationMs / 1_000).toFixed(1)}s`;
  }
  if (durationMs < 60_000) {
    return `${Math.round(durationMs / 1_000)}s`;
  }

  const totalSeconds = Math.round(durationMs / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (seconds === 0) {
    return `${minutes}m`;
  }
  return `${minutes}m ${seconds}s`;
};

export const formatRuntimeCompactDuration = (valueMs?: number | null): string => {
  if (valueMs === null || valueMs === undefined || !Number.isFinite(valueMs)) {
    return "0 sec";
  }
  const durationMs = Math.max(0, valueMs);
  const totalSeconds = Math.round(durationMs / 1_000);

  if (totalSeconds < 60) {
    return `${totalSeconds} sec`;
  }

  const totalMinutes = Math.round(totalSeconds / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) {
    return `${hours} hr`;
  }
  return `${hours} hr ${minutes} min`;
};

export const formatCycleLabel = (cycleId: number | null): string => {
  return cycleId === null ? "pending" : String(cycleId);
};
