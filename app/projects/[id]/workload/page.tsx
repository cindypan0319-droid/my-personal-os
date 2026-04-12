"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import { recomputeAndSaveProjectAnalysis } from "../../../../lib/project-analysis-sync";
import { PageHeader } from "../../../../components/app/PageHeader";
import { Project } from "../../../../types/task";
import { TimelineTask } from "../../../../types/project-timeline";

type DailyLoadRow = {
  date: string;
  totalHours: number;
  criticalHours: number;
  nonCriticalHours: number;
  overload: boolean;
  tasks: TimelineTask[];
};

type AssigneeSummary = {
  assignee: string;
  totalHours: number;
  criticalHours: number;
  nonCriticalHours: number;
  activeDays: number;
  overloadedDays: number;
};

type WorkloadSuggestion = {
  date: string;
  taskId: number | null;
  taskTitle: string | null;
  maxShiftDays: number;
  message: string;
};

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function getDateRange(start: string, finish: string) {
  const days: string[] = [];
  let current = start;
  while (current <= finish) {
    days.push(current);
    current = addDays(current, 1);
  }
  return days;
}

function getTaskDailyHours(task: TimelineTask): number {
  if (task.daily_hours !== null && task.daily_hours !== undefined) {
    const v = Number(task.daily_hours);
    if (Number.isFinite(v) && v > 0) return v;
  }

  const duration = Number(task.estimated_duration_days ?? 0);
  if (Number.isFinite(duration) && duration > 0) {
    return 8;
  }

  return 8;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
  });
}

