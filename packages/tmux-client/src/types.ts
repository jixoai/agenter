export interface TmuxCommand {
  executable: string;
  args: readonly string[];
}

export interface TmuxExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface TmuxExecutor {
  exec(command: TmuxCommand, options?: TmuxExecOptions): Promise<TmuxExecResult>;
  which?(executable: string): Promise<string | null>;
}

export interface TmuxExecOptions {
  env?: Record<string, string | undefined>;
}

export interface TmuxClientOptions {
  executable?: string;
  socketName?: string;
  env?: Record<string, string | undefined>;
  executor?: TmuxExecutor;
}

export interface TmuxPane {
  paneId: string;
  sessionName: string;
  windowId: string;
  windowIndex: number;
  paneIndex: number;
  active: boolean;
  currentCommand: string;
  startCommand: string;
  currentPath: string;
  title: string;
}

export interface TmuxSession {
  sessionName: string;
  windows: number;
  attached: boolean;
  createdAt: number;
}

export type TmuxSplitDirection = "left" | "right" | "above" | "below";

export interface TmuxSplitPaneInput {
  target?: string;
  direction?: TmuxSplitDirection;
  size?: string;
  cwd?: string;
  detached?: boolean;
  command?: string | readonly string[];
}

export interface TmuxMovePaneInput {
  source: string;
  target: string;
  direction?: "left" | "right" | "above" | "below";
  size?: string;
  detached?: boolean;
}

export interface TmuxDisplayPopupInput {
  targetClient?: string;
  target?: string;
  title?: string;
  width?: string;
  height?: string;
  closeOnExit?: boolean;
  command?: string | readonly string[];
}

export interface TmuxClosePopupInput {
  targetClient?: string;
}

export interface TmuxNewSessionInput {
  sessionName: string;
  detached?: boolean;
  cwd?: string;
  command?: string | readonly string[];
}

export interface TmuxBindKeyInput {
  table?: string;
  key: string;
  tmuxCommand: readonly string[];
}
