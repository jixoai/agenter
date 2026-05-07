/** @jsxImportSource @opentui/react */

import type { RuntimeStore } from "@agenter/client-sdk";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { useMemo, useSyncExternalStore } from "react";

import { layoutCliShellCollapsedFrame } from "./frame";
import { buildCliShellCollapsedModel } from "./model";

export interface CliShellTuiAppProps {
  store: Pick<RuntimeStore, "getState" | "subscribe">;
  sessionId: string;
  shellName: string;
  fallbackTerminalId: string;
  managed: boolean;
  onQuit: () => void;
}

export const CliShellTuiApp = (props: CliShellTuiAppProps) => {
  const state = useSyncExternalStore(
    (listener) => props.store.subscribe(listener),
    () => props.store.getState(),
  );
  const { width, height } = useTerminalDimensions();
  const model = useMemo(
    () =>
      buildCliShellCollapsedModel({
        state,
        sessionId: props.sessionId,
        shellName: props.shellName,
        fallbackTerminalId: props.fallbackTerminalId,
        managed: props.managed,
      }),
    [props.fallbackTerminalId, props.managed, props.sessionId, props.shellName, state],
  );
  const frame = useMemo(() => layoutCliShellCollapsedFrame({ model, width, height }), [height, model, width]);

  useKeyboard((key) => {
    if (key.ctrl && key.name === "q") {
      props.onQuit();
      return true;
    }
    return false;
  });

  return (
    <box width="100%" height="100%" flexDirection="column">
      <box flexGrow={1}>
        <text selectable>
          {frame.bodyLines.map((line, index) => (
            <span key={`body-${index}`}>
              {line}
              {index < frame.bodyLines.length - 1 ? <br /> : null}
            </span>
          ))}
        </text>
      </box>
      <box height={1} backgroundColor="#2b3036">
        <text fg="#f4f7fb">{frame.toolbarLine}</text>
      </box>
    </box>
  );
};