export default function ProjectWorkloadPage() {
  const params = useParams();
  const projectId = Number(params.id);

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<TimelineTask[]>([]);
  const [loading, setLoading] = useState(true);

  const [dailyCapacity, setDailyCapacity] = useState(8);
  const [selectedAssignee, setSelectedAssignee] = useState("all");
  const [working, setWorking] = useState(false);

  const loadData = async () => {
    setLoading(true);

    const { data: projectData, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    const { data: taskData, error: taskError } = await supabase
      .from("tasks")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

    if (projectError) console.error(projectError.message);
    if (taskError) console.error(taskError.message);

    setProject((projectData as Project) || null);
    setTasks((taskData as TimelineTask[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!Number.isNaN(projectId)) loadData();
  }, [projectId]);

  const schedulableTasks = useMemo(() => {
    return tasks.filter(
      (task) =>
        task.planned_start_date &&
        task.planned_finish_date &&
        task.status !== "done"
    );
  }, [tasks]);

  const assignees = useMemo(() => {
    const values = Array.from(
      new Set(
        schedulableTasks
          .map((task) => task.assignee || "Unassigned")
          .filter(Boolean)
      )
    );
    return values.sort();
  }, [schedulableTasks]);

  const filteredTasks = useMemo(() => {
    if (selectedAssignee === "all") return schedulableTasks;
    return schedulableTasks.filter(
      (task) => (task.assignee || "Unassigned") === selectedAssignee
    );
  }, [schedulableTasks, selectedAssignee]);

  const dailyLoad = useMemo<DailyLoadRow[]>(() => {
    const dayMap = new Map<string, DailyLoadRow>();

    for (const task of filteredTasks) {
      const start = task.planned_start_date!;
      const finish = task.planned_finish_date!;
      const taskDays = getDateRange(start, finish);
      const hours = getTaskDailyHours(task);

      for (const date of taskDays) {
        const existing = dayMap.get(date) || {
          date,
          totalHours: 0,
          criticalHours: 0,
          nonCriticalHours: 0,
          overload: false,
          tasks: [],
        };

        existing.totalHours += hours;
        if (task.is_critical) {
          existing.criticalHours += hours;
        } else {
          existing.nonCriticalHours += hours;
        }
        existing.tasks.push(task);
        existing.overload = existing.totalHours > dailyCapacity;

        dayMap.set(date, existing);
      }
    }

    return Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredTasks, dailyCapacity]);

  const assigneeSummary = useMemo<AssigneeSummary[]>(() => {
    const map = new Map<string, AssigneeSummary>();

    for (const task of schedulableTasks) {
      const assignee = task.assignee || "Unassigned";
      const hours = getTaskDailyHours(task);
      const taskDays = getDateRange(task.planned_start_date!, task.planned_finish_date!);

      let summary = map.get(assignee);
      if (!summary) {
        summary = {
          assignee,
          totalHours: 0,
          criticalHours: 0,
          nonCriticalHours: 0,
          activeDays: 0,
          overloadedDays: 0,
        };
      }

      summary.totalHours += hours * taskDays.length;
      if (task.is_critical) {
        summary.criticalHours += hours * taskDays.length;
      } else {
        summary.nonCriticalHours += hours * taskDays.length;
      }
      summary.activeDays += taskDays.length;

      map.set(assignee, summary);
    }

    const rows = Array.from(map.values());

    for (const row of rows) {
      const relatedDaily = dailyLoad.filter((d) =>
        d.tasks.some((task) => (task.assignee || "Unassigned") === row.assignee)
      );
      row.overloadedDays = relatedDaily.filter((d) => d.totalHours > dailyCapacity).length;
    }

    return rows.sort((a, b) => b.totalHours - a.totalHours);
  }, [schedulableTasks, dailyLoad, dailyCapacity]);

  const suggestions = useMemo<WorkloadSuggestion[]>(() => {
    const overloadedDays = dailyLoad.filter((d) => d.overload);
    const tips: WorkloadSuggestion[] = [];

    for (const day of overloadedDays.slice(0, 5)) {
      const candidate = [...day.tasks]
        .filter((task) => !task.is_critical)
        .sort((a, b) => {
          const aFloat = Number(a.total_float_days ?? 0);
          const bFloat = Number(b.total_float_days ?? 0);
          return bFloat - aFloat;
        })[0];

      if (candidate) {
        const float = Number(candidate.total_float_days ?? 0);

        if (float > 0) {
          tips.push({
            date: day.date,
            taskId: candidate.id,
            taskTitle: candidate.title,
            maxShiftDays: float,
            message: `${formatDate(day.date)} is overloaded (${day.totalHours}h). Consider moving "${candidate.title}" by up to ${float} day(s).`,
          });
        } else {
          tips.push({
            date: day.date,
            taskId: null,
            taskTitle: null,
            maxShiftDays: 0,
            message: `${formatDate(day.date)} is overloaded (${day.totalHours}h). No float available on non-critical tasks, so you may need to reduce scope or reassign work.`,
          });
        }
      } else {
        tips.push({
          date: day.date,
          taskId: null,
          taskTitle: null,
          maxShiftDays: 0,
          message: `${formatDate(day.date)} is overloaded (${day.totalHours}h). Most work on this day is critical, so shifting tasks may affect project duration.`,
        });
      }
    }

    if (tips.length === 0) {
      tips.push({
        date: "",
        taskId: null,
        taskTitle: null,
        maxShiftDays: 0,
        message: "No overload detected under the current daily capacity.",
      });
    }

    return tips;
  }, [dailyLoad]);

  const totalOpenHours = dailyLoad.reduce((sum, day) => sum + day.totalHours, 0);
  const overloadedCount = dailyLoad.filter((d) => d.overload).length;

  const pushTaskLater = async (taskId: number, days: number) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || !task.planned_start_date || !task.planned_finish_date) return;

    const maxFloat = Number(task.total_float_days ?? 0);
    if (days > maxFloat) {
      alert(`This task can only move by ${maxFloat} day(s).`);
      return;
    }

    setWorking(true);

    const newStart = addDays(task.planned_start_date, days);
    const newFinish = addDays(task.planned_finish_date, days);

    const { error } = await supabase
      .from("tasks")
      .update({
        planned_start_date: newStart,
        planned_finish_date: newFinish,
      })
      .eq("id", taskId);

    if (error) {
      setWorking(false);
      alert("Failed to move task: " + error.message);
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

  if (loading) {
    return (
      <div className="page-wrap">
        <div className="panel card-pad">Loading workload view...</div>
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
        title={`${project.name} Workload`}
        description="A practical resource-loading view for everyday planning. Suggestions and task moves now trigger automatic CPM recomputation."
        actions={
          <>
            <select
              value={selectedAssignee}
              onChange={(e) => setSelectedAssignee(e.target.value)}
              style={{ minWidth: 180 }}
            >
              <option value="all">All assignees</option>
              {assignees.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>

            <input
              type="number"
              value={dailyCapacity}
              onChange={(e) => setDailyCapacity(Number(e.target.value || 8))}
              style={{ width: 120 }}
              placeholder="Daily capacity"
            />
          </>
        }
      />

      <section className="tight-grid-3" style={{ marginBottom: 16 }}>
        <div className="panel card-pad stat-card">
          <div className="stat-label">Scheduled Open Tasks</div>
          <div className="stat-number">{filteredTasks.length}</div>
        </div>

        <div className="panel card-pad stat-card">
          <div className="stat-label">Total Planned Hours</div>
          <div className="stat-number">{totalOpenHours}</div>
        </div>

        <div className="panel card-pad stat-card">
          <div className="stat-label">Overloaded Days</div>
          <div className="stat-number">{overloadedCount}</div>
        </div>
      </section>

      <section className="tight-grid-2" style={{ marginBottom: 16 }}>
        <div className="panel card-pad">
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
            Daily Load
          </div>

          <div className="tight-grid">
            {dailyLoad.length === 0 ? (
              <div className="panel-soft card-pad empty-state">
                No planned dates yet. Add planned_start_date and planned_finish_date first.
              </div>
            ) : (
              dailyLoad.map((day) => {
                const ratio = Math.min(day.totalHours / Math.max(dailyCapacity, 1), 1.5);
                return (
                  <div key={day.date} className="panel-soft card-pad">
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "center",
                        marginBottom: 10,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>
                          {formatDate(day.date)}
                        </div>
                        <div className="task-meta">
                          {day.tasks.length} task(s) · Critical {day.criticalHours}h · Non-critical{" "}
                          {day.nonCriticalHours}h
                        </div>
                      </div>

                      <div>
                        {day.overload ? (
                          <span
                            className="badge"
                            style={{
                              background: "var(--danger-soft)",
                              color: "var(--danger)",
                            }}
                          >
                            Overload
                          </span>
                        ) : (
                          <span className="badge">OK</span>
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        height: 12,
                        borderRadius: 999,
                        background: "var(--panel-soft-2)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(ratio * 100, 100)}%`,
                          height: "100%",
                          borderRadius: "inherit",
                          background: day.overload ? "var(--danger)" : "var(--primary)",
                        }}
                      />
                    </div>

                    <div className="task-meta" style={{ marginTop: 8 }}>
                      {day.totalHours}h / {dailyCapacity}h capacity
                    </div>

                    <div className="badge-row">
                      {day.tasks.map((task) => (
                        <div
                          key={`${day.date}-${task.id}`}
                          className="badge"
                          style={
                            task.is_critical
                              ? {
                                  background: "var(--danger-soft)",
                                  color: "var(--danger)",
                                }
                              : undefined
                          }
                        >
                          {task.title}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="panel card-pad">
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
            Assignee Summary
          </div>

          <div className="tight-grid">
            {assigneeSummary.length === 0 ? (
              <div className="panel-soft card-pad empty-state">
                No assignee data yet. Add `assignee` to tasks for better balancing.
              </div>
            ) : (
              assigneeSummary.map((row) => (
                <div key={row.assignee} className="panel-soft card-pad">
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{row.assignee}</div>
                  <div className="task-meta">
                    Total {row.totalHours}h · Critical {row.criticalHours}h · Non-critical{" "}
                    {row.nonCriticalHours}h
                  </div>
                  <div className="task-meta">
                    Active days {row.activeDays} · Overloaded days {row.overloadedDays}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="panel card-pad">
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
          Suggestions
        </div>

        <div className="tight-grid">
          {suggestions.map((tip, index) => (
            <div key={index} className="panel-soft card-pad">
              <div>{tip.message}</div>

              {tip.taskId && tip.maxShiftDays > 0 ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  <button
                    className="secondary-btn"
                    onClick={() => pushTaskLater(tip.taskId!, 1)}
                    disabled={working}
                  >
                    {working ? "Working..." : "Push 1 day"}
                  </button>

                  {tip.maxShiftDays >= 2 ? (
                    <button
                      className="secondary-btn"
                      onClick={() => pushTaskLater(tip.taskId!, 2)}
                      disabled={working}
                    >
                      {working ? "Working..." : "Push 2 days"}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}