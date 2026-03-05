interface TaskItem {
  key: string;
  title: string;
  status: string;
  progress: number;
  blockedBy: string[];
}

interface TasksPanelProps {
  tasks: TaskItem[];
}

const toPercent = (value: number): string => `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;

export const TasksPanel = ({ tasks }: TasksPanelProps) => {
  return (
    <box border borderColor="gray" padding={1} flexGrow={1} flexDirection="column" title="tasks">
      <scrollbox flexGrow={1} stickyScroll stickyStart="top">
        <box flexDirection="column">
          {tasks.length === 0 ? <text fg="gray">(no tasks)</text> : null}
          {tasks.map((task) => (
            <box key={task.key} marginTop={1} flexDirection="column">
              <text>
                {task.title} [{task.status}] {toPercent(task.progress)}
              </text>
              <text fg={task.blockedBy.length > 0 ? "yellow" : "green"}>blockedBy: {task.blockedBy.length}</text>
            </box>
          ))}
        </box>
      </scrollbox>
    </box>
  );
};
