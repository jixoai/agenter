export const formatRuntimeTimestamp = (value?: number | string | null): string => {
  if (!value) {
    return "Unknown";
  }
  return new Date(value).toLocaleString();
};

export const formatCycleLabel = (cycleId: number | null): string => {
  return cycleId === null ? "pending" : String(cycleId);
};
