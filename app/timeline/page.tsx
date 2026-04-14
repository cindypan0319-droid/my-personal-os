"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { PageHeader } from "../../components/app/PageHeader";
import { Project, Task, formatDuration } from "../../types/task";

export default function TimelinePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() =>
    new Date().toISOString().split("T")[0]
  );
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");

  const loadData = async () => {
    setLoading(true);

    const { data: taskData, error: taskError } = await supabase.from("tasks").select("*");
    const { data: projectData, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (taskError) console.error(taskError.message);
    if (projectError) console.error(projectError.message);

    setTasks((taskData as Task[]) || []);
    setProjects((projectData as Project[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const todayStr = new Date().toISOString().split("T")[0];

  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let hour = 6; hour <= 22; hour++) {
      slots.push(`${String(hour).padStart(2, "0")}:00`);
    }
    return slots;
  }, []);

  const visibleTasks = useMemo(
    () => tasks.filter((task) => task.is_active !== false && task.status !== "done"),
    [tasks]
  );

  const timelineTasks = useMemo(() => {
    return [...visibleTasks]
      .filter(
        (task) =>
          task.scheduled_date === selectedDate &&
          task.start_time &&
          task.end_time
      )
      .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
  }, [visibleTasks, selectedDate]);

  const taskPool = useMemo(() => {
    return [...visibleTasks]
      .filter((task) => {
        const noSlot = !task.start_time || !task.end_time;
        const matchesDay =
          task.scheduled_date === selectedDate ||
          task.due_date === selectedDate ||
          !!task.must_do_today ||
          (selectedDate === todayStr && !!task.is_quick_task);

        return matchesDay && noSlot;
      })
      .sort((a, b) => {
        const aQuick = a.is_quick_task ? 1 : 0;
        const bQuick = b.is_quick_task ? 1 : 0;
        if (aQuick !== bQuick) return bQuick - aQuick;

        const aMust = a.must_do_today ? 1 : 0;
        const bMust = b.must_do_today ? 1 : 0;
        if (aMust !== bMust) return bMust - aMust;

        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
  }, [visibleTasks, selectedDate, todayStr]);

  const getProjectName = (projectId: number | null) => {
    if (projectId === null) return "No Project";
    return projects.find((p) => p.id === projectId)?.name || "No Project";
  };

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
    await loadData();
  };

  const clearTaskTime = async (taskId: number) => {
    const { error } = await supabase
      .from("tasks")
      .update({ start_time: null, end_time: null })
      .eq("id", taskId);

    if (error) {
      alert("清除时间失败：" + error.message);
      return;
    }

    await loadData();
  };

  const markDone = async (taskId: number) => {
    const { error } = await supabase.from("tasks").update({ status: "done" }).eq("id", taskId);
    if (error) {
      alert("修改状态失败：" + error.message);
      return;
    }
    await loadData();
  };

  const moveToDoing = async (taskId: number) => {
    const { error } = await supabase.from("tasks").update({ status: "doing" }).eq("id", taskId);
    if (error) {
      alert("修改状态失败：" + error.message);
      return;
    }
    await loadData();
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
      <PageHeader
        kicker="Timeline"
        title="Daily Timeline"
        description="The right side now shows quick tasks, scheduled work, and due work for the chosen day."
        actions={
          <>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
            <button
              className="secondary-btn"
              onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])}
            >
              Today
            </button>
          </>
        }
      />

      <section className="timeline-main">
        <div className="panel card-pad">
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Timeline</div>

          <div className="tight-grid">
            {timeSlots.map((time) => {
              const items = getTasksStartingAt(time);

              return (
                <div key={time} className="timeline-slot panel-soft card-pad">
                  <div
                    className="text-muted"
                    style={{ fontSize: 12, fontWeight: 700, paddingTop: 4 }}
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
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{task.title}</div>
                          <div className="task-meta">
                            {task.start_time || "--"} - {task.end_time || "--"} ·{" "}
                            {getProjectName(task.project_id)}
                          </div>

                          <div className="badge-row" style={{ marginTop: 8 }}>
                            {task.is_quick_task ? <div className="badge">quick</div> : null}
                            {task.must_do_today ? <div className="badge">must today</div> : null}
                            <div className="badge">{formatDuration(task)}</div>
                          </div>

                          {editingTaskId !== task.id ? (
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                              <button className="blue-btn" onClick={() => startEditTime(task)}>
                                Edit time
                              </button>
                              <button
                                className="secondary-btn"
                                onClick={() => clearTaskTime(task.id)}
                              >
                                Clear time
                              </button>
                              <button
                                className="secondary-btn"
                                onClick={() => moveToDoing(task.id)}
                              >
                                Doing
                              </button>
                              <button className="primary-btn" onClick={() => markDone(task.id)}>
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
                                />
                                <input
                                  type="time"
                                  value={editEndTime}
                                  onChange={(e) => setEditEndTime(e.target.value)}
                                />
                              </div>

                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <button
                                  className="primary-btn"
                                  onClick={() => saveTaskTime(task.id)}
                                >
                                  Save
                                </button>
                                <button className="secondary-btn" onClick={cancelEditTime}>
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

        <aside className="panel card-pad">
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
            Task Pool For {selectedDate}
          </div>

          <div className="tight-grid">
            {taskPool.length === 0 ? (
              <div className="panel-soft card-pad empty-state">
                No quick tasks, due tasks, or unscheduled tasks for this day.
              </div>
            ) : (
              taskPool.map((task) => (
                <div key={task.id} className="panel-soft card-pad">
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{task.title}</div>
                  <div className="task-meta">
                    {getProjectName(task.project_id)} · {task.priority} · Due:{" "}
                    {task.due_date || "N/A"}
                  </div>

                  <div className="badge-row" style={{ marginTop: 8 }}>
                    {task.is_quick_task ? <div className="badge">quick</div> : null}
                    {task.must_do_today ? <div className="badge">must today</div> : null}
                    {task.scheduled_date === selectedDate ? <div className="badge">scheduled</div> : null}
                    <div className="badge">{formatDuration(task)}</div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    <button
                      className="blue-btn"
                      onClick={() => {
                        setEditingTaskId(task.id);
                        setEditStartTime(task.start_time || "");
                        setEditEndTime(task.end_time || "");
                      }}
                    >
                      Assign time
                    </button>
                    <button className="secondary-btn" onClick={() => moveToDoing(task.id)}>
                      Doing
                    </button>
                    <button className="primary-btn" onClick={() => markDone(task.id)}>
                      Done
                    </button>
                  </div>

                  {editingTaskId === task.id ? (
                    <div className="tight-grid" style={{ marginTop: 10 }}>
                      <div className="tight-grid-2">
                        <input
                          type="time"
                          value={editStartTime}
                          onChange={(e) => setEditStartTime(e.target.value)}
                        />
                        <input
                          type="time"
                          value={editEndTime}
                          onChange={(e) => setEditEndTime(e.target.value)}
                        />
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button className="primary-btn" onClick={() => saveTaskTime(task.id)}>
                          Save
                        </button>
                        <button className="secondary-btn" onClick={cancelEditTime}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}