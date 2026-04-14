"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { recomputeAndSaveProjectAnalysis } from "../../../lib/project-analysis-sync";
import { PageHeader } from "../../../components/app/PageHeader";
import { Project } from "../../../types/task";

type WorkspaceTab =
  | "overview"
  | "structure"
  | "logic"
  | "timeline"
  | "analysis"
  | "workload";

type DependencyType = "FS" | "SS" | "FF" | "SF";
type DurationUnit = "hours" | "days" | "weeks" | "months";
type TaskStatus = "inbox" | "todo" | "doing" | "done" | "inactive";

type WorkspaceProject = Project & {
  notes?: string | null;
  status?: "active" | "completed" | "archived" | string | null;
  completed_at?: string | null;
};

type ProjectWorkPackage = {
  id: number;
  project_id: number;
  name: string;
  description: string | null;
  manual_order: number | null;
  created_at: string;
};

type TaskDependency = {
  id: number;
  project_id: number;
  predecessor_task_id: number;
  successor_task_id: number;
  dependency_type: DependencyType;
  lag_days: number | null;
  created_at: string;
};

type TimelineTask = {
  id: number;
  title: string;
  status: TaskStatus;
  priority: "low" | "medium" | "high";
  context: string | null;
  project_id: number | null;
  work_package_id: number | null;
  wbs_code: string | null;

  estimated_duration_days: number | null;
  duration_value: number | null;
  duration_unit: DurationUnit | null;

  planned_start_date: string | null;
  planned_finish_date: string | null;

  due_date: string | null;
  scheduled_date: string | null;
  start_time: string | null;
  end_time: string | null;

  is_quick_task: boolean | null;
  must_do_today: boolean | null;
  is_milestone: boolean | null;
  is_critical: boolean | null;
  is_active: boolean | null;

  notes: string | null;
  description: string | null;
  assignee: string | null;

  parent_task_id: number | null;
  sort_order: number | null;

  earliest_start_day: number | null;
  earliest_finish_day: number | null;
  latest_start_day: number | null;
  latest_finish_day: number | null;
  total_float_days: number | null;
  free_float_days: number | null;

  created_at: string;
};

type WorkPackageDraft = {
  name: string;
  description: string;
};

type TaskDraft = {
  title: string;
  description: string;
  notes: string;
  status: TaskStatus;
  priority: "low" | "medium" | "high";
  wbsCode: string;
  assignee: string;
  durationValue: string;
  durationUnit: DurationUnit;
  startDate: string;
  finishDate: string;
  isMilestone: boolean;
};

