import {
  buildTmuxStatusBarOptionCommands,
  tmuxFormatEquals,
  tmuxStatusButton,
  tmuxStatusText,
  type TmuxStatusBarDefinition,
  type TmuxStatusBarOptionCommand,
} from "@agenter/tmux-client";

export interface CliShellStatusBarInput {
  shellName: string;
  avatarNickname: string;
}

export const CLI_SHELL_TMUX_STATUS_STYLE =
  "fg=colour252,bg=colour234,nobold,noitalics,nounderscore,noreverse,nodim,noblink";
export const CLI_SHELL_TMUX_STATUS_MIN_COLUMNS = 80;
export const CLI_SHELL_TMUX_STATUS_LEFT_LENGTH = 54;
export const CLI_SHELL_TMUX_STATUS_RIGHT_LENGTH = 24;

const CLI_SHELL_TMUX_STATUS_DEFAULT_STYLE = {
  fg: "colour252",
  bg: "colour234",
  bold: false,
  italic: false,
  underscore: false,
  reverse: false,
  dim: false,
  blink: false,
} as const;

const CLI_SHELL_TMUX_STATUS_BUTTON_STYLE = {
  fg: "colour159",
  bg: "colour234",
  bold: false,
} as const;

const CLI_SHELL_TMUX_STATUS_BUTTON_ACTIVE_STYLE = {
  fg: "colour16",
  bg: "colour220",
  bold: true,
} as const;

const activeActionExpression = (name: string): string => tmuxFormatEquals("#{@agenter_cli_shell_active_action}", name);

export const buildCliShellStatusBarDefinition = (input: CliShellStatusBarInput): TmuxStatusBarDefinition => ({
  defaultStyle: CLI_SHELL_TMUX_STATUS_DEFAULT_STYLE,
  left: {
    gap: "  ",
    items: [
      tmuxStatusText("cli-shell", { fg: "colour51", bold: true }),
      tmuxStatusText(input.shellName, { fg: "colour252" }),
      tmuxStatusText(`@${input.avatarNickname}`, { fg: "colour229" }),
      // Keep clickable actions before variable text; oversized left ranges can swallow right-side clicks in tmux.
      tmuxStatusButton({
        id: "managed",
        label: " managed:#{@agenter_cli_shell_managed} ",
        active: activeActionExpression("managed"),
        style: CLI_SHELL_TMUX_STATUS_BUTTON_STYLE,
        activeStyle: CLI_SHELL_TMUX_STATUS_BUTTON_ACTIVE_STYLE,
      }),
      tmuxStatusText("#{@agenter_cli_shell_heartbeat_status}", { fg: "colour159" }),
    ],
  },
  right: {
    gap: "  ",
    items: [
      tmuxStatusButton({
        id: "help",
        label: " Help ",
        active: activeActionExpression("help"),
        style: CLI_SHELL_TMUX_STATUS_BUTTON_STYLE,
        activeStyle: CLI_SHELL_TMUX_STATUS_BUTTON_ACTIVE_STYLE,
      }),
      tmuxStatusButton({
        id: "chat",
        label: " Chat ",
        active: activeActionExpression("chat"),
        style: CLI_SHELL_TMUX_STATUS_BUTTON_STYLE,
        activeStyle: CLI_SHELL_TMUX_STATUS_BUTTON_ACTIVE_STYLE,
      }),
    ],
  },
});

export const buildCliShellStatusBarOptionCommands = (
  input: CliShellStatusBarInput,
): readonly TmuxStatusBarOptionCommand[] =>
  buildTmuxStatusBarOptionCommands({
    target: input.shellName,
    enabled: true,
    position: "bottom",
    style: CLI_SHELL_TMUX_STATUS_STYLE,
    leftStyle: CLI_SHELL_TMUX_STATUS_STYLE,
    rightStyle: CLI_SHELL_TMUX_STATUS_STYLE,
    minClientColumns: CLI_SHELL_TMUX_STATUS_MIN_COLUMNS,
    leftLength: CLI_SHELL_TMUX_STATUS_LEFT_LENGTH,
    rightLength: CLI_SHELL_TMUX_STATUS_RIGHT_LENGTH,
    windowStatusFormat: "",
    windowStatusCurrentFormat: "",
    definition: buildCliShellStatusBarDefinition(input),
  });
