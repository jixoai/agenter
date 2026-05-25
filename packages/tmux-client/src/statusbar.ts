import { quoteShellArg } from "./format";

const TMUX_STATUS_RANGE_MAX_BYTES = 15;
const TMUX_STATUS_RESERVED_RANGES = new Set(["", "left", "right", "session", "window", "pane"]);

export type TmuxStatusBarSide = "left" | "right";
export type TmuxStatusBarPosition = "top" | "bottom";

export interface TmuxStatusStyle {
  fg?: string;
  bg?: string;
  bold?: boolean;
  italic?: boolean;
  underscore?: boolean;
  reverse?: boolean;
  dim?: boolean;
  blink?: boolean;
}

export interface TmuxStatusTextItem {
  kind: "text";
  text: string;
  style?: TmuxStatusStyle;
}

export interface TmuxStatusButtonItem {
  kind: "button";
  id: string;
  label: string;
  style?: TmuxStatusStyle;
  activeStyle?: TmuxStatusStyle;
  active?: boolean | string;
}

export type TmuxStatusItem = TmuxStatusTextItem | TmuxStatusButtonItem;

export interface TmuxStatusBarSection {
  items: readonly TmuxStatusItem[];
  gap?: string;
}

export interface TmuxStatusBarDefinition {
  left?: TmuxStatusBarSection;
  right?: TmuxStatusBarSection;
  defaultStyle?: TmuxStatusStyle;
  resetStyle?: TmuxStatusStyle;
}

export interface TmuxRenderedStatusBar {
  statusLeft: string;
  statusRight: string;
  buttonIds: readonly string[];
}

export interface TmuxStatusBarOptionCommand {
  args: readonly string[];
}

export interface TmuxStatusBarOptionInput {
  target?: string;
  definition: TmuxStatusBarDefinition;
  enabled?: boolean;
  position?: TmuxStatusBarPosition;
  style?: TmuxStatusStyle | string;
  leftStyle?: TmuxStatusStyle | string;
  rightStyle?: TmuxStatusStyle | string;
  leftLength?: number | string;
  rightLength?: number | string;
  minClientColumns?: number;
  windowStatusFormat?: string;
  windowStatusCurrentFormat?: string;
}

export interface TmuxStatusBarInstaller {
  exec(args: readonly string[]): Promise<unknown>;
}

export interface TmuxStatusBarBindingInput {
  command: string | readonly string[];
  key?: string;
  table?: string;
  event?: "MouseDown1Status" | "MouseUp1Status";
  unknownRangeCommand?: string | readonly string[];
}

export const tmuxStatusStyle = (style: TmuxStatusStyle | undefined): string => {
  const value = tmuxStatusStyleValue(style);
  return value ? `#[${value}]` : "";
};

export const tmuxStatusStyleValue = (style: TmuxStatusStyle | string | undefined): string => {
  if (!style) {
    return "";
  }
  if (typeof style === "string") {
    return style;
  }
  const attributes: string[] = [];
  if (style.fg) {
    attributes.push(`fg=${style.fg}`);
  }
  if (style.bg) {
    attributes.push(`bg=${style.bg}`);
  }
  attributes.push(style.bold ? "bold" : "nobold");
  attributes.push(style.italic ? "italics" : "noitalics");
  attributes.push(style.underscore ? "underscore" : "nounderscore");
  attributes.push(style.reverse ? "reverse" : "noreverse");
  attributes.push(style.dim ? "dim" : "nodim");
  attributes.push(style.blink ? "blink" : "noblink");
  return attributes.join(",");
};

export const tmuxStatusText = (text: string, style?: TmuxStatusStyle): TmuxStatusTextItem => ({
  kind: "text",
  text,
  style,
});

export const tmuxStatusButton = (input: Omit<TmuxStatusButtonItem, "kind">): TmuxStatusButtonItem => {
  assertTmuxStatusRangeId(input.id);
  return {
    kind: "button",
    ...input,
  };
};

export const tmuxFormatEquals = (left: string, right: string): string =>
  `#{==:${left},${escapeTmuxConditionalBranch(right)}}`;

export const renderTmuxStatusBar = (definition: TmuxStatusBarDefinition): TmuxRenderedStatusBar => {
  const defaultStyle = tmuxStatusStyle(definition.defaultStyle);
  const resetStyle = tmuxStatusStyle(definition.resetStyle ?? definition.defaultStyle);
  const buttonIds = new Set<string>();
  return {
    statusLeft: renderSection(definition.left, defaultStyle, resetStyle, buttonIds),
    statusRight: renderSection(definition.right, defaultStyle, resetStyle, buttonIds),
    buttonIds: [...buttonIds],
  };
};

export const buildTmuxStatusBarOptionCommands = (
  input: TmuxStatusBarOptionInput,
): readonly TmuxStatusBarOptionCommand[] => {
  assertTmuxStatusLengthBudget(input);
  const rendered = renderTmuxStatusBar(input.definition);
  const targetArgs = input.target ? ["-t", input.target] : [];
  const command = (name: string, value: string): TmuxStatusBarOptionCommand => ({
    args: ["set-option", ...targetArgs, name, value],
  });
  const commands: TmuxStatusBarOptionCommand[] = [
    command("status", input.enabled === false ? "off" : "on"),
    ...(input.position ? [command("status-position", input.position)] : []),
    ...(input.style ? [command("status-style", tmuxStatusStyleValue(input.style))] : []),
    ...(input.leftStyle ? [command("status-left-style", tmuxStatusStyleValue(input.leftStyle))] : []),
    ...(input.rightStyle ? [command("status-right-style", tmuxStatusStyleValue(input.rightStyle))] : []),
    command("status-left", rendered.statusLeft),
    ...(input.leftLength === undefined ? [] : [command("status-left-length", String(input.leftLength))]),
    ...(input.rightLength === undefined ? [] : [command("status-right-length", String(input.rightLength))]),
    command("status-right", rendered.statusRight),
    ...(input.windowStatusFormat === undefined ? [] : [command("window-status-format", input.windowStatusFormat)]),
    ...(input.windowStatusCurrentFormat === undefined
      ? []
      : [command("window-status-current-format", input.windowStatusCurrentFormat)]),
  ];
  return commands;
};

export const installTmuxStatusBar = async (
  client: TmuxStatusBarInstaller,
  input: TmuxStatusBarOptionInput,
): Promise<TmuxRenderedStatusBar> => {
  const commands = buildTmuxStatusBarOptionCommands(input);
  for (const command of commands) {
    await client.exec(command.args);
  }
  return renderTmuxStatusBar(input.definition);
};

export const buildTmuxStatusBarMouseBinding = (input: TmuxStatusBarBindingInput): string[] => [
  "bind-key",
  ...(input.table ? ["-T", input.table] : []),
  input.event ?? input.key ?? "MouseDown1Status",
  "run-shell",
  buildDispatchShell(input),
];

export const createTmuxStatusBar = (definition: TmuxStatusBarDefinition): TmuxRenderedStatusBar =>
  renderTmuxStatusBar(definition);

export const readTmuxStatusUserRangeId = (value: string): string | null => {
  const trimmed = value.trim();
  if (TMUX_STATUS_RESERVED_RANGES.has(trimmed)) {
    return null;
  }
  const userRangePrefix = "user|";
  const id = trimmed.startsWith(userRangePrefix) ? trimmed.slice(userRangePrefix.length).trim() : trimmed;
  assertTmuxStatusRangeId(id);
  return id;
};

const renderSection = (
  section: TmuxStatusBarSection | undefined,
  defaultStyle: string,
  resetStyle: string,
  buttonIds: Set<string>,
): string => {
  if (!section) {
    return "";
  }
  const gap = section.gap ?? "  ";
  return section.items.map((item) => renderItem(item, defaultStyle, resetStyle, buttonIds)).join(gap);
};

const renderItem = (
  item: TmuxStatusItem,
  defaultStyle: string,
  resetStyle: string,
  buttonIds: Set<string>,
): string => {
  if (item.kind === "text") {
    return `${defaultStyle}${tmuxStatusStyle(item.style)}${item.text}${resetStyle}`;
  }
  assertTmuxStatusRangeId(item.id);
  buttonIds.add(item.id);
  const inactive = `${defaultStyle}${tmuxStatusStyle(item.style)}`;
  const active = `${defaultStyle}${tmuxStatusStyle(item.activeStyle ?? item.style)}`;
  const style =
    typeof item.active === "string"
      ? `#{?${item.active},${escapeTmuxConditionalBranch(active)},${escapeTmuxConditionalBranch(inactive)}}`
      : item.active
        ? active
        : inactive;
  return `#[range=user|${item.id}]${style}${item.label}${resetStyle}#[norange]`;
};

const escapeTmuxConditionalBranch = (value: string): string => value.replace(/,/g, "#,").replace(/}/g, "#}");

const assertTmuxStatusLengthBudget = (input: TmuxStatusBarOptionInput): void => {
  if (input.minClientColumns === undefined || input.leftLength === undefined || input.rightLength === undefined) {
    return;
  }
  const leftLength = parseTmuxStatusLength(input.leftLength, "status-left-length");
  const rightLength = parseTmuxStatusLength(input.rightLength, "status-right-length");
  const reservedColumns = 2;
  if (leftLength + rightLength > input.minClientColumns - reservedColumns) {
    throw new Error(
      `tmux status bar length budget exceeds minimum client columns: left=${leftLength}, right=${rightLength}, min=${input.minClientColumns}`,
    );
  }
};

const parseTmuxStatusLength = (value: number | string, name: string): number => {
  const normalized = typeof value === "number" ? value : Number.parseInt(value, 10);
  if (!Number.isInteger(normalized) || normalized < 0 || String(value).trim() !== String(normalized)) {
    throw new Error(`tmux ${name} must be a non-negative integer when minClientColumns is set: ${value}`);
  }
  return normalized;
};

const assertTmuxStatusRangeId = (id: string): void => {
  if (!id.trim()) {
    throw new Error("tmux status range id cannot be empty");
  }
  if (id.includes("|")) {
    throw new Error(`tmux status range id cannot contain "|": ${id}`);
  }
  if (new TextEncoder().encode(id).byteLength > TMUX_STATUS_RANGE_MAX_BYTES) {
    throw new Error(`tmux status range id must be at most ${TMUX_STATUS_RANGE_MAX_BYTES} bytes: ${id}`);
  }
};

const buildDispatchShell = (input: TmuxStatusBarBindingInput): string => {
  const command = toShellSnippet(input.command);
  const unknown = input.unknownRangeCommand
    ? toShellSnippet(input.unknownRangeCommand)
    : "";
  if (!unknown) {
    return command;
  }
  return `case "#{mouse_status_range}" in ""|left|right|session|window|pane) ${unknown} ;; *) ${command} ;; esac`;
};

const toShellSnippet = (command: string | readonly string[]): string =>
  typeof command === "string" ? command : command.join(" ");

export const quoteTmuxStatusShellArg = quoteShellArg;
