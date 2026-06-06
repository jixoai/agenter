const padTwoDigits = (value: number): string => String(value).padStart(2, "0");

export const formatRuntimeCompactTimestamp = (value?: number | string | null): string => {
  if (!value) {
    return "Unknown";
  }
  const date = new Date(value);
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${padTwoDigits(date.getHours())}:${padTwoDigits(date.getMinutes())}:${padTwoDigits(date.getSeconds())}`;
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
