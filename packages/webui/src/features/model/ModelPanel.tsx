import type { ModelDebugOutput } from "@agenter/client-sdk";
import { RefreshCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { MarkdownDocument, type MarkdownDocumentMode } from "../../components/markdown/MarkdownDocument";
import { AsyncSurface, resolveAsyncSurfaceState } from "../../components/ui/async-surface";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../components/ui/accordion";
import { Badge } from "../../components/ui/badge";
import { Button, ButtonLabel, ButtonLeadingVisual } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { ScrollViewport } from "../../components/ui/overflow-surface";
import { PasswordInput } from "../../components/ui/password-input";
import { Skeleton } from "../../components/ui/skeleton";
import { Tabs, type TabItem } from "../../components/ui/tabs";
import { ToolStructuredView } from "../chat/tool-structured-view";
import {
  buildHistoryMessages,
  buildHttpRecords,
  buildLatestCallView,
  buildLatestTools,
  formatTimestamp,
} from "./model-debug";

interface ModelPanelProps {
  debug: ModelDebugOutput | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

type ModelPanelTab = "overview" | "latest" | "history" | "transport";
type LatestPanelTab = "request" | "result" | "tools";
type HistoryPanelTab = "context" | "calls";

const TEXT_MODE_STORAGE_KEY = "agenter:webui:model-text-mode";
const MODEL_TAB_STORAGE_KEY = "agenter:webui:model-panel-tab";
const LATEST_TAB_STORAGE_KEY = "agenter:webui:model-panel-latest-tab";
const HISTORY_TAB_STORAGE_KEY = "agenter:webui:model-panel-history-tab";
const TEXT_MODE_TABS = [
  { id: "preview", label: "Preview" },
  { id: "raw", label: "Raw" },
] as const satisfies readonly TabItem[];
const MODEL_TABS = [
  { id: "overview", label: "Overview" },
  { id: "latest", label: "Latest" },
  { id: "history", label: "History" },
  { id: "transport", label: "HTTP" },
] as const satisfies readonly TabItem[];
const LATEST_TABS = [
  { id: "request", label: "Request" },
  { id: "result", label: "Result" },
  { id: "tools", label: "Tools" },
] as const satisfies readonly TabItem[];
const HISTORY_TABS = [
  { id: "context", label: "Context" },
  { id: "calls", label: "Calls" },
] as const satisfies readonly TabItem[];

const readTextMode = (): MarkdownDocumentMode => {
  if (typeof window === "undefined") {
    return "preview";
  }
  return window.localStorage.getItem(TEXT_MODE_STORAGE_KEY) === "raw" ? "raw" : "preview";
};

const readModelTab = (): ModelPanelTab => {
  if (typeof window === "undefined") {
    return "overview";
  }
  const raw = window.localStorage.getItem(MODEL_TAB_STORAGE_KEY);
  return raw === "latest" || raw === "history" || raw === "transport" ? raw : "overview";
};

const readLatestTab = (): LatestPanelTab => {
  if (typeof window === "undefined") {
    return "request";
  }
  return window.localStorage.getItem(LATEST_TAB_STORAGE_KEY) === "result"
    ? "result"
    : window.localStorage.getItem(LATEST_TAB_STORAGE_KEY) === "tools"
      ? "tools"
      : "request";
};

const readHistoryTab = (): HistoryPanelTab => {
  if (typeof window === "undefined") {
    return "context";
  }
  return window.localStorage.getItem(HISTORY_TAB_STORAGE_KEY) === "calls" ? "calls" : "context";
};

const configBadgeVariant = (apiStandard: string | undefined): "secondary" | "warning" | "success" => {
  if (apiStandard === "openai-chat" || apiStandard === "openai-completion" || apiStandard === "openai-responses") {
    return "secondary";
  }
  if (apiStandard === "anthropic") {
    return "warning";
  }
  if (apiStandard === "gemini") {
    return "success";
  }
  return "secondary";
};

const modelCallBadgeVariant = (status: "running" | "done" | "error" | undefined): "secondary" | "success" | "destructive" => {
  if (status === "running") {
    return "secondary";
  }
  if (status === "error") {
    return "destructive";
  }
  return "success";
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <label className="space-y-1">
    <span className="text-[11px] text-slate-500">{label}</span>
    <Input value={value} readOnly />
  </label>
);

const SectionTitle = ({ title, description, badge }: { title: string; description: string; badge?: string }) => (
  <div className="flex flex-wrap items-start justify-between gap-3">
    <div className="space-y-1">
      <CardTitle>{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </div>
    {badge ? <Badge variant="secondary">{badge}</Badge> : null}
  </div>
);

const InspectorMarkdown = ({
  label,
  value,
  mode,
  empty,
  minHeight = 96,
  maxHeight,
}: {
  label: string;
  value: string;
  mode: MarkdownDocumentMode;
  empty?: string;
  minHeight?: number;
  maxHeight?: number;
}) => (
  <div className="space-y-1.5">
    <span className="text-[11px] text-slate-500">{label}</span>
    <MarkdownDocument
      value={value || empty || "_No content recorded._"}
      mode={mode}
      usage="inspector"
      minHeight={minHeight}
      maxHeight={maxHeight}
    />
  </div>
);

const StructuredPane = ({ label, value }: { label: string; value: unknown }) => (
  <div className="space-y-1.5">
    <span className="text-[11px] text-slate-500">{label}</span>
    <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/80">
      <ToolStructuredView value={value} />
    </div>
  </div>
);

const EmptyCard = ({ message }: { message: string }) => (
  <div className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">{message}</div>
);

const LoadingShell = () => (
  <div className="space-y-3">
    <div className="grid gap-3 xl:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="mt-4 h-10 w-full" />
        <Skeleton className="mt-2 h-10 w-full" />
        <Skeleton className="mt-2 h-10 w-full" />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="mt-4 h-32 w-full" />
      </div>
    </div>
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <Skeleton className="h-4 w-1/4" />
      <Skeleton className="mt-4 h-48 w-full" />
    </div>
  </div>
);

export const ModelPanel = ({ debug, loading, error, onRefresh }: ModelPanelProps) => {
  const [textMode, setTextMode] = useState<MarkdownDocumentMode>(() => readTextMode());
  const [activeTab, setActiveTab] = useState<ModelPanelTab>(() => readModelTab());
  const [latestTab, setLatestTab] = useState<LatestPanelTab>(() => readLatestTab());
  const [historyTab, setHistoryTab] = useState<HistoryPanelTab>(() => readHistoryTab());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(TEXT_MODE_STORAGE_KEY, textMode);
  }, [textMode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(MODEL_TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(LATEST_TAB_STORAGE_KEY, latestTab);
  }, [latestTab]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(HISTORY_TAB_STORAGE_KEY, historyTab);
  }, [historyTab]);

  const latestModelCall = debug?.latestModelCall ?? null;
  const historyMessages = useMemo(() => (debug ? buildHistoryMessages(debug) : []), [debug]);
  const latestTools = useMemo(() => (debug ? buildLatestTools(debug) : []), [debug]);
  const latestCall = useMemo(() => (debug ? buildLatestCallView(debug) : null), [debug]);
  const httpRecords = useMemo(() => (debug ? buildHttpRecords(debug) : []), [debug]);
  const recentModelCalls = debug?.recentModelCalls ?? [];

  const textViewControl = (
    <div className="space-y-1">
      <span className="block text-[11px] text-slate-500">Text view</span>
      <Tabs
        items={TEXT_MODE_TABS as unknown as TabItem[]}
        value={textMode}
        onValueChange={(value) => setTextMode(value === "raw" ? "raw" : "preview")}
      />
    </div>
  );

  const overviewStats = {
    loops: debug?.stats?.loops ?? 0,
    apiCalls: debug?.stats?.apiCalls ?? 0,
    lastContextChars: debug?.stats?.lastContextChars ?? 0,
    totalContextChars: debug?.stats?.totalContextChars ?? 0,
    lastPromptTokens: debug?.stats?.lastPromptTokens ?? null,
    totalPromptTokens: debug?.stats?.totalPromptTokens ?? null,
  };

  return (
    <section className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="typo-title-3 text-slate-900">Model</h3>
            {latestModelCall ? (
              <Badge variant={modelCallBadgeVariant(latestModelCall.status)}>{latestModelCall.status}</Badge>
            ) : null}
            {debug?.config ? (
              <Badge variant={configBadgeVariant(debug.config.apiStandard)}>{debug.config.apiStandard}</Badge>
            ) : null}
            {debug?.config?.vendor ? <Badge variant="secondary">{debug.config.vendor}</Badge> : null}
            {debug?.config?.model ? <Badge variant="secondary">{debug.config.model}</Badge> : null}
          </div>
          <p className="text-[11px] text-slate-500">
            {latestModelCall
              ? latestModelCall.status === "running"
                ? `Latest call #${latestModelCall.id} is running since ${formatTimestamp(latestModelCall.createdAt)}`
                : `Latest call #${latestModelCall.id} ${latestModelCall.status} at ${formatTimestamp(latestModelCall.completedAt ?? latestModelCall.createdAt)}`
              : "Waiting for the first model call."}
          </p>
        </div>

        <Button size="sm" variant="secondary" onClick={onRefresh} disabled={loading}>
          <ButtonLeadingVisual>
            <RefreshCcw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
          </ButtonLeadingVisual>
          <ButtonLabel>{loading ? "Refreshing..." : "Refresh"}</ButtonLabel>
        </Button>
      </div>

      {error ? <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

      <AsyncSurface
        state={resolveAsyncSurfaceState({ loading, hasData: Boolean(debug) })}
        loadingOverlayLabel="Refreshing model..."
        skeleton={<LoadingShell />}
        empty={<EmptyCard message="Open a running session to inspect model state." />}
        className="flex-1"
      >
        {debug ? (
          <div className="flex h-full flex-col gap-3">
          <Tabs
            items={MODEL_TABS as unknown as TabItem[]}
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as ModelPanelTab)}
          />

          <ScrollViewport className="flex-1 pr-1">
            {activeTab === "overview" ? (
              <div className="space-y-3">
                <div className="grid gap-3 xl:grid-cols-2">
                  <Card>
                    <CardHeader className="pb-3">
                      <SectionTitle
                        title="Provider"
                        description="Resolved provider configuration used by the active session runtime."
                      />
                    </CardHeader>
                    <CardContent className="grid gap-3 pt-0 md:grid-cols-2">
                      <Field label="Provider ID" value={debug.config?.providerId ?? "-"} />
                      <Field label="API standard" value={debug.config?.apiStandard ?? "-"} />
                      <Field label="Vendor" value={debug.config?.vendor ?? "-"} />
                      <Field label="Profile" value={debug.config?.profile ?? "-"} />
                      <Field label="Model" value={debug.config?.model ?? "-"} />
                      <Field label="Base URL" value={debug.config?.baseUrl ?? "-"} />
                      <label className="space-y-1 md:col-span-2">
                        <span className="text-[11px] text-slate-500">API token</span>
                        <PasswordInput value={debug.config?.apiKey ?? ""} readOnly />
                      </label>
                      <Field label="API key env" value={debug.config?.apiKeyEnv ?? "-"} />
                      <Field label="Temperature" value={String(debug.config?.temperature ?? "-")} />
                      <Field label="Max retries" value={String(debug.config?.maxRetries ?? "-")} />
                      <Field label="Max token" value={String(debug.config?.maxToken ?? "-")} />
                      <Field label="Compact threshold" value={String(debug.config?.compactThreshold ?? "-")} />
                      <StructuredPane label="Headers" value={debug.config?.headers ?? {}} />
                      <StructuredPane label="Extensions" value={debug.config?.extensions ?? []} />
                      <StructuredPane label="Capabilities" value={debug.config?.capabilities ?? {}} />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <SectionTitle
                        title="Current context"
                        description="Runtime counters retained for the next provider turn."
                        badge={String(historyMessages.length)}
                      />
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      <StructuredPane label="Counters" value={overviewStats} />
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-3">
                    <SectionTitle
                      title="Latest summary"
                      description="Latest model envelope, useful for checking whether the runtime is pointing at the right provider and cycle."
                      badge={latestCall ? String(latestModelCall?.id ?? "") : undefined}
                    />
                  </CardHeader>
                  <CardContent className="pt-0">
                    {latestCall ? (
                      <StructuredPane label="Envelope" value={latestCall.summary} />
                    ) : (
                      <EmptyCard message="No model call has been recorded yet." />
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : null}

            {activeTab === "latest" ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <Tabs
                    items={LATEST_TABS as unknown as TabItem[]}
                    value={latestTab}
                    onValueChange={(value) => setLatestTab(value === "result" || value === "tools" ? value : "request")}
                  />
                  {textViewControl}
                </div>

                {!latestCall ? (
                  <EmptyCard message="No model call has been recorded yet." />
                ) : (
                  <>
                    {latestTab === "request" ? (
                      <Card>
                        <CardHeader className="pb-3">
                          <SectionTitle
                            title="Latest model request"
                            description="Latest request envelope, prompt text, and request messages."
                            badge={String(latestModelCall?.id ?? "")}
                          />
                        </CardHeader>
                        <CardContent className="space-y-3 pt-0">
                          <StructuredPane label="Envelope" value={latestCall.summary} />
                          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                            <InspectorMarkdown
                              label="System prompt"
                              value={latestCall.systemPrompt}
                              mode={textMode}
                              empty="_No system prompt recorded in this request._"
                              minHeight={180}
                              maxHeight={420}
                            />
                            <StructuredPane label="Request meta" value={latestCall.requestMeta} />
                          </div>
                          <div className="space-y-1.5">
                            <span className="text-[11px] text-slate-500">Request messages</span>
                            {latestCall.requestMessages.length === 0 ? (
                              <EmptyCard message="No request messages were recorded in the latest call." />
                            ) : (
                              <Accordion type="single" collapsible>
                                {latestCall.requestMessages.map((message) => (
                                  <AccordionItem key={message.key} value={message.key} className="border-slate-200">
                                    <AccordionTrigger className="py-2 hover:no-underline">
                                      <span className="flex min-w-0 flex-1 items-center gap-2">
                                        <span className="truncate text-xs font-medium text-slate-900">
                                          {message.title}
                                        </span>
                                        <Badge variant="secondary">{message.subtitle}</Badge>
                                      </span>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                      <div className="space-y-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/80">
                                        <StructuredPane label="Message meta" value={message.meta} />
                                        {message.parts.map((part, index) => (
                                          <InspectorMarkdown
                                            key={`${message.key}-part-${index}`}
                                            label={`Text part ${index + 1}`}
                                            value={part}
                                            mode={textMode}
                                            minHeight={96}
                                            maxHeight={260}
                                          />
                                        ))}
                                      </div>
                                    </AccordionContent>
                                  </AccordionItem>
                                ))}
                              </Accordion>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ) : null}

                    {latestTab === "result" ? (
                      <Card>
                        <CardHeader className="pb-3">
                          <SectionTitle
                            title="Latest model result"
                            description="Response and error bodies captured for the latest call."
                            badge={String(latestModelCall?.id ?? "")}
                          />
                        </CardHeader>
                        <CardContent className="grid gap-3 pt-0 xl:grid-cols-2">
                          <StructuredPane label="Response body" value={latestCall.response} />
                          <StructuredPane label="Error body" value={latestCall.error} />
                        </CardContent>
                      </Card>
                    ) : null}

                    {latestTab === "tools" ? (
                      <Card>
                        <CardHeader className="pb-3">
                          <SectionTitle
                            title="AI tools"
                            description="Tool declarations attached to the latest request."
                            badge={String(latestTools.length)}
                          />
                        </CardHeader>
                        <CardContent className="pt-0">
                          {latestTools.length === 0 ? (
                            <EmptyCard message="No tools were attached to the latest request." />
                          ) : (
                            <Accordion type="single" collapsible>
                              {latestTools.map((tool) => (
                                <AccordionItem key={tool.key} value={tool.key} className="border-slate-200">
                                  <AccordionTrigger className="py-2 hover:no-underline">
                                    <span className="flex min-w-0 flex-1 items-center gap-2">
                                      <span className="truncate text-xs font-medium text-slate-900">{tool.title}</span>
                                      {tool.description ? (
                                        <span className="truncate text-[11px] text-slate-500">{tool.description}</span>
                                      ) : null}
                                    </span>
                                  </AccordionTrigger>
                                  <AccordionContent>
                                    <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/80">
                                      <ToolStructuredView value={tool.value} />
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>
                              ))}
                            </Accordion>
                          )}
                        </CardContent>
                      </Card>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}

            {activeTab === "history" ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <Tabs
                    items={HISTORY_TABS as unknown as TabItem[]}
                    value={historyTab}
                    onValueChange={(value) => setHistoryTab(value === "calls" ? "calls" : "context")}
                  />
                  {textViewControl}
                </div>

                {historyTab === "context" ? (
                  <Card>
                    <CardHeader className="pb-3">
                      <SectionTitle
                        title="Current context"
                        description="Messages currently retained for the next model turn."
                        badge={String(historyMessages.length)}
                      />
                    </CardHeader>
                    <CardContent className="pt-0">
                      {historyMessages.length === 0 ? (
                        <EmptyCard message="Model history is still empty for this session." />
                      ) : (
                        <Accordion type="single" collapsible>
                          {historyMessages.map((message) => (
                            <AccordionItem key={message.key} value={message.key} className="border-slate-200">
                              <AccordionTrigger className="py-2 hover:no-underline">
                                <span className="flex min-w-0 flex-1 items-center gap-2">
                                  <span className="truncate text-xs font-medium text-slate-900">{message.title}</span>
                                  <Badge variant="secondary">{message.subtitle}</Badge>
                                </span>
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="space-y-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/80">
                                  <StructuredPane label="Message meta" value={message.meta} />
                                  {message.parts.map((part, index) => (
                                    <InspectorMarkdown
                                      key={`${message.key}-part-${index}`}
                                      label={`Text part ${index + 1}`}
                                      value={part}
                                      mode={textMode}
                                      minHeight={96}
                                      maxHeight={260}
                                    />
                                  ))}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      )}
                    </CardContent>
                  </Card>
                ) : null}

                {historyTab === "calls" ? (
                  <Card>
                    <CardHeader className="pb-3">
                      <SectionTitle
                        title="Recent model calls"
                        description="Recent call envelopes, useful when inspecting loops or retries."
                        badge={String(recentModelCalls.length)}
                      />
                    </CardHeader>
                    <CardContent className="pt-0">
                      {recentModelCalls.length === 0 ? (
                        <EmptyCard message="No model calls have been recorded for this session yet." />
                      ) : (
                        <Accordion type="single" collapsible>
                          {recentModelCalls
                            .slice()
                            .reverse()
                            .map((call) => (
                              <AccordionItem key={call.id} value={`model-call-${call.id}`} className="border-slate-200">
                                <AccordionTrigger className="py-2 hover:no-underline">
                                  <span className="flex min-w-0 flex-1 items-center gap-2">
                                    <span className="truncate text-xs font-medium text-slate-900">Call #{call.id}</span>
                                    <span className="truncate text-[11px] text-slate-500">cycle {call.cycleId}</span>
                                    <span className="truncate text-[11px] text-slate-500">
                                      {formatTimestamp(call.createdAt)}
                                    </span>
                                  </span>
                                </AccordionTrigger>
                                <AccordionContent>
                                  <div className="space-y-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/80">
                                    <StructuredPane
                                      label="Envelope"
                                      value={{
                                        id: call.id,
                                        cycleId: call.cycleId,
                                        status: call.status,
                                        provider: call.provider,
                                        model: call.model,
                                        createdAt: formatTimestamp(call.createdAt),
                                        completedAt: formatTimestamp(call.completedAt),
                                      }}
                                    />
                                    <StructuredPane label="Request" value={call.request} />
                                    <StructuredPane label="Response" value={call.response ?? null} />
                                    <StructuredPane label="Error" value={call.error ?? null} />
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            ))}
                        </Accordion>
                      )}
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            ) : null}

            {activeTab === "transport" ? (
              <Card>
                <CardHeader className="pb-3">
                  <SectionTitle
                    title="Recorded HTTP"
                    description="Full request and response bodies captured by optional HTTP recording."
                    badge={String(httpRecords.length)}
                  />
                </CardHeader>
                <CardContent className="pt-0">
                  {httpRecords.length === 0 ? (
                    <EmptyCard message="HTTP recording is empty for this session." />
                  ) : (
                    <Accordion type="single" collapsible>
                      {httpRecords.map((record) => (
                        <AccordionItem key={record.key} value={record.key} className="border-slate-200">
                          <AccordionTrigger className="py-2 hover:no-underline">
                            <span className="flex min-w-0 flex-1 items-center gap-2">
                              <span className="truncate text-xs font-medium text-slate-900">{record.title}</span>
                              <span className="truncate text-[11px] text-slate-500">
                                {String(record.meta.createdAt ?? "-")}
                              </span>
                            </span>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/80">
                              <StructuredPane label="Meta" value={record.meta} />
                              <StructuredPane label="Request body" value={record.request} />
                              <StructuredPane label="Response body" value={record.response} />
                              <StructuredPane label="Error body" value={record.error} />
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                </CardContent>
              </Card>
            ) : null}
          </ScrollViewport>
          </div>
        ) : null}
      </AsyncSurface>
    </section>
  );
};
