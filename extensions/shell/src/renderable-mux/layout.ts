import type {
  ChildLayoutNode,
  FocusDirection,
  LayoutAxis,
  LayoutPaneInput,
  LayoutRect,
  LayoutSourceKind,
  ResizeEdge,
  RootLayout,
  SplitDirection,
} from "./layout-types";

export type {
  ChildLayoutNode,
  FocusDirection,
  LayoutAxis,
  LayoutPaneInput,
  LayoutRect,
  LayoutSourceKind,
  ResizeEdge,
  RootLayout,
  SplitDirection,
} from "./layout-types";

// tmux reference: tmux/tmux@7a15dc6772152f09313b7708068e984c55848094.
// `tmux.h` defines `PANE_MINIMUM` as 1, and `layout.c` split checks add
// one separator cell between two panes before allowing a split.
const PANE_MINIMUM_CELLS = 1;
const SPLIT_SEPARATOR_CELLS = 1;

export const getOpenComposeMinimumSplitSize = (paneCount: number): number => {
  const count = Math.max(1, Math.trunc(paneCount));
  return count * PANE_MINIMUM_CELLS + Math.max(0, count - 1) * SPLIT_SEPARATOR_CELLS;
};

interface LayoutPaneTreeNode {
  kind: "pane";
  pane: LayoutPaneInput;
  rect: LayoutRect;
}

interface LayoutSplitBranch {
  node: LayoutTreeNode;
  weight: number;
}

interface LayoutSplitTreeNode {
  kind: "split";
  id: string;
  axis: LayoutAxis;
  rect: LayoutRect;
  children: LayoutSplitBranch[];
}

type LayoutTreeNode = LayoutPaneTreeNode | LayoutSplitTreeNode;

interface PanePathPart {
  split: LayoutSplitTreeNode;
  index: number;
}

interface PaneSearchResult {
  node: LayoutPaneTreeNode;
  path: PanePathPart[];
}

const sanitizeRect = (rect: LayoutRect): LayoutRect => ({
  x: Math.max(0, Math.trunc(rect.x)),
  y: Math.max(0, Math.trunc(rect.y)),
  width: Math.max(1, Math.trunc(rect.width)),
  height: Math.max(1, Math.trunc(rect.height)),
});

const containsPoint = (rect: LayoutRect, x: number, y: number): boolean =>
  x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;

const axisForSplitDirection = (direction: SplitDirection): LayoutAxis =>
  direction === "left" || direction === "right" ? "horizontal" : "vertical";

const axisForResizeEdge = (edge: ResizeEdge): LayoutAxis =>
  edge === "left" || edge === "right" ? "horizontal" : "vertical";

const paneSizeOnAxis = (rect: LayoutRect, axis: LayoutAxis): number => (axis === "horizontal" ? rect.width : rect.height);

const paneCenter = (rect: LayoutRect): { x: number; y: number } => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2,
});

export const canSplitRect = (rect: LayoutRect, direction: SplitDirection): boolean => {
  const safe = sanitizeRect(rect);
  const axis = axisForSplitDirection(direction);
  return paneSizeOnAxis(safe, axis) >= getOpenComposeMinimumSplitSize(2);
};

const createPaneNode = (pane: LayoutPaneInput): LayoutPaneTreeNode => ({
  kind: "pane",
  pane,
  rect: { x: 0, y: 0, width: 1, height: 1 },
});

const cloneTree = (node: LayoutTreeNode): LayoutTreeNode => structuredClone(node) as LayoutTreeNode;

const createSplitNode = (id: string, axis: LayoutAxis, children: LayoutSplitBranch[]): LayoutSplitTreeNode => ({
  kind: "split",
  id,
  axis,
  rect: { x: 0, y: 0, width: 1, height: 1 },
  children,
});

const distributeSizes = (size: number, branches: readonly LayoutSplitBranch[]): number[] => {
  const safeSize = Math.max(1, Math.trunc(size));
  const totalWeight = branches.reduce((sum, branch) => sum + Math.max(1, branch.weight), 0);
  const sizes = branches.map((branch) => Math.max(1, Math.floor((safeSize * Math.max(1, branch.weight)) / totalWeight)));
  let used = sizes.reduce((sum, value) => sum + value, 0);
  for (let index = 0; used < safeSize; index = (index + 1) % sizes.length) {
    sizes[index] += 1;
    used += 1;
  }
  return sizes;
};

const assignRects = (node: LayoutTreeNode, rect: LayoutRect): void => {
  const safe = sanitizeRect(rect);
  node.rect = safe;
  if (node.kind === "pane") {
    return;
  }
  const axis = node.axis;
  const sizes = distributeSizes(paneSizeOnAxis(safe, axis), node.children);
  let offset = axis === "horizontal" ? safe.x : safe.y;
  node.children.forEach((branch, index) => {
    const size = sizes[index] ?? 1;
    const childRect =
      axis === "horizontal"
        ? { x: offset, y: safe.y, width: size, height: safe.height }
        : { x: safe.x, y: offset, width: safe.width, height: size };
    assignRects(branch.node, childRect);
    offset += size;
  });
};

const flattenPanes = (node: LayoutTreeNode, focusedId: string | null): ChildLayoutNode[] => {
  if (node.kind === "pane") {
    return [{ ...node.pane, rect: node.rect, focused: node.pane.id === focusedId }];
  }
  return node.children.flatMap((child) => flattenPanes(child.node, focusedId));
};

const firstPaneId = (node: LayoutTreeNode): string => {
  if (node.kind === "pane") {
    return node.pane.id;
  }
  return firstPaneId(node.children[0]?.node ?? createPaneNode({ id: "missing", sourceKind: "opentui-renderable" }));
};

const findPane = (node: LayoutTreeNode, paneId: string, path: PanePathPart[] = []): PaneSearchResult | null => {
  if (node.kind === "pane") {
    return node.pane.id === paneId ? { node, path } : null;
  }
  for (let index = 0; index < node.children.length; index += 1) {
    const result = findPane(node.children[index].node, paneId, [...path, { split: node, index }]);
    if (result) {
      return result;
    }
  }
  return null;
};

const buildInitialTree = (panes: readonly LayoutPaneInput[]): LayoutTreeNode => {
  const paneNodes = panes.map(createPaneNode);
  if (paneNodes.length === 0) {
    return createPaneNode({ id: "pane-1", sourceKind: "opentui-renderable" });
  }
  if (paneNodes.length === 1) {
    return paneNodes[0];
  }
  if (paneNodes.length === 4) {
    return createSplitNode("split-root", "vertical", [
      {
        weight: 1,
        node: createSplitNode("split-top", "horizontal", [
          { weight: 1, node: paneNodes[0] },
          { weight: 1, node: paneNodes[1] },
        ]),
      },
      {
        weight: 1,
        node: createSplitNode("split-bottom", "horizontal", [
          { weight: 1, node: paneNodes[2] },
          { weight: 1, node: paneNodes[3] },
        ]),
      },
    ]);
  }
  return createSplitNode(
    "split-root",
    "horizontal",
    paneNodes.map((node) => ({ weight: 1, node })),
  );
};

const insertSplit = (root: LayoutTreeNode, found: PaneSearchResult, direction: SplitDirection, pane: LayoutPaneInput): LayoutTreeNode => {
  const axis = axisForSplitDirection(direction);
  const newBranch = { weight: 1, node: createPaneNode(pane) };
  const targetBranch = { weight: 1, node: found.node };
  const ordered =
    direction === "left" || direction === "above" ? [newBranch, targetBranch] : [targetBranch, newBranch];
  const parentPart = found.path.at(-1);
  if (parentPart && parentPart.split.axis === axis) {
    const insertIndex = direction === "left" || direction === "above" ? parentPart.index : parentPart.index + 1;
    parentPart.split.children.splice(insertIndex, 0, newBranch);
    return root;
  }
  const replacement = createSplitNode(`split-${pane.id}`, axis, ordered);
  if (!parentPart) {
    return replacement;
  }
  parentPart.split.children[parentPart.index].node = replacement;
  return root;
};

const removePane = (node: LayoutTreeNode, paneId: string): { node: LayoutTreeNode | null; removed: boolean } => {
  if (node.kind === "pane") {
    return { node: node.pane.id === paneId ? null : node, removed: node.pane.id === paneId };
  }
  let removed = false;
  const children: LayoutSplitBranch[] = [];
  for (const branch of node.children) {
    const result = removePane(branch.node, paneId);
    removed = removed || result.removed;
    if (result.node) {
      children.push({ ...branch, node: result.node });
    }
  }
  if (!removed) {
    return { node, removed: false };
  }
  if (children.length === 1) {
    return { node: children[0].node, removed: true };
  }
  node.children = children;
  return { node, removed: true };
};

const findResizablePair = (
  path: readonly PanePathPart[],
  edge: ResizeEdge,
): { split: LayoutSplitTreeNode; index: number; neighborIndex: number } | null => {
  const axis = axisForResizeEdge(edge);
  const towardPrevious = edge === "left" || edge === "top";
  for (let pathIndex = path.length - 1; pathIndex >= 0; pathIndex -= 1) {
    const part = path[pathIndex];
    if (part.split.axis !== axis) {
      continue;
    }
    const neighborIndex = towardPrevious ? part.index - 1 : part.index + 1;
    if (neighborIndex >= 0 && neighborIndex < part.split.children.length) {
      return { split: part.split, index: part.index, neighborIndex };
    }
  }
  return null;
};

const getFocusCandidate = (focused: ChildLayoutNode, candidates: readonly ChildLayoutNode[], direction: FocusDirection): string | null => {
  const focusedCenter = paneCenter(focused.rect);
  const scored = candidates
    .filter((candidate) => candidate.id !== focused.id)
    .map((candidate) => {
      const center = paneCenter(candidate.rect);
      const dx = center.x - focusedCenter.x;
      const dy = center.y - focusedCenter.y;
      const inDirection =
        (direction === "left" && dx < 0) ||
        (direction === "right" && dx > 0) ||
        (direction === "up" && dy < 0) ||
        (direction === "down" && dy > 0);
      const primary = direction === "left" || direction === "right" ? Math.abs(dx) : Math.abs(dy);
      const secondary = direction === "left" || direction === "right" ? Math.abs(dy) : Math.abs(dx);
      return { candidate, inDirection, primary, secondary };
    })
    .filter((entry) => entry.inDirection)
    .sort((a, b) => a.primary - b.primary || a.secondary - b.secondary);
  return scored[0]?.candidate.id ?? null;
};

export const createRootLayout = (rect: LayoutRect, nodes: readonly LayoutPaneInput[]): RootLayout => {
  let currentRect = sanitizeRect(rect);
  let root = buildInitialTree(nodes);
  let focusedId = firstPaneId(root);
  let children: ChildLayoutNode[] = [];

  const recompute = (): void => {
    assignRects(root, currentRect);
    children = flattenPanes(root, focusedId);
    if (!children.some((child) => child.id === focusedId)) {
      focusedId = children[0]?.id ?? null;
      children = flattenPanes(root, focusedId);
    }
  };

  recompute();

  return {
    get rect() {
      return currentRect;
    },
    get children() {
      return children;
    },
    resize(nextRect) {
      currentRect = sanitizeRect(nextRect);
      recompute();
    },
    focus(nodeId) {
      if (!children.some((child) => child.id === nodeId)) {
        return false;
      }
      focusedId = nodeId;
      recompute();
      return true;
    },
    focusAdjacent(direction) {
      const focused = children.find((child) => child.focused);
      if (!focused) {
        return false;
      }
      const nextId = getFocusCandidate(focused, children, direction);
      return nextId ? this.focus(nextId) : false;
    },
    split(nodeId, direction, pane) {
      const found = findPane(root, nodeId);
      if (!found || !canSplitRect(found.node.rect, direction)) {
        return false;
      }
      root = insertSplit(root, found, direction, pane);
      focusedId = pane.id;
      recompute();
      return true;
    },
    movePane(nodeId, anchorNodeId, direction) {
      if (nodeId === anchorNodeId || children.length <= 1) {
        return false;
      }
      const moving = findPane(root, nodeId);
      const anchor = findPane(root, anchorNodeId);
      if (!moving || !anchor) {
        return false;
      }
      const previousRoot = cloneTree(root);
      const previousFocusedId = focusedId;
      const movingPane = { ...moving.node.pane };
      const removed = removePane(root, nodeId);
      if (!removed.removed || !removed.node) {
        root = previousRoot;
        focusedId = previousFocusedId;
        recompute();
        return false;
      }
      root = removed.node;
      recompute();
      const nextAnchor = findPane(root, anchorNodeId);
      if (!nextAnchor || !canSplitRect(nextAnchor.node.rect, direction)) {
        root = previousRoot;
        focusedId = previousFocusedId;
        recompute();
        return false;
      }
      root = insertSplit(root, nextAnchor, direction, movingPane);
      focusedId = movingPane.id;
      recompute();
      return true;
    },
    close(nodeId) {
      if (children.length <= 1) {
        return false;
      }
      const result = removePane(root, nodeId);
      if (!result.removed || !result.node) {
        return false;
      }
      root = result.node;
      if (focusedId === nodeId) {
        focusedId = firstPaneId(root);
      }
      recompute();
      return true;
    },
    resizePane(nodeId, edge, delta) {
      const found = findPane(root, nodeId);
      if (!found || delta === 0) {
        return false;
      }
      const pair = findResizablePair(found.path, edge);
      if (!pair) {
        return false;
      }
      const axis = pair.split.axis;
      const current = pair.split.children[pair.index];
      const neighbor = pair.split.children[pair.neighborIndex];
      const currentSize = paneSizeOnAxis(current.node.rect, axis);
      const neighborSize = paneSizeOnAxis(neighbor.node.rect, axis);
      const maxGrow = Math.max(0, neighborSize - PANE_MINIMUM_CELLS);
      const maxShrink = Math.max(0, currentSize - PANE_MINIMUM_CELLS);
      const change = Math.max(-maxShrink, Math.min(maxGrow, Math.trunc(delta)));
      if (change === 0) {
        return false;
      }
      current.weight = currentSize + change;
      neighbor.weight = neighborSize - change;
      recompute();
      return true;
    },
    hitTest(x, y) {
      return children.find((child) => containsPoint(child.rect, x, y)) ?? null;
    },
  };
};

export const createFourPaneLayout = (rect: LayoutRect): RootLayout =>
  createRootLayout(rect, [
    { id: "pane-a", sourceKind: "opentui-renderable" },
    { id: "pane-b", sourceKind: "opentui-renderable" },
    { id: "pane-c", sourceKind: "opentui-renderable" },
    { id: "pane-d", sourceKind: "opentui-renderable" },
  ]);