type DependencyDraft = {
  predecessorTaskId: string;
  successorTaskId: string;
  dependencyType: DependencyType;
  lagDays: string;
};

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function diffDaysInclusive(start: string, finish: string) {
  const s = new Date(start);
  const f = new Date(finish);
  const diff = Math.round((f.getTime() - s.getTime()) / 86400000);
  return diff + 1;
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

function durationToDays(value: number | null, unit: DurationUnit | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  const v = Number(value);
  if (unit === "hours") return Number((v / 8).toFixed(3));
  if (unit === "days" || !unit) return Number(v.toFixed(3));
  if (unit === "weeks") return Number((v * 5).toFixed(3));
  return Number((v * 20).toFixed(3));
}

function formatTaskDuration(task: TimelineTask) {
  if (task.duration_value !== null && task.duration_value !== undefined) {
    const unit = task.duration_unit || "days";
    const singular =
      Number(task.duration_value) === 1 ? unit.slice(0, -1) : unit;
    return `${task.duration_value} ${singular}`;
  }
  if (task.estimated_duration_days !== null && task.estimated_duration_days !== undefined) {
    return `${task.estimated_duration_days} d`;
  }
  return "—";
}

function makeTaskDraft(task: TimelineTask): TaskDraft {
  return {
    title: task.title || "",
    description: task.description || "",
    notes: task.notes || "",
    status: task.status || "todo",
    priority: task.priority || "medium",
    wbsCode: task.wbs_code || "",
    assignee: task.assignee || "",
    durationValue:
      task.duration_value !== null && task.duration_value !== undefined
        ? String(task.duration_value)
        : task.estimated_duration_days !== null && task.estimated_duration_days !== undefined
        ? String(task.estimated_duration_days)
        : "",
    durationUnit: task.duration_unit || "days",
    startDate: task.planned_start_date || "",
    finishDate: task.planned_finish_date || "",
    isMilestone: !!task.is_milestone,
  };
}

function sortTasksForDisplay(tasks: TimelineTask[]) {
  return [...tasks].sort((a, b) => {
    const aDone = a.status === "done" ? 1 : 0;
    const bDone = b.status === "done" ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;

    const aOrder = a.sort_order ?? 999999;
    const bOrder = b.sort_order ?? 999999;
    if (aOrder !== bOrder) return aOrder - bOrder;

    const aCode = a.wbs_code || "";
    const bCode = b.wbs_code || "";
    if (aCode && bCode) return aCode.localeCompare(bCode);

    return a.title.localeCompare(b.title);
  });
}

function defaultEndTimeFromStart(start: string, hours: number) {
  const [h, m] = start.split(":").map(Number);
  const total = h * 60 + m + Math.round(hours * 60);
  const endH = Math.floor(total / 60);
  const endM = total % 60;
  return `${String(Math.min(endH, 23)).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
}

function Section({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="panel card-pad workspace-section">
      <div className="workspace-section-header">
        <div>
          <div className="workspace-section-title">{title}</div>
          {subtitle ? <div className="workspace-section-subtitle">{subtitle}</div> : null}
        </div>
        {actions ? <div className="workspace-section-actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="panel card-pad stat-card workspace-metric">
      <div className="stat-label">{label}</div>
      <div className="stat-number">{value}</div>
    </div>
  );
}

export default function ProjectWorkspacePage() {
  const params = useParams();
  const projectId = Number(params.id);

  const [project, setProject] = useState<WorkspaceProject | null>(null);
  const [workPackages, setWorkPackages] = useState<ProjectWorkPackage[]>([]);
  const [tasks, setTasks] = useState<TimelineTask[]>([]);
  const [dependencies, setDependencies] = useState<TaskDependency[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const [tab, setTab] = useState<WorkspaceTab>("overview");

  const [projectEditOpen, setProjectEditOpen] = useState(false);
  const [createWorkPackageOpen, setCreateWorkPackageOpen] = useState(false);
  const [createActivityOpen, setCreateActivityOpen] = useState(false);
  const [addDependencyOpen, setAddDependencyOpen] = useState(false);

  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectNotes, setProjectNotes] = useState("");

  const [wpName, setWpName] = useState("");
  const [wpDescription, setWpDescription] = useState("");

  const [editingWpId, setEditingWpId] = useState<number | null>(null);
  const [editingWpDraft, setEditingWpDraft] = useState<WorkPackageDraft | null>(null);

  const [newRootTitle, setNewRootTitle] = useState("");
  const [newRootWorkPackageId, setNewRootWorkPackageId] = useState<string>("");
  const [newRootWbsCode, setNewRootWbsCode] = useState("");
  const [newRootDurationValue, setNewRootDurationValue] = useState("");
  const [newRootDurationUnit, setNewRootDurationUnit] = useState<DurationUnit>("days");
  const [newRootStartDate, setNewRootStartDate] = useState("");
  const [newRootFinishDate, setNewRootFinishDate] = useState("");

  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingTaskDraft, setEditingTaskDraft] = useState<TaskDraft | null>(null);

  const [addingChildFor, setAddingChildFor] = useState<number | null>(null);
  const [newChildTitle, setNewChildTitle] = useState("");

  const [predecessorTaskId, setPredecessorTaskId] = useState("");
  const [successorTaskId, setSuccessorTaskId] = useState("");
  const [dependencyType, setDependencyType] = useState<DependencyType>("FS");
  const [lagDays, setLagDays] = useState("0");

  const [editingDependencyId, setEditingDependencyId] = useState<number | null>(null);
  const [editingDependencyDraft, setEditingDependencyDraft] = useState<DependencyDraft | null>(null);

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [scheduleEditTaskId, setScheduleEditTaskId] = useState<number | null>(null);
  const [editStartDate, setEditStartDate] = useState("");
  const [editFinishDate, setEditFinishDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");

  const [timelineSelectedTaskId, setTimelineSelectedTaskId] = useState<number | null>(null);

  const [poolEditingTaskId, setPoolEditingTaskId] = useState<number | null>(null);
  const [poolStartTime, setPoolStartTime] = useState("09:00");
  const [poolEndTime, setPoolEndTime] = useState("10:00");

  const [dailyCapacity, setDailyCapacity] = useState(8);
  const [selectedAssignee, setSelectedAssignee] = useState("all");

  const loadData = async () => {
    setLoading(true);

    const { data: projectData } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    const { data: wpData } = await supabase
      .from("project_work_packages")
      .select("*")
      .eq("project_id", projectId)
      .order("manual_order", { ascending: true });

    const { data: taskData } = await supabase
      .from("tasks")
      .select("*")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    const { data: depData } = await supabase
      .from("task_dependencies")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

    const nextProject = (projectData as WorkspaceProject) || null;
    setProject(nextProject);
    setWorkPackages((wpData as ProjectWorkPackage[]) || []);
    setTasks((taskData as TimelineTask[]) || []);
    setDependencies((depData as TaskDependency[]) || []);

    if (nextProject) {
      setProjectName(nextProject.name || "");
      setProjectDescription(nextProject.description || "");
      setProjectNotes(nextProject.notes || "");
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!Number.isNaN(projectId)) loadData();
  }, [projectId]);

  const flatSortedTasks = useMemo(() => sortTasksForDisplay(tasks), [tasks]);

  const groupedTasks = useMemo(() => {
    const map = new Map<number | null, TimelineTask[]>();
    for (const task of tasks) {
      const key = task.parent_task_id ?? null;
      const arr = map.get(key) || [];
      arr.push(task);
      map.set(key, arr);
    }
    for (const [, arr] of map.entries()) {
      arr.sort((a, b) => {
        const aDone = a.status === "done" ? 1 : 0;
        const bDone = b.status === "done" ? 1 : 0;
        if (aDone !== bDone) return aDone - bDone;

        const aOrder = a.sort_order ?? 999999;
        const bOrder = b.sort_order ?? 999999;
        if (aOrder !== bOrder) return aOrder - bOrder;

        return a.created_at.localeCompare(b.created_at);
      });
    }
    return map;
  }, [tasks]);

  const groupedByWorkPackage = useMemo(() => {
    return workPackages.map((wp) => ({
      ...wp,
      rootTasks: (groupedTasks.get(null) || []).filter((task) => task.work_package_id === wp.id),
    }));
  }, [workPackages, groupedTasks]);

  const ungroupedRootTasks = useMemo(() => {
    return (groupedTasks.get(null) || []).filter((task) => task.work_package_id === null);
  }, [groupedTasks]);

  const stats = useMemo(() => {
    const activeTasks = tasks.filter((t) => t.is_active !== false);
    const done = activeTasks.filter((t) => t.status === "done").length;
    const open = activeTasks.filter((t) => t.status !== "done" && t.status !== "inactive").length;
    const critical = activeTasks.filter((t) => !!t.is_critical).length;
    const milestones = activeTasks.filter((t) => !!t.is_milestone).length;
    const progress = activeTasks.length === 0 ? 0 : Math.round((done / activeTasks.length) * 100);
    return { total: activeTasks.length, done, open, critical, milestones, progress };
  }, [tasks]);

  const urgentTasks = useMemo(() => {
    return [...tasks]
      .filter((task) => task.is_active !== false && task.status !== "done" && task.status !== "inactive")
      .sort((a, b) => {
        const aMust = a.must_do_today ? 1 : 0;
        const bMust = b.must_do_today ? 1 : 0;
        if (aMust !== bMust) return bMust - aMust;
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        if (priorityOrder[b.priority] !== priorityOrder[a.priority]) {
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        if (a.planned_finish_date && b.planned_finish_date) {
          return a.planned_finish_date.localeCompare(b.planned_finish_date);
        }
        if (a.planned_finish_date && !b.planned_finish_date) return -1;
        if (!a.planned_finish_date && b.planned_finish_date) return 1;
        return b.created_at.localeCompare(a.created_at);
      })
      .slice(0, 5);
  }, [tasks]);

  const assignees = useMemo(() => {
    return Array.from(new Set(tasks.map((task) => task.assignee || "Unassigned").filter(Boolean))).sort();
  }, [tasks]);

  const taskLabel = (taskId: number) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return String(taskId);
    return `${task.wbs_code || task.id} - ${task.title}`;
  };

  const timelineRange = useMemo(() => {
    const validStarts = tasks.map((t) => t.planned_start_date).filter(Boolean) as string[];
    const validEnds = tasks.map((t) => t.planned_finish_date).filter(Boolean) as string[];
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
          ? `${predTask.wbs_code || predTask.id} (${dep.dependency_type}${dep.lag_days ? ` +${dep.lag_days}d` : ""})`
          : `${dep.predecessor_task_id}`;
      })
      .join(", ");
  };

  const dayScheduledTasks = useMemo(() => {
    return sortTasksForDisplay(
      tasks.filter(
        (task) =>
          task.status !== "done" &&
          task.status !== "inactive" &&
          task.scheduled_date === selectedDate &&
          !!task.start_time &&
          !!task.end_time
      )
    );
  }, [tasks, selectedDate]);

  const dayTaskPool = useMemo(() => {
    return sortTasksForDisplay(
      tasks.filter((task) => {
        if (task.status === "done" || task.status === "inactive") return false;
        const activeByPlan =
          !!task.planned_start_date &&
          !!task.planned_finish_date &&
          selectedDate >= task.planned_start_date &&
          selectedDate <= task.planned_finish_date;
        const dueHere = task.due_date === selectedDate;
        const scheduledHere = task.scheduled_date === selectedDate;
        const quick = !!task.is_quick_task;
        const inPool = activeByPlan || dueHere || scheduledHere || quick;
        const alreadyTimed =
          task.scheduled_date === selectedDate && !!task.start_time && !!task.end_time;
        return inPool && !alreadyTimed;
      })
    );
  }, [tasks, selectedDate]);

  const selectedTimelineTask = useMemo(() => {
    if (!timelineSelectedTaskId) return null;
    return tasks.find((t) => t.id === timelineSelectedTaskId) || null;
  }, [tasks, timelineSelectedTaskId]);

  const schedulableTasks = useMemo(() => {
    return tasks.filter(
      (task) =>
        task.planned_start_date &&
        task.planned_finish_date &&
        task.status !== "done" &&
        task.status !== "inactive"
    );
  }, [tasks]);

  const filteredWorkloadTasks = useMemo(() => {
    if (selectedAssignee === "all") return schedulableTasks;
    return schedulableTasks.filter((task) => (task.assignee || "Unassigned") === selectedAssignee);
  }, [schedulableTasks, selectedAssignee]);

  const dailyLoad = useMemo(() => {
    const dayMap = new Map<string, { date: string; totalHours: number; criticalHours: number; nonCriticalHours: number; overload: boolean; tasks: TimelineTask[] }>();
    for (const task of filteredWorkloadTasks) {
      const start = task.planned_start_date!;
      const finish = task.planned_finish_date!;
      const hours = Number(task.estimated_duration_days ?? 0) <= 0 ? 8 : Number(task.estimated_duration_days) < 1 ? Math.max(1, Math.round(Number(task.estimated_duration_days) * 8)) : 8;
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

  const suggestions = useMemo(() => {
    const overloadedDays = dailyLoad.filter((d) => d.overload);
    const tips: Array<{ date: string; taskId: number | null; taskTitle: string | null; maxShiftDays: number; message: string }> = [];
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
    if (!task.planned_start_date || !task.planned_finish_date || timelineRange.length === 0) {
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
          const selected = day === selectedDate;
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
                  : selected
                  ? "rgba(33, 150, 243, 0.08)"
                  : "var(--panel-soft-2)",
                opacity: active ? 1 : 0.55,
                outline: selected ? "1px solid var(--primary)" : "none",
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
    } finally {
      setWorking(false);
    }
  };

  const saveProjectDetails = async () => {
    if (!projectName.trim()) {
      alert("Project name is required");
      return;
    }
    setWorking(true);
    const { error } = await supabase
      .from("projects")
      .update({
        name: projectName.trim(),
        description: projectDescription.trim() || null,
        notes: projectNotes.trim() || null,
      })
      .eq("id", projectId);
    setWorking(false);
    if (error) {
      alert("Save project failed: " + error.message);
      return;
    }
    setProjectEditOpen(false);
    await loadData();
  };

  const setProjectCompleted = async (completed: boolean) => {
    setWorking(true);
    const { error: projectError } = await supabase
      .from("projects")
      .update({
        status: completed ? "completed" : "active",
        completed_at: completed ? new Date().toISOString() : null,
      })
      .eq("id", projectId);
    if (projectError) {
      setWorking(false);
      alert("Project update failed: " + projectError.message);
      return;
    }
    const { error: taskError } = await supabase
      .from("tasks")
      .update({
        status: completed ? "inactive" : "todo",
        is_active: !completed,
      })
      .eq("project_id", projectId)
      .neq("status", "done");
    setWorking(false);
    if (taskError) {
      alert("Task update failed: " + taskError.message);
      return;
    }
    await loadData();
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
      description: wpDescription.trim() || null,
      manual_order: nextOrder,
    });
    setWorking(false);
    if (error) {
      alert("Create work package failed: " + error.message);
      return;
    }
    setWpName("");
    setWpDescription("");
    setCreateWorkPackageOpen(false);
    await loadData();
  };

  const startEditWorkPackage = (wp: ProjectWorkPackage) => {
    setEditingWpId(wp.id);
    setEditingWpDraft({
      name: wp.name || "",
      description: wp.description || "",
    });
  };

  const cancelEditWorkPackage = () => {
    setEditingWpId(null);
    setEditingWpDraft(null);
  };

  const saveWorkPackage = async (id: number) => {
    if (!editingWpDraft || !editingWpDraft.name.trim()) {
      alert("Work package name is required");
      return;
    }
    setWorking(true);
    const { error } = await supabase
      .from("project_work_packages")
      .update({
        name: editingWpDraft.name.trim(),
        description: editingWpDraft.description.trim() || null,
      })
      .eq("id", id);
    setWorking(false);
    if (error) {
      alert("Save work package failed: " + error.message);
      return;
    }
    cancelEditWorkPackage();
    await loadData();
  };

  const deleteWorkPackage = async (id: number) => {
    const ok = window.confirm("Delete this work package?");
    if (!ok) return;
    setWorking(true);
    const { error } = await supabase.from("project_work_packages").delete().eq("id", id);
    setWorking(false);
    if (error) {
      alert("Delete work package failed: " + error.message);
      return;
    }
    await loadData();
  };

  const addRootTask = async () => {
    if (!newRootTitle.trim()) {
      alert("Activity title is required");
      return;
    }
    const durationValue = newRootDurationValue ? Number(newRootDurationValue) : null;
    const estimatedDays = durationToDays(durationValue, newRootDurationUnit);
    const nextSort =
      tasks.length === 0 ? 1 : Math.max(...tasks.map((t) => t.sort_order || 0)) + 1;
    setWorking(true);
    const { error } = await supabase.from("tasks").insert({
      title: newRootTitle.trim(),
      description: null,
      notes: null,
      status: "todo",
      priority: "medium",
      context: "project",
      project_id: projectId,
      work_package_id: newRootWorkPackageId ? Number(newRootWorkPackageId) : null,
      parent_task_id: null,
      sort_order: nextSort,
      wbs_code: newRootWbsCode.trim() || null,
      duration_value: durationValue,
      duration_unit: newRootDurationUnit,
      estimated_duration_days: estimatedDays,
      planned_start_date: newRootStartDate || null,
      planned_finish_date: newRootFinishDate || null,
      scheduled_date: newRootStartDate || null,
      is_quick_task: false,
      estimated_minutes: null,
      reference_link: null,
      start_time: null,
      end_time: null,
      recurring_enabled: false,
      recurring_type: null,
      recurring_interval: null,
      recurring_days_of_week: null,
      energy_level: null,
      must_do_today: false,
      is_milestone: false,
      is_active: true,
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
    setNewRootTitle("");
    setNewRootWorkPackageId("");
    setNewRootWbsCode("");
    setNewRootDurationValue("");
    setNewRootDurationUnit("days");
    setNewRootStartDate("");
    setNewRootFinishDate("");
    setCreateActivityOpen(false);
    setWorking(false);
    await loadData();
  };

  const addChildTask = async (parentTaskId: number) => {
    if (!newChildTitle.trim()) {
      alert("Sub-task title is required");
      return;
    }
    const parent = tasks.find((t) => t.id === parentTaskId);
    const siblingMax =
      Math.max(
        0,
        ...tasks.filter((t) => t.parent_task_id === parentTaskId).map((t) => t.sort_order || 0)
      ) + 1;
    setWorking(true);
    const { error } = await supabase.from("tasks").insert({
      title: newChildTitle.trim(),
      description: null,
      notes: null,
      status: "todo",
      priority: "medium",
      context: "project",
      project_id: projectId,
      work_package_id: parent?.work_package_id || null,
      parent_task_id: parentTaskId,
      sort_order: siblingMax,
      wbs_code: null,
      duration_value: 1,
      duration_unit: "days",
      estimated_duration_days: 1,
      planned_start_date: parent?.planned_start_date || null,
      planned_finish_date: parent?.planned_finish_date || null,
      scheduled_date: parent?.planned_start_date || null,
      is_quick_task: false,
      estimated_minutes: null,
      reference_link: null,
      start_time: null,
      end_time: null,
      recurring_enabled: false,
      recurring_type: null,
      recurring_interval: null,
      recurring_days_of_week: null,
      energy_level: null,
      must_do_today: false,
      is_milestone: false,
      is_active: true,
      user_id: null,
    });
    if (error) {
      setWorking(false);
      alert("Create sub-task failed: " + error.message);
      return;
    }
    try {
      await recomputeAndSaveProjectAnalysis(projectId);
    } catch {}
    setWorking(false);
    setAddingChildFor(null);
    setNewChildTitle("");
    await loadData();
  };

  const startEditTask = (task: TimelineTask) => {
    setEditingTaskId(task.id);
    setEditingTaskDraft(makeTaskDraft(task));
  };

  const cancelEditTask = () => {
    setEditingTaskId(null);
    setEditingTaskDraft(null);
  };

  const saveTask = async (taskId: number) => {
    if (!editingTaskDraft || !editingTaskDraft.title.trim()) {
      alert("Task title is required");
      return;
    }
    const durationValue = editingTaskDraft.durationValue
      ? Number(editingTaskDraft.durationValue)
      : null;
    setWorking(true);
    const { error } = await supabase
      .from("tasks")
      .update({
        title: editingTaskDraft.title.trim(),
        description: editingTaskDraft.description.trim() || null,
        notes: editingTaskDraft.notes.trim() || null,
        status: editingTaskDraft.status,
        priority: editingTaskDraft.priority,
        wbs_code: editingTaskDraft.wbsCode.trim() || null,
        assignee: editingTaskDraft.assignee.trim() || null,
        duration_value: durationValue,
        duration_unit: editingTaskDraft.durationUnit,
        estimated_duration_days: durationToDays(durationValue, editingTaskDraft.durationUnit),
        planned_start_date: editingTaskDraft.startDate || null,
        planned_finish_date: editingTaskDraft.finishDate || null,
        scheduled_date: editingTaskDraft.startDate || null,
        is_milestone: editingTaskDraft.isMilestone,
      })
      .eq("id", taskId);
    if (error) {
      setWorking(false);
      alert("Save task failed: " + error.message);
      return;
    }
    try {
      await recomputeAndSaveProjectAnalysis(projectId);
    } catch {}
    setWorking(false);
    cancelEditTask();
    await loadData();
  };

  const deleteTask = async (taskId: number) => {
    const ok = window.confirm("Delete this task?");
    if (!ok) return;
    setWorking(true);
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) {
      setWorking(false);
      alert("Delete task failed: " + error.message);
      return;
    }
    try {
      await recomputeAndSaveProjectAnalysis(projectId);
    } catch {}
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
    setAddDependencyOpen(false);
    setWorking(false);
    await loadData();
  };

  const startEditDependency = (dep: TaskDependency) => {
    setEditingDependencyId(dep.id);
    setEditingDependencyDraft({
      predecessorTaskId: String(dep.predecessor_task_id),
      successorTaskId: String(dep.successor_task_id),
      dependencyType: dep.dependency_type,
      lagDays: String(dep.lag_days ?? 0),
    });
  };

  const cancelEditDependency = () => {
    setEditingDependencyId(null);
    setEditingDependencyDraft(null);
  };

  const saveDependency = async (id: number) => {
    if (!editingDependencyDraft) return;
    if (!editingDependencyDraft.predecessorTaskId || !editingDependencyDraft.successorTaskId) {
      alert("Please select both predecessor and successor");
      return;
    }
    if (editingDependencyDraft.predecessorTaskId === editingDependencyDraft.successorTaskId) {
      alert("A task cannot depend on itself");
      return;
    }
    setWorking(true);
    const { error } = await supabase
      .from("task_dependencies")
      .update({
        predecessor_task_id: Number(editingDependencyDraft.predecessorTaskId),
        successor_task_id: Number(editingDependencyDraft.successorTaskId),
        dependency_type: editingDependencyDraft.dependencyType,
        lag_days: Number(editingDependencyDraft.lagDays || 0),
      })
      .eq("id", id);
    if (error) {
      setWorking(false);
      alert("Save dependency failed: " + error.message);
      return;
    }
    try {
      await recomputeAndSaveProjectAnalysis(projectId);
    } catch {}
    setWorking(false);
    cancelEditDependency();
    await loadData();
  };

  const deleteDependency = async (id: number) => {
    const ok = window.confirm("Delete this dependency?");
    if (!ok) return;
    setWorking(true);
    const { error } = await supabase.from("task_dependencies").delete().eq("id", id);
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

  const startEditSchedule = (task: TimelineTask) => {
    setScheduleEditTaskId(task.id);
    setEditStartDate(task.planned_start_date || "");
    setEditFinishDate(task.planned_finish_date || "");
    setEditStartTime(task.start_time || "");
    setEditEndTime(task.end_time || "");
  };

  const cancelEditSchedule = () => {
    setScheduleEditTaskId(null);
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
    cancelEditSchedule();
    setWorking(false);
    await loadData();
  };

  const shiftTaskByDays = async (taskId: number, days: number) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task?.planned_start_date || !task?.planned_finish_date) {
      alert("This task needs both start and finish dates first.");
      return;
    }
    setWorking(true);
    const { error } = await supabase
      .from("tasks")
      .update({
        planned_start_date: addDays(task.planned_start_date, days),
        planned_finish_date: addDays(task.planned_finish_date, days),
        scheduled_date: task.scheduled_date
          ? addDays(task.scheduled_date, days)
          : addDays(task.planned_start_date, days),
      })
      .eq("id", taskId);
    if (error) {
      setWorking(false);
      alert("Shift task failed: " + error.message);
      return;
    }
    try {
      await recomputeAndSaveProjectAnalysis(projectId);
    } catch {}
    setWorking(false);
    await loadData();
  };

  const stretchTaskDuration = async (taskId: number, deltaDays: number) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task?.planned_start_date || !task?.planned_finish_date) {
      alert("This task needs both start and finish dates first.");
      return;
    }
    const currentSpan = diffDaysInclusive(task.planned_start_date, task.planned_finish_date);
    const nextSpan = Math.max(1, currentSpan + deltaDays);
    const nextFinish = addDays(task.planned_start_date, nextSpan - 1);
    setWorking(true);
    const { error } = await supabase
      .from("tasks")
      .update({
        planned_finish_date: nextFinish,
        estimated_duration_days: nextSpan,
        duration_value: nextSpan,
        duration_unit: "days",
      })
      .eq("id", taskId);
    if (error) {
      setWorking(false);
      alert("Update duration failed: " + error.message);
      return;
    }
    try {
      await recomputeAndSaveProjectAnalysis(projectId);
    } catch {}
    setWorking(false);
    await loadData();
  };

  const snapTaskToSelectedDate = async (taskId: number) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task?.planned_start_date || !task?.planned_finish_date) {
      alert("This task needs both start and finish dates first.");
      return;
    }
    const span = diffDaysInclusive(task.planned_start_date, task.planned_finish_date);
    const nextFinish = addDays(selectedDate, span - 1);
    setWorking(true);
    const { error } = await supabase
      .from("tasks")
      .update({
        planned_start_date: selectedDate,
        planned_finish_date: nextFinish,
        scheduled_date: selectedDate,
      })
      .eq("id", taskId);
    if (error) {
      setWorking(false);
      alert("Move task failed: " + error.message);
      return;
    }
    try {
      await recomputeAndSaveProjectAnalysis(projectId);
    } catch {}
    setWorking(false);
    await loadData();
  };

  const assignTaskToDayBlock = async (task: TimelineTask) => {
    setWorking(true);
    const { error } = await supabase
      .from("tasks")
      .update({
        scheduled_date: selectedDate,
        start_time: poolStartTime || null,
        end_time: poolEndTime || null,
      })
      .eq("id", task.id);
    if (error) {
      setWorking(false);
      alert("Assign time failed: " + error.message);
      return;
    }
    setPoolEditingTaskId(null);
    setWorking(false);
    await loadData();
  };

  const clearTaskBlock = async (taskId: number) => {
    setWorking(true);
    const { error } = await supabase
      .from("tasks")
      .update({
        start_time: null,
        end_time: null,
      })
      .eq("id", taskId);
    if (error) {
      setWorking(false);
      alert("Clear time failed: " + error.message);
      return;
    }
    setWorking(false);
    await loadData();
  };

  const quickAssignTwoHours = async (task: TimelineTask, start: string) => {
    const end = defaultEndTimeFromStart(start, 2);
    setWorking(true);
    const { error } = await supabase
      .from("tasks")
      .update({
        scheduled_date: selectedDate,
        start_time: start,
        end_time: end,
      })
      .eq("id", task.id);
    if (error) {
      setWorking(false);
      alert("Quick assign failed: " + error.message);
      return;
    }
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

  const renderTaskTree = (parentId: number | null, workPackageId: number | null, depth = 0): React.ReactNode => {
    const children = sortTasksForDisplay(
      (groupedTasks.get(parentId) || []).filter((task) => task.work_package_id === workPackageId)
    );
    if (children.length === 0) return null;

    return children.map((task) => {
      const isEditing = editingTaskId === task.id && editingTaskDraft;
      const grandChildren = (groupedTasks.get(task.id) || []).filter((t) => t.work_package_id === workPackageId);

      return (
        <div key={task.id} style={{ marginLeft: depth * 22 }}>
          <div
            className="panel-soft card-pad workspace-task-row"
            style={{ marginBottom: 10, opacity: task.status === "done" ? 0.72 : 1 }}
          >
            {!isEditing ? (
              <>
                <div className="workspace-row-top">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="workspace-row-title-wrap">
                      <div
                        className="workspace-row-title"
                        style={{ textDecoration: task.status === "done" ? "line-through" : "none" }}
                      >
                        {task.title}
                      </div>
                      <div className="badge">{task.parent_task_id ? "sub-task" : "activity"}</div>
                      <div className="badge">{task.priority}</div>
                      <div className="badge">{formatTaskDuration(task)}</div>
                      {task.wbs_code ? <div className="badge">{task.wbs_code}</div> : null}
                    </div>

                    {task.description ? (
                      <div className="task-meta" style={{ marginTop: 6 }}>
                        {task.description}
                      </div>
                    ) : null}

                    <div className="task-meta" style={{ marginTop: 8 }}>
                      {task.planned_start_date || "—"} → {task.planned_finish_date || "—"}
                      {task.assignee ? ` · ${task.assignee}` : ""}
                      {task.is_milestone ? " · Milestone" : ""}
                    </div>

                    {task.notes ? (
                      <div className="task-meta" style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>
                        {task.notes}
                      </div>
                    ) : null}
                  </div>

                  <div className="workspace-row-actions">
                    <button className="secondary-btn" onClick={() => startEditTask(task)} disabled={working}>
                      Edit
                    </button>
                    <button
                      className="blue-btn"
                      onClick={() => {
                        setAddingChildFor(task.id);
                        setNewChildTitle("");
                      }}
                      disabled={working}
                    >
                      + Sub-task
                    </button>
                    <button className="danger-btn" onClick={() => deleteTask(task.id)} disabled={working}>
                      Delete
                    </button>
                  </div>
                </div>

                {addingChildFor === task.id ? (
                  <div className="tight-grid-2" style={{ marginTop: 12 }}>
                    <input
                      value={newChildTitle}
                      onChange={(e) => setNewChildTitle(e.target.value)}
                      placeholder="New sub-task title"
                    />
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button className="primary-btn" onClick={() => addChildTask(task.id)} disabled={working}>
                        Add
                      </button>
                      <button
                        className="secondary-btn"
                        onClick={() => {
                          setAddingChildFor(null);
                          setNewChildTitle("");
                        }}
                        disabled={working}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="tight-grid">
                <input
                  value={editingTaskDraft.title}
                  onChange={(e) => setEditingTaskDraft({ ...editingTaskDraft, title: e.target.value })}
                  placeholder="Title"
                />

                <textarea
                  value={editingTaskDraft.description}
                  onChange={(e) => setEditingTaskDraft({ ...editingTaskDraft, description: e.target.value })}
                  placeholder="Description"
                  rows={3}
                />

                <textarea
                  value={editingTaskDraft.notes}
                  onChange={(e) => setEditingTaskDraft({ ...editingTaskDraft, notes: e.target.value })}
                  placeholder="Notes"
                  rows={4}
                />

                <div className="tight-grid-2">
                  <select
                    value={editingTaskDraft.status}
                    onChange={(e) =>
                      setEditingTaskDraft({
                        ...editingTaskDraft,
                        status: e.target.value as TaskStatus,
                      })
                    }
                  >
                    <option value="inbox">inbox</option>
                    <option value="todo">todo</option>
                    <option value="doing">doing</option>
                    <option value="done">done</option>
                    <option value="inactive">inactive</option>
                  </select>

                  <select
                    value={editingTaskDraft.priority}
                    onChange={(e) =>
                      setEditingTaskDraft({
                        ...editingTaskDraft,
                        priority: e.target.value as "low" | "medium" | "high",
                      })
                    }
                  >
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                  </select>
                </div>

                <div className="tight-grid-2">
                  <input
                    value={editingTaskDraft.wbsCode}
                    onChange={(e) => setEditingTaskDraft({ ...editingTaskDraft, wbsCode: e.target.value })}
                    placeholder="WBS code"
                  />
                  <input
                    value={editingTaskDraft.assignee}
                    onChange={(e) => setEditingTaskDraft({ ...editingTaskDraft, assignee: e.target.value })}
                    placeholder="Assignee"
                  />
                </div>

                <div className="tight-grid-2">
                  <input
                    value={editingTaskDraft.durationValue}
                    onChange={(e) => setEditingTaskDraft({ ...editingTaskDraft, durationValue: e.target.value })}
                    placeholder="Duration"
                  />
                  <select
                    value={editingTaskDraft.durationUnit}
                    onChange={(e) =>
                      setEditingTaskDraft({
                        ...editingTaskDraft,
                        durationUnit: e.target.value as DurationUnit,
                      })
                    }
                  >
                    <option value="hours">hours</option>
                    <option value="days">days</option>
                    <option value="weeks">weeks</option>
                    <option value="months">months</option>
                  </select>
                </div>

                <div className="tight-grid-2">
                  <input
                    type="date"
                    value={editingTaskDraft.startDate}
                    onChange={(e) => setEditingTaskDraft({ ...editingTaskDraft, startDate: e.target.value })}
                  />
                  <input
                    type="date"
                    value={editingTaskDraft.finishDate}
                    onChange={(e) => setEditingTaskDraft({ ...editingTaskDraft, finishDate: e.target.value })}
                  />
                </div>

                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={editingTaskDraft.isMilestone}
                    onChange={(e) =>
                      setEditingTaskDraft({
                        ...editingTaskDraft,
                        isMilestone: e.target.checked,
                      })
                    }
                  />
                  Milestone
                </label>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="primary-btn" onClick={() => saveTask(task.id)} disabled={working}>
                    Save
                  </button>
                  <button className="secondary-btn" onClick={cancelEditTask} disabled={working}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {grandChildren.length > 0 ? renderTaskTree(task.id, workPackageId, depth + 1) : null}
        </div>
      );
    });
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
    <div className="page-wrap" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHeader
        kicker="Projects"
        title={project.name}
        description={project.description || "Single-page project workspace"}
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/projects" className="secondary-btn">
              Back to Projects
            </Link>
            <button className="secondary-btn" onClick={() => setProjectEditOpen((v) => !v)}>
              {projectEditOpen ? "Close edit" : "Edit project"}
            </button>
            {project.status === "completed" ? (
              <button className="primary-btn" onClick={() => setProjectCompleted(false)} disabled={working}>
                Resume Project
              </button>
            ) : (
              <button className="secondary-btn" onClick={() => setProjectCompleted(true)} disabled={working}>
                Finish Project
              </button>
            )}
            <button className="primary-btn" onClick={runAnalysis} disabled={working}>
              {working ? "Working..." : "Recompute Analysis"}
            </button>
          </div>
        }
      />

      <section className="panel card-pad workspace-tabs-bar">
        <div className="workspace-tabs">
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
          <section className="dashboard-grid-4">
            <Metric label="Total" value={stats.total} />
            <Metric label="Open" value={stats.open} />
            <Metric label="Done" value={stats.done} />
            <Metric label="Progress" value={`${stats.progress}%`} />
          </section>

          {projectEditOpen ? (
            <Section
              title="Project details"
              subtitle="Edit the core project information only when you need it."
              actions={
                <button className="primary-btn" onClick={saveProjectDetails} disabled={working}>
                  Save Project
                </button>
              }
            >
              <div className="tight-grid">
                <input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Project name"
                />
                <input
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="Project description"
                />
                <textarea
                  value={projectNotes}
                  onChange={(e) => setProjectNotes(e.target.value)}
                  placeholder="Project notes"
                  rows={8}
                />
              </div>
            </Section>
          ) : (
            <Section title="Project snapshot" subtitle="A quick summary without opening edit mode.">
              <div className="tight-grid">
                <div className="panel-soft card-pad">
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Status</div>
                  <div className="task-meta">{project.status || "active"}</div>
                </div>
                <div className="panel-soft card-pad">
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Description</div>
                  <div className="task-meta">{project.description || "No description"}</div>
                </div>
                <div className="panel-soft card-pad">
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Notes</div>
                  <div className="task-meta" style={{ whiteSpace: "pre-wrap" }}>
                    {project.notes || "No notes"}
                  </div>
                </div>
              </div>
            </Section>
          )}

          <Section title="Most urgent items" subtitle="The few tasks that deserve your attention first.">
            <div className="tight-grid">
              {urgentTasks.length === 0 ? (
                <div className="panel-soft card-pad empty-state">No active tasks yet.</div>
              ) : (
                urgentTasks.map((task) => (
                  <div key={task.id} className="panel-soft card-pad">
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{task.title}</div>
                    <div className="task-meta" style={{ marginTop: 6 }}>
                      {task.priority}
                      {task.wbs_code ? ` · ${task.wbs_code}` : ""}
                      {task.parent_task_id ? " · sub-task" : " · activity"}
                    </div>
                    <div className="task-meta">
                      {task.planned_start_date || "—"} → {task.planned_finish_date || "—"}
                    </div>
                    {task.description ? (
                      <div className="task-meta" style={{ marginTop: 6 }}>
                        {task.description}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </Section>
        </>
      ) : null}

      {tab === "structure" ? (
        <>
          <Section
            title="Structure controls"
            subtitle="Show only the create tool you need, instead of everything at once."
            actions={
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="secondary-btn" onClick={() => setCreateWorkPackageOpen((v) => !v)}>
                  {createWorkPackageOpen ? "Close work package" : "+ Work Package"}
                </button>
                <button className="primary-btn" onClick={() => setCreateActivityOpen((v) => !v)}>
                  {createActivityOpen ? "Close activity" : "+ Root Activity"}
                </button>
              </div>
            }
          >
            <div className="dashboard-grid-2">
              {createWorkPackageOpen ? (
                <div className="panel-soft card-pad">
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Create work package</div>
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
                      Add Work Package
                    </button>
                  </div>
                </div>
              ) : (
                <div className="panel-soft card-pad empty-state">Work package creator is hidden.</div>
              )}

              {createActivityOpen ? (
                <div className="panel-soft card-pad">
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Add root activity</div>
                  <div className="tight-grid">
                    <input
                      value={newRootTitle}
                      onChange={(e) => setNewRootTitle(e.target.value)}
                      placeholder="Activity name"
                    />
                    <div className="tight-grid-2">
                      <select
                        value={newRootWorkPackageId}
                        onChange={(e) => setNewRootWorkPackageId(e.target.value)}
                      >
                        <option value="">No Work Package</option>
                        {workPackages.map((wp) => (
                          <option key={wp.id} value={wp.id}>
                            {wp.name}
                          </option>
                        ))}
                      </select>
                      <input
                        value={newRootWbsCode}
                        onChange={(e) => setNewRootWbsCode(e.target.value)}
                        placeholder="WBS code"
                      />
                    </div>
                    <div className="tight-grid-2">
                      <input
                        value={newRootDurationValue}
                        onChange={(e) => setNewRootDurationValue(e.target.value)}
                        placeholder="Duration"
                      />
                      <select
                        value={newRootDurationUnit}
                        onChange={(e) => setNewRootDurationUnit(e.target.value as DurationUnit)}
                      >
                        <option value="hours">hours</option>
                        <option value="days">days</option>
                        <option value="weeks">weeks</option>
                        <option value="months">months</option>
                      </select>
                    </div>
                    <div className="tight-grid-2">
                      <input
                        type="date"
                        value={newRootStartDate}
                        onChange={(e) => setNewRootStartDate(e.target.value)}
                      />
                      <input
                        type="date"
                        value={newRootFinishDate}
                        onChange={(e) => setNewRootFinishDate(e.target.value)}
                      />
                    </div>
                    <button className="primary-btn" onClick={addRootTask} disabled={working}>
                      Add Activity
                    </button>
                  </div>
                </div>
              ) : (
                <div className="panel-soft card-pad empty-state">Root activity creator is hidden.</div>
              )}
            </div>
          </Section>

          <section className="tight-grid">
            {groupedByWorkPackage.map((wp) => (
              <Section
                key={wp.id}
                title={editingWpId === wp.id && editingWpDraft ? "Edit work package" : wp.name}
                subtitle={
                  editingWpId === wp.id && editingWpDraft
                    ? "Adjust the package details here."
                    : wp.description || "No description"
                }
                actions={
                  editingWpId !== wp.id || !editingWpDraft ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button className="secondary-btn" onClick={() => startEditWorkPackage(wp)} disabled={working}>
                        Edit
                      </button>
                      <button className="danger-btn" onClick={() => deleteWorkPackage(wp.id)} disabled={working}>
                        Delete
                      </button>
                    </div>
                  ) : null
                }
              >
                {editingWpId === wp.id && editingWpDraft ? (
                  <div className="tight-grid" style={{ marginBottom: 12 }}>
                    <input
                      value={editingWpDraft.name}
                      onChange={(e) => setEditingWpDraft({ ...editingWpDraft, name: e.target.value })}
                      placeholder="Work package name"
                    />
                    <input
                      value={editingWpDraft.description}
                      onChange={(e) =>
                        setEditingWpDraft({ ...editingWpDraft, description: e.target.value })
                      }
                      placeholder="Description"
                    />
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button className="primary-btn" onClick={() => saveWorkPackage(wp.id)} disabled={working}>
                        Save
                      </button>
                      <button className="secondary-btn" onClick={cancelEditWorkPackage} disabled={working}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}

                {wp.rootTasks.length === 0 ? (
                  <div className="panel-soft card-pad empty-state">No activities in this work package.</div>
                ) : (
                  <div className="tight-grid">{renderTaskTree(null, wp.id, 0)}</div>
                )}
              </Section>
            ))}

            <Section title="Ungrouped" subtitle="Activities not yet assigned to a work package.">
              {ungroupedRootTasks.length === 0 ? (
                <div className="panel-soft card-pad empty-state">No ungrouped activities.</div>
              ) : (
                <div className="tight-grid">{renderTaskTree(null, null, 0)}</div>
              )}
            </Section>
          </section>
        </>
      ) : null}

      {tab === "logic" ? (
        <>
          <Section
            title="Dependencies"
            subtitle="Keep the editor hidden until you need to add a new link."
            actions={
              <button className="primary-btn" onClick={() => setAddDependencyOpen((v) => !v)}>
                {addDependencyOpen ? "Close add dependency" : "+ Add Dependency"}
              </button>
            }
          >
            {addDependencyOpen ? (
              <div className="panel-soft card-pad" style={{ marginBottom: 12 }}>
                <div className="tight-grid-2">
                  <select
                    value={predecessorTaskId}
                    onChange={(e) => setPredecessorTaskId(e.target.value)}
                  >
                    <option value="">Select predecessor</option>
                    {flatSortedTasks.map((task) => (
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
                    {flatSortedTasks.map((task) => (
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
                    Add Dependency
                  </button>
                </div>
              </div>
            ) : null}

            <div className="tight-grid">
              {dependencies.length === 0 ? (
                <div className="panel-soft card-pad empty-state">No dependencies yet.</div>
              ) : (
                dependencies.map((dep) => (
                  <div key={dep.id} className="panel-soft card-pad">
                    {editingDependencyId !== dep.id || !editingDependencyDraft ? (
                      <div className="workspace-dep-row">
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

                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button className="secondary-btn" onClick={() => startEditDependency(dep)} disabled={working}>
                            Edit
                          </button>
                          <button className="danger-btn" onClick={() => deleteDependency(dep.id)} disabled={working}>
                            Delete
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="tight-grid">
                        <div className="tight-grid-2">
                          <select
                            value={editingDependencyDraft.predecessorTaskId}
                            onChange={(e) =>
                              setEditingDependencyDraft({
                                ...editingDependencyDraft,
                                predecessorTaskId: e.target.value,
                              })
                            }
                          >
                            <option value="">Select predecessor</option>
                            {flatSortedTasks.map((task) => (
                              <option key={task.id} value={task.id}>
                                {taskLabel(task.id)}
                              </option>
                            ))}
                          </select>

                          <select
                            value={editingDependencyDraft.successorTaskId}
                            onChange={(e) =>
                              setEditingDependencyDraft({
                                ...editingDependencyDraft,
                                successorTaskId: e.target.value,
                              })
                            }
                          >
                            <option value="">Select successor</option>
                            {flatSortedTasks.map((task) => (
                              <option key={task.id} value={task.id}>
                                {taskLabel(task.id)}
                              </option>
                            ))}
                          </select>

                          <select
                            value={editingDependencyDraft.dependencyType}
                            onChange={(e) =>
                              setEditingDependencyDraft({
                                ...editingDependencyDraft,
                                dependencyType: e.target.value as DependencyType,
                              })
                            }
                          >
                            <option value="FS">FS - Finish to Start</option>
                            <option value="SS">SS - Start to Start</option>
                            <option value="FF">FF - Finish to Finish</option>
                            <option value="SF">SF - Start to Finish</option>
                          </select>

                          <input
                            type="number"
                            value={editingDependencyDraft.lagDays}
                            onChange={(e) =>
                              setEditingDependencyDraft({
                                ...editingDependencyDraft,
                                lagDays: e.target.value,
                              })
                            }
                            placeholder="Lag days"
                          />
                        </div>

                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button className="primary-btn" onClick={() => saveDependency(dep.id)} disabled={working}>
                            Save
                          </button>
                          <button className="secondary-btn" onClick={cancelEditDependency} disabled={working}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </Section>
        </>
      ) : null}

      {tab === "timeline" ? (
        <>
          <section className="dashboard-grid-2">
            <Section
              title="Day plan"
              subtitle="Timed work only. Keep the daily view focused."
              actions={
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  style={{ width: 160 }}
                />
              }
            >
              <div className="tight-grid">
                {dayScheduledTasks.length === 0 ? (
                  <div className="panel-soft card-pad empty-state">No timed tasks on this date.</div>
                ) : (
                  dayScheduledTasks.map((task) => (
                    <div key={task.id} className="panel-soft card-pad">
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{task.title}</div>
                      <div className="task-meta">
                        {task.start_time || "--"} → {task.end_time || "--"}
                        {task.wbs_code ? ` · ${task.wbs_code}` : ""}
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                        <button className="blue-btn" onClick={() => startEditSchedule(task)} disabled={working}>
                          Edit block
                        </button>
                        <button className="secondary-btn" onClick={() => clearTaskBlock(task.id)} disabled={working}>
                          Clear block
                        </button>
                      </div>

                      {scheduleEditTaskId === task.id ? (
                        <div className="tight-grid" style={{ marginTop: 10 }}>
                          <div className="tight-grid-2">
                            <input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} />
                            <input type="date" value={editFinishDate} onChange={(e) => setEditFinishDate(e.target.value)} />
                            <input type="time" value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} />
                            <input type="time" value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)} />
                          </div>

                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button className="primary-btn" onClick={() => saveTaskSchedule(task.id)} disabled={working}>
                              Save
                            </button>
                            <button className="secondary-btn" onClick={cancelEditSchedule} disabled={working}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </Section>

            <Section title={`Task pool · ${formatDate(selectedDate)}`} subtitle="Only tasks relevant to this day.">
              <div className="tight-grid">
                {dayTaskPool.length === 0 ? (
                  <div className="panel-soft card-pad empty-state">No available tasks for this day.</div>
                ) : (
                  dayTaskPool.map((task) => (
                    <div key={task.id} className="panel-soft card-pad">
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{task.title}</div>
                      <div className="task-meta">
                        {task.is_quick_task ? "Quick" : "Planned"}
                        {task.wbs_code ? ` · ${task.wbs_code}` : ""}
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                        <button className="secondary-btn" onClick={() => quickAssignTwoHours(task, "09:00")} disabled={working}>
                          09:00–11:00
                        </button>
                        <button className="secondary-btn" onClick={() => quickAssignTwoHours(task, "13:00")} disabled={working}>
                          13:00–15:00
                        </button>
                        <button
                          className="blue-btn"
                          onClick={() => {
                            setPoolEditingTaskId(task.id);
                            setPoolStartTime("09:00");
                            setPoolEndTime("10:00");
                          }}
                          disabled={working}
                        >
                          Custom assign
                        </button>
                      </div>

                      {poolEditingTaskId === task.id ? (
                        <div className="tight-grid" style={{ marginTop: 10 }}>
                          <div className="tight-grid-2">
                            <input type="time" value={poolStartTime} onChange={(e) => setPoolStartTime(e.target.value)} />
                            <input type="time" value={poolEndTime} onChange={(e) => setPoolEndTime(e.target.value)} />
                          </div>

                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button className="primary-btn" onClick={() => assignTaskToDayBlock(task)} disabled={working}>
                              Assign
                            </button>
                            <button className="secondary-btn" onClick={() => setPoolEditingTaskId(null)} disabled={working}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </Section>
          </section>

          <Section title="Timeline controls" subtitle="One selected task, one place to adjust it.">
            {selectedTimelineTask ? (
              <div className="tight-grid">
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{selectedTimelineTask.title}</div>
                  <div className="task-meta">
                    {selectedTimelineTask.planned_start_date || "—"} → {selectedTimelineTask.planned_finish_date || "—"}
                    {selectedTimelineTask.total_float_days !== null &&
                    selectedTimelineTask.total_float_days !== undefined
                      ? ` · Float ${selectedTimelineTask.total_float_days}d`
                      : ""}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="secondary-btn" onClick={() => shiftTaskByDays(selectedTimelineTask.id, -1)} disabled={working}>
                    Move -1d
                  </button>
                  <button className="secondary-btn" onClick={() => shiftTaskByDays(selectedTimelineTask.id, 1)} disabled={working}>
                    Move +1d
                  </button>
                  <button className="secondary-btn" onClick={() => stretchTaskDuration(selectedTimelineTask.id, -1)} disabled={working}>
                    Shorten 1d
                  </button>
                  <button className="secondary-btn" onClick={() => stretchTaskDuration(selectedTimelineTask.id, 1)} disabled={working}>
                    Extend 1d
                  </button>
                  <button className="primary-btn" onClick={() => snapTaskToSelectedDate(selectedTimelineTask.id)} disabled={working}>
                    Start on selected day
                  </button>
                </div>
              </div>
            ) : (
              <div className="panel-soft card-pad empty-state">
                Select a task row in the timeline below to adjust its plan.
              </div>
            )}
          </Section>

          <Section title="Project timeline" subtitle="Cleaner gantt view with row selection and quick moves.">
            <div style={{ overflowX: "auto" }}>
              {timelineRange.length > 0 ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "110px 240px 110px 140px 170px minmax(420px, 1fr) 160px",
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
                          style={{
                            fontSize: 10,
                            textAlign: "center",
                            background: day === selectedDate ? "rgba(33,150,243,0.12)" : "transparent",
                            borderRadius: 6,
                          }}
                        >
                          {new Date(day).getDate()}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="text-muted" style={{ fontSize: 12, fontWeight: 700 }}>Adjust</div>

                  {flatSortedTasks.map((task) => (
                    <div key={task.id} style={{ display: "contents" }}>
                      <div style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                        {task.wbs_code || "—"}
                      </div>

                      <button
                        type="button"
                        onClick={() => setTimelineSelectedTaskId(task.id)}
                        style={{
                          padding: "10px 0",
                          borderTop: "1px solid var(--border)",
                          background: timelineSelectedTaskId === task.id ? "rgba(33,150,243,0.06)" : "transparent",
                          borderLeft: "none",
                          borderRight: "none",
                          borderBottom: "none",
                          borderTopWidth: 1,
                          borderStyle: "solid",
                          borderColor: "var(--border)",
                          textAlign: "left",
                          cursor: "pointer",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            textDecoration: task.status === "done" ? "line-through" : "none",
                          }}
                        >
                          {task.title}
                        </div>
                        <div className="task-meta">
                          {task.is_critical ? "Critical" : "Non-critical"}
                        </div>
                      </button>

                      <div style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                        {formatTaskDuration(task)}
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

                      <div style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button className="secondary-btn" onClick={() => shiftTaskByDays(task.id, -1)} disabled={working}>
                            -1d
                          </button>
                          <button className="secondary-btn" onClick={() => shiftTaskByDays(task.id, 1)} disabled={working}>
                            +1d
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">No planned dates yet.</div>
              )}
            </div>
          </Section>
        </>
      ) : null}

      {tab === "analysis" ? (
        <Section title="Analysis" subtitle="Critical path and float figures in one place.">
          <div style={{ overflowX: "auto" }}>
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

              {flatSortedTasks.map((task) => (
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
                      <span className="badge" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
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
          </div>
        </Section>
      ) : null}

      {tab === "workload" ? (
        <>
          <section className="dashboard-grid-3">
            <Metric label="Scheduled Open Tasks" value={filteredWorkloadTasks.length} />
            <Metric label="Total Planned Hours" value={totalOpenHours} />
            <Metric label="Overloaded Days" value={overloadedCount} />
          </section>

          <Section title="Filters" subtitle="Reduce noise and inspect only the workload you care about.">
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
          </Section>

          <section className="dashboard-grid-2">
            <Section title="Daily load" subtitle="See overloaded days without digging through each task.">
              <div className="tight-grid">
                {dailyLoad.length === 0 ? (
                  <div className="panel-soft card-pad empty-state">No planned dates yet.</div>
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
                            <div style={{ fontSize: 14, fontWeight: 700 }}>{formatDate(day.date)}</div>
                            <div className="task-meta">
                              {day.tasks.length} task(s) · Critical {day.criticalHours}h · Non-critical {day.nonCriticalHours}h
                            </div>
                          </div>

                          {day.overload ? (
                            <span className="badge" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
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
            </Section>

            <Section title="Suggestions" subtitle="Quick rebalance options when a day is overloaded.">
              <div className="tight-grid">
                {suggestions.map((tip, index) => (
                  <div key={index} className="panel-soft card-pad">
                    <div>{tip.message}</div>

                    {tip.taskId && tip.maxShiftDays > 0 ? (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                        <button className="secondary-btn" onClick={() => pushTaskLater(tip.taskId!, 1)} disabled={working}>
                          Push 1 day
                        </button>
                        {tip.maxShiftDays >= 2 ? (
                          <button className="secondary-btn" onClick={() => pushTaskLater(tip.taskId!, 2)} disabled={working}>
                            Push 2 days
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </Section>
          </section>
        </>
      ) : null}
    </div>
  );
}