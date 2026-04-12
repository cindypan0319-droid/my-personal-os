"use client";

import { useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  EnergyLevel,
  Project,
  TaskContext,
  TaskPriority,
  TaskStatus,
} from "../../types/task";

export function NewTaskModal({
  open,
  projects,
  onClose,
  onCreated,
}: {
  open: boolean;
  projects: Project[];
  onClose: () => void;
  onCreated: () => Promise<void> | void;
}) {
  const initialState = useMemo(
    () => ({
      title: "",
      status: "todo" as TaskStatus,
      priority: "medium" as TaskPriority,
      context: "home" as TaskContext,
      due_date: "",
      project_id: "",
      is_quick_task: false,
      estimated_minutes: "",
      notes: "",
      reference_link: "",
      scheduled_date: "",
      start_time: "",
      end_time: "",
      recurring_enabled: false,
      energy_level: "" as EnergyLevel | "",
      must_do_today: false,
      advanced: false,
    }),
    []
  );

  const [form, setForm] = useState(initialState);

  if (!open) return null;

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async () => {
    if (!form.title.trim()) {
      alert("Task title is required");
      return;
    }

    const { error } = await supabase.from("tasks").insert({
      title: form.title.trim(),
      status: form.status,
      priority: form.priority,
      context: form.context,
      due_date: form.due_date || null,
      project_id: form.project_id ? Number(form.project_id) : null,
      is_quick_task: form.is_quick_task,
      estimated_minutes: form.estimated_minutes ? Number(form.estimated_minutes) : null,
      notes: form.notes || null,
      reference_link: form.reference_link || null,
      scheduled_date: form.scheduled_date || null,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      recurring_enabled: false,
      recurring_type: null,
      recurring_interval: null,
      recurring_days_of_week: null,
      energy_level: form.energy_level || null,
      must_do_today: form.must_do_today,
      user_id: null,
    });

    if (error) {
      alert("Create task failed: " + error.message);
      return;
    }

    setForm(initialState);
    await onCreated();
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="card-pad tight-grid">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div>
              <div className="page-kicker">Tasks</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>New Task</div>
            </div>
            <button className="ghost-btn" onClick={onClose}>
              Close
            </button>
          </div>

          <input
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="Task title"
          />

          <div className="tight-grid-2">
            <select
              value={form.status}
              onChange={(e) => update("status", e.target.value as TaskStatus)}
            >
              <option value="inbox">inbox</option>
              <option value="todo">todo</option>
              <option value="doing">doing</option>
              <option value="done">done</option>
            </select>

            <select
              value={form.priority}
              onChange={(e) => update("priority", e.target.value as TaskPriority)}
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>

            <select
              value={form.context}
              onChange={(e) => update("context", e.target.value as TaskContext)}
            >
              <option value="home">home</option>
              <option value="computer">computer</option>
              <option value="shop">shop</option>
              <option value="outside">outside</option>
            </select>

            <select value={form.project_id} onChange={(e) => update("project_id", e.target.value)}>
              <option value="">No Project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={form.due_date}
              onChange={(e) => update("due_date", e.target.value)}
            />

            <input
              type="number"
              value={form.estimated_minutes}
              onChange={(e) => update("estimated_minutes", e.target.value)}
              placeholder="Estimated minutes"
            />
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={form.is_quick_task}
                onChange={(e) => update("is_quick_task", e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              Quick task
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={form.must_do_today}
                onChange={(e) => update("must_do_today", e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              Must do today
            </label>

            <button className="secondary-btn" onClick={() => update("advanced", !form.advanced)}>
              {form.advanced ? "Hide advanced" : "More options"}
            </button>
          </div>

          {form.advanced ? (
            <div className="tight-grid">
              <div className="tight-grid-2">
                <input
                  type="date"
                  value={form.scheduled_date}
                  onChange={(e) => update("scheduled_date", e.target.value)}
                />

                <select
                value={form.energy_level ?? ""}
                onChange={(e) =>
                    update("energy_level", (e.target.value || null) as EnergyLevel | "")
                }
                >
                <option value="">Energy level</option>
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
                </select>

                <input
                  type="time"
                  value={form.start_time}
                  onChange={(e) => update("start_time", e.target.value)}
                />

                <input
                  type="time"
                  value={form.end_time}
                  onChange={(e) => update("end_time", e.target.value)}
                />
              </div>

              <input
                value={form.reference_link}
                onChange={(e) => update("reference_link", e.target.value)}
                placeholder="Reference link"
              />

              <textarea
                rows={4}
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                placeholder="Notes"
              />
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <button className="secondary-btn" onClick={onClose}>
              Cancel
            </button>
            <button className="primary-btn" onClick={submit}>
              Create Task
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}