import type { SessionInstance } from "@agenter/client-sdk";

interface InstancesPanelProps {
  instances: SessionInstance[];
  activeInstanceId: string | null;
  onSelect: (instanceId: string) => void;
  onCreate: () => void;
  onStart: () => void;
  onStop: () => void;
  onDelete: () => void;
}

export const InstancesPanel = ({
  instances,
  activeInstanceId,
  onSelect,
  onCreate,
  onStart,
  onStop,
  onDelete,
}: InstancesPanelProps) => {
  return (
    <section className="panel panel--instances">
      <header className="panel__header">
        <h2>Instances</h2>
      </header>
      <div className="panel__actions">
        <button onClick={onCreate}>New</button>
        <button onClick={onStart} disabled={!activeInstanceId}>
          Start
        </button>
        <button onClick={onStop} disabled={!activeInstanceId}>
          Stop
        </button>
        <button onClick={onDelete} disabled={!activeInstanceId}>
          Delete
        </button>
      </div>
      <div className="instance-list">
        {instances.map((instance) => (
          <button
            key={instance.id}
            className={instance.id === activeInstanceId ? "instance-item instance-item--active" : "instance-item"}
            onClick={() => onSelect(instance.id)}
          >
            <strong>{instance.name}</strong>
            <span>{instance.status}</span>
            <small>{instance.cwd}</small>
          </button>
        ))}
      </div>
    </section>
  );
};
