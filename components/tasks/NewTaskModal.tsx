"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { DurationUnit, Project, durationToMinutes } from "../../types/task";

type Props = {
  open: boolean;
  projects: Project[];
  onClose: () => void;
  onCreated: () => Promise<void> | void;
};

export function NewTaskModal({ open, projects, onClose, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [context, setContext] = useState("general");
  const [projectId, setProjectId] = useState<string>("");
  const [dueDate, setDueDate] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [isQuickTask, setIsQuickTask] = useState(false);
  const [mustDoToday, setMustDoToday] = useState(false);
  const [durationValue, setDurationValue] = useState("1");
  const [durationUnit, setDurationUnit] = useState<DurationUnit>("days");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setNotes("");
    setPriority("medium");
    setContext("general");
    setProjectId("");
    setDueDate("");
    setScheduledDate("");
    setIsQuickTask(false);
    setMustDoToday(false);
    setDurationValue("1");
    setDurationUnit("days");
    setSaving(false);
  }, [open]);

  if (!open) return null;

  const createTask = async () => {
    if (!title.trim()) {
      alert("Task title is required");
      return;
    }

    setSaving(true);

    const parsedDuration = durationValue.trim() ? Number(durationValue) : null;

    const { error } = await supabase.from("tasks").insert({
      title: title.trim(),
      description: description.trim() || null,
      notes: notes.trim() || null,
      status: "todo",
      priority,
      context: context.trim() || "general",
      due_date: dueDate || null,
      scheduled_date: scheduledDate || null,
      start_time: null,
      end_time: null,
      project_id: projectId ? Number(projectId) : null,
      user_id: null,
      is_quick_task: isQuickTask,
      must_do_today: mustDoToday,
      is_active: true,
      duration_input_value: parsedDuration,
      duration_input_unit: durationUnit,
      estimated_minutes: durationToMinutes(parsedDuration, durationUnit),
      reference_link: null,
      recurring_enabled: false,
      recurring_type: null,
      recurring_interval: null,
      recurring_days_of_week: null,
      energy_level: null,
    });

    setSaving(false);

    if (error) {
      alert("Create task failed: " + error.message);
      return;
    }

    await onCreated();
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.38)",
        zIndex: 60,
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <div
        className="panel card-pad"
        style={{
          width: "min(780px, 100%)",
          maxHeight: "90vh",
          overflow: "auto",
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 14 }}>Create New Task</div>

        <div className="tight-grid">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={3} />
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" rows={4} />

          <div className="tight-grid-2">
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">No Project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>

            <select value={priority} onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high")}>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </div>

          <div className="tight-grid-2">
            <input value={context} onChange={(e) => setContext(e.target.value)} placeholder="Context" />
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

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={isQuickTask} onChange={(e) => setIsQuickTask(e.target.checked)} />
              Quick task
            </label>

            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={mustDoToday} onChange={(e) => setMustDoToday(e.target.checked)} />
              Must do today
            </label>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <button className="primary-btn" onClick={createTask} disabled={saving}>
              {saving ? "Saving..." : "Create"}
            </button>
            <button className="secondary-btn" onClick={onClose} disabled={saving}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}