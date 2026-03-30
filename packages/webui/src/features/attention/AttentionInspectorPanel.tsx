import type { AttentionQueryItem, RuntimeAttentionState } from "@agenter/client-sdk";
import { FileCode2, GitCommitHorizontal, GitMerge, Link2, Orbit, Search, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { MarkdownDocument } from "../../components/markdown/MarkdownDocument";
import { AsyncSurface, resolveAsyncSurfaceState } from "../../components/ui/async-surface";
import { HelpHint } from "../../components/ui/help-hint";
import { JSONViewer } from "../../components/ui/json-viewer";
import { ScrollViewport } from "../../components/ui/overflow-surface";
import { Tabs } from "../../components/ui/tabs";
import { cn } from "../../lib/utils";
import {
  buildAttentionScoreQuery,
  diagnoseAttentionQuery,
  parseAttentionQuery,
  queryAttentionLocally,
} from "./attention-query";
import {
  buildAttentionContextSnapshot,
  buildAttentionScoreSummary,
  compareAttentionItemsByRecency,
  deriveAttentionSelection,
  EMPTY_RUNTIME_ATTENTION_STATE,
  selectDefaultItemId,
  sortAttentionContexts,
  type AttentionCommitView,
  type AttentionPanelTab,
  type AttentionSelectionState,
} from "./attention-view-model";

interface AttentionInspectorPanelProps {
  attention?: RuntimeAttentionState;
  loading: boolean;
  className?: string;
  sessionId?: string;
  queryAttention?: (input: {
    sessionId: string;
    query: string;
    offset?: number;
    limit?: number;
  }) => Promise<AttentionQueryItem[]>;
  selectedContextId?: string | null;
  selectedItemId?: string | null;
  detailView?: AttentionPanelTab;
  onDetailViewChange?: (view: AttentionPanelTab) => void;
  queryText?: string;
  onQueryTextChange?: (query: string) => void;
  onSelectionChange?: (selection: AttentionSelectionState) => void;
}

interface QueryListItem {
  contextId: string;
  commit: AttentionCommitView;
}

interface RelatedCommitView {
  contextId: string;
  commit: AttentionCommitView;
  reason: string;
}

const badgeClassName =
  "inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600";
const surfaceClassName = "rounded-xl border border-slate-200 bg-white";
const detailTabs = [
  { id: "context", label: "Context" },
  { id: "items", label: "Items" },
] satisfies Array<{ id: AttentionPanelTab; label: string }>;

const formatAttentionTimestamp = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return new Date(parsed).toISOString().replace("T", " ").replace(".000Z", "Z");
};

const buildQueryListItems = (items: QueryListItem[]): QueryListItem[] => {
  return [...items].sort((left, right) => compareAttentionItemsByRecency(left.commit, right.commit));
};

const readChangeRawText = (commit: AttentionCommitView): string | undefined => {
  if (!("value" in commit.change)) {
    return undefined;
  }
  return typeof commit.change.value === "string" ? commit.change.value : undefined;
};

const readChangePreviewText = (commit: AttentionCommitView): string => {
  if (!("value" in commit.change)) {
    return commit.commitId;
  }
  return JSON.stringify(commit.change.value);
};

const renderScoreButtons = (input: {
  scores: Record<string, number>;
  emptyLabel: string;
  onSelectHash: (hash: string) => void;
}) => {
  const summary = buildAttentionScoreSummary(input.scores);
  if (!summary || summary.entries.length === 0) {
    return <p className="text-sm text-slate-500">{input.emptyLabel}</p>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {summary.entries.map((entry) => (
        <button
          key={entry.key}
          type="button"
          onClick={() => input.onSelectHash(entry.key)}
          className={cn(
            badgeClassName,
            "cursor-pointer transition-colors hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800",
            entry.resolved
              ? "border-slate-200 bg-slate-100 text-slate-500"
              : "border-emerald-200 bg-emerald-50 text-emerald-700",
          )}
          title={`score:${entry.key}`}
        >
          <span className="font-medium">{entry.key}</span>
          <span>{entry.score}</span>
        </button>
      ))}
    </div>
  );
};

export const AttentionInspectorPanel = ({
  attention = EMPTY_RUNTIME_ATTENTION_STATE,
  loading,
  className,
  sessionId,
  queryAttention,
  selectedContextId,
  selectedItemId,
  detailView,
  onDetailViewChange,
  queryText: controlledQueryText,
  onQueryTextChange,
  onSelectionChange,
}: AttentionInspectorPanelProps) => {
  const contexts = useMemo(() => sortAttentionContexts(attention), [attention]);
  const asyncState = resolveAsyncSurfaceState({ loading, hasData: contexts.length > 0 });

  const [uncontrolledSelection, setUncontrolledSelection] = useState<AttentionSelectionState>(() =>
    deriveAttentionSelection(attention, {
      contextId: selectedContextId ?? contexts[0]?.contextId ?? null,
      itemId: selectedItemId ?? selectDefaultItemId(contexts[0], attention),
    }),
  );
  const [uncontrolledDetailView, setUncontrolledDetailView] = useState<AttentionPanelTab>("context");
  const [uncontrolledQueryText, setUncontrolledQueryText] = useState("");
  const [queryItems, setQueryItems] = useState<QueryListItem[]>([]);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);

  const controlledSelection =
    selectedContextId !== undefined || selectedItemId !== undefined
      ? {
          contextId: selectedContextId ?? null,
          itemId: selectedItemId ?? null,
        }
      : undefined;
  const selectionSource = controlledSelection ?? uncontrolledSelection;
  const selection = useMemo(() => deriveAttentionSelection(attention, selectionSource), [attention, selectionSource]);
  const activeTab = detailView ?? uncontrolledDetailView;
  const queryText = controlledQueryText ?? uncontrolledQueryText;

  useEffect(() => {
    if (controlledSelection) {
      return;
    }
    setUncontrolledSelection((current) =>
      current.contextId === selection.contextId && current.itemId === selection.itemId ? current : selection,
    );
  }, [controlledSelection, selection]);

  const setActiveTab = (next: AttentionPanelTab) => {
    if (next === activeTab) {
      return;
    }
    if (detailView === undefined) {
      setUncontrolledDetailView(next);
    }
    onDetailViewChange?.(next);
  };

  const setQueryText = (next: string) => {
    if (controlledQueryText === undefined) {
      setUncontrolledQueryText(next);
    }
    onQueryTextChange?.(next);
  };

  const applySelection = (next: AttentionSelectionState) => {
    if (controlledSelection === undefined) {
      setUncontrolledSelection(next);
    }
    onSelectionChange?.(next);
  };

  const selectedContext = useMemo(
    () => contexts.find((context) => context.contextId === selection.contextId) ?? contexts[0],
    [contexts, selection.contextId],
  );
  const selectedCommit = useMemo(
    () => selectedContext?.commits.find((commit) => commit.commitId === selection.itemId) ?? undefined,
    [selectedContext, selection.itemId],
  );
  const contextSnapshot = useMemo(
    () => buildAttentionContextSnapshot(attention, selectedContext?.contextId ?? null),
    [attention, selectedContext?.contextId],
  );
  const contextScoreMap = contextSnapshot?.context.scoreMap ?? {};

  const defaultContextItems = useMemo<QueryListItem[]>(() => {
    const contextId = selectedContext?.contextId;
    if (!contextId) {
      return [];
    }
    return buildQueryListItems((selectedContext?.commits ?? []).map((commit) => ({ contextId, commit })));
  }, [selectedContext]);

  useEffect(() => {
    const normalizedQuery = queryText.trim();
    if (normalizedQuery.length === 0) {
      setQueryItems([]);
      setQueryLoading(false);
      setQueryError(null);
      return;
    }

    const diagnostics = diagnoseAttentionQuery(normalizedQuery);
    if (diagnostics.length > 0) {
      setQueryItems([]);
      setQueryLoading(false);
      setQueryError(diagnostics[0]!.message);
      return;
    }
    const parsed = parseAttentionQuery(normalizedQuery);
    setQueryLoading(true);
    setQueryError(null);

    const timeoutId = window.setTimeout(() => {
      const runner =
        queryAttention && sessionId
          ? queryAttention({
              sessionId,
              query: normalizedQuery,
              limit: 120,
            })
          : Promise.resolve(queryAttentionLocally(attention, parsed, 120));

      void runner
        .then((items) => {
          setQueryItems(
            buildQueryListItems(items.map((entry) => ({ contextId: entry.contextId, commit: entry.commit }))),
          );
          setQueryLoading(false);
        })
        .catch((error: unknown) => {
          setQueryItems([]);
          setQueryError(error instanceof Error ? error.message : String(error));
          setQueryLoading(false);
        });
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [attention, queryAttention, queryText, sessionId]);

  const isQueryMode = queryText.trim().length > 0;
  const visibleItems = isQueryMode ? queryItems : defaultContextItems;

  useEffect(() => {
    if (visibleItems.length === 0) {
      return;
    }
    const stillVisible = visibleItems.some(
      (entry) => entry.contextId === selection.contextId && entry.commit.commitId === selection.itemId,
    );
    if (stillVisible) {
      return;
    }
    const first = visibleItems[0]!;
    applySelection({ contextId: first.contextId, itemId: first.commit.commitId });
  }, [selection.contextId, selection.itemId, visibleItems]);

  const selectedQueryEntry = useMemo<QueryListItem | null>(() => {
    if (!isQueryMode) {
      return null;
    }
    return (
      queryItems.find(
        (entry) => entry.contextId === selection.contextId && entry.commit.commitId === selection.itemId,
      ) ?? null
    );
  }, [isQueryMode, queryItems, selection.contextId, selection.itemId]);

  const detailContext = isQueryMode
    ? (contexts.find((context) => context.contextId === selectedQueryEntry?.contextId) ?? undefined)
    : selectedContext;
  const detailCommit = isQueryMode ? selectedQueryEntry?.commit : selectedCommit;
  const selectedCommitScoreSummary = useMemo(
    () => (detailCommit ? buildAttentionScoreSummary(detailCommit.scores) : null),
    [detailCommit],
  );

  const relatedItems = useMemo<RelatedCommitView[]>(() => {
    if (!detailCommit) {
      return [];
    }
    const scoreKeys = new Set(Object.keys(detailCommit.scores));
    const parentIds = new Set(detailCommit.parentCommitIds);
    const next: RelatedCommitView[] = [];

    for (const context of contexts) {
      for (const commit of context.commits) {
        if (commit.commitId === detailCommit.commitId && context.contextId === detailContext?.contextId) {
          continue;
        }
        if (parentIds.has(commit.commitId)) {
          next.push({ contextId: context.contextId, commit, reason: "parent" });
          continue;
        }
        if (commit.parentCommitIds.includes(detailCommit.commitId)) {
          next.push({ contextId: context.contextId, commit, reason: "child" });
          continue;
        }
        if (Object.keys(commit.scores).some((key) => scoreKeys.has(key))) {
          next.push({ contextId: context.contextId, commit, reason: "shared score" });
        }
      }
    }

    return buildQueryListItems(next.map((entry) => ({ contextId: entry.contextId, commit: entry.commit }))).map(
      (entry) =>
        next.find(
          (candidate) => candidate.contextId === entry.contextId && candidate.commit.commitId === entry.commit.commitId,
        )!,
    );
  }, [contexts, detailCommit, detailContext?.contextId]);

  const openHashQuery = (hash: string) => {
    setActiveTab("items");
    setQueryText(
      buildAttentionScoreQuery({
        contextId: detailContext?.contextId ?? selectedContext?.contextId ?? null,
        hash,
        depth: 2,
      }),
    );
  };

  return (
    <section
      className={cn("grid h-full grid-rows-[auto_auto_minmax(0,1fr)] rounded-xl bg-white p-3 shadow-xs", className)}
    >
      <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="typo-title-3 text-slate-900">Attention</h2>
            <HelpHint
              helpId="attention-panel:overview"
              textContext="Context is the notebook. Items are the immutable commit log that drives the notebook toward score zero."
              content="Context is the notebook. Items are the immutable commit log that drives the notebook toward score zero."
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className={badgeClassName}>
            <Orbit className="h-3.5 w-3.5" />
            {contexts.length} contexts
          </span>
          <span className={badgeClassName}>
            <Sparkles className="h-3.5 w-3.5" />
            {attention.active.length} active
          </span>
          <span className={badgeClassName}>{attention.cycleFrames.length} frames</span>
          <span className={badgeClassName}>{attention.hooks.length} hooks</span>
        </div>
      </header>

      <section className="mb-3 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
        <label
          className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-600"
          htmlFor="attention-query-input"
        >
          <Search className="h-3.5 w-3.5" />
          Search attention
        </label>
        <input
          id="attention-query-input"
          data-testid="attention-query-input"
          value={queryText}
          onChange={(event) => setQueryText(event.target.value)}
          placeholder="context:ctx-chat-kzf score:abc123 deep:2"
          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700 transition-colors outline-none placeholder:text-slate-400 focus:border-sky-300"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
          <span>
            {isQueryMode
              ? queryLoading
                ? "Querying related commits..."
                : `${queryItems.length} matches`
              : "Leave empty to browse contexts and their current notebook state."}
          </span>
          {isQueryMode ? (
            <button
              type="button"
              onClick={() => setQueryText("")}
              className="font-medium text-sky-700 hover:text-sky-800"
            >
              Clear query
            </button>
          ) : null}
        </div>
        {queryError ? <p className="mt-2 text-[11px] text-rose-600">{queryError}</p> : null}
      </section>

      <AsyncSurface
        state={asyncState}
        skeleton={<div className="h-full rounded-xl border border-dashed border-slate-200 bg-slate-50/60" />}
        empty={
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 text-sm text-slate-500">
            No contexts yet.
          </div>
        }
        emptyLoadingLabel="Loading contexts..."
        loadingOverlayLabel="Refreshing context state..."
        className="min-h-0"
      >
        {isQueryMode ? (
          <div className="grid h-full gap-3 xl:grid-cols-[20rem_minmax(0,1fr)]">
            <ScrollViewport
              className="rounded-xl border border-slate-200 bg-white p-2"
              data-testid="attention-item-scroll-viewport"
            >
              <div className="space-y-1.5">
                {queryItems.map((entry) => {
                  const contextActive = Object.values(
                    contexts.find((context) => context.contextId === entry.contextId)?.scoreMap ?? {},
                  ).some((score) => score > 0);
                  const isSelected =
                    entry.contextId === detailContext?.contextId && entry.commit.commitId === detailCommit?.commitId;
                  const scoreSummary = buildAttentionScoreSummary(entry.commit.scores);
                  return (
                    <button
                      key={`${entry.contextId}:${entry.commit.commitId}`}
                      type="button"
                      onClick={() => {
                        applySelection({
                          contextId: entry.contextId,
                          itemId: entry.commit.commitId,
                        });
                      }}
                      className={cn(
                        "w-full rounded-xl border px-2.5 py-2 text-left transition-colors",
                        isSelected
                          ? "border-slate-900 bg-slate-950 text-white"
                          : "border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-300 hover:bg-white",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{entry.commit.summary}</div>
                          <div className="mt-1 text-[11px] opacity-80">
                            {entry.contextId} · {entry.commit.meta.author} · {entry.commit.meta.source}
                          </div>
                        </div>
                        <span className="text-[11px] opacity-70">{contextActive ? "active" : "resolved"}</span>
                      </div>
                      <div className="mt-1 text-[11px] opacity-80">{scoreSummary?.text ?? "No score summary"}</div>
                      <div className="mt-1 line-clamp-2 text-[11px] opacity-70">
                        {readChangePreviewText(entry.commit)}
                      </div>
                    </button>
                  );
                })}
                {queryItems.length === 0 && !queryLoading ? (
                  <p className="px-2 py-4 text-sm text-slate-500">No commits match the current query.</p>
                ) : null}
              </div>
            </ScrollViewport>

            <ScrollViewport
              className="rounded-xl border border-slate-200 bg-white p-3"
              data-testid="attention-detail-scroll-viewport"
            >
              {detailContext && detailCommit ? (
                <div className="space-y-4">
                  <section className={cn(surfaceClassName, "space-y-3 bg-slate-50/60 p-3")}>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                      <span className={badgeClassName}>{detailContext.contextId}</span>
                      <span className={badgeClassName}>{detailCommit.commitId}</span>
                      <span className={badgeClassName}>{detailCommit.meta.author}</span>
                      <span className={badgeClassName}>{detailCommit.meta.source}</span>
                      {formatAttentionTimestamp(detailCommit.createdAt) ? (
                        <span className={badgeClassName}>{formatAttentionTimestamp(detailCommit.createdAt)}</span>
                      ) : null}
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
                        Commit summary
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <h3 className="text-base font-semibold text-slate-950">{detailCommit.summary}</h3>
                        <HelpHint
                          helpId="attention-panel:commit-summary"
                          textContext="Each item is one immutable attention commit: metadata, scores, summary, and a context mutation."
                          content="Each item is one immutable attention commit: metadata, scores, summary, and a context mutation."
                        />
                      </div>
                    </div>
                  </section>

                  <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.9fr)]">
                    <section className={cn(surfaceClassName, "space-y-3 p-3")}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">Change</h4>
                          <HelpHint
                            helpId="attention-panel:change"
                            textContext="This payload is the concrete mutation applied to the notebook state."
                            content="This payload is the concrete mutation applied to the notebook state."
                          />
                        </div>
                        <span className="text-[11px] text-slate-500">{detailCommit.change.type}</span>
                      </div>
                      <JSONViewer value={detailCommit.change} rawText={readChangeRawText(detailCommit)} />
                    </section>

                    <div className="space-y-3">
                      <section className={cn(surfaceClassName, "space-y-3 p-3")}>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">Scores</h4>
                          <HelpHint
                            helpId="attention-panel:scores"
                            textContext="Scores are the lookup edges that connect this commit to related work."
                            content="Scores are the lookup edges that connect this commit to related work."
                          />
                        </div>
                        {renderScoreButtons({
                          scores: detailCommit.scores,
                          emptyLabel: "No scores are attached to this commit.",
                          onSelectHash: openHashQuery,
                        })}
                        {selectedCommitScoreSummary?.text ? (
                          <p className="text-[11px] text-slate-500">{selectedCommitScoreSummary.text}</p>
                        ) : null}
                        <JSONViewer value={detailCommit.scores} />
                      </section>

                      <section className={cn(surfaceClassName, "space-y-3 p-3")}>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">Metadata</h4>
                          <HelpHint
                            helpId="attention-panel:metadata"
                            textContext="Metadata explains who emitted the commit and where the mutation belongs."
                            content="Metadata explains who emitted the commit and where the mutation belongs."
                          />
                        </div>
                        <JSONViewer value={detailCommit.meta} />
                      </section>

                      <section className={cn(surfaceClassName, "space-y-3 p-3")}>
                        <h4 className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">
                          Graph links
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          <span className={badgeClassName}>
                            <GitCommitHorizontal className="h-3.5 w-3.5" />
                            {detailCommit.parentCommitIds.length} parents
                          </span>
                          <span className={badgeClassName}>
                            <GitMerge className="h-3.5 w-3.5" />
                            {relatedItems.length} related
                          </span>
                        </div>
                        {relatedItems.length > 0 ? (
                          <div className="space-y-1.5">
                            {relatedItems.map((entry) => (
                              <button
                                key={`${entry.contextId}:${entry.commit.commitId}:${entry.reason}`}
                                type="button"
                                onClick={() => {
                                  applySelection({
                                    contextId: entry.contextId,
                                    itemId: entry.commit.commitId,
                                  });
                                }}
                                className="flex w-full items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-left hover:border-slate-300 hover:bg-white"
                              >
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-medium text-slate-900">
                                    {entry.commit.summary}
                                  </div>
                                  <div className="mt-0.5 text-[11px] text-slate-500">{entry.contextId}</div>
                                </div>
                                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                                  <Link2 className="h-3.5 w-3.5" />
                                  {entry.reason}
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500">No related commits are linked to this selection yet.</p>
                        )}
                      </section>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  {queryLoading ? "Querying related commits..." : "Select a search result to inspect its detail."}
                </div>
              )}
            </ScrollViewport>
          </div>
        ) : (
          <div className="grid h-full gap-3 lg:grid-cols-[14rem_minmax(0,1fr)]">
            <ScrollViewport
              className="rounded-xl border border-slate-200 bg-slate-50/70 p-2"
              data-testid="attention-context-scroll-viewport"
            >
              <div className="space-y-1.5">
                {contexts.map((context) => {
                  const isSelected = context.contextId === selectedContext?.contextId;
                  const snapshot = buildAttentionContextSnapshot(attention, context.contextId);
                  const activeCount = snapshot?.activeCount ?? 0;
                  return (
                    <button
                      key={context.contextId}
                      type="button"
                      onClick={() => {
                        applySelection({
                          contextId: context.contextId,
                          itemId: selectDefaultItemId(context, attention),
                        });
                        setActiveTab("context");
                      }}
                      className={cn(
                        "w-full rounded-xl border px-2.5 py-2 text-left transition-colors",
                        isSelected
                          ? "border-sky-300 bg-sky-50 text-sky-950"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">{context.contextId}</span>
                        <span className="text-[11px] text-slate-500">{activeCount}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">owner: {context.owner}</div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        {snapshot?.scoreSummary?.text ?? "No active scores"}
                      </div>
                      <div className="mt-1 line-clamp-2 text-[11px] text-slate-500">
                        {snapshot?.headCommit?.summary ??
                          `${snapshot?.commitCount ?? context.commitCount ?? context.commits.length} commits`}
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollViewport>

            <div className="grid grid-rows-[auto_minmax(0,1fr)] gap-3">
              {selectedContext ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
                  <Tabs
                    items={detailTabs}
                    value={activeTab}
                    onValueChange={(value) => setActiveTab(value === "items" ? "items" : "context")}
                    ariaLabel="Attention detail tabs"
                    trailing={
                      <span className={badgeClassName} data-testid="attention-current-context-pill">
                        <FileCode2 className="h-3.5 w-3.5" />
                        {selectedContext.contextId}
                      </span>
                    }
                  />
                </div>
              ) : null}

              {activeTab === "context" ? (
                <ScrollViewport
                  className="rounded-xl border border-slate-200 bg-white p-3"
                  data-testid="attention-context-detail-scroll-viewport"
                >
                  {contextSnapshot ? (
                    <div className="space-y-4">
                      <section className={cn(surfaceClassName, "space-y-3 bg-slate-50/60 p-3")}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
                              Context state
                            </div>
                            <div className="mt-1 flex items-center gap-2">
                              <h3 className="text-base font-semibold text-slate-950">
                                {contextSnapshot.context.contextId}
                              </h3>
                              <HelpHint
                                helpId="attention-panel:context-state"
                                textContext="One attention context is one notebook. The head commit is the latest mutation; the notebook body is the current merged state."
                                content="One attention context is one notebook. The head commit is the latest mutation; the notebook body is the current merged state."
                              />
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <span className={badgeClassName}>{contextSnapshot.context.owner}</span>
                            <span className={badgeClassName}>{contextSnapshot.activeCount} active</span>
                            <span className={badgeClassName}>{contextSnapshot.commitCount} commits</span>
                            {contextSnapshot.commitsTruncated ? (
                              <span className={badgeClassName}>
                                showing recent {contextSnapshot.context.commits.length}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
                            Context body
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-slate-900">
                              {contextSnapshot.headCommit?.summary ?? "No head commit yet"}
                            </h4>
                            <p className="mt-1 text-xs text-slate-500">
                              Head commit: {contextSnapshot.headCommit?.commitId ?? "none"}
                              {contextSnapshot.context.contentFormat
                                ? ` · ${contextSnapshot.context.contentFormat}`
                                : ""}
                            </p>
                          </div>
                          <div data-testid="attention-context-markdown-card">
                            <MarkdownDocument
                              value={
                                contextSnapshot.context.content?.trim().length
                                  ? contextSnapshot.context.content
                                  : "_No context content yet._"
                              }
                              mode="preview"
                              usage="inspector"
                              surface="panel"
                              syntaxTone="accented"
                            />
                          </div>
                        </div>
                      </section>

                      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.9fr)]">
                        <section className={cn(surfaceClassName, "space-y-3 p-3")}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">
                                Metadata
                              </h4>
                              <HelpHint
                                helpId="attention-panel:metadata"
                                textContext="Metadata explains who owns the notebook and when it last changed."
                                content="Metadata explains who owns the notebook and when it last changed."
                              />
                            </div>
                          </div>
                          <JSONViewer
                            value={{
                              contextId: contextSnapshot.context.contextId,
                              owner: contextSnapshot.context.owner,
                              headCommitId: contextSnapshot.context.headCommitId,
                              createdAt: formatAttentionTimestamp(contextSnapshot.context.createdAt),
                              updatedAt: formatAttentionTimestamp(contextSnapshot.context.updatedAt),
                              activeCount: contextSnapshot.activeCount,
                              commitCount: contextSnapshot.commitCount,
                              commitsLoaded: contextSnapshot.context.commits.length,
                              commitsTruncated: contextSnapshot.commitsTruncated,
                            }}
                          />
                        </section>

                        <section className={cn(surfaceClassName, "space-y-3 p-3")}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">
                                Scores
                              </h4>
                              <HelpHint
                                helpId="attention-panel:context-scores"
                                textContext="Scores are the cross-context lookup graph. Click a hash to traverse related commits."
                                content="Scores are the cross-context lookup graph. Click a hash to traverse related commits."
                              />
                            </div>
                            {contextSnapshot.scoreSummary?.text ? (
                              <span className="text-[11px] text-slate-500">{contextSnapshot.scoreSummary.text}</span>
                            ) : null}
                          </div>
                          {renderScoreButtons({
                            scores: contextScoreMap,
                            emptyLabel: "No scores are attached to this context.",
                            onSelectHash: openHashQuery,
                          })}
                        </section>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500">
                      Select a context to inspect its current state.
                    </div>
                  )}
                </ScrollViewport>
              ) : (
                <div className="grid h-full gap-3 xl:grid-cols-[20rem_minmax(0,1fr)]">
                  <ScrollViewport
                    className="rounded-xl border border-slate-200 bg-white p-2"
                    data-testid="attention-item-scroll-viewport"
                  >
                    <div className="space-y-1.5">
                      {defaultContextItems.map((entry) => {
                        const contextActive = Object.values(
                          contexts.find((context) => context.contextId === entry.contextId)?.scoreMap ?? {},
                        ).some((score) => score > 0);
                        const isSelected =
                          entry.contextId === selectedContext?.contextId &&
                          entry.commit.commitId === selectedCommit?.commitId;
                        const scoreSummary = buildAttentionScoreSummary(entry.commit.scores);
                        return (
                          <button
                            key={`${entry.contextId}:${entry.commit.commitId}`}
                            type="button"
                            onClick={() => {
                              applySelection({
                                contextId: entry.contextId,
                                itemId: entry.commit.commitId,
                              });
                            }}
                            className={cn(
                              "w-full rounded-xl border px-2.5 py-2 text-left transition-colors",
                              isSelected
                                ? "border-slate-900 bg-slate-950 text-white"
                                : "border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-300 hover:bg-white",
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium">{entry.commit.summary}</div>
                                <div className="mt-1 text-[11px] opacity-80">
                                  {entry.contextId} · {entry.commit.meta.author} · {entry.commit.meta.source}
                                </div>
                              </div>
                              <span className="text-[11px] opacity-70">{contextActive ? "active" : "resolved"}</span>
                            </div>
                            <div className="mt-1 text-[11px] opacity-80">
                              {scoreSummary?.text ?? "No score summary"}
                            </div>
                            <div className="mt-1 line-clamp-2 text-[11px] opacity-70">
                              {readChangePreviewText(entry.commit)}
                            </div>
                          </button>
                        );
                      })}
                      {defaultContextItems.length === 0 ? (
                        <p className="px-2 py-4 text-sm text-slate-500">No commits are loaded for this context yet.</p>
                      ) : null}
                    </div>
                  </ScrollViewport>

                  <ScrollViewport
                    className="rounded-xl border border-slate-200 bg-white p-3"
                    data-testid="attention-detail-scroll-viewport"
                  >
                    {selectedContext && selectedCommit ? (
                      <div className="space-y-4">
                        <section className={cn(surfaceClassName, "space-y-3 bg-slate-50/60 p-3")}>
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                            <span className={badgeClassName}>{selectedContext.contextId}</span>
                            <span className={badgeClassName}>{selectedCommit.commitId}</span>
                            <span className={badgeClassName}>{selectedCommit.meta.author}</span>
                            <span className={badgeClassName}>{selectedCommit.meta.source}</span>
                            {formatAttentionTimestamp(selectedCommit.createdAt) ? (
                              <span className={badgeClassName}>
                                {formatAttentionTimestamp(selectedCommit.createdAt)}
                              </span>
                            ) : null}
                          </div>
                          <div>
                            <div className="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
                              Commit summary
                            </div>
                            <div className="mt-1 flex items-center gap-2">
                              <h3 className="text-base font-semibold text-slate-950">{selectedCommit.summary}</h3>
                              <HelpHint
                                helpId="attention-panel:commit-summary"
                                textContext="Each item is one immutable attention commit: metadata, scores, summary, and a context mutation."
                                content="Each item is one immutable attention commit: metadata, scores, summary, and a context mutation."
                              />
                            </div>
                          </div>
                        </section>

                        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.9fr)]">
                          <section className={cn(surfaceClassName, "space-y-3 p-3")}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">
                                  Change
                                </h4>
                                <HelpHint
                                  helpId="attention-panel:change"
                                  textContext="This payload is the concrete mutation applied to the notebook state."
                                  content="This payload is the concrete mutation applied to the notebook state."
                                />
                              </div>
                              <span className="text-[11px] text-slate-500">{selectedCommit.change.type}</span>
                            </div>
                            <JSONViewer value={selectedCommit.change} rawText={readChangeRawText(selectedCommit)} />
                          </section>

                          <div className="space-y-3">
                            <section className={cn(surfaceClassName, "space-y-3 p-3")}>
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">
                                  Scores
                                </h4>
                                <HelpHint
                                  helpId="attention-panel:scores"
                                  textContext="Scores are the lookup edges that connect this commit to related work."
                                  content="Scores are the lookup edges that connect this commit to related work."
                                />
                              </div>
                              {renderScoreButtons({
                                scores: selectedCommit.scores,
                                emptyLabel: "No scores are attached to this commit.",
                                onSelectHash: openHashQuery,
                              })}
                              {selectedCommitScoreSummary?.text ? (
                                <p className="text-[11px] text-slate-500">{selectedCommitScoreSummary.text}</p>
                              ) : null}
                              <JSONViewer value={selectedCommit.scores} />
                            </section>

                            <section className={cn(surfaceClassName, "space-y-3 p-3")}>
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">
                                  Metadata
                                </h4>
                                <HelpHint
                                  helpId="attention-panel:metadata"
                                  textContext="Metadata explains who emitted the commit and where the mutation belongs."
                                  content="Metadata explains who emitted the commit and where the mutation belongs."
                                />
                              </div>
                              <JSONViewer value={selectedCommit.meta} />
                            </section>

                            <section className={cn(surfaceClassName, "space-y-3 p-3")}>
                              <h4 className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">
                                Graph links
                              </h4>
                              <div className="flex flex-wrap gap-1.5">
                                <span className={badgeClassName}>
                                  <GitCommitHorizontal className="h-3.5 w-3.5" />
                                  {selectedCommit.parentCommitIds.length} parents
                                </span>
                                <span className={badgeClassName}>
                                  <GitMerge className="h-3.5 w-3.5" />
                                  {relatedItems.length} related
                                </span>
                              </div>
                              {relatedItems.length > 0 ? (
                                <div className="space-y-1.5">
                                  {relatedItems.map((entry) => (
                                    <button
                                      key={`${entry.contextId}:${entry.commit.commitId}:${entry.reason}`}
                                      type="button"
                                      onClick={() => {
                                        applySelection({
                                          contextId: entry.contextId,
                                          itemId: entry.commit.commitId,
                                        });
                                      }}
                                      className="flex w-full items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-left hover:border-slate-300 hover:bg-white"
                                    >
                                      <div className="min-w-0">
                                        <div className="truncate text-sm font-medium text-slate-900">
                                          {entry.commit.summary}
                                        </div>
                                        <div className="mt-0.5 text-[11px] text-slate-500">{entry.contextId}</div>
                                      </div>
                                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                                        <Link2 className="h-3.5 w-3.5" />
                                        {entry.reason}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-slate-500">
                                  No related commits are linked to this selection yet.
                                </p>
                              )}
                            </section>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-slate-500">
                        Select a commit to inspect its detail.
                      </div>
                    )}
                  </ScrollViewport>
                </div>
              )}
            </div>
          </div>
        )}
      </AsyncSurface>
    </section>
  );
};
