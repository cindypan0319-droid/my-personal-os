"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  EnergyLevel,
  Project,
  RecurringType,
  Task,
  TaskContext,
  TaskPriority,
  TaskStatus,
} from "../../types/task";

export function TaskDetailPanel({
  task,
  projects,
  onUpdated,
  onDeleted,
}: {
  task: Task | null;
  projects: Project[];
  onUpdated: () => Promise<void> | void;
  onDeleted: () => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Task | null>(task);

  useEffect(() => {
    setForm(task);
    setEditing(false);
  }, [task?.id]);

  if (!task || !form) {
    return (
      <aside className="panel card-pad task-detail">
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Details</div>
        <div className="panel-soft card-pad empty-state">Select a task to view details.</div>
      </aside>
    );
  }

  const updateField = <K extends keyof Task>(key: K, value: Task[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const save = async () => {
    const { error } = await supabase
      .from("tasks")
      .update({
        title: form.title,
        status: form.status,
        priority: form.priority,
        context: form.context,
        due_date: form.due_date || null,
        project_id: form.project_id,
        is_quick_task: form.is_quick_task,
        estimated_minutes: form.estimated_minutes,
        notes: form.notes || null,
        reference_link: form.reference_link || null,
        scheduled_date: form.scheduled_date || null,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        recurring_enabled: form.recurring_enabled,
        recurring_type: form.recurring_enabled ? form.recurring_type : null,
        recurring_interval: form.recurring_enabled ? form.recurring_interval : null,
        recurring_days_of_week:
          form.recurring_enabled && form.recurring_type === "weekly"
            ? form.recurring_days_of_week
            : null,
        energy_level: form.energy_level || null,
        must_do_today: form.must_do_today,
      })
      .eq("id", task.id);

    if (error) {
      alert("保存任务失败：" + error.message);
      return;
    }

    setEditing(false);
    await onUpdated();
  };

  const remove = async () => {
    const ok = window.confirm("Delete this task?");
    if (!ok) return;

    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    if (error) {
      alert("删除任务失败：" + error.message);
      return;
    }

    await onDeleted();
  };

  return (
    <aside className="panel card-pad task-detail">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700 }}>Details</div>
        {!editing ? (
          <button className="blue-btn" onClick={() => setEditing(true)}>
            Edit
          </button>
        ) : (
          <button
            className="secondary-btn"
            onClick={() => {
              setForm(task);
              setEditing(false);
            }}
          >
            Cancel
          </button>
        )}
      </div>

      {!editing ? (
        <div className="tight-grid">
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{task.title}</div>
            <div className="task-meta" style={{ marginTop: 6 }}>
              {task.status} · {task.priority} · {task.context}
            </div>
          </div>

          <div className="panel-soft card-pad">
            <div className="text-muted" style={{ fontSize: 12 }}>
              Project
            </div>
            <div style={{ marginTop: 4 }}>
              {task.project_id
                ? projects.find((p) => p.id === task.project_id)?.name || "No Project"
                : "No Project"}
            </div>
          </div>

          <div className="tight-grid-2">
            <div className="panel-soft card-pad">
              <div className="text-muted" style={{ fontSize: 12 }}>
                Due Date
              </div>
              <div style={{ marginTop: 4 }}>{task.due_date || "N/A"}</div>
            </div>
            <div className="panel-soft card-pad">
              <div className="text-muted" style={{ fontSize: 12 }}>
                Estimate
              </div>
              <div style={{ marginTop: 4 }}>
                {task.estimated_minutes !== null ? `${task.estimated_minutes} min` : "N/A"}
              </div>
            </div>
          </div>

          <div className="panel-soft card-pad">
            <div className="text-muted" style={{ fontSize: 12 }}>
              Schedule
            </div>
            <div style={{ marginTop: 4 }}>
              {task.scheduled_date || "N/A"}
              {task.start_time || task.end_time
                ? ` · ${task.start_time || "--"} - ${task.end_time || "--"}`
                : ""}
            </div>
          </div>

          <div className="badge-row" style={{ marginTop: 0 }}>
            {task.energy_level ? <div className="badge">Energy: {task.energy_level}</div> : null}
            {task.must_do_today ? <div className="badge">Must today</div> : null}
            {task.is_quick_task ? <div className="badge">Quick</div> : null}
            {task.recurring_enabled ? (
              <div className="badge">Repeat: {task.recurring_type || "yes"}</div>
            ) : null}
          </div>

          <div className="panel-soft card-pad">
            <div className="text-muted" style={{ fontSize: 12 }}>
              Reference Link
            </div>
            <div style={{ marginTop: 4 }}>
              {task.reference_link ? (
                <a
                  href={task.reference_link}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    color: "var(--primary)",
                    textDecoration: "underline",
                    wordBreak: "break-all",
                  }}
                >
                  {task.reference_link}
                </a>
              ) : (
                "N/A"
              )}
            </div>
          </div>

          <div className="panel-soft card-pad">
            <div className="text-muted" style={{ fontSize: 12 }}>
              Notes
            </div>
            <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>
              {task.notes || "No notes"}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="danger-btn" onClick={remove}>
              Delete
            </button>
          </div>
        </div>
      ) : (
        <div className="tight-grid">
          <input
            value={form.title}
            onChange={(e) => updateField("title", e.target.value)}
            placeholder="Task title"
          />

          <div className="tight-grid-2">
            <select
              value={form.status}
              onChange={(e) => updateField("status", e.target.value as TaskStatus)}
            >
              <option value="inbox">inbox</option>
              <option value="todo">todo</option>
              <option value="doing">doing</option>
              <option value="done">done</option>
            </select>

            <select
              value={form.priority}
              onChange={(e) => updateField("priority", e.target.value as TaskPriority)}
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>

            <select
              value={form.context}
              onChange={(e) => updateField("context", e.target.value as TaskContext)}
            >
              <option value="home">home</option>
              <option value="computer">computer</option>
              <option value="shop">shop</option>
              <option value="outside">outside</option>
            </select>

            <select
              value={form.project_id ?? ""}
              onChange={(e) =>
                updateField("project_id", e.target.value ? Number(e.target.value) : null)
              }
            >
              <option value="">No Project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={form.due_date || ""}
              onChange={(e) => updateField("due_date", e.target.value || null)}
            />

            <input
              type="number"
              value={form.estimated_minutes ?? ""}
              onChange={(e) =>
                updateField("estimated_minutes", e.target.value ? Number(e.target.value) : null)
              }
              placeholder="Estimated minutes"
            />

            <input
              type="date"
              value={form.scheduled_date || ""}
              onChange={(e) => updateField("scheduled_date", e.target.value || null)}
            />

            <div className="tight-grid-2">
              <input
                type="time"
                value={form.start_time || ""}
                onChange={(e) => updateField("start_time", e.target.value || null)}
              />
              <input
                type="time"
                value={form.end_time || ""}
                onChange={(e) => updateField("end_time", e.target.value || null)}
              />
            </div>

            <select
              value={form.energy_level || ""}
              onChange={(e) =>
                updateField("energy_level", (e.target.value || null) as EnergyLevel | null)
              }
            >
              <option value="">Energy level</option>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </div>

          <input
            value={form.reference_link || ""}
            onChange={(e) => updateField("reference_link", e.target.value || null)}
            placeholder="Reference link"
          />

          <textarea
            rows={4}
            value={form.notes || ""}
            onChange={(e) => updateField("notes", e.target.value || null)}
            placeholder="Notes"
          />

          <div className="tight-grid-2">
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                <input
                type="checkbox"
                checked={!!form.is_quick_task}
                onChange={(e) => updateField("is_quick_task", e.target.checked)}
                style={{ width: 16, height: 16 }}
                />
                Quick task
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                <input
                type="checkbox"
                checked={!!form.must_do_today}
                onChange={(e) => updateField("must_do_today", e.target.checked)}
                style={{ width: 16, height: 16 }}
                />
                Must do today
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                <input
                type="checkbox"
                checked={!!form.recurring_enabled}
                onChange={(e) => {
                    updateField("recurring_enabled", e.target.checked);
                    if (!e.target.checked) {
                    updateField("recurring_type", null as RecurringType);
                    updateField("recurring_interval", null);
                    updateField("recurring_days_of_week", null);
                    }
                }}
                style={{ width: 16, height: 16 }}
                />
                Recurring
            </label>
            </div>

          {form.recurring_enabled ? (
            <div className="tight-grid-2">
              <select
                value={form.recurring_type || ""}
                onChange={(e) =>
                  updateField("recurring_type", (e.target.value || null) as RecurringType)
                }
              >
                <option value="">Recurring type</option>
                <option value="daily">daily</option>
                <option value="weekly">weekly</option>
                <option value="monthly">monthly</option>
              </select>
              <input
                type="number"
                value={form.recurring_interval ?? ""}
                onChange={(e) =>
                  updateField("recurring_interval", e.target.value ? Number(e.target.value) : null)
                }
                placeholder="Recurring interval"
              />
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="primary-btn" onClick={save}>
              Save
            </button>
            <button className="danger-btn" onClick={remove}>
              Delete
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}