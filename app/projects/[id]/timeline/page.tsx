"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import { recomputeAndSaveProjectAnalysis } from "../../../../lib/project-analysis-sync";
import { PageHeader } from "../../../../components/app/PageHeader";
import { Project } from "../../../../types/task";
import {
  ProjectWorkPackage,
  TaskDependency,
  TimelineTask,
} from "../../../../types/project-timeline";

function dateToLabel(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short" });
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export default function ProjectTimelinePage() {
  const params = useParams();
  const projectId = Number(params.id);

  const [project, setProject] = useState<Project | null>(null);
  const [workPackages, setWorkPackages] = useState<ProjectWorkPackage[]>([]);
  const [tasks, setTasks] = useState<TimelineTask[]>([]);
  const [dependencies, setDependencies] = useState<TaskDependency[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const [selectedDate, setSelectedDate] = useState(() =>
    new Date().toISOString().split("T")[0]
  );
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editFinishDate, setEditFinishDate] = useState("");

  const loadData = async () => {
    setLoading(true);

    const { data: projectData, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    const { data: wpData, error: wpError } = await supabase
      .from("project_work_packages")
      .select("*")
      .eq("project_id", projectId)
      .order("manual_order", { ascending: true });

    const { data: taskData, error: taskError } = await supabase
      .from("tasks")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

    const { data: depData, error: depError } = await supabase
      .from("task_dependencies")
      .select("*")
      .eq("project_id", projectId);

    if (projectError) console.error(projectError.message);
    if (wpError) console.error(wpError.message);
    if (taskError) console.error(taskError.message);
    if (depError) console.error(depError.message);

    setProject((projectData as Project) || null);
    setWorkPackages((wpData as ProjectWorkPackage[]) || []);
    setTasks((taskData as TimelineTask[]) || []);
    setDependencies((depData as TaskDependency[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!Number.isNaN(projectId)) loadData();
  }, [projectId]);

  const grouped = useMemo(() => {
    return workPackages.map((wp) => ({
      ...wp,
      tasks: tasks.filter((task) => task.work_package_id === wp.id),
    }));
  }, [workPackages, tasks]);

  const ungroupedTasks = useMemo(() => {
    return tasks.filter((task) => task.work_package_id === null);
  }, [tasks]);

  const timelineRange = useMemo(() => {
    const validStarts = tasks
      .map((t) => t.planned_start_date)
      .filter(Boolean) as string[];
    const validEnds = tasks
      .map((t) => t.planned_finish_date)
      .filter(Boolean) as string[];

    if (validStarts.length === 0 || validEnds.length === 0) return [];

    const minDate = [...validStarts].sort()[0];
    const maxDate = [...validEnds].sort()[validEnds.length - 1];

    const days: string[] = [];
    let current = minDate;
    while (current <= maxDate) {
      days.push(current);
      current = addDays(current, 1);
    }
    return days;
  }, [tasks]);

  const dependencyText = (taskId: number) => {
    const preds = dependencies.filter((d) => d.successor_task_id === taskId);
    if (preds.length === 0) return "—";

    return preds
      .map((dep) => {
        const predTask = tasks.find((t) => t.id === dep.predecessor_task_id);
        return predTask
          ? `${predTask.wbs_code || predTask.id} (${dep.dependency_type}${
              dep.lag_days ? ` +${dep.lag_days}d` : ""
            })`
          : `${dep.predecessor_task_id}`;
      })
      .join(", ");
  };

  const renderBar = (task: TimelineTask) => {
    if (
      !task.planned_start_date ||
      !task.planned_finish_date ||
      timelineRange.length === 0
    ) {
      return <div className="text-muted" style={{ fontSize: 12 }}>No plan</div>;
    }

    const startIndex = timelineRange.indexOf(task.planned_start_date);
    const endIndex = timelineRange.indexOf(task.planned_finish_date);

    if (startIndex === -1 || endIndex === -1) {
      return <div className="text-muted" style={{ fontSize: 12 }}>No plan</div>;
    }

    const isCritical = !!task.is_critical;
    const isMilestone = !!task.is_milestone;

    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${timelineRange.length}, minmax(22px, 1fr))`,
          gap: 2,
          alignItems: "center",
        }}
      >
        {timelineRange.map((day, index) => {
          const active = index >= startIndex && index <= endIndex;

          let background = "var(--panel-soft-2)";
          let opacity = 0.55;
          let borderRadius = 6;

          if (active) {
            background = isCritical ? "var(--danger)" : "var(--primary)";
            opacity = 1;
          }

          if (active && isMilestone) {
            borderRadius = 999;
          }

          return (
            <div
              key={day}
              style={{
                height: 18,
                borderRadius,
                background,
                opacity,
                boxShadow:
                  active && isCritical
                    ? "0 0 0 1px rgba(220,38,38,0.15)"
                    : undefined,
              }}
              title={day}
            />
          );
        })}
      </div>
    );
  };

  const startEditTask = (task: TimelineTask) => {
    setEditingTaskId(task.id);
    setEditStartTime(task.start_time || "");
    setEditEndTime(task.end_time || "");
    setEditStartDate(task.planned_start_date || "");
    setEditFinishDate(task.planned_finish_date || "");
  };

  const cancelEditTask = () => {
    setEditingTaskId(null);
    setEditStartTime("");
    setEditEndTime("");
    setEditStartDate("");
    setEditFinishDate("");
  };

  const saveTaskSchedule = async (taskId: number) => {
    setWorking(true);

    const { error } = await supabase
      .from("tasks")
      .update({
        planned_start_date: editStartDate || null,
        planned_finish_date: editFinishDate || null,
        scheduled_date: editStartDate || null,
        start_time: editStartTime || null,
        end_time: editEndTime || null,
      })
      .eq("id", taskId);

    if (error) {
      setWorking(false);
      alert("保存排程失败：" + error.message);
      return;
    }

    try {
      await recomputeAndSaveProjectAnalysis(projectId);
    } catch (error) {
      setWorking(false);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to recompute project analysis."
      );
      return;
    }

    cancelEditTask();
    setWorking(false);
    await loadData();
  };

  const clearTaskTime = async (taskId: number) => {
    setWorking(true);

    const { error } = await supabase
      .from("tasks")
      .update({
        scheduled_date: null,
        start_time: null,
        end_time: null,
      })
      .eq("id", taskId);

    if (error) {
      setWorking(false);
      alert("清除时间失败：" + error.message);
      return;
    }

    try {
      await recomputeAndSaveProjectAnalysis(projectId);
    } catch (error) {
      setWorking(false);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to recompute project analysis."
      );
      return;
    }

    setWorking(false);
    await loadData();
  };

  const markDone = async (taskId: number) => {
    setWorking(true);

    const { error } = await supabase
      .from("tasks")
      .update({ status: "done" })
      .eq("id", taskId);

    if (error) {
      setWorking(false);
      alert("修改状态失败：" + error.message);
      return;
    }

    setWorking(false);
    await loadData();
  };

  const moveToDoing = async (taskId: number) => {
    setWorking(true);

    const { error } = await supabase
      .from("tasks")
      .update({ status: "doing" })
      .eq("id", taskId);

    if (error) {
      setWorking(false);
      alert("修改状态失败：" + error.message);
      return;
    }

    setWorking(false);
    await loadData();
  };

  const timelineTasksForSelectedDate = useMemo(() => {
    return tasks
      .filter(
        (task) =>
          task.status !== "done" &&
          task.planned_start_date &&
          task.planned_finish_date &&
          selectedDate >= task.planned_start_date &&
          selectedDate <= task.planned_finish_date
      )
      .sort((a, b) => {
        if (a.start_time && b.start_time) return a.start_time.localeCompare(b.start_time);
        if (a.start_time && !b.start_time) return -1;
        if (!a.start_time && b.start_time) return 1;
        return a.title.localeCompare(b.title);
      });
  }, [tasks, selectedDate]);

  const criticalCount = tasks.filter((t) => !!t.is_critical).length;

  if (loading) {
    return (
      <div className="page-wrap">
        <div className="panel card-pad">Loading timeline...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="page-wrap">
        <div className="panel card-pad">Project not found.</div>
      </div>
    );
  }

  return (
    <div className="page-wrap">
      <PageHeader
        kicker="Projects"
        title={`${project.name} Timeline`}
        description="Critical activities are highlighted in red. Editing schedule dates will automatically recompute project analysis."
        actions={
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ width: 160 }}
          />
        }
      />

      <section className="tight-grid-3" style={{ marginBottom: 16 }}>
        <div className="panel card-pad stat-card">
          <div className="stat-label">Work Packages</div>
          <div className="stat-number">{workPackages.length}</div>
        </div>

        <div className="panel card-pad stat-card">
          <div className="stat-label">Activities</div>
          <div className="stat-number">{tasks.length}</div>
        </div>

        <div className="panel card-pad stat-card">
          <div className="stat-label">Critical Activities</div>
          <div className="stat-number">{criticalCount}</div>
        </div>
      </section>

      <section className="tight-grid-2" style={{ marginBottom: 16 }}>
        <div className="panel card-pad">
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
            Timeline Legend
          </div>

          <div className="tight-grid">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  width: 24,
                  height: 12,
                  borderRadius: 6,
                  background: "var(--danger)",
                  display: "inline-block",
                }}
              />
              <span>Critical path activity</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  width: 24,
                  height: 12,
                  borderRadius: 6,
                  background: "var(--primary)",
                  display: "inline-block",
                }}
              />
              <span>Non-critical activity</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 999,
                  background: "var(--primary)",
                  display: "inline-block",
                }}
              />
              <span>Milestone</span>
            </div>
          </div>
        </div>

        <div className="panel card-pad">
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
            Selected Day
          </div>

          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
            {selectedDate}
          </div>

          <div className="tight-grid">
            {timelineTasksForSelectedDate.length === 0 ? (
              <div className="panel-soft card-pad empty-state">
                No activities on this date.
              </div>
            ) : (
              timelineTasksForSelectedDate.map((task) => (
                <div key={task.id} className="panel-soft card-pad">
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{task.title}</div>
                  <div className="task-meta">
                    {task.wbs_code || "—"} · {task.status}
                    {task.is_critical ? " · Critical" : ""}
                    {task.total_float_days !== null && task.total_float_days !== undefined
                      ? ` · Float ${task.total_float_days}d`
                      : ""}
                  </div>

                  {editingTaskId !== task.id ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                      <button className="blue-btn" onClick={() => startEditTask(task)} disabled={working}>
                        Edit schedule
                      </button>
                      <button className="secondary-btn" onClick={() => clearTaskTime(task.id)} disabled={working}>
                        Clear time
                      </button>
                      <button className="secondary-btn" onClick={() => moveToDoing(task.id)} disabled={working}>
                        Doing
                      </button>
                      <button className="primary-btn" onClick={() => markDone(task.id)} disabled={working}>
                        Done
                      </button>
                    </div>
                  ) : (
                    <div className="tight-grid" style={{ marginTop: 10 }}>
                      <div className="tight-grid-2">
                        <input
                          type="date"
                          value={editStartDate}
                          onChange={(e) => setEditStartDate(e.target.value)}
                        />
                        <input
                          type="date"
                          value={editFinishDate}
                          onChange={(e) => setEditFinishDate(e.target.value)}
                        />
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
                          onClick={() => saveTaskSchedule(task.id)}
                          disabled={working}
                        >
                          {working ? "Saving..." : "Save"}
                        </button>
                        <button
                          className="secondary-btn"
                          onClick={cancelEditTask}
                          disabled={working}
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

      <section className="panel card-pad" style={{ overflowX: "auto" }}>
        {timelineRange.length > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "120px 240px 120px 120px 190px minmax(420px, 1fr)",
              gap: 12,
              alignItems: "start",
            }}
          >
            <div className="text-muted" style={{ fontSize: 12, fontWeight: 700 }}>
              WBS
            </div>
            <div className="text-muted" style={{ fontSize: 12, fontWeight: 700 }}>
              Activity
            </div>
            <div className="text-muted" style={{ fontSize: 12, fontWeight: 700 }}>
              Duration
            </div>
            <div className="text-muted" style={{ fontSize: 12, fontWeight: 700 }}>
              Start / Finish
            </div>
            <div className="text-muted" style={{ fontSize: 12, fontWeight: 700 }}>
              Predecessor
            </div>

            <div>
              <div
                className="text-muted"
                style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}
              >
                Timeline
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${timelineRange.length}, minmax(22px, 1fr))`,
                  gap: 2,
                }}
              >
                {timelineRange.map((day) => (
                  <div
                    key={day}
                    className="text-muted"
                    style={{ fontSize: 10, textAlign: "center" }}
                  >
                    {new Date(day).getDate()}
                  </div>
                ))}
              </div>
            </div>

            {grouped.map((wp) => (
              <div key={wp.id} style={{ gridColumn: "1 / -1" }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    marginTop: 12,
                    marginBottom: 8,
                    color: "var(--primary)",
                  }}
                >
                  {wp.name}
                </div>

                <div className="tight-grid">
                  {wp.tasks.map((task) => (
                    <div
                      key={task.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "120px 240px 120px 120px 190px minmax(420px, 1fr)",
                        gap: 12,
                        alignItems: "center",
                        padding: "10px 0",
                        borderTop: "1px solid var(--border)",
                      }}
                    >
                      <div style={{ fontSize: 13 }}>{task.wbs_code || "—"}</div>

                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>
                          {task.title}
                        </div>

                        <div className="task-meta">
                          {task.status}
                          {task.is_milestone ? " · Milestone" : ""}
                          {task.is_critical ? " · Critical" : ""}
                          {task.total_float_days !== null &&
                          task.total_float_days !== undefined
                            ? ` · Float ${task.total_float_days}d`
                            : ""}
                        </div>

                        <div className="badge-row">
                          {task.is_critical ? (
                            <div
                              className="badge"
                              style={{
                                background: "var(--danger-soft)",
                                color: "var(--danger)",
                              }}
                            >
                              Critical
                            </div>
                          ) : (
                            <div className="badge">Non-critical</div>
                          )}

                          {task.is_milestone ? (
                            <div className="badge">Milestone</div>
                          ) : null}

                          {task.total_float_days !== null &&
                          task.total_float_days !== undefined ? (
                            <div className="badge">Float {task.total_float_days}d</div>
                          ) : null}
                        </div>
                      </div>

                      <div style={{ fontSize: 13 }}>
                        {task.estimated_duration_days ?? "—"} d
                      </div>

                      <div style={{ fontSize: 13 }}>
                        {task.planned_start_date
                          ? dateToLabel(task.planned_start_date)
                          : "—"}
                        {" → "}
                        {task.planned_finish_date
                          ? dateToLabel(task.planned_finish_date)
                          : "—"}
                      </div>

                      <div style={{ fontSize: 13 }}>{dependencyText(task.id)}</div>

                      <div>{renderBar(task)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {ungroupedTasks.length > 0 ? (
              <div key="ungrouped" style={{ gridColumn: "1 / -1" }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    marginTop: 12,
                    marginBottom: 8,
                    color: "var(--warning)",
                  }}
                >
                  Ungrouped Activities
                </div>

                <div className="tight-grid">
                  {ungroupedTasks.map((task) => (
                    <div
                      key={task.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "120px 240px 120px 120px 190px minmax(420px, 1fr)",
                        gap: 12,
                        alignItems: "center",
                        padding: "10px 0",
                        borderTop: "1px solid var(--border)",
                      }}
                    >
                      <div style={{ fontSize: 13 }}>{task.wbs_code || "—"}</div>

                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>
                          {task.title}
                        </div>

                        <div className="task-meta">
                          {task.status}
                          {task.is_milestone ? " · Milestone" : ""}
                          {task.is_critical ? " · Critical" : ""}
                          {task.total_float_days !== null &&
                          task.total_float_days !== undefined
                            ? ` · Float ${task.total_float_days}d`
                            : ""}
                        </div>

                        <div className="badge-row">
                          {task.is_critical ? (
                            <div
                              className="badge"
                              style={{
                                background: "var(--danger-soft)",
                                color: "var(--danger)",
                              }}
                            >
                              Critical
                            </div>
                          ) : (
                            <div className="badge">Non-critical</div>
                          )}

                          {task.is_milestone ? (
                            <div className="badge">Milestone</div>
                          ) : null}

                          {task.total_float_days !== null &&
                          task.total_float_days !== undefined ? (
                            <div className="badge">Float {task.total_float_days}d</div>
                          ) : null}
                        </div>
                      </div>

                      <div style={{ fontSize: 13 }}>
                        {task.estimated_duration_days ?? "—"} d
                      </div>

                      <div style={{ fontSize: 13 }}>
                        {task.planned_start_date
                          ? dateToLabel(task.planned_start_date)
                          : "—"}
                        {" → "}
                        {task.planned_finish_date
                          ? dateToLabel(task.planned_finish_date)
                          : "—"}
                      </div>

                      <div style={{ fontSize: 13 }}>{dependencyText(task.id)}</div>

                      <div>{renderBar(task)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="empty-state">
            No planned dates yet. Add planned dates and duration first, then run
            analysis if you want critical path highlighting.
          </div>
        )}
      </section>
    </div>
  );
}