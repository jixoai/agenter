import type { SessionInstance } from "@agenter/client-sdk";

interface InstancesPanelProps {
  instances: SessionInstance[];
  activeInstanceId: string | null;
}

export const InstancesPanel = ({ instances, activeInstanceId }: InstancesPanelProps) => {
  return (
    <box border borderColor="gray" padding={1} width="33%" flexDirection="column" title="instances">
      <text fg="gray">Ctrl+N new / Ctrl+Tab switch</text>
      <scrollbox flexGrow={1} stickyScroll stickyStart="top">
        <box flexDirection="column">
          {instances.length === 0 ? <text fg="gray">(empty)</text> : null}
          {instances.map((instance) => (
            <box key={instance.id} marginTop={1}>
              <text fg={instance.id === activeInstanceId ? "cyan" : "white"}>
                {instance.id === activeInstanceId ? "●" : "○"} {instance.name} [{instance.status}]
              </text>
            </box>
          ))}
        </box>
      </scrollbox>
    </box>
  );
};
