"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { recomputeAndSaveProjectAnalysis } from "../../../lib/project-analysis-sync";
import { PageHeader } from "../../../components/app/PageHeader";
import { Project } from "../../../types/task";
import {
  ProjectWorkPackage,
  TaskDependency,
  TimelineTask,
} from "../../../types/project-timeline";

type WorkspaceTab =
  | "overview"
  | "structure"
  | "logic"
  | "timeline"
  | "analysis"
  | "workload";

type DependencyType = "FS" | "SS" | "FF" | "SF";

type DailyLoadRow = {
  date: string;
  totalHours: number;
  criticalHours: number;
  nonCriticalHours: number;
  overload: boolean;
  tasks: TimelineTask[];
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

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
  });
}

function dateToLabel(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short" });
}

function getTaskDailyHours(task: TimelineTask): number {
  if (task.daily_hours !== null && task.daily_hours !== undefined) {
    const v = Number(task.daily_hours);
    if (Number.isFinite(v) && v > 0) return v;
  }
  return 8;
}

export default function ProjectWorkspacePage() {
  const params = useParams();
  const projectId = Number(params.id);

  const [project, setProject] = useState<Project | null>(null);
  const [workPackages, setWorkPackages] = useState<ProjectWorkPackage[]>([]);
  const [tasks, setTasks] = useState<TimelineTask[]>([]);
  const [dependencies, setDependencies] = useState<TaskDependency[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [recentEditingTaskId, setRecentEditingTaskId] = useState<number | null>(null);
  const [recentTitle, setRecentTitle] = useState("");
  const [recentStatus, setRecentStatus] = useState<"inbox" | "todo" | "doing" | "done">("todo");
  const [recentDuration, setRecentDuration] = useState("");
  const [recentStartDate, setRecentStartDate] = useState("");
  const [recentFinishDate, setRecentFinishDate] = useState("");

  const [tab, setTab] = useState<WorkspaceTab>("overview");

  const [wpName, setWpName] = useState("");
  const [wpDescription, setWpDescription] = useState("");

  const [taskTitle, setTaskTitle] = useState("");
  const [taskWorkPackageId, setTaskWorkPackageId] = useState<string>("");
  const [taskWbsCode, setTaskWbsCode] = useState("");
  const [taskDuration, setTaskDuration] = useState("");
  const [taskStartDate, setTaskStartDate] = useState("");
  const [taskFinishDate, setTaskFinishDate] = useState("");

  const [predecessorTaskId, setPredecessorTaskId] = useState("");
  const [successorTaskId, setSuccessorTaskId] = useState("");
  const [dependencyType, setDependencyType] = useState<DependencyType>("FS");
  const [lagDays, setLagDays] = useState("0");

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editStartDate, setEditStartDate] = useState("");
  const [editFinishDate, setEditFinishDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");

  const [dailyCapacity, setDailyCapacity] = useState(8);
  const [selectedAssignee, setSelectedAssignee] = useState("all");

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
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

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

  const ungroupedTasks = useMemo(
    () => tasks.filter((task) => task.work_package_id === null),
    [tasks]
  );

  const stats = useMemo(() => {
    const done = tasks.filter((t) => t.status === "done").length;
    const open = tasks.filter((t) => t.status !== "done").length;
    const critical = tasks.filter((t) => !!t.is_critical).length;
    const milestones = tasks.filter((t) => !!t.is_milestone).length;
    const progress = tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100);

    return {
      total: tasks.length,
      done,
      open,
      critical,
      milestones,
      progress,
    };
  }, [tasks]);

  const taskLabel = (taskId: number) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return String(taskId);
    return `${task.wbs_code || task.id} - ${task.title}`;
  };

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const aCode = a.wbs_code || "";
      const bCode = b.wbs_code || "";
      if (aCode && bCode) return aCode.localeCompare(bCode);
      return a.title.localeCompare(b.title);
    });
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

  const assignees = useMemo(() => {
    const values = Array.from(
      new Set(tasks.map((task) => task.assignee || "Unassigned").filter(Boolean))
    );
    return values.sort();
  }, [tasks]);

  const schedulableTasks = useMemo(() => {
    return tasks.filter(
      (task) =>
        task.planned_start_date &&
        task.planned_finish_date &&
        task.status !== "done"
    );
  }, [tasks]);

  const filteredWorkloadTasks = useMemo(() => {
    if (selectedAssignee === "all") return schedulableTasks;
    return schedulableTasks.filter(
      (task) => (task.assignee || "Unassigned") === selectedAssignee
    );
  }, [schedulableTasks, selectedAssignee]);

  const dailyLoad = useMemo<DailyLoadRow[]>(() => {
    const dayMap = new Map<string, DailyLoadRow>();

    for (const task of filteredWorkloadTasks) {
      const start = task.planned_start_date!;
      const finish = task.planned_finish_date!;
      const hours = getTaskDailyHours(task);

      for (const date of getDateRange(start, finish)) {
        const existing = dayMap.get(date) || {
          date,
          totalHours: 0,
          criticalHours: 0,
          nonCriticalHours: 0,
          overload: false,
          tasks: [],
        };

        existing.totalHours += hours;
        if (task.is_critical) existing.criticalHours += hours;
        else existing.nonCriticalHours += hours;
        existing.tasks.push(task);
        existing.overload = existing.totalHours > dailyCapacity;

        dayMap.set(date, existing);
      }
    }

    return Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredWorkloadTasks, dailyCapacity]);

  const suggestions = useMemo<WorkloadSuggestion[]>(() => {
    const overloadedDays = dailyLoad.filter((d) => d.overload);
    const tips: WorkloadSuggestion[] = [];

    for (const day of overloadedDays.slice(0, 5)) {
      const candidate = [...day.tasks]
        .filter((task) => !task.is_critical)
        .sort((a, b) => Number(b.total_float_days ?? 0) - Number(a.total_float_days ?? 0))[0];

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
            message: `${formatDate(day.date)} is overloaded (${day.totalHours}h). No float available on non-critical tasks.`,
          });
        }
      } else {
        tips.push({
          date: day.date,
          taskId: null,
          taskTitle: null,
          maxShiftDays: 0,
          message: `${formatDate(day.date)} is overloaded (${day.totalHours}h). Most work on this day is critical.`,
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

    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${timelineRange.length}, minmax(22px, 1fr))`,
          gap: 2,
        }}
      >
        {timelineRange.map((day, index) => {
          const active = index >= startIndex && index <= endIndex;
          return (
            <div
              key={day}
              style={{
                height: 18,
                borderRadius: active && task.is_milestone ? 999 : 6,
                background: active
                  ? task.is_critical
                    ? "var(--danger)"
                    : "var(--primary)"
                  : "var(--panel-soft-2)",
                opacity: active ? 1 : 0.55,
              }}
              title={day}
            />
          );
        })}
      </div>
    );
  };

  const runAnalysis = async () => {
    setWorking(true);
    try {
      await recomputeAndSaveProjectAnalysis(projectId);
      await loadData();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Analysis failed.");
    } finally {
      setWorking(false);
    }
  };

  const addWorkPackage = async () => {
    if (!wpName.trim()) {
      alert("Work package name is required");
      return;
    }

    setWorking(true);
    const nextOrder =
      workPackages.length === 0
        ? 1
        : Math.max(...workPackages.map((w) => w.manual_order || 0)) + 1;

    const { error } = await supabase.from("project_work_packages").insert({
      project_id: projectId,
      name: wpName.trim(),
      description: wpDescription || null,
      manual_order: nextOrder,
    });

    setWorking(false);

    if (error) {
      alert("Create work package failed: " + error.message);
      return;
    }

    setWpName("");
    setWpDescription("");
    await loadData();
  };

  const addTask = async () => {
    if (!taskTitle.trim()) {
      alert("Task title is required");
      return;
    }

    setWorking(true);

    const { error } = await supabase.from("tasks").insert({
      title: taskTitle.trim(),
      status: "todo",
      priority: "medium",
      context: "computer",
      project_id: projectId,
      work_package_id: taskWorkPackageId ? Number(taskWorkPackageId) : null,
      wbs_code: taskWbsCode || null,
      estimated_duration_days: taskDuration ? Number(taskDuration) : null,
      planned_start_date: taskStartDate || null,
      planned_finish_date: taskFinishDate || null,
      is_quick_task: false,
      estimated_minutes: null,
      notes: null,
      reference_link: null,
      scheduled_date: null,
      start_time: null,
      end_time: null,
      recurring_enabled: false,
      recurring_type: null,
      recurring_interval: null,
      recurring_days_of_week: null,
      energy_level: null,
      must_do_today: false,
      is_milestone: false,
      user_id: null,
    });

    if (error) {
      setWorking(false);
      alert("Create activity failed: " + error.message);
      return;
    }

    try {
      await recomputeAndSaveProjectAnalysis(projectId);
    } catch {}

    setTaskTitle("");
    setTaskWorkPackageId("");
    setTaskWbsCode("");
    setTaskDuration("");
    setTaskStartDate("");
    setTaskFinishDate("");
    setWorking(false);
    await loadData();
  };

  const addDependency = async () => {
    if (!predecessorTaskId || !successorTaskId) {
      alert("Please select both predecessor and successor");
      return;
    }
    if (predecessorTaskId === successorTaskId) {
      alert("A task cannot depend on itself");
      return;
    }

    setWorking(true);

    const { error } = await supabase.from("task_dependencies").insert({
      project_id: projectId,
      predecessor_task_id: Number(predecessorTaskId),
      successor_task_id: Number(successorTaskId),
      dependency_type: dependencyType,
      lag_days: Number(lagDays || 0),
    });

    if (error) {
      setWorking(false);
      alert("Create dependency failed: " + error.message);
      return;
    }

    try {
      await recomputeAndSaveProjectAnalysis(projectId);
    } catch {}

    setPredecessorTaskId("");
    setSuccessorTaskId("");
    setDependencyType("FS");
    setLagDays("0");
    setWorking(false);
    await loadData();
  };

  const deleteDependency = async (id: number) => {
    const ok = window.confirm("Delete this dependency?");
    if (!ok) return;

    setWorking(true);

    const { error } = await supabase
      .from("task_dependencies")
      .delete()
      .eq("id", id);

    if (error) {
      setWorking(false);
      alert("Delete dependency failed: " + error.message);
      return;
    }

    try {
      await recomputeAndSaveProjectAnalysis(projectId);
    } catch {}

    setWorking(false);
    await loadData();
  };

  const startEditTask = (task: TimelineTask) => {
    setEditingTaskId(task.id);
    setEditStartDate(task.planned_start_date || "");
    setEditFinishDate(task.planned_finish_date || "");
    setEditStartTime(task.start_time || "");
    setEditEndTime(task.end_time || "");
  };

  const cancelEditTask = () => {
    setEditingTaskId(null);
    setEditStartDate("");
    setEditFinishDate("");
    setEditStartTime("");
    setEditEndTime("");
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
      alert("Save schedule failed: " + error.message);
      return;
    }

    try {
      await recomputeAndSaveProjectAnalysis(projectId);
    } catch {}

    cancelEditTask();
    setWorking(false);
    await loadData();
  };

  const pushTaskLater = async (taskId: number, days: number) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || !task.planned_start_date || !task.planned_finish_date) return;

    const maxFloat = Number(task.total_float_days ?? 0);
    if (days > maxFloat) {
      alert(`This task can only move by ${maxFloat} day(s).`);
      return;
    }

    setWorking(true);

    const { error } = await supabase
      .from("tasks")
      .update({
        planned_start_date: addDays(task.planned_start_date, days),
        planned_finish_date: addDays(task.planned_finish_date, days),
      })
      .eq("id", taskId);

    if (error) {
      setWorking(false);
      alert("Failed to move task: " + error.message);
      return;
    }

    try {
      await recomputeAndSaveProjectAnalysis(projectId);
    } catch {}

    setWorking(false);
    await loadData();
  };

    const startEditRecentTask = (task: TimelineTask) => {
    setRecentEditingTaskId(task.id);
    setRecentTitle(task.title || "");
    setRecentStatus(task.status);
    setRecentDuration(
      task.estimated_duration_days !== null && task.estimated_duration_days !== undefined
        ? String(task.estimated_duration_days)
        : ""
    );
    setRecentStartDate(task.planned_start_date || "");
    setRecentFinishDate(task.planned_finish_date || "");
  };

  const cancelEditRecentTask = () => {
    setRecentEditingTaskId(null);
    setRecentTitle("");
    setRecentStatus("todo");
    setRecentDuration("");
    setRecentStartDate("");
    setRecentFinishDate("");
  };

  const saveRecentTask = async (taskId: number) => {
    setWorking(true);

    const { error } = await supabase
      .from("tasks")
      .update({
        title: recentTitle.trim(),
        status: recentStatus,
        estimated_duration_days: recentDuration ? Number(recentDuration) : null,
        planned_start_date: recentStartDate || null,
        planned_finish_date: recentFinishDate || null,
        scheduled_date: recentStartDate || null,
      })
      .eq("id", taskId);

    if (error) {
      setWorking(false);
      alert("Save task failed: " + error.message);
      return;
    }

    try {
      await recomputeAndSaveProjectAnalysis(projectId);
    } catch (error) {
      setWorking(false);
      alert(
        error instanceof Error ? error.message : "Failed to recompute project analysis."
      );
      return;
    }

    cancelEditRecentTask();
    setWorking(false);
    await loadData();
  };

  if (loading) {
    return (
      <div className="page-wrap">
        <div className="panel card-pad">Loading project workspace...</div>
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

  const tabs: Array<{ key: WorkspaceTab; label: string }> = [
    { key: "overview", label: "Overview" },
    { key: "structure", label: "Structure" },
    { key: "logic", label: "Logic" },
    { key: "timeline", label: "Timeline" },
    { key: "analysis", label: "Analysis" },
    { key: "workload", label: "Workload" },
  ];

  return (
    <div className="page-wrap">
      <PageHeader
        kicker="Projects"
        title={project.name}
        description={project.description || "Single-page project workspace"}
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/projects" className="secondary-btn">
              Back to Projects
            </Link>
            <button className="primary-btn" onClick={runAnalysis} disabled={working}>
              {working ? "Working..." : "Recompute Analysis"}
            </button>
          </div>
        }
      />

      <section className="panel card-pad" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {tabs.map((item) => (
            <button
              key={item.key}
              className={tab === item.key ? "blue-btn" : "secondary-btn"}
              onClick={() => setTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {tab === "overview" ? (
        <>
          <section className="tight-grid-3" style={{ marginBottom: 16 }}>
            <div className="panel card-pad stat-card">
              <div className="stat-label">Total Activities</div>
              <div className="stat-number">{stats.total}</div>
            </div>
            <div className="panel card-pad stat-card">
              <div className="stat-label">Open</div>
              <div className="stat-number">{stats.open}</div>
            </div>
            <div className="panel card-pad stat-card">
              <div className="stat-label">Done</div>
              <div className="stat-number">{stats.done}</div>
            </div>
          </section>

          <section className="tight-grid-3" style={{ marginBottom: 16 }}>
            <div className="panel card-pad stat-card">
              <div className="stat-label">Critical</div>
              <div className="stat-number">{stats.critical}</div>
            </div>
            <div className="panel card-pad stat-card">
              <div className="stat-label">Milestones</div>
              <div className="stat-number">{stats.milestones}</div>
            </div>
            <div className="panel card-pad stat-card">
              <div className="stat-label">Progress</div>
              <div className="stat-number">{stats.progress}%</div>
            </div>
          </section>

          <section className="tight-grid-2">
            <div className="panel card-pad">
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
                Quick Actions
              </div>
              <div className="tight-grid">
                <button className="secondary-btn" onClick={() => setTab("structure")}>
                  Go to Structure
                </button>
                <button className="secondary-btn" onClick={() => setTab("logic")}>
                  Go to Logic
                </button>
                <button className="secondary-btn" onClick={() => setTab("timeline")}>
                  Go to Timeline
                </button>
                <button className="secondary-btn" onClick={() => setTab("analysis")}>
                  Go to Analysis
                </button>
                <button className="secondary-btn" onClick={() => setTab("workload")}>
                  Go to Workload
                </button>
              </div>
            </div>

            <div className="panel card-pad">
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
                Recent Activities
              </div>

              <div className="tight-grid">
                {tasks.length === 0 ? (
                  <div className="panel-soft card-pad empty-state">No activities yet.</div>
                ) : (
                  [...tasks]
                    .sort((a, b) => b.created_at.localeCompare(a.created_at))
                    .slice(0, 8)
                    .map((task) => (
                      <div key={task.id} className="panel-soft card-pad">
                        {recentEditingTaskId !== task.id ? (
                          <>
                            <div style={{ fontSize: 14, fontWeight: 700 }}>{task.title}</div>
                            <div className="task-meta">
                              {task.status}
                              {task.is_critical ? " · Critical" : ""}
                              {task.total_float_days !== null &&
                              task.total_float_days !== undefined
                                ? ` · Float ${task.total_float_days}d`
                                : ""}
                            </div>
                            <div className="task-meta">
                              {task.planned_start_date || "—"} → {task.planned_finish_date || "—"}
                            </div>

                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                              <button
                                className="blue-btn"
                                onClick={() => startEditRecentTask(task)}
                                disabled={working}
                              >
                                Edit
                              </button>

                              <button
                                className="secondary-btn"
                                onClick={async () => {
                                  setWorking(true);
                                  const { error } = await supabase
                                    .from("tasks")
                                    .update({ status: "doing" })
                                    .eq("id", task.id);

                                  if (error) {
                                    setWorking(false);
                                    alert("Update failed: " + error.message);
                                    return;
                                  }

                                  setWorking(false);
                                  await loadData();
                                }}
                                disabled={working}
                              >
                                Doing
                              </button>

                              <button
                                className="primary-btn"
                                onClick={async () => {
                                  setWorking(true);
                                  const { error } = await supabase
                                    .from("tasks")
                                    .update({ status: "done" })
                                    .eq("id", task.id);

                                  if (error) {
                                    setWorking(false);
                                    alert("Update failed: " + error.message);
                                    return;
                                  }

                                  setWorking(false);
                                  await loadData();
                                }}
                                disabled={working}
                              >
                                Done
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="tight-grid">
                            <input
                              value={recentTitle}
                              onChange={(e) => setRecentTitle(e.target.value)}
                              placeholder="Activity title"
                            />

                            <div className="tight-grid-2">
                              <select
                                value={recentStatus}
                                onChange={(e) =>
                                  setRecentStatus(
                                    e.target.value as "inbox" | "todo" | "doing" | "done"
                                  )
                                }
                              >
                                <option value="inbox">inbox</option>
                                <option value="todo">todo</option>
                                <option value="doing">doing</option>
                                <option value="done">done</option>
                              </select>

                              <input
                                type="number"
                                value={recentDuration}
                                onChange={(e) => setRecentDuration(e.target.value)}
                                placeholder="Duration (days)"
                              />

                              <input
                                type="date"
                                value={recentStartDate}
                                onChange={(e) => setRecentStartDate(e.target.value)}
                              />

                              <input
                                type="date"
                                value={recentFinishDate}
                                onChange={(e) => setRecentFinishDate(e.target.value)}
                              />
                            </div>

                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button
                                className="primary-btn"
                                onClick={() => saveRecentTask(task.id)}
                                disabled={working}
                              >
                                {working ? "Saving..." : "Save"}
                              </button>

                              <button
                                className="secondary-btn"
                                onClick={cancelEditRecentTask}
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
        </>
      ) : null}

      {tab === "structure" ? (
        <>
          <section className="tight-grid-2" style={{ marginBottom: 16 }}>
            <div className="panel card-pad">
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
                Create Work Package
              </div>
              <div className="tight-grid">
                <input
                  value={wpName}
                  onChange={(e) => setWpName(e.target.value)}
                  placeholder="Work package name"
                />
                <input
                  value={wpDescription}
                  onChange={(e) => setWpDescription(e.target.value)}
                  placeholder="Description"
                />
                <button className="primary-btn" onClick={addWorkPackage} disabled={working}>
                  {working ? "Working..." : "Add Work Package"}
                </button>
              </div>
            </div>

            <div className="panel card-pad">
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
                Add Activity
              </div>
              <div className="tight-grid">
                <input
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Activity name"
                />

                <div className="tight-grid-2">
                  <select
                    value={taskWorkPackageId}
                    onChange={(e) => setTaskWorkPackageId(e.target.value)}
                  >
                    <option value="">No Work Package</option>
                    {workPackages.map((wp) => (
                      <option key={wp.id} value={wp.id}>
                        {wp.name}
                      </option>
                    ))}
                  </select>

                  <input
                    value={taskWbsCode}
                    onChange={(e) => setTaskWbsCode(e.target.value)}
                    placeholder="WBS code"
                  />

                  <input
                    type="number"
                    value={taskDuration}
                    onChange={(e) => setTaskDuration(e.target.value)}
                    placeholder="Duration (days)"
                  />

                  <input
                    type="date"
                    value={taskStartDate}
                    onChange={(e) => setTaskStartDate(e.target.value)}
                  />

                  <input
                    type="date"
                    value={taskFinishDate}
                    onChange={(e) => setTaskFinishDate(e.target.value)}
                  />
                </div>

                <button className="primary-btn" onClick={addTask} disabled={working}>
                  {working ? "Working..." : "Add Activity"}
                </button>
              </div>
            </div>
          </section>

          <section className="panel card-pad">
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
              WBS Overview
            </div>

            <div className="tight-grid">
              {grouped.length === 0 ? (
                <div className="panel-soft card-pad empty-state">
                  No work packages yet.
                </div>
              ) : (
                grouped.map((wp) => (
                  <div key={wp.id} className="panel-soft card-pad">
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{wp.name}</div>
                    <div className="task-meta">{wp.description || "No description"}</div>

                    <div className="tight-grid" style={{ marginTop: 12 }}>
                      {wp.tasks.length === 0 ? (
                        <div className="text-muted" style={{ fontSize: 13 }}>
                          No activities in this work package.
                        </div>
                      ) : (
                        wp.tasks.map((task) => (
                          <div
                            key={task.id}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "100px 1fr 100px 180px",
                              gap: 12,
                              padding: "10px 0",
                              borderTop: "1px solid var(--border)",
                            }}
                          >
                            <div style={{ fontSize: 13 }}>{task.wbs_code || "—"}</div>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 600 }}>{task.title}</div>
                              <div className="task-meta">
                                {task.is_critical ? "Critical" : "Non-critical"}
                                {task.total_float_days !== null &&
                                task.total_float_days !== undefined
                                  ? ` · Float ${task.total_float_days}d`
                                  : ""}
                              </div>
                            </div>
                            <div style={{ fontSize: 13 }}>
                              {task.estimated_duration_days ?? "—"} d
                            </div>
                            <div style={{ fontSize: 13 }}>
                              {task.planned_start_date || "—"} → {task.planned_finish_date || "—"}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))
              )}

              {ungroupedTasks.length > 0 ? (
                <div className="panel-soft card-pad">
                  <div style={{ fontSize: 15, fontWeight: 700 }}>Ungrouped</div>
                  <div className="tight-grid" style={{ marginTop: 12 }}>
                    {ungroupedTasks.map((task) => (
                      <div
                        key={task.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "100px 1fr 100px 180px",
                          gap: 12,
                          padding: "10px 0",
                          borderTop: "1px solid var(--border)",
                        }}
                      >
                        <div style={{ fontSize: 13 }}>{task.wbs_code || "—"}</div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{task.title}</div>
                        <div style={{ fontSize: 13 }}>
                          {task.estimated_duration_days ?? "—"} d
                        </div>
                        <div style={{ fontSize: 13 }}>
                          {task.planned_start_date || "—"} → {task.planned_finish_date || "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </>
      ) : null}

      {tab === "logic" ? (
        <>
          <section className="panel card-pad" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
              Add Dependency
            </div>

            <div className="tight-grid-2">
              <select
                value={predecessorTaskId}
                onChange={(e) => setPredecessorTaskId(e.target.value)}
              >
                <option value="">Select predecessor</option>
                {sortedTasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {taskLabel(task.id)}
                  </option>
                ))}
              </select>

              <select
                value={successorTaskId}
                onChange={(e) => setSuccessorTaskId(e.target.value)}
              >
                <option value="">Select successor</option>
                {sortedTasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {taskLabel(task.id)}
                  </option>
                ))}
              </select>

              <select
                value={dependencyType}
                onChange={(e) => setDependencyType(e.target.value as DependencyType)}
              >
                <option value="FS">FS - Finish to Start</option>
                <option value="SS">SS - Start to Start</option>
                <option value="FF">FF - Finish to Finish</option>
                <option value="SF">SF - Start to Finish</option>
              </select>

              <input
                type="number"
                value={lagDays}
                onChange={(e) => setLagDays(e.target.value)}
                placeholder="Lag days"
              />
            </div>

            <div style={{ marginTop: 12 }}>
              <button className="primary-btn" onClick={addDependency} disabled={working}>
                {working ? "Working..." : "Add Dependency"}
              </button>
            </div>
          </section>

          <section className="panel card-pad">
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
              Dependency List
            </div>

            <div className="tight-grid">
              {dependencies.length === 0 ? (
                <div className="panel-soft card-pad empty-state">
                  No dependencies yet.
                </div>
              ) : (
                dependencies.map((dep) => (
                  <div key={dep.id} className="panel-soft card-pad">
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 120px 1fr auto",
                        gap: 12,
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>
                          {taskLabel(dep.predecessor_task_id)}
                        </div>
                        <div className="task-meta">Predecessor</div>
                      </div>

                      <div style={{ fontSize: 13, fontWeight: 700 }}>
                        {dep.dependency_type}
                        {dep.lag_days ? ` +${dep.lag_days}d` : ""}
                      </div>

                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>
                          {taskLabel(dep.successor_task_id)}
                        </div>
                        <div className="task-meta">Successor</div>
                      </div>

                      <button
                        className="danger-btn"
                        onClick={() => deleteDependency(dep.id)}
                        disabled={working}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </>
      ) : null}

      {tab === "timeline" ? (
        <>
          <section className="tight-grid-2" style={{ marginBottom: 16 }}>
            <div className="panel card-pad">
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
                Selected Day
              </div>

              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{ width: 160, marginBottom: 12 }}
              />

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
                        {task.total_float_days !== null &&
                        task.total_float_days !== undefined
                          ? ` · Float ${task.total_float_days}d`
                          : ""}
                      </div>

                      {editingTaskId !== task.id ? (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                          <button
                            className="blue-btn"
                            onClick={() => startEditTask(task)}
                            disabled={working}
                          >
                            Edit schedule
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

            <div className="panel card-pad">
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
                Legend
              </div>
              <div className="tight-grid">
                <div>Red = Critical</div>
                <div>Blue = Non-critical</div>
                <div>Round bar = Milestone</div>
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
                <div className="text-muted" style={{ fontSize: 12, fontWeight: 700 }}>WBS</div>
                <div className="text-muted" style={{ fontSize: 12, fontWeight: 700 }}>Activity</div>
                <div className="text-muted" style={{ fontSize: 12, fontWeight: 700 }}>Duration</div>
                <div className="text-muted" style={{ fontSize: 12, fontWeight: 700 }}>Start / Finish</div>
                <div className="text-muted" style={{ fontSize: 12, fontWeight: 700 }}>Predecessor</div>
                <div>
                  <div className="text-muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
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

                {tasks.map((task) => (
                  <div
                    key={task.id}
                    style={{
                      display: "contents",
                    }}
                  >
                    <div style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                      {task.wbs_code || "—"}
                    </div>
                    <div style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{task.title}</div>
                      <div className="task-meta">
                        {task.is_critical ? "Critical" : "Non-critical"}
                        {task.total_float_days !== null &&
                        task.total_float_days !== undefined
                          ? ` · Float ${task.total_float_days}d`
                          : ""}
                      </div>
                    </div>
                    <div style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                      {task.estimated_duration_days ?? "—"} d
                    </div>
                    <div style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                      {task.planned_start_date ? dateToLabel(task.planned_start_date) : "—"}
                      {" → "}
                      {task.planned_finish_date ? dateToLabel(task.planned_finish_date) : "—"}
                    </div>
                    <div style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                      {dependencyText(task.id)}
                    </div>
                    <div style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                      {renderBar(task)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">No planned dates yet.</div>
            )}
          </section>
        </>
      ) : null}

      {tab === "analysis" ? (
        <section className="panel card-pad" style={{ overflowX: "auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "100px 220px 80px 80px 80px 80px 80px 80px 100px 100px",
              gap: 12,
              alignItems: "center",
            }}
          >
            <div className="text-muted" style={{ fontSize: 12, fontWeight: 700 }}>WBS</div>
            <div className="text-muted" style={{ fontSize: 12, fontWeight: 700 }}>Activity</div>
            <div className="text-muted" style={{ fontSize: 12, fontWeight: 700 }}>Dur</div>
            <div className="text-muted" style={{ fontSize: 12, fontWeight: 700 }}>ES</div>
            <div className="text-muted" style={{ fontSize: 12, fontWeight: 700 }}>EF</div>
            <div className="text-muted" style={{ fontSize: 12, fontWeight: 700 }}>LS</div>
            <div className="text-muted" style={{ fontSize: 12, fontWeight: 700 }}>LF</div>
            <div className="text-muted" style={{ fontSize: 12, fontWeight: 700 }}>Float</div>
            <div className="text-muted" style={{ fontSize: 12, fontWeight: 700 }}>Critical</div>
            <div className="text-muted" style={{ fontSize: 12, fontWeight: 700 }}>Status</div>

            {tasks.map((task) => (
              <div key={task.id} style={{ display: "contents" }}>
                <div style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                  {task.wbs_code || "—"}
                </div>
                <div style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{task.title}</div>
                </div>
                <div style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                  {task.estimated_duration_days ?? "—"}
                </div>
                <div style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                  {task.earliest_start_day ?? "—"}
                </div>
                <div style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                  {task.earliest_finish_day ?? "—"}
                </div>
                <div style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                  {task.latest_start_day ?? "—"}
                </div>
                <div style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                  {task.latest_finish_day ?? "—"}
                </div>
                <div style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                  {task.total_float_days ?? "—"}
                </div>
                <div style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                  {task.is_critical ? (
                    <span
                      className="badge"
                      style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
                    >
                      Yes
                    </span>
                  ) : (
                    <span className="badge">No</span>
                  )}
                </div>
                <div style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                  {task.status}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "workload" ? (
        <>
          <section className="tight-grid-3" style={{ marginBottom: 16 }}>
            <div className="panel card-pad stat-card">
              <div className="stat-label">Scheduled Open Tasks</div>
              <div className="stat-number">{filteredWorkloadTasks.length}</div>
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

          <section className="panel card-pad" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
                    No planned dates yet.
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
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="panel card-pad">
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
                          Push 1 day
                        </button>

                        {tip.maxShiftDays >= 2 ? (
                          <button
                            className="secondary-btn"
                            onClick={() => pushTaskLater(tip.taskId!, 2)}
                            disabled={working}
                          >
                            Push 2 days
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}