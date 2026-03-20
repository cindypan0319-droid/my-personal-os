"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Project, Task } from "../../types/task";

export default function TimelinePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });

  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");

  const loadData = async () => {
    setLoading(true);

    const { data: taskData, error: taskError } = await supabase
      .from("tasks")
      .select("*");

    const { data: projectData, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (taskError) console.error("Load tasks error:", taskError.message);
    if (projectError) console.error("Load projects error:", projectError.message);

    setTasks((taskData as Task[]) || []);
    setProjects((projectData as Project[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const getProjectName = (projectId: number | null) => {
    if (projectId === null) return "No Project";
    const project = projects.find((item) => item.id === projectId);
    return project ? project.name : "No Project";
  };

  const timelineTasks = useMemo(() => {
    return [...tasks]
      .filter(
        (task) =>
          task.status !== "done" &&
          task.scheduled_date === selectedDate &&
          task.start_time &&
          task.end_time
      )
      .sort((a, b) => {
        return (a.start_time || "").localeCompare(b.start_time || "");
      });
  }, [tasks, selectedDate]);

  const unscheduledTasks = useMemo(() => {
    return [...tasks]
      .filter((task) => {
        if (task.status === "done") return false;

        const isRelatedToDay =
          task.scheduled_date === selectedDate || task.due_date === selectedDate;

        const hasNoTimeSlot = !task.start_time || !task.end_time;

        return isRelatedToDay && hasNoTimeSlot;
      })
      .sort((a, b) => {
        const aMust = a.must_do_today ? 1 : 0;
        const bMust = b.must_do_today ? 1 : 0;
        if (aMust !== bMust) return bMust - aMust;

        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const diff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (diff !== 0) return diff;

        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        if (a.due_date && !b.due_date) return -1;
        if (!a.due_date && b.due_date) return 1;

        return a.title.localeCompare(b.title);
      });
  }, [tasks, selectedDate]);

  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let hour = 6; hour <= 22; hour++) {
      const label = `${String(hour).padStart(2, "0")}:00`;
      slots.push(label);
    }
    return slots;
  }, []);

  const getTasksStartingAt = (time: string) => {
    return timelineTasks.filter((task) => task.start_time?.slice(0, 5) === time);
  };

  const startEditTime = (task: Task) => {
    setEditingTaskId(task.id);
    setEditStartTime(task.start_time || "");
    setEditEndTime(task.end_time || "");
  };

  const cancelEditTime = () => {
    setEditingTaskId(null);
    setEditStartTime("");
    setEditEndTime("");
  };

  const saveTaskTime = async (taskId: number) => {
    const { error } = await supabase
      .from("tasks")
      .update({
        scheduled_date: selectedDate,
        start_time: editStartTime || null,
        end_time: editEndTime || null,
      })
      .eq("id", taskId);

    if (error) {
      alert("保存时间失败：" + error.message);
      return;
    }

    cancelEditTime();
    loadData();
  };

  const clearTaskTime = async (taskId: number) => {
    const { error } = await supabase
      .from("tasks")
      .update({
        start_time: null,
        end_time: null,
      })
      .eq("id", taskId);

    if (error) {
      alert("清除时间失败：" + error.message);
      return;
    }

    loadData();
  };

  const markDone = async (taskId: number) => {
    const { error } = await supabase
      .from("tasks")
      .update({ status: "done" })
      .eq("id", taskId);

    if (error) {
      alert("修改状态失败：" + error.message);
      return;
    }

    loadData();
  };

  const moveToDoing = async (taskId: number) => {
    const { error } = await supabase
      .from("tasks")
      .update({ status: "doing" })
      .eq("id", taskId);

    if (error) {
      alert("修改状态失败：" + error.message);
      return;
    }

    loadData();
  };

  if (loading) {
    return (
      <div className="page-wrap">
        <div className="panel card-pad">Loading timeline...</div>
      </div>
    );
  }

  return (
    <div className="page-wrap">
      <header className="page-header">
        <div className="page-kicker">Timeline</div>
        <h1 className="page-title">Daily Timeline</h1>
        <div className="page-desc">
          把任务排进一天的时间块里，适合课、会议和深度工作。
        </div>
      </header>

      <section className="panel card-pad" style={{ marginBottom: 12 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 600 }}>
            Selected date: {selectedDate}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ padding: "10px 12px" }}
            />
            <button
              className="secondary-btn"
              onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])}
            >
              Today
            </button>
          </div>
        </div>
      </section>

      <section className="tight-grid-2">
        <div className="panel card-pad">
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>
            Timeline
          </div>

          <div className="tight-grid">
            {timeSlots.map((time) => {
              const items = getTasksStartingAt(time);

              return (
                <div
                  key={time}
                  className="panel-soft card-pad"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "68px 1fr",
                    gap: 10,
                    alignItems: "start",
                  }}
                >
                  <div
                    className="text-muted"
                    style={{ fontSize: 12, fontWeight: 600, paddingTop: 4 }}
                  >
                    {time}
                  </div>

                  <div className="tight-grid">
                    {items.length === 0 ? (
                      <div className="text-muted" style={{ fontSize: 13 }}>
                        —
                      </div>
                    ) : (
                      items.map((task) => (
                        <div key={task.id} className="panel card-pad">
                          <div style={{ fontSize: 14, fontWeight: 600 }}>
                            {task.title}
                          </div>

                          <div className="task-meta">
                            {task.start_time || "--"} - {task.end_time || "--"} ·{" "}
                            {getProjectName(task.project_id)}
                          </div>

                          <div className="badge-row">
                            <div className="badge">Status: {task.status}</div>
                            <div className="badge">Priority: {task.priority}</div>
                            <div className="badge">
                              Time:{" "}
                              {task.estimated_minutes !== null
                                ? `${task.estimated_minutes} min`
                                : "N/A"}
                            </div>
                            <div className="badge">
                              Energy: {task.energy_level || "N/A"}
                            </div>
                            {task.must_do_today && <div className="badge">Must Today</div>}
                          </div>

                          {editingTaskId !== task.id ? (
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 8,
                                marginTop: 10,
                              }}
                            >
                              <button
                                onClick={() => startEditTime(task)}
                                className="blue-btn"
                              >
                                Edit time
                              </button>
                              <button
                                onClick={() => clearTaskTime(task.id)}
                                className="secondary-btn"
                              >
                                Clear time
                              </button>
                              <button
                                onClick={() => moveToDoing(task.id)}
                                className="secondary-btn"
                              >
                                Doing
                              </button>
                              <button
                                onClick={() => markDone(task.id)}
                                className="primary-btn"
                              >
                                Done
                              </button>
                            </div>
                          ) : (
                            <div className="tight-grid" style={{ marginTop: 10 }}>
                              <div className="tight-grid-2">
                                <input
                                  type="time"
                                  value={editStartTime}
                                  onChange={(e) => setEditStartTime(e.target.value)}
                                  style={{ padding: "10px 12px" }}
                                />
                                <input
                                  type="time"
                                  value={editEndTime}
                                  onChange={(e) => setEditEndTime(e.target.value)}
                                  style={{ padding: "10px 12px" }}
                                />
                              </div>

                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <button
                                  onClick={() => saveTaskTime(task.id)}
                                  className="primary-btn"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={cancelEditTime}
                                  className="secondary-btn"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel card-pad">
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>
            Unscheduled Tasks For This Day
          </div>

          <div className="tight-grid">
            {unscheduledTasks.length === 0 ? (
              <div className="panel-soft card-pad text-muted">
                这一天没有未排时间的相关任务。
              </div>
            ) : (
              unscheduledTasks.map((task) => (
                <div key={task.id} className="panel-soft card-pad">
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{task.title}</div>

                  <div className="task-meta">
                    {getProjectName(task.project_id)} · {task.priority} · {task.context}
                  </div>

                  <div className="badge-row">
                    <div className="badge">Due: {task.due_date || "N/A"}</div>
                    <div className="badge">
                      Scheduled: {task.scheduled_date || "N/A"}
                    </div>
                    <div className="badge">
                      Time:{" "}
                      {task.estimated_minutes !== null
                        ? `${task.estimated_minutes} min`
                        : "N/A"}
                    </div>
                    <div className="badge">Energy: {task.energy_level || "N/A"}</div>
                    {task.must_do_today && <div className="badge">Must Today</div>}
                  </div>

                  {(task.reference_link || task.notes) && (
                    <div className="notes-box">
                      {task.reference_link && (
                        <div style={{ marginBottom: task.notes ? 8 : 0 }}>
                          <span style={{ fontWeight: 600 }}>Link:</span>{" "}
                          <a
                            href={task.reference_link}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              color: "var(--blue-text)",
                              textDecoration: "underline",
                              wordBreak: "break-all",
                            }}
                          >
                            {task.reference_link}
                          </a>
                        </div>
                      )}
                      {task.notes && (
                        <div style={{ whiteSpace: "pre-wrap" }}>
                          <span style={{ fontWeight: 600 }}>Notes:</span> {task.notes}
                        </div>
                      )}
                    </div>
                  )}

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      marginTop: 10,
                    }}
                  >
                    <button
                      onClick={() => {
                        setEditingTaskId(task.id);
                        setEditStartTime(task.start_time || "");
                        setEditEndTime(task.end_time || "");
                      }}
                      className="blue-btn"
                    >
                      Assign time
                    </button>
                    <button
                      onClick={() => moveToDoing(task.id)}
                      className="secondary-btn"
                    >
                      Doing
                    </button>
                    <button
                      onClick={() => markDone(task.id)}
                      className="primary-btn"
                    >
                      Done
                    </button>
                  </div>

                  {editingTaskId === task.id && (
                    <div className="tight-grid" style={{ marginTop: 10 }}>
                      <div className="tight-grid-2">
                        <input
                          type="time"
                          value={editStartTime}
                          onChange={(e) => setEditStartTime(e.target.value)}
                          style={{ padding: "10px 12px" }}
                        />
                        <input
                          type="time"
                          value={editEndTime}
                          onChange={(e) => setEditEndTime(e.target.value)}
                          style={{ padding: "10px 12px" }}
                        />
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          onClick={() => saveTaskTime(task.id)}
                          className="primary-btn"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelEditTime}
                          className="secondary-btn"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}