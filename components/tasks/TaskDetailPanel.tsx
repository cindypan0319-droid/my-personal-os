"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { DurationUnit, Project, Task, durationToMinutes, formatDuration } from "../../types/task";

type Props = {
  task: Task | null;
  projects: Project[];
  onUpdated: () => Promise<void> | void;
  onDeleted: () => Promise<void> | void;
};

export function TaskDetailPanel({ task, projects, onUpdated, onDeleted }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [context, setContext] = useState("general");
  const [status, setStatus] = useState<"inbox" | "todo" | "doing" | "done" | "inactive">("todo");
  const [projectId, setProjectId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isQuickTask, setIsQuickTask] = useState(false);
  const [mustDoToday, setMustDoToday] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [durationValue, setDurationValue] = useState("1");
  const [durationUnit, setDurationUnit] = useState<DurationUnit>("days");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title || "");
    setDescription(task.description || "");
    setNotes(task.notes || "");
    setPriority(task.priority || "medium");
    setContext(task.context || "general");
    setStatus(task.status || "todo");
    setProjectId(task.project_id == null ? "" : String(task.project_id));
    setDueDate(task.due_date || "");
    setScheduledDate(task.scheduled_date || "");
    setStartTime(task.start_time || "");
    setEndTime(task.end_time || "");
    setIsQuickTask(!!task.is_quick_task);
    setMustDoToday(!!task.must_do_today);
    setIsActive(task.is_active !== false);

    if (task.duration_input_value != null && task.duration_input_unit) {
      setDurationValue(String(task.duration_input_value));
      setDurationUnit(task.duration_input_unit);
    } else {
      setDurationValue(task.estimated_minutes ? String(task.estimated_minutes / 60) : "1");
      setDurationUnit("hours");
    }
  }, [task]);

  const headerMeta = useMemo(() => {
    if (!task) return "";
    return `${task.priority} · ${task.status} · ${formatDuration(task)}`;
  }, [task]);

  if (!task) {
    return (
      <aside className="panel card-pad">
        <div className="empty-state">Select a task to see details.</div>
      </aside>
    );
  }

  const saveTask = async () => {
    if (!title.trim()) {
      alert("Task title is required");
      return;
    }

    setSaving(true);

    const parsedDuration = durationValue.trim() ? Number(durationValue) : null;

    const { error } = await supabase
      .from("tasks")
      .update({
        title: title.trim(),
        description: description.trim() || null,
        notes: notes.trim() || null,
        priority,
        context: context.trim() || "general",
        status,
        project_id: projectId ? Number(projectId) : null,
        due_date: dueDate || null,
        scheduled_date: scheduledDate || null,
        start_time: startTime || null,
        end_time: endTime || null,
        is_quick_task: isQuickTask,
        must_do_today: mustDoToday,
        is_active: isActive,
        duration_input_value: parsedDuration,
        duration_input_unit: durationUnit,
        estimated_minutes: durationToMinutes(parsedDuration, durationUnit),
      })
      .eq("id", task.id);

    setSaving(false);

    if (error) {
      alert("Save task failed: " + error.message);
      return;
    }

    await onUpdated();
  };

  const deleteTask = async () => {
    const ok = window.confirm("Delete this task?");
    if (!ok) return;

    const { error } = await supabase.from("tasks").delete().eq("id", task.id);

    if (error) {
      alert("Delete task failed: " + error.message);
      return;
    }

    await onDeleted();
  };

  return (
    <aside
      className="panel card-pad"
      style={{
        position: "sticky",
        top: 16,
        alignSelf: "start",
        maxHeight: "calc(100vh - 32px)",
        overflow: "auto",
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 700 }}>{task.title}</div>
      <div className="task-meta" style={{ marginTop: 6, marginBottom: 16 }}>
        {headerMeta}
      </div>

      <div className="tight-grid">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={3} />
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" rows={5} />

        <div className="tight-grid-2">
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">No Project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>

          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="inbox">inbox</option>
            <option value="todo">todo</option>
            <option value="doing">doing</option>
            <option value="done">done</option>
            <option value="inactive">inactive</option>
          </select>
        </div>

        <div className="tight-grid-2">
          <select value={priority} onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high")}>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>

          <input value={context} onChange={(e) => setContext(e.target.value)} placeholder="Context" />
        </div>

        <div className="tight-grid-2">
          <label>
            <div className="task-meta" style={{ marginBottom: 6 }}>Due date</div>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
          <label>
            <div className="task-meta" style={{ marginBottom: 6 }}>Scheduled date</div>
            <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
          </label>
        </div>

        <div className="tight-grid-2">
          <label>
            <div className="task-meta" style={{ marginBottom: 6 }}>Start time</div>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </label>
          <label>
            <div className="task-meta" style={{ marginBottom: 6 }}>End time</div>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </label>
        </div>

        <div className="tight-grid-2">
          <input
            value={durationValue}
            onChange={(e) => setDurationValue(e.target.value)}
            placeholder="Duration"
            inputMode="decimal"
          />
          <select value={durationUnit} onChange={(e) => setDurationUnit(e.target.value as DurationUnit)}>
            <option value="hours">hours</option>
            <option value="days">days</option>
            <option value="weeks">weeks</option>
            <option value="months">months</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" checked={isQuickTask} onChange={(e) => setIsQuickTask(e.target.checked)} />
            Quick task
          </label>

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" checked={mustDoToday} onChange={(e) => setMustDoToday(e.target.checked)} />
            Must do today
          </label>

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active
          </label>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          <button className="primary-btn" onClick={saveTask} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
          <button className="danger-btn" onClick={deleteTask} disabled={saving}>
            Delete
          </button>
        </div>
      </div>
    </aside>
  );
}