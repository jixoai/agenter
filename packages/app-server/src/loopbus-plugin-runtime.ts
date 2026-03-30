import type {
  AttentionCommit,
  AttentionCommitHookResult,
  AttentionContextState,
} from "@agenter/attention-system";

import type { AppServerLogger } from "./types";

export type LoopBusPluginEnforce = "pre" | "post";
export type LoopBusHookOrder = "pre" | "default" | "post";
export type LoopBusHookKind = "first" | "parallel" | "sequential" | "sequential-waterfall";

export interface LoopSourceRef {
  systemId: string;
  subjectId: string;
  reason: string;
  versionHint?: string | number;
  meta?: Record<string, unknown>;
}

export interface LoopSourceReadRequest {
  ref: LoopSourceRef;
  mode?: "auto" | "diff" | "snapshot";
}

export interface LoopSourceReadResult {
  kind: "diff" | "snapshot";
  content: string;
  bytes: number;
  fromHash: string | null;
  toHash: string | null;
  semanticHash?: string | null;
  viewHash?: string | null;
  meta?: Record<string, unknown>;
}

export interface AttentionDraft {
  sourceRef: LoopSourceRef;
  content: string;
  from: string;
  score?: number;
  meta?: Record<string, unknown>;
  supersedeActive?: {
    systemId: string;
    subjectId: string;
  };
}

export interface LoopSourceAdapter {
  systemId: string;
  match: (ref: LoopSourceRef) => boolean;
  read: (request: LoopSourceReadRequest) => Promise<LoopSourceReadResult>;
  toAttentionDrafts?: (
    result: LoopSourceReadResult,
    request: LoopSourceReadRequest,
  ) => Promise<AttentionDraft[]> | AttentionDraft[];
}

export interface AttentionCommittedInput {
  contextId: string;
  context: AttentionContextState;
  commit: AttentionCommit;
}

export interface LoopBusPluginApi {
  expose: <T>(id: string, value: T) => void;
  useExposed: <T>(id: string) => T | undefined;
  registerSource: (adapter: LoopSourceAdapter) => void;
  invalidate: (ref: LoopSourceRef) => void;
}

export interface LoopBusHookContext {
  ref?: LoopSourceRef;
  contextId?: string;
  signal?: AbortSignal;
}

export interface LoopBusHookDescriptor<THandler> {
  handler: THandler;
  order?: LoopBusHookOrder;
  filter?: (context: LoopBusHookContext) => boolean;
}

export type LoopBusHook<THandler> = THandler | LoopBusHookDescriptor<THandler>;

export type AttentionWillLoadHook = (
  request: LoopSourceReadRequest,
  context: LoopBusHookContext,
) => Promise<LoopSourceReadRequest> | LoopSourceReadRequest;

export type AttentionShouldLoadResult =
  | boolean
  | {
      allow: boolean;
      reason?: string;
    };

export type AttentionShouldLoadHook = (
  input: {
    request: LoopSourceReadRequest;
  },
  context: LoopBusHookContext,
) =>
  | Promise<AttentionShouldLoadResult | null | undefined>
  | AttentionShouldLoadResult
  | null
  | undefined;

export type AttentionTransformHook = (
  drafts: AttentionDraft[],
  input: {
    request: LoopSourceReadRequest;
    result: LoopSourceReadResult;
  },
) => Promise<AttentionDraft[]> | AttentionDraft[];

export type AttentionCommittedHook = (
  input: AttentionCommittedInput,
  context: LoopBusHookContext,
) =>
  | Promise<AttentionCommitHookResult | AttentionCommitHookResult[] | null | undefined>
  | AttentionCommitHookResult
  | AttentionCommitHookResult[]
  | null
  | undefined;

export type CycleShouldStartResult =
  | boolean
  | {
      allow: boolean;
      reason?: string;
    };

export type CycleShouldStartHook = (
  input: {
    drafts: AttentionDraft[];
  },
  context: LoopBusHookContext,
) => Promise<CycleShouldStartResult | null | undefined> | CycleShouldStartResult | null | undefined;

export type CycleWillCallModelHook = (
  input: { cycleId: string; signal: AbortSignal },
  context: LoopBusHookContext,
) => Promise<void> | void;

export type CycleDidCallModelHook = (
  input: { cycleId: string; signal: AbortSignal; result?: unknown },
  context: LoopBusHookContext,
) => Promise<void> | void;

export type CycleDidAbortHook = (
  input: { cycleId: string; signal: AbortSignal; reason?: unknown },
  context: LoopBusHookContext,
) => Promise<void> | void;

export interface LoopBusPlugin {
  name: string;
  enforce?: LoopBusPluginEnforce;
  setup?: (api: LoopBusPluginApi) => Promise<void> | void;
  attentionWillLoad?: LoopBusHook<AttentionWillLoadHook>;
  attentionShouldLoad?: LoopBusHook<AttentionShouldLoadHook>;
  attentionTransform?: LoopBusHook<AttentionTransformHook>;
  attentionCommitted?: LoopBusHook<AttentionCommittedHook>;
  cycleShouldStart?: LoopBusHook<CycleShouldStartHook>;
  cycleWillCallModel?: LoopBusHook<CycleWillCallModelHook>;
  cycleDidCallModel?: LoopBusHook<CycleDidCallModelHook>;
  cycleDidAbort?: LoopBusHook<CycleDidAbortHook>;
}

interface RegisteredHook<THandler> {
  pluginName: string;
  order: LoopBusHookOrder;
  filter?: (context: LoopBusHookContext) => boolean;
  handler: THandler;
}

const HOOK_ORDER_WEIGHT: Record<LoopBusHookOrder, number> = {
  pre: 0,
  default: 1,
  post: 2,
};

const PLUGIN_ENFORCE_WEIGHT: Record<LoopBusPluginEnforce | "default", number> = {
  pre: 0,
  default: 1,
  post: 2,
};

const normalizeHook = <THandler>(hook: LoopBusHook<THandler>): Omit<RegisteredHook<THandler>, "pluginName"> => {
  if (typeof hook === "function") {
    return {
      order: "default",
      handler: hook,
    };
  }
  const descriptor = hook as LoopBusHookDescriptor<THandler>;
  return {
    order: descriptor.order ?? "default",
    filter: descriptor.filter,
    handler: descriptor.handler,
  };
};

const orderPlugins = (plugins: LoopBusPlugin[]): LoopBusPlugin[] =>
  [...plugins].sort((left, right) => {
    const leftWeight = PLUGIN_ENFORCE_WEIGHT[left.enforce ?? "default"];
    const rightWeight = PLUGIN_ENFORCE_WEIGHT[right.enforce ?? "default"];
    return leftWeight - rightWeight;
  });

const orderHooks = <THandler>(hooks: RegisteredHook<THandler>[]): RegisteredHook<THandler>[] =>
  [...hooks].sort((left, right) => HOOK_ORDER_WEIGHT[left.order] - HOOK_ORDER_WEIGHT[right.order]);

export class LoopBusPluginRuntime {
  private readonly sources: LoopSourceAdapter[] = [];
  private readonly exposed = new Map<string, unknown>();
  private readonly invalidated = new Map<string, LoopSourceRef>();
  private readonly attentionWillLoadHooks: RegisteredHook<AttentionWillLoadHook>[] = [];
  private readonly attentionShouldLoadHooks: RegisteredHook<AttentionShouldLoadHook>[] = [];
  private readonly attentionTransformHooks: RegisteredHook<AttentionTransformHook>[] = [];
  private readonly attentionCommittedHooks: RegisteredHook<AttentionCommittedHook>[] = [];
  private readonly cycleShouldStartHooks: RegisteredHook<CycleShouldStartHook>[] = [];
  private readonly cycleWillCallModelHooks: RegisteredHook<CycleWillCallModelHook>[] = [];
  private readonly cycleDidCallModelHooks: RegisteredHook<CycleDidCallModelHook>[] = [];
  private readonly cycleDidAbortHooks: RegisteredHook<CycleDidAbortHook>[] = [];

  constructor(
    plugins: LoopBusPlugin[],
    private readonly logger: AppServerLogger = { log: () => {} },
  ) {
    for (const plugin of orderPlugins(plugins)) {
      this.registerPlugin(plugin);
    }
  }

  async setup(): Promise<void> {
    for (const [index, plugin] of this.plugins.entries()) {
      if (!plugin.setup) {
        continue;
      }
      await plugin.setup(this.createPluginApi(index));
    }
  }

  hasInvalidations(): boolean {
    return this.invalidated.size > 0;
  }

  invalidate(ref: LoopSourceRef): void {
    this.invalidated.set(this.refKey(ref), { ...ref, meta: ref.meta ? { ...ref.meta } : undefined });
  }

  async readInvalidatedAttentionDrafts(): Promise<AttentionDraft[]> {
    const refs = [...this.invalidated.values()];
    this.invalidated.clear();
    const drafts: AttentionDraft[] = [];

    for (const ref of refs) {
      const source = this.sources.find((candidate) => candidate.match(ref));
      if (!source) {
        this.logger.log({
          channel: "agent",
          level: "warn",
          message: "loopbus.plugin.source_missing",
          meta: { systemId: ref.systemId, subjectId: ref.subjectId, reason: ref.reason },
        });
        continue;
      }
      const context: LoopBusHookContext = { ref };
      let request: LoopSourceReadRequest = { ref, mode: "auto" };
      request = await this.runSequentialWaterfall(this.attentionWillLoadHooks, request, context);
      const loadDecision = await this.shouldLoadAttention(request, context);
      if (!loadDecision.allow) {
        this.invalidate(ref);
        continue;
      }
      const result = await source.read(request);
      const initialDrafts = source.toAttentionDrafts ? await source.toAttentionDrafts(result, request) : [];
      const nextDrafts = await this.runAttentionTransform(initialDrafts, { request, result }, context);
      if (nextDrafts.length > 0) {
        drafts.push(...nextDrafts);
      }
    }

    return drafts;
  }

  async notifyAttentionCommitted(
    input: AttentionCommittedInput,
    context: LoopBusHookContext = {},
  ): Promise<AttentionCommitHookResult[]> {
    return await this.runCollect(this.attentionCommittedHooks, input, context);
  }

  async shouldStartCycle(drafts: AttentionDraft[]): Promise<CycleShouldStartResult> {
    const first = await this.runFirst(this.cycleShouldStartHooks, { drafts }, {});
    if (first === null || first === undefined) {
      return { allow: drafts.length > 0 };
    }
    if (typeof first === "boolean") {
      return { allow: first };
    }
    return first;
  }

  private readonly plugins: LoopBusPlugin[] = [];

  async notifyCycleWillCallModel(input: { cycleId: string; signal: AbortSignal }): Promise<void> {
    await this.runParallel(this.cycleWillCallModelHooks, input, { signal: input.signal });
  }

  async notifyCycleDidCallModel(input: { cycleId: string; signal: AbortSignal; result?: unknown }): Promise<void> {
    await this.runParallel(this.cycleDidCallModelHooks, input, { signal: input.signal });
  }

  async notifyCycleDidAbort(input: { cycleId: string; signal: AbortSignal; reason?: unknown }): Promise<void> {
    await this.runParallel(this.cycleDidAbortHooks, input, { signal: input.signal });
  }

  private registerPlugin(plugin: LoopBusPlugin): void {
    this.plugins.push(plugin);
    this.registerHook(plugin.name, plugin.attentionWillLoad, this.attentionWillLoadHooks);
    this.registerHook(plugin.name, plugin.attentionShouldLoad, this.attentionShouldLoadHooks);
    this.registerHook(plugin.name, plugin.attentionTransform, this.attentionTransformHooks);
    this.registerHook(plugin.name, plugin.attentionCommitted, this.attentionCommittedHooks);
    this.registerHook(plugin.name, plugin.cycleShouldStart, this.cycleShouldStartHooks);
    this.registerHook(plugin.name, plugin.cycleWillCallModel, this.cycleWillCallModelHooks);
    this.registerHook(plugin.name, plugin.cycleDidCallModel, this.cycleDidCallModelHooks);
    this.registerHook(plugin.name, plugin.cycleDidAbort, this.cycleDidAbortHooks);
  }

  private registerHook<THandler>(
    pluginName: string,
    hook: LoopBusHook<THandler> | undefined,
    target: RegisteredHook<THandler>[],
  ): void {
    if (!hook) {
      return;
    }
    const normalized = normalizeHook(hook);
    target.push({
      pluginName,
      order: normalized.order,
      filter: normalized.filter,
      handler: normalized.handler,
    });
  }

  private createPluginApi(index: number): LoopBusPluginApi {
    return {
      expose: (id, value) => {
        this.exposed.set(id, value);
      },
      useExposed: (id) => this.exposed.get(id) as never,
      registerSource: (adapter) => {
        this.sources.push(adapter);
      },
      invalidate: (ref) => {
        this.invalidate(ref);
      },
    };
  }

  private refKey(ref: LoopSourceRef): string {
    return `${ref.systemId}:${ref.subjectId}`;
  }

  private shouldRun<THandler>(hook: RegisteredHook<THandler>, context: LoopBusHookContext): boolean {
    return hook.filter ? hook.filter(context) : true;
  }

  private async runSequentialWaterfall<TValue>(
    hooks: RegisteredHook<(value: TValue, context: LoopBusHookContext) => Promise<TValue> | TValue>[],
    value: TValue,
    context: LoopBusHookContext,
  ): Promise<TValue> {
    let current = value;
    for (const hook of orderHooks(hooks)) {
      if (!this.shouldRun(hook, context)) {
        continue;
      }
      current = await hook.handler(current, context);
    }
    return current;
  }

  private async runAttentionTransform(
    drafts: AttentionDraft[],
    input: { request: LoopSourceReadRequest; result: LoopSourceReadResult },
    context: LoopBusHookContext,
  ): Promise<AttentionDraft[]> {
    let current = drafts;
    for (const hook of orderHooks(this.attentionTransformHooks)) {
      if (!this.shouldRun(hook, context)) {
        continue;
      }
      current = await hook.handler(current, input);
    }
    return current;
  }

  private async shouldLoadAttention(
    request: LoopSourceReadRequest,
    context: LoopBusHookContext,
  ): Promise<{ allow: boolean; reason?: string }> {
    const first = await this.runFirst(this.attentionShouldLoadHooks, { request }, context);
    if (first === null || first === undefined) {
      return { allow: true };
    }
    if (typeof first === "boolean") {
      return { allow: first };
    }
    return first;
  }

  private async runParallel<TInput>(
    hooks: RegisteredHook<(input: TInput, context: LoopBusHookContext) => Promise<void> | void>[],
    input: TInput,
    context: LoopBusHookContext,
  ): Promise<void> {
    await Promise.all(
      orderHooks(hooks).map(async (hook) => {
        if (!this.shouldRun(hook, context)) {
          return;
        }
        await hook.handler(input, context);
      }),
    );
  }

  private async runCollect<TInput, TResult>(
    hooks: RegisteredHook<
      (input: TInput, context: LoopBusHookContext) => Promise<TResult | TResult[] | null | undefined> | TResult | TResult[] | null | undefined
    >[],
    input: TInput,
    context: LoopBusHookContext,
  ): Promise<TResult[]> {
    const results: TResult[] = [];
    for (const hook of orderHooks(hooks)) {
      if (!this.shouldRun(hook, context)) {
        continue;
      }
      const output = await hook.handler(input, context);
      if (Array.isArray(output)) {
        results.push(...output);
        continue;
      }
      if (output !== null && output !== undefined) {
        results.push(output);
      }
    }
    return results;
  }

  private async runFirst<TInput, TResult>(
    hooks: RegisteredHook<(input: TInput, context: LoopBusHookContext) => Promise<TResult | null | undefined> | TResult | null | undefined>[],
    input: TInput,
    context: LoopBusHookContext,
  ): Promise<TResult | null | undefined> {
    for (const hook of orderHooks(hooks)) {
      if (!this.shouldRun(hook, context)) {
        continue;
      }
      const result = await hook.handler(input, context);
      if (result !== null && result !== undefined) {
        return result;
      }
    }
    return undefined;
  }
}
