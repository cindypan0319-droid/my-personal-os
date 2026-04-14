"use client";

import { Project, Task, formatDuration } from "../../types/task";

type Props = {
  task: Task;
  projects: Project[];
  active: boolean;
  onSelect: () => void;
  onToggleDone: () => void;
};

export function TaskRow({ task, projects, active, onSelect, onToggleDone }: Props) {
  const projectName =
    task.project_id == null
      ? "No Project"
      : projects.find((p) => p.id === task.project_id)?.name || "No Project";

  const isDone = task.status === "done";

  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        width: "100%",
        textAlign: "left",
        border: active ? "1px solid var(--primary)" : "1px solid var(--border)",
        background: active ? "rgba(33, 150, 243, 0.06)" : "#fff",
        borderRadius: 16,
        padding: 14,
        opacity: isDone ? 0.68 : 1,
        cursor: "pointer",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              textDecoration: isDone ? "line-through" : "none",
              color: isDone ? "var(--muted)" : "var(--text)",
            }}
          >
            {task.title}
          </div>

          {task.description ? (
            <div
              className="task-meta"
              style={{
                marginTop: 6,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical" as const,
                overflow: "hidden",
              }}
            >
              {task.description}
            </div>
          ) : null}

          <div className="task-meta" style={{ marginTop: 8 }}>
            {projectName} · {task.priority} · {task.context || "general"}
          </div>

          <div className="badge-row" style={{ marginTop: 10 }}>
            {task.is_quick_task ? <div className="badge">quick</div> : null}
            {task.must_do_today ? <div className="badge">must today</div> : null}
            {task.due_date ? <div className="badge">due {task.due_date}</div> : null}
            {task.scheduled_date ? <div className="badge">scheduled {task.scheduled_date}</div> : null}
            <div className="badge">{formatDuration(task)}</div>
            {!task.is_active ? <div className="badge">inactive</div> : null}
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleDone();
          }}
          className={isDone ? "secondary-btn" : "primary-btn"}
        >
          {isDone ? "Undo" : "Done"}
        </button>
      </div>
    </button>
  );
}