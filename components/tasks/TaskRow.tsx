import { Project, Task } from "../../types/task";
import { StatusCheckbox } from "./StatusCheckbox";

export function TaskRow({
  task,
  projects,
  active,
  onSelect,
  onToggleDone,
}: {
  task: Task;
  projects: Project[];
  active: boolean;
  onSelect: () => void;
  onToggleDone: () => void;
}) {
  const isDone = task.status === "done";
  const project = task.project_id
    ? projects.find((p) => p.id === task.project_id)?.name || "No Project"
    : "No Project";

  return (
    <div className={`task-row ${active ? "task-row-active" : ""}`}>
      <div className="task-row-grid">
        <div style={{ paddingTop: 2 }}>
          <StatusCheckbox checked={isDone} onChange={onToggleDone} />
        </div>

        <div
          onClick={onSelect}
          style={{ cursor: "pointer", minWidth: 0 }}
        >
          <div className={`task-title ${isDone ? "task-title-done" : ""}`}>
            {task.title}
          </div>
          <div className="task-meta">
            {project} · {task.priority} · {task.context} · Due: {task.due_date || "N/A"}
            {task.estimated_minutes !== null ? ` · ${task.estimated_minutes} min` : ""}
            {task.must_do_today ? " · Must today" : ""}
          </div>
        </div>

        <div
          className="badge-row"
          style={{ marginTop: 0, justifyContent: "flex-end" }}
          onClick={onSelect}
        >
          {task.status !== "done" ? (
            <div className="badge">{task.status}</div>
          ) : (
            <div className="badge">done</div>
          )}
          {task.is_quick_task ? <div className="badge">Quick</div> : null}
        </div>
      </div>
    </div>
  );
}