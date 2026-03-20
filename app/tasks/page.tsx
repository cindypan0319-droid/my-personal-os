"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import SortableList from "../../components/SortableList";
import { persistManualOrder } from "../../lib/manual-order";
import {
  EnergyLevel,
  Project,
  RecurringType,
  Subtask,
  Task,
  TaskContext,
  TaskPriority,
  TaskStatus,
} from "../../types/task";

type EditTaskForm = {
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  context: TaskContext;
  due_date: string;
  project_id: string;
  is_quick_task: boolean;
  estimated_minutes: string;
  notes: string;
  reference_link: string;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  recurring_enabled: boolean;
  recurring_type: RecurringType;
  recurring_interval: string;
  recurring_days_of_week: number[];
  energy_level: EnergyLevel | "";
  must_do_today: boolean;
};

type NewSubtaskForm = {
  title: string;
  estimated_minutes: string;
  due_date: string;
  scheduled_date: string;
  start_time: string;
  end_time: string;
};

type EditSubtaskForm = {
  title: string;
  estimated_minutes: string;
  due_date: string;
  scheduled_date: string;
  start_time: string;
  end_time: string;
};

const WEEK_DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [context, setContext] = useState<TaskContext>("home");
  const [dueDate, setDueDate] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [isQuickTask, setIsQuickTask] = useState(false);
  const [estimatedMinutes, setEstimatedMinutes] = useState("");
  const [notes, setNotes] = useState("");
  const [referenceLink, setReferenceLink] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [recurringEnabled, setRecurringEnabled] = useState(false);
  const [recurringType, setRecurringType] = useState<RecurringType>(null);
  const [recurringInterval, setRecurringInterval] = useState("1");
  const [recurringDaysOfWeek, setRecurringDaysOfWeek] = useState<number[]>([]);
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel | "">("");
  const [mustDoToday, setMustDoToday] = useState(false);

  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [quickOnly, setQuickOnly] = useState(false);

  const [subtaskForms, setSubtaskForms] = useState<Record<number, NewSubtaskForm>>(
    {}
  );
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editTaskForm, setEditTaskForm] = useState<EditTaskForm | null>(null);

  const [editingSubtaskId, setEditingSubtaskId] = useState<number | null>(null);
  const [editSubtaskForm, setEditSubtaskForm] = useState<EditSubtaskForm | null>(
    null
  );

  const sortTasksByDueDate = (taskList: Task[]) => {
    return [...taskList].sort((a, b) => {
      const aMust = a.must_do_today ? 1 : 0;
      const bMust = b.must_do_today ? 1 : 0;
      if (aMust !== bMust) return bMust - aMust;

      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date && !b.due_date) return -1;
      if (!a.due_date && b.due_date) return 1;

      const aOrder = a.manual_order ?? 999999;
      const bOrder = b.manual_order ?? 999999;
      if (aOrder !== bOrder) return aOrder - bOrder;

      return b.created_at.localeCompare(a.created_at);
    });
  };

  const sortSubtasksByDueDate = (subtaskList: Subtask[]) => {
    return [...subtaskList].sort((a, b) => {
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date && !b.due_date) return -1;
      if (!a.due_date && b.due_date) return 1;

      const aOrder = a.manual_order ?? 999999;
      const bOrder = b.manual_order ?? 999999;
      if (aOrder !== bOrder) return aOrder - bOrder;

      return a.created_at.localeCompare(b.created_at);
    });
  };

  const loadData = async () => {
    setLoading(true);

    const { data: taskData, error: taskError } = await supabase
      .from("tasks")
      .select("*");

    const { data: projectData, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: subtaskData, error: subtaskError } = await supabase
      .from("subtasks")
      .select("*");

    if (taskError) console.error("Load tasks error:", taskError.message);
    if (projectError) console.error("Load projects error:", projectError.message);
    if (subtaskError) console.error("Load subtasks error:", subtaskError.message);

    setTasks(sortTasksByDueDate((taskData as Task[]) || []));
    setProjects((projectData as Project[]) || []);
    setSubtasks(sortSubtasksByDueDate((subtaskData as Subtask[]) || []));
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

  const getSubtasksForTask = (taskId: number) => {
    return sortSubtasksByDueDate(
      subtasks.filter((subtask) => subtask.task_id === taskId)
    );
  };

  const getSubtaskProgress = (taskId: number) => {
    const items = getSubtasksForTask(taskId);
    if (items.length === 0) return { done: 0, total: 0, percent: 0 };

    const done = items.filter((item) => item.status === "done").length;
    return {
      done,
      total: items.length,
      percent: Math.round((done / items.length) * 100),
    };
  };

  const resetTaskForm = () => {
    setTitle("");
    setStatus("todo");
    setPriority("medium");
    setContext("home");
    setDueDate("");
    setProjectId("");
    setIsQuickTask(false);
    setEstimatedMinutes("");
    setNotes("");
    setReferenceLink("");
    setScheduledDate("");
    setStartTime("");
    setEndTime("");
    setRecurringEnabled(false);
    setRecurringType(null);
    setRecurringInterval("1");
    setRecurringDaysOfWeek([]);
    setEnergyLevel("");
    setMustDoToday(false);
  };

  const handleAddTask = async () => {
    if (!title.trim()) return;

    const { error } = await supabase.from("tasks").insert({
      title,
      status,
      priority,
      context,
      due_date: dueDate || null,
      project_id: projectId ? Number(projectId) : null,
      is_quick_task: isQuickTask,
      estimated_minutes: estimatedMinutes ? Number(estimatedMinutes) : null,
      notes: notes || null,
      reference_link: referenceLink || null,
      scheduled_date: scheduledDate || null,
      start_time: startTime || null,
      end_time: endTime || null,
      recurring_enabled: recurringEnabled,
      recurring_type: recurringEnabled ? recurringType : null,
      recurring_interval: recurringEnabled ? Number(recurringInterval || "1") : null,
      recurring_days_of_week:
        recurringEnabled && recurringType === "weekly"
          ? recurringDaysOfWeek
          : null,
      energy_level: energyLevel || null,
      must_do_today: mustDoToday,
      user_id: null,
    });

    if (error) {
      alert("新增任务失败：" + error.message);
      return;
    }

    resetTaskForm();
    loadData();
  };

  const updateTaskStatus = async (taskId: number, newStatus: TaskStatus) => {
    const { error } = await supabase
      .from("tasks")
      .update({ status: newStatus })
      .eq("id", taskId);

    if (error) {
      alert("修改任务状态失败：" + error.message);
      return;
    }

    loadData();
  };

  const deleteTask = async (taskId: number) => {
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);

    if (error) {
      alert("删除任务失败：" + error.message);
      return;
    }

    loadData();
  };

  const startEditTask = (task: Task) => {
    setEditingTaskId(task.id);
    setEditTaskForm({
      title: task.title,
      status: task.status,
      priority: task.priority,
      context: task.context,
      due_date: task.due_date || "",
      project_id: task.project_id ? String(task.project_id) : "",
      is_quick_task: task.is_quick_task,
      estimated_minutes:
        task.estimated_minutes !== null ? String(task.estimated_minutes) : "",
      notes: task.notes || "",
      reference_link: task.reference_link || "",
      scheduled_date: task.scheduled_date || "",
      start_time: task.start_time || "",
      end_time: task.end_time || "",
      recurring_enabled: !!task.recurring_enabled,
      recurring_type: task.recurring_type || null,
      recurring_interval:
        task.recurring_interval !== null && task.recurring_interval !== undefined
          ? String(task.recurring_interval)
          : "1",
      recurring_days_of_week: task.recurring_days_of_week || [],
      energy_level: task.energy_level || "",
      must_do_today: !!task.must_do_today,
    });
  };

  const cancelEditTask = () => {
    setEditingTaskId(null);
    setEditTaskForm(null);
  };

  const saveTaskEdit = async (taskId: number) => {
    if (!editTaskForm || !editTaskForm.title.trim()) {
      alert("任务标题不能为空");
      return;
    }

    const { error } = await supabase
      .from("tasks")
      .update({
        title: editTaskForm.title,
        status: editTaskForm.status,
        priority: editTaskForm.priority,
        context: editTaskForm.context,
        due_date: editTaskForm.due_date || null,
        project_id: editTaskForm.project_id ? Number(editTaskForm.project_id) : null,
        is_quick_task: editTaskForm.is_quick_task,
        estimated_minutes: editTaskForm.estimated_minutes
          ? Number(editTaskForm.estimated_minutes)
          : null,
        notes: editTaskForm.notes || null,
        reference_link: editTaskForm.reference_link || null,
        scheduled_date: editTaskForm.scheduled_date || null,
        start_time: editTaskForm.start_time || null,
        end_time: editTaskForm.end_time || null,
        recurring_enabled: editTaskForm.recurring_enabled,
        recurring_type: editTaskForm.recurring_enabled
          ? editTaskForm.recurring_type
          : null,
        recurring_interval: editTaskForm.recurring_enabled
          ? Number(editTaskForm.recurring_interval || "1")
          : null,
        recurring_days_of_week:
          editTaskForm.recurring_enabled &&
          editTaskForm.recurring_type === "weekly"
            ? editTaskForm.recurring_days_of_week
            : null,
        energy_level: editTaskForm.energy_level || null,
        must_do_today: editTaskForm.must_do_today,
      })
      .eq("id", taskId);

    if (error) {
      alert("保存任务修改失败：" + error.message);
      return;
    }

    setEditingTaskId(null);
    setEditTaskForm(null);
    loadData();
  };

  const ensureSubtaskForm = (taskId: number) => {
    if (subtaskForms[taskId]) return;
    setSubtaskForms((prev) => ({
      ...prev,
      [taskId]: {
        title: "",
        estimated_minutes: "",
        due_date: "",
        scheduled_date: "",
        start_time: "",
        end_time: "",
      },
    }));
  };

  const updateSubtaskForm = (
    taskId: number,
    key: keyof NewSubtaskForm,
    value: string
  ) => {
    ensureSubtaskForm(taskId);

    setSubtaskForms((prev) => ({
      ...prev,
      [taskId]: {
        ...(prev[taskId] || {
          title: "",
          estimated_minutes: "",
          due_date: "",
          scheduled_date: "",
          start_time: "",
          end_time: "",
        }),
        [key]: value,
      },
    }));
  };

  const addSubtask = async (taskId: number) => {
    const form = subtaskForms[taskId];
    if (!form || !form.title.trim()) return;

    const { error } = await supabase.from("subtasks").insert({
      task_id: taskId,
      title: form.title,
      status: "todo",
      estimated_minutes: form.estimated_minutes
        ? Number(form.estimated_minutes)
        : null,
      due_date: form.due_date || null,
      scheduled_date: form.scheduled_date || null,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      user_id: null,
    });

    if (error) {
      alert("新增子任务失败：" + error.message);
      return;
    }

    setSubtaskForms((prev) => ({
      ...prev,
      [taskId]: {
        title: "",
        estimated_minutes: "",
        due_date: "",
        scheduled_date: "",
        start_time: "",
        end_time: "",
      },
    }));

    loadData();
  };

  const toggleSubtaskStatus = async (subtask: Subtask) => {
    const newStatus = subtask.status === "done" ? "todo" : "done";

    const { error } = await supabase
      .from("subtasks")
      .update({ status: newStatus })
      .eq("id", subtask.id);

    if (error) {
      alert("修改子任务状态失败：" + error.message);
      return;
    }

    loadData();
  };

  const deleteSubtask = async (subtaskId: number) => {
    const { error } = await supabase.from("subtasks").delete().eq("id", subtaskId);

    if (error) {
      alert("删除子任务失败：" + error.message);
      return;
    }

    loadData();
  };

  const startEditSubtask = (subtask: Subtask) => {
    setEditingSubtaskId(subtask.id);
    setEditSubtaskForm({
      title: subtask.title,
      estimated_minutes:
        subtask.estimated_minutes !== null
          ? String(subtask.estimated_minutes)
          : "",
      due_date: subtask.due_date || "",
      scheduled_date: subtask.scheduled_date || "",
      start_time: subtask.start_time || "",
      end_time: subtask.end_time || "",
    });
  };

  const cancelEditSubtask = () => {
    setEditingSubtaskId(null);
    setEditSubtaskForm(null);
  };

  const saveSubtaskEdit = async (subtaskId: number) => {
    if (!editSubtaskForm || !editSubtaskForm.title.trim()) {
      alert("子任务标题不能为空");
      return;
    }

    const { error } = await supabase
      .from("subtasks")
      .update({
        title: editSubtaskForm.title,
        estimated_minutes: editSubtaskForm.estimated_minutes
          ? Number(editSubtaskForm.estimated_minutes)
          : null,
        due_date: editSubtaskForm.due_date || null,
        scheduled_date: editSubtaskForm.scheduled_date || null,
        start_time: editSubtaskForm.start_time || null,
        end_time: editSubtaskForm.end_time || null,
      })
      .eq("id", subtaskId);

    if (error) {
      alert("保存子任务修改失败：" + error.message);
      return;
    }

    setEditingSubtaskId(null);
    setEditSubtaskForm(null);
    loadData();
  };

  const toggleRecurringDay = (
    current: number[],
    dayValue: number,
    onChange: (next: number[]) => void
  ) => {
    if (current.includes(dayValue)) {
      onChange(current.filter((d) => d !== dayValue));
    } else {
      onChange([...current, dayValue].sort((a, b) => a - b));
    }
  };

  const filteredTasks = useMemo(() => {
    return sortTasksByDueDate(
      tasks.filter((task) => {
        if (statusFilter !== "all" && task.status !== statusFilter) return false;
        if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
        if (
          projectFilter !== "all" &&
          String(task.project_id ?? "none") !== projectFilter
        )
          return false;
        if (quickOnly && !task.is_quick_task) return false;
        return true;
      })
    );
  }, [tasks, statusFilter, priorityFilter, projectFilter, quickOnly]);

    const handleReorderTasks = async (reorderedTasks: Task[]) => {
    try {
      await persistManualOrder("tasks", reorderedTasks);
      setTasks(reorderedTasks);
      await loadData();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown reorder error";
      alert("保存拖拽顺序失败：" + message);
    }
  };

  if (loading) {
    return (
      <div className="page-wrap">
        <div className="panel card-pad">Loading tasks...</div>
      </div>
    );
  }

  return (
    <div className="page-wrap">
      <header className="page-header">
        <div className="page-kicker">Tasks</div>
        <h1 className="page-title">All Tasks</h1>
        <div className="page-desc">
          任务、子任务、排期、重复规则、时间信息都集中在这里管理。
        </div>
      </header>

      <section className="panel card-pad" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
          Add New Task
        </div>

        <div className="tight-grid" style={{ gridTemplateColumns: "repeat(1, minmax(0, 1fr))" }}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            style={{ padding: "10px 12px" }}
          />

          <div className="tight-grid-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              style={{ padding: "10px 12px" }}
            >
              <option value="inbox">inbox</option>
              <option value="todo">todo</option>
              <option value="doing">doing</option>
              <option value="done">done</option>
            </select>

            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              style={{ padding: "10px 12px" }}
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>

            <select
              value={context}
              onChange={(e) => setContext(e.target.value as TaskContext)}
              style={{ padding: "10px 12px" }}
            >
              <option value="home">home</option>
              <option value="computer">computer</option>
              <option value="shop">shop</option>
              <option value="outside">outside</option>
            </select>

            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              style={{ padding: "10px 12px" }}
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
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={{ padding: "10px 12px" }}
            />

            <input
              type="number"
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(e.target.value)}
              placeholder="Estimated minutes"
              style={{ padding: "10px 12px" }}
            />

            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              style={{ padding: "10px 12px" }}
            />

            <div className="tight-grid-2">
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                style={{ padding: "10px 12px" }}
              />
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                style={{ padding: "10px 12px" }}
              />
            </div>

            <select
              value={energyLevel}
              onChange={(e) => setEnergyLevel(e.target.value as EnergyLevel | "")}
              style={{ padding: "10px 12px" }}
            >
              <option value="">Energy level</option>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </div>

          <input
            type="text"
            value={referenceLink}
            onChange={(e) => setReferenceLink(e.target.value)}
            placeholder="Reference link / address"
            style={{ padding: "10px 12px" }}
          />

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes"
            rows={3}
            style={{ padding: "10px 12px" }}
          />

          <div className="tight-grid-2">
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={isQuickTask}
                onChange={(e) => setIsQuickTask(e.target.checked)}
              />
              Quick Task
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={mustDoToday}
                onChange={(e) => setMustDoToday(e.target.checked)}
              />
              Must do today
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={recurringEnabled}
                onChange={(e) => {
                  setRecurringEnabled(e.target.checked);
                  if (!e.target.checked) {
                    setRecurringType(null);
                    setRecurringDaysOfWeek([]);
                  }
                }}
              />
              Recurring
            </label>
          </div>

          {recurringEnabled && (
            <div className="panel-soft card-pad">
              <div className="tight-grid-2">
                <select
                  value={recurringType || ""}
                  onChange={(e) =>
                    setRecurringType((e.target.value || null) as RecurringType)
                  }
                  style={{ padding: "10px 12px" }}
                >
                  <option value="">Recurring type</option>
                  <option value="daily">daily</option>
                  <option value="weekly">weekly</option>
                  <option value="monthly">monthly</option>
                </select>

                <input
                  type="number"
                  value={recurringInterval}
                  onChange={(e) => setRecurringInterval(e.target.value)}
                  placeholder="Interval"
                  style={{ padding: "10px 12px" }}
                />
              </div>

              {recurringType === "weekly" && (
                <div style={{ marginTop: 10 }}>
                  <div className="text-muted" style={{ fontSize: 12, marginBottom: 8 }}>
                    Days of week
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {WEEK_DAYS.map((day) => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() =>
                          toggleRecurringDay(
                            recurringDaysOfWeek,
                            day.value,
                            setRecurringDaysOfWeek
                          )
                        }
                        className={
                          recurringDaysOfWeek.includes(day.value)
                            ? "primary-btn"
                            : "secondary-btn"
                        }
                        style={{ padding: "8px 10px" }}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <button onClick={handleAddTask} className="primary-btn">
              Add Task
            </button>
          </div>
        </div>
      </section>

      <section className="panel card-pad" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
          Filters
        </div>

        <div className="tight-grid-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: "10px 12px" }}
          >
            <option value="all">all status</option>
            <option value="inbox">inbox</option>
            <option value="todo">todo</option>
            <option value="doing">doing</option>
            <option value="done">done</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            style={{ padding: "10px 12px" }}
          >
            <option value="all">all priority</option>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>

          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            style={{ padding: "10px 12px" }}
          >
            <option value="all">all projects</option>
            <option value="none">No Project</option>
            {projects.map((project) => (
              <option key={project.id} value={String(project.id)}>
                {project.name}
              </option>
            ))}
          </select>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <input
              type="checkbox"
              checked={quickOnly}
              onChange={(e) => setQuickOnly(e.target.checked)}
            />
            Show quick tasks only
          </label>
        </div>
      </section>

            <section className="tight-grid">
        {filteredTasks.length === 0 ? (
          <div className="panel card-pad text-muted">没有符合筛选条件的任务。</div>
        ) : (
          <SortableList
            items={filteredTasks}
            onReorder={handleReorderTasks}
            renderItem={(task) => {
              const taskSubtasks = getSubtasksForTask(task.id);
              const progress = getSubtaskProgress(task.id);
              const isEditing = editingTaskId === task.id;
              const subtaskForm = subtaskForms[task.id] || {
                title: "",
                estimated_minutes: "",
                due_date: "",
                scheduled_date: "",
                start_time: "",
                end_time: "",
              };

              return (
                <div className="panel card-pad">
                  {!isEditing ? (
                    <>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          alignItems: "flex-start",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 16, fontWeight: 600 }}>{task.title}</div>
                          <div className="task-meta">
                            {getProjectName(task.project_id)} · {task.context}
                          </div>
                        </div>
                      </div>

                      <div className="badge-row">
                        <div className="badge">Status: {task.status}</div>
                        <div className="badge">Priority: {task.priority}</div>
                        <div className="badge">Due: {task.due_date || "N/A"}</div>
                        <div className="badge">
                          Time:{" "}
                          {task.estimated_minutes !== null
                            ? `${task.estimated_minutes} min`
                            : "N/A"}
                        </div>
                        <div className="badge">
                          Scheduled: {task.scheduled_date || "N/A"}
                        </div>
                        <div className="badge">
                          Slot:{" "}
                          {task.start_time || task.end_time
                            ? `${task.start_time || "--"} - ${task.end_time || "--"}`
                            : "N/A"}
                        </div>
                        <div className="badge">
                          Energy: {task.energy_level || "N/A"}
                        </div>
                        {task.is_quick_task && <div className="badge">Quick</div>}
                        {task.must_do_today && <div className="badge">Must Today</div>}
                        {task.recurring_enabled && (
                          <div className="badge">
                            Repeat: {task.recurring_type || "yes"}
                          </div>
                        )}
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

                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                        <button onClick={() => updateTaskStatus(task.id, "inbox")} className="secondary-btn">
                          Inbox
                        </button>
                        <button onClick={() => updateTaskStatus(task.id, "todo")} className="secondary-btn">
                          Todo
                        </button>
                        <button onClick={() => updateTaskStatus(task.id, "doing")} className="secondary-btn">
                          Doing
                        </button>
                        <button onClick={() => updateTaskStatus(task.id, "done")} className="primary-btn">
                          Done
                        </button>
                        <button onClick={() => startEditTask(task)} className="blue-btn">
                          Edit
                        </button>
                        <button onClick={() => deleteTask(task.id)} className="danger-btn">
                          Delete
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="tight-grid">
                      <input
                        type="text"
                        value={editTaskForm?.title || ""}
                        onChange={(e) =>
                          setEditTaskForm((prev) =>
                            prev ? { ...prev, title: e.target.value } : prev
                          )
                        }
                        style={{ padding: "10px 12px" }}
                      />

                      <div className="tight-grid-2">
                        <select
                          value={editTaskForm?.status || "todo"}
                          onChange={(e) =>
                            setEditTaskForm((prev) =>
                              prev ? { ...prev, status: e.target.value as TaskStatus } : prev
                            )
                          }
                          style={{ padding: "10px 12px" }}
                        >
                          <option value="inbox">inbox</option>
                          <option value="todo">todo</option>
                          <option value="doing">doing</option>
                          <option value="done">done</option>
                        </select>

                        <select
                          value={editTaskForm?.priority || "medium"}
                          onChange={(e) =>
                            setEditTaskForm((prev) =>
                              prev
                                ? { ...prev, priority: e.target.value as TaskPriority }
                                : prev
                            )
                          }
                          style={{ padding: "10px 12px" }}
                        >
                          <option value="low">low</option>
                          <option value="medium">medium</option>
                          <option value="high">high</option>
                        </select>

                        <select
                          value={editTaskForm?.context || "home"}
                          onChange={(e) =>
                            setEditTaskForm((prev) =>
                              prev
                                ? { ...prev, context: e.target.value as TaskContext }
                                : prev
                            )
                          }
                          style={{ padding: "10px 12px" }}
                        >
                          <option value="home">home</option>
                          <option value="computer">computer</option>
                          <option value="shop">shop</option>
                          <option value="outside">outside</option>
                        </select>

                        <select
                          value={editTaskForm?.project_id || ""}
                          onChange={(e) =>
                            setEditTaskForm((prev) =>
                              prev ? { ...prev, project_id: e.target.value } : prev
                            )
                          }
                          style={{ padding: "10px 12px" }}
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
                          value={editTaskForm?.due_date || ""}
                          onChange={(e) =>
                            setEditTaskForm((prev) =>
                              prev ? { ...prev, due_date: e.target.value } : prev
                            )
                          }
                          style={{ padding: "10px 12px" }}
                        />

                        <input
                          type="number"
                          value={editTaskForm?.estimated_minutes || ""}
                          onChange={(e) =>
                            setEditTaskForm((prev) =>
                              prev ? { ...prev, estimated_minutes: e.target.value } : prev
                            )
                          }
                          placeholder="Estimated min"
                          style={{ padding: "10px 12px" }}
                        />

                        <input
                          type="date"
                          value={editTaskForm?.scheduled_date || ""}
                          onChange={(e) =>
                            setEditTaskForm((prev) =>
                              prev ? { ...prev, scheduled_date: e.target.value } : prev
                            )
                          }
                          style={{ padding: "10px 12px" }}
                        />

                        <div className="tight-grid-2">
                          <input
                            type="time"
                            value={editTaskForm?.start_time || ""}
                            onChange={(e) =>
                              setEditTaskForm((prev) =>
                                prev ? { ...prev, start_time: e.target.value } : prev
                              )
                            }
                            style={{ padding: "10px 12px" }}
                          />
                          <input
                            type="time"
                            value={editTaskForm?.end_time || ""}
                            onChange={(e) =>
                              setEditTaskForm((prev) =>
                                prev ? { ...prev, end_time: e.target.value } : prev
                              )
                            }
                            style={{ padding: "10px 12px" }}
                          />
                        </div>

                        <select
                          value={editTaskForm?.energy_level || ""}
                          onChange={(e) =>
                            setEditTaskForm((prev) =>
                              prev
                                ? { ...prev, energy_level: e.target.value as EnergyLevel | "" }
                                : prev
                            )
                          }
                          style={{ padding: "10px 12px" }}
                        >
                          <option value="">Energy level</option>
                          <option value="low">low</option>
                          <option value="medium">medium</option>
                          <option value="high">high</option>
                        </select>
                      </div>

                      <input
                        type="text"
                        value={editTaskForm?.reference_link || ""}
                        onChange={(e) =>
                          setEditTaskForm((prev) =>
                            prev ? { ...prev, reference_link: e.target.value } : prev
                          )
                        }
                        placeholder="Reference link / address"
                        style={{ padding: "10px 12px" }}
                      />

                      <textarea
                        value={editTaskForm?.notes || ""}
                        onChange={(e) =>
                          setEditTaskForm((prev) =>
                            prev ? { ...prev, notes: e.target.value } : prev
                          )
                        }
                        rows={3}
                        placeholder="Notes"
                        style={{ padding: "10px 12px" }}
                      />

                      <div className="tight-grid-2">
                        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                          <input
                            type="checkbox"
                            checked={editTaskForm?.is_quick_task || false}
                            onChange={(e) =>
                              setEditTaskForm((prev) =>
                                prev ? { ...prev, is_quick_task: e.target.checked } : prev
                              )
                            }
                          />
                          Quick Task
                        </label>

                        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                          <input
                            type="checkbox"
                            checked={editTaskForm?.must_do_today || false}
                            onChange={(e) =>
                              setEditTaskForm((prev) =>
                                prev ? { ...prev, must_do_today: e.target.checked } : prev
                              )
                            }
                          />
                          Must do today
                        </label>

                        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                          <input
                            type="checkbox"
                            checked={editTaskForm?.recurring_enabled || false}
                            onChange={(e) =>
                              setEditTaskForm((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      recurring_enabled: e.target.checked,
                                      recurring_type: e.target.checked
                                        ? prev.recurring_type
                                        : null,
                                      recurring_days_of_week: e.target.checked
                                        ? prev.recurring_days_of_week
                                        : [],
                                    }
                                  : prev
                              )
                            }
                          />
                          Recurring
                        </label>
                      </div>

                      {editTaskForm?.recurring_enabled && (
                        <div className="panel-soft card-pad">
                          <div className="tight-grid-2">
                            <select
                              value={editTaskForm?.recurring_type || ""}
                              onChange={(e) =>
                                setEditTaskForm((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        recurring_type: (e.target.value || null) as RecurringType,
                                      }
                                    : prev
                                )
                              }
                              style={{ padding: "10px 12px" }}
                            >
                              <option value="">Recurring type</option>
                              <option value="daily">daily</option>
                              <option value="weekly">weekly</option>
                              <option value="monthly">monthly</option>
                            </select>

                            <input
                              type="number"
                              value={editTaskForm?.recurring_interval || "1"}
                              onChange={(e) =>
                                setEditTaskForm((prev) =>
                                  prev ? { ...prev, recurring_interval: e.target.value } : prev
                                )
                              }
                              placeholder="Interval"
                              style={{ padding: "10px 12px" }}
                            />
                          </div>

                          {editTaskForm?.recurring_type === "weekly" && (
                            <div style={{ marginTop: 10 }}>
                              <div className="text-muted" style={{ fontSize: 12, marginBottom: 8 }}>
                                Days of week
                              </div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                {WEEK_DAYS.map((day) => (
                                  <button
                                    key={day.value}
                                    type="button"
                                    onClick={() =>
                                      toggleRecurringDay(
                                        editTaskForm.recurring_days_of_week,
                                        day.value,
                                        (next) =>
                                          setEditTaskForm((prev) =>
                                            prev
                                              ? { ...prev, recurring_days_of_week: next }
                                              : prev
                                          )
                                      )
                                    }
                                    className={
                                      editTaskForm.recurring_days_of_week.includes(day.value)
                                        ? "primary-btn"
                                        : "secondary-btn"
                                    }
                                    style={{ padding: "8px 10px" }}
                                  >
                                    {day.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button onClick={() => saveTaskEdit(task.id)} className="primary-btn">
                          Save
                        </button>
                        <button onClick={cancelEditTask} className="secondary-btn">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            }}
          />
        )}
      </section>
    </div>
  );
}