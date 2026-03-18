export interface VisibleCycleEntry {
  id: string;
  ratio: number;
  distance: number;
}

export interface VisibleCycleState {
  visibleIds: string[];
  anchorId: string | null;
}

export const resolveVisibleCycleState = (
  entries: Iterable<VisibleCycleEntry>,
  orderedCycleIds: readonly string[],
): VisibleCycleState => {
  const visible = [...entries].filter((entry) => entry.ratio > 0);
  if (visible.length === 0) {
    return { visibleIds: [], anchorId: null };
  }

  const orderIndex = new Map(orderedCycleIds.map((id, index) => [id, index]));
  visible.sort((left, right) => {
    const leftIndex = orderIndex.get(left.id);
    const rightIndex = orderIndex.get(right.id);
    if (leftIndex !== undefined && rightIndex !== undefined && leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }
    if (leftIndex !== undefined && rightIndex === undefined) {
      return -1;
    }
    if (leftIndex === undefined && rightIndex !== undefined) {
      return 1;
    }
    if (left.distance !== right.distance) {
      return left.distance - right.distance;
    }
    return right.ratio - left.ratio;
  });

  const visibleIds = visible.map((entry) => entry.id);
  const anchorId = visibleIds[Math.floor((visibleIds.length - 1) / 2)] ?? null;
  return { visibleIds, anchorId };
};
