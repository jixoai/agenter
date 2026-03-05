import { join, resolve } from "node:path";

export interface TaskSourceInput {
  name: string;
  path: string;
}

export interface TaskSourceResolved {
  name: string;
  path: string;
}

export interface TaskAddressingConfig {
  projectRoot: string;
  homeDir: string;
  sources?: TaskSourceInput[];
}

const normalizePath = (value: string, projectRoot: string, homeDir: string): string => {
  if (value === "~") {
    return homeDir;
  }
  if (value.startsWith("~/")) {
    return join(homeDir, value.slice(2));
  }
  if (value.startsWith("/")) {
    return value;
  }
  return resolve(projectRoot, value);
};

export const resolveTaskSources = (config: TaskAddressingConfig): TaskSourceResolved[] => {
  const defaults: TaskSourceInput[] = [
    { name: "user", path: "~/.agenter/tasks" },
    { name: "workspace", path: ".agenter/tasks" },
  ];
  const sourceList = config.sources && config.sources.length > 0 ? config.sources : defaults;
  const dedup = new Set<string>();
  const output: TaskSourceResolved[] = [];
  for (const source of sourceList) {
    const name = source.name.trim();
    const rawPath = source.path.trim();
    if (name.length === 0 || rawPath.length === 0) {
      continue;
    }
    const path = normalizePath(rawPath, config.projectRoot, config.homeDir);
    const key = `${name}:${path}`;
    if (dedup.has(key)) {
      continue;
    }
    dedup.add(key);
    output.push({ name, path });
  }
  return output;
};
