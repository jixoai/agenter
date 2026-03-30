export const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const fractionFromSeed = (seed: number, offset: number): number => {
  const next = Math.imul(seed ^ (offset * 0x45d9f3b), 0x27d4eb2d) >>> 0;
  return next / 0xffffffff;
};
