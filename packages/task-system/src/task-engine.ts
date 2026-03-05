import { CronExpressionParser } from "cron-parser";

import type {
  Task,
  TaskCreateInput,
  TaskDoneResult,
  TaskEventInput,
  TaskImportItem,
  TaskImportResult,
  TaskRef,
  TaskSourceName,
  TaskStatus,
  TaskTrigger,
  TaskTriggerResult,
  TaskUpdateInput,
  TaskView,
} from "./task-types";

const nowIso = (): string => new Date().toISOString();
const nowMs = (): number => Date.now();

const createId = (): string => `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const keyOf = (source: TaskSourceName, id: string): string => `${source}:${id}`;

const parseRef = (value: string | TaskRef, currentSource: TaskSourceName): TaskRef => {
  if (typeof value !== "string") {
    return value;
  }
  const separator = value.indexOf(":");
  if (separator > 0 && separator < value.length - 1) {
    const source = value.slice(0, separator).trim();
    const id = value.slice(separator + 1).trim();
    if (source.length > 0 && id.length > 0) {
      return { source, id };
    }
  }
  return { source: currentSource, id: value };
};

const refToString = (ref: TaskRef): string => keyOf(ref.source, ref.id);

interface TriggerState {
  atFired: Set<string>;
  lastCronMs: Map<string, number>;
}

export class TaskEngine {
  private readonly tasks = new Map<string, Task>();
  private readonly triggerState: TriggerState = {
    atFired: new Set<string>(),
    lastCronMs: new Map<string, number>(),
  };

  list(): TaskView[] {
    const all = [...this.tasks.values()];
    return all
      .map((task) => this.withDerived(task))
      .sort((a, b) => a.meta.updatedAt.localeCompare(b.meta.updatedAt));
  }

  get(source: TaskSourceName, id: string): TaskView | undefined {
    const task = this.tasks.get(keyOf(source, id));
    return task ? this.withDerived(task) : undefined;
  }

  create(input: TaskCreateInput): TaskView {
    const id = input.id?.trim() || createId();
    const task = this.buildTask(input.source, id, input);
    const key = keyOf(task.source.name, task.id);
    this.ensureNoCycle(task, task.dependsOn);
    this.tasks.set(key, task);
    this.recomputeStatuses();
    return this.withDerived(task);
  }

  upsert(input: TaskCreateInput): { mode: "created" | "updated"; task: TaskView } {
    const id = input.id?.trim() || createId();
    const key = keyOf(input.source, id);
    if (!this.tasks.has(key)) {
      return { mode: "created", task: this.create({ ...input, id }) };
    }
    const updated = this.update({
      source: input.source,
      id,
      patch: {
        title: input.title,
        body: input.body,
        status: input.status,
        type: input.type,
        assignees: input.assignees,
        labels: input.labels,
        milestone: input.milestone,
        projects: input.projects,
        dependsOn: input.dependsOn,
        relationships: input.relationships,
        triggers: input.triggers,
      },
    });
    return { mode: "updated", task: updated };
  }

  import(items: TaskImportItem[]): TaskImportResult {
    const result: TaskView[] = [];
    let created = 0;
    let updated = 0;
    for (const item of items) {
      const output = this.upsert({
        source: item.source,
        sourceFile: item.file,
        ...item.task,
      });
      if (output.mode === "created") {
        created += 1;
      } else {
        updated += 1;
      }
      result.push(output.task);
    }
    return {
      created,
      updated,
      items: result,
    };
  }

  update(input: TaskUpdateInput): TaskView {
    const key = keyOf(input.source, input.id);
    const task = this.tasks.get(key);
    if (!task) {
      throw new Error(`task not found: ${key}`);
    }

    const nextDependsOn = input.patch.dependsOn
      ? input.patch.dependsOn.map((item) => parseRef(item, input.source))
      : task.dependsOn;
    this.ensureNoCycle(task, nextDependsOn);

    const next: Task = {
      ...task,
      ...input.patch,
      dependsOn: nextDependsOn,
      relationships: input.patch.relationships
        ? input.patch.relationships.map((item) => ({
            type: item.type,
            target: parseRef(item.target, input.source),
          }))
        : task.relationships,
      meta: {
        ...task.meta,
        updatedAt: nowIso(),
        version: task.meta.version + 1,
      },
    };

    this.tasks.set(key, next);
    this.recomputeStatuses();
    return this.withDerived(next);
  }

  addDependency(source: TaskSourceName, id: string, target: string | TaskRef): TaskView {
    const task = this.assertTask(source, id);
    const ref = parseRef(target, source);
    const exists = task.dependsOn.some((item) => item.source === ref.source && item.id === ref.id);
    if (exists) {
      return this.withDerived(task);
    }
    const nextDependsOn = [...task.dependsOn, ref];
    this.ensureNoCycle(task, nextDependsOn);
    task.dependsOn = nextDependsOn;
    task.meta.updatedAt = nowIso();
    task.meta.version += 1;
    this.recomputeStatuses();
    return this.withDerived(task);
  }

  removeDependency(source: TaskSourceName, id: string, target: string | TaskRef): TaskView {
    const task = this.assertTask(source, id);
    const ref = parseRef(target, source);
    task.dependsOn = task.dependsOn.filter((item) => !(item.source === ref.source && item.id === ref.id));
    task.meta.updatedAt = nowIso();
    task.meta.version += 1;
    this.recomputeStatuses();
    return this.withDerived(task);
  }

  done(source: TaskSourceName, id: string): TaskDoneResult {
    const task = this.tasks.get(keyOf(source, id));
    if (!task) {
      return { ok: false, affected: [], reason: `task not found: ${source}:${id}` };
    }
    task.status = "done";
    task.meta.updatedAt = nowIso();
    task.meta.version += 1;
    this.recomputeStatuses();

    const affected = this.collectAffected(task).map((item) => this.withDerived(item));
    return {
      ok: true,
      task: this.withDerived(task),
      affected,
    };
  }

  triggerManual(source: TaskSourceName, id: string): TaskView | undefined {
    const task = this.tasks.get(keyOf(source, id));
    if (!task) {
      return undefined;
    }
    if (task.status === "backlog") {
      task.status = "pending";
      task.meta.updatedAt = nowIso();
      task.meta.version += 1;
    }
    this.recomputeStatuses();
    return this.withDerived(task);
  }

  emitEvent(input: TaskEventInput): TaskTriggerResult {
    const topic = input.topic.trim();
    const source = input.source ?? "api";
    const affected: TaskView[] = [];
    for (const task of this.tasks.values()) {
      const matched = task.triggers.some((trigger) => trigger.type === "event" && trigger.topic === topic);
      if (!matched) {
        continue;
      }
      if (task.status === "backlog") {
        task.status = "pending";
        task.meta.updatedAt = nowIso();
        task.meta.version += 1;
      }
      affected.push(this.withDerived(task));
    }
    this.recomputeStatuses();
    return { topic, source, affected };
  }

  pollTime(now = nowMs()): TaskTriggerResult {
    const affected: TaskView[] = [];
    for (const task of this.tasks.values()) {
      for (const trigger of task.triggers) {
        if (!this.shouldFireTrigger(task, trigger, now)) {
          continue;
        }
        if (task.status === "backlog") {
          task.status = "pending";
          task.meta.updatedAt = nowIso();
          task.meta.version += 1;
          affected.push(this.withDerived(task));
        }
      }
    }
    if (affected.length > 0) {
      this.recomputeStatuses();
    }
    return {
      topic: "time",
      source: "scheduler",
      affected,
    };
  }

  remove(source: TaskSourceName, id: string): boolean {
    const key = keyOf(source, id);
    const removed = this.tasks.delete(key);
    if (!removed) {
      return false;
    }
    for (const task of this.tasks.values()) {
      task.dependsOn = task.dependsOn.filter((dep) => keyOf(dep.source, dep.id) !== key);
      task.relationships = task.relationships.filter((rel) => keyOf(rel.target.source, rel.target.id) !== key);
    }
    this.recomputeStatuses();
    return true;
  }

  private collectAffected(seed: Task): Task[] {
    const seen = new Set<string>();
    const queue = [keyOf(seed.source.name, seed.id)];
    const output: Task[] = [];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || seen.has(current)) {
        continue;
      }
      seen.add(current);
      const task = this.tasks.get(current);
      if (!task) {
        continue;
      }
      output.push(task);
      for (const next of this.tasks.values()) {
        if (next.dependsOn.some((dep) => keyOf(dep.source, dep.id) === current)) {
          queue.push(keyOf(next.source.name, next.id));
        }
      }
    }
    return output;
  }

  private shouldFireTrigger(task: Task, trigger: TaskTrigger, now: number): boolean {
    const key = keyOf(task.source.name, task.id);
    if (trigger.type === "at") {
      const triggerKey = `${key}:at:${trigger.at}`;
      if (this.triggerState.atFired.has(triggerKey)) {
        return false;
      }
      const atMs = Date.parse(trigger.at);
      if (!Number.isFinite(atMs)) {
        return false;
      }
      if (now >= atMs) {
        this.triggerState.atFired.add(triggerKey);
        return true;
      }
      return false;
    }
    if (trigger.type === "cron") {
      try {
        const interval = CronExpressionParser.parse(trigger.expr, {
          currentDate: new Date(now),
          strict: false,
        });
        const prevDate = interval.prev();
        const prevMs = prevDate.getTime();
        const triggerKey = `${key}:cron:${trigger.expr}`;
        const lastMs = this.triggerState.lastCronMs.get(triggerKey) ?? 0;
        if (prevMs > lastMs) {
          this.triggerState.lastCronMs.set(triggerKey, prevMs);
          return true;
        }
      } catch {
        return false;
      }
    }
    return false;
  }

  private withDerived(task: Task): TaskView {
    const key = keyOf(task.source.name, task.id);
    const blockedBy = task.dependsOn
      .map((dep) => this.tasks.get(refToString(dep)))
      .filter((dep): dep is Task => dep !== undefined && dep.status !== "done")
      .map((dep) => keyOf(dep.source.name, dep.id));

    const blocks = [...this.tasks.values()]
      .filter((next) => next.dependsOn.some((dep) => keyOf(dep.source, dep.id) === key))
      .map((next) => keyOf(next.source.name, next.id));

    const doneDeps = task.dependsOn
      .map((dep) => this.tasks.get(refToString(dep)))
      .filter((dep): dep is Task => dep !== undefined && dep.status === "done").length;

    const progress = task.dependsOn.length === 0 ? (task.status === "done" ? 1 : 0) : doneDeps / task.dependsOn.length;
    return {
      ...task,
      key,
      blockedBy,
      blocks,
      ready: task.status === "ready",
      progress,
    };
  }

  private recomputeStatuses(): void {
    const all = [...this.tasks.values()];
    for (const task of all) {
      if (["done", "failed", "canceled", "running"].includes(task.status)) {
        continue;
      }
      const hasTrigger = task.triggers.length > 0;
      const blocked = task.dependsOn.some((dep) => {
        const target = this.tasks.get(refToString(dep));
        return !target || target.status !== "done";
      });

      if (task.status === "backlog") {
        if (!hasTrigger && !blocked) {
          task.status = "ready";
        }
        continue;
      }

      if (blocked) {
        task.status = "pending";
      } else if (task.status === "pending") {
        task.status = "ready";
      }
    }
  }

  private assertTask(source: TaskSourceName, id: string): Task {
    const task = this.tasks.get(keyOf(source, id));
    if (!task) {
      throw new Error(`task not found: ${source}:${id}`);
    }
    return task;
  }

  private ensureNoCycle(task: Task, dependencies: TaskRef[]): void {
    const sourceKey = keyOf(task.source.name, task.id);
    for (const dep of dependencies) {
      const depKey = keyOf(dep.source, dep.id);
      if (depKey === sourceKey) {
        throw new Error(`dependency cycle: ${sourceKey} depends on itself`);
      }
      if (this.reachable(depKey, sourceKey)) {
        throw new Error(`dependency cycle: ${sourceKey} -> ${depKey}`);
      }
    }
  }

  private reachable(from: string, target: string, seen = new Set<string>()): boolean {
    if (from === target) {
      return true;
    }
    if (seen.has(from)) {
      return false;
    }
    seen.add(from);
    const task = this.tasks.get(from);
    if (!task) {
      return false;
    }
    for (const dep of task.dependsOn) {
      if (this.reachable(refToString(dep), target, seen)) {
        return true;
      }
    }
    return false;
  }

  private buildTask(source: TaskSourceName, id: string, input: TaskCreateInput): Task {
    const createdAt = nowIso();
    const dependsOn = (input.dependsOn ?? []).map((item) => parseRef(item, source));
    const relationships = (input.relationships ?? []).map((item) => ({
      type: item.type,
      target: parseRef(item.target, source),
    }));

    const status: TaskStatus = input.status ?? (input.triggers && input.triggers.length > 0 ? "backlog" : "ready");

    return {
      id,
      title: input.title,
      body: input.body ?? "",
      status,
      type: input.type,
      assignees: [...(input.assignees ?? [])],
      labels: [...(input.labels ?? [])],
      milestone: input.milestone,
      projects: [...(input.projects ?? [])],
      dependsOn,
      relationships,
      triggers: [...(input.triggers ?? [])],
      source: {
        name: source,
        file: input.sourceFile ?? `${id}.md`,
      },
      meta: {
        createdAt,
        updatedAt: createdAt,
        version: 1,
      },
    };
  }
}

export const toTaskKey = (source: TaskSourceName, id: string): string => keyOf(source, id);
export const toTaskRef = parseRef;
