const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const deepMerge = <T>(base: T, patch: Partial<T>): T => {
  if (Array.isArray(base) || Array.isArray(patch)) {
    return (Array.isArray(patch) ? patch : base) as T;
  }
  if (!isObject(base) || !isObject(patch)) {
    return (patch === undefined ? base : patch) as T;
  }

  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      continue;
    }
    const current = result[key];
    if (isObject(current) && isObject(value)) {
      result[key] = deepMerge(current, value);
      continue;
    }
    result[key] = value;
  }

  return result as T;
};
