"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import SortableList from "../../components/SortableList";
import { persistManualOrder } from "../../lib/manual-order";

import {
  EnergyLevel,
  Project,
  RecurringType,
  Task,
  TaskContext,
  TaskPriority,
  TaskStatus,
} from "../../types/task";

type EditProjectForm = {
  name: string;
  description: string;
};

type EditTaskForm = {
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  context: TaskContext;
  due_date: string;
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

type NewTaskByProject = Record<
  number,
  {
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    context: TaskContext;
    due_date: string;
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
  }
>;

const WEEK_DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [editProjectForm, setEditProjectForm] = useState<EditProjectForm | null>(
    null
  );

  const [expandedProjects, setExpandedProjects] = useState<Record<number, boolean>>(
    {}
  );

    const handleReorderProjectTasks = async (reorderedTasks: Task[]) => {
    try {
      await persistManualOrder("tasks", reorderedTasks);
      setTasks((prev) => {
        const reorderedIds = new Set(reorderedTasks.map((item) => item.id));
        const untouched = prev.filter((item) => !reorderedIds.has(item.id));
        return [...untouched, ...reorderedTasks];
      });
      await loadData();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown reorder error";
      alert("保存项目内拖拽顺序失败：" + message);
    }
  };


  const [newTaskByProject, setNewTaskByProject] = useState<NewTaskByProject>({});
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editTaskForm, setEditTaskForm] = useState<EditTaskForm | null>(null);

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

  const loadData = async () => {
    setLoading(true);

    const { data: projectData, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: taskData, error: taskError } = await supabase
      .from("tasks")
      .select("*");

    if (projectError) console.error("Load projects error:", projectError.message);
    if (taskError) console.error("Load tasks error:", taskError.message);

    setProjects((projectData as Project[]) || []);
    setTasks(sortTasksByDueDate((taskData as Task[]) || []));
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleProjectExpand = (projectId: number) => {
    setExpandedProjects((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  };

  const getTasksForProject = (projectId: number) => {
    return sortTasksByDueDate(tasks.filter((task) => task.project_id === projectId));
  };

  const projectCards = useMemo(() => {
    return projects.map((project) => {
      const projectTasks = getTasksForProject(project.id);
      const doneCount = projectTasks.filter((task) => task.status === "done").length;
      const totalCount = projectTasks.length;

      return {
        ...project,
        tasks: projectTasks,
        doneCount,
        totalCount,
        progress:
          totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100),
      };
    });
  }, [projects, tasks]);

  const handleAddProject = async () => {
    if (!name.trim()) return;

    const { error } = await supabase.from("projects").insert({
      name,
      description,
      user_id: null,
    });

    if (error) {
      alert("新增项目失败：" + error.message);
      return;
    }

    setName("");
    setDescription("");
    loadData();
  };

  const deleteProject = async (projectId: number) => {
    const { error } = await supabase.from("projects").delete().eq("id", projectId);

    if (error) {
      alert("删除项目失败：" + error.message);
      return;
    }

    loadData();
  };

  const startEditProject = (project: Project) => {
    setEditingProjectId(project.id);
    setEditProjectForm({
      name: project.name,
      description: project.description || "",
    });
  };

  const cancelEditProject = () => {
    setEditingProjectId(null);
    setEditProjectForm(null);
  };

  const saveProjectEdit = async (projectId: number) => {
    if (!editProjectForm || !editProjectForm.name.trim()) {
      alert("项目名不能为空");
      return;
    }

    const { error } = await supabase
      .from("projects")
      .update({
        name: editProjectForm.name,
        description: editProjectForm.description,
      })
      .eq("id", projectId);

    if (error) {
      alert("保存项目失败：" + error.message);
      return;
    }

    setEditingProjectId(null);
    setEditProjectForm(null);
    loadData();
  };

  const defaultNewTaskForm = {
    title: "",
    status: "todo" as TaskStatus,
    priority: "medium" as TaskPriority,
    context: "home" as TaskContext,
    due_date: "",
    is_quick_task: false,
    estimated_minutes: "",
    notes: "",
    reference_link: "",
    scheduled_date: "",
    start_time: "",
    end_time: "",
    recurring_enabled: false,
    recurring_type: null as RecurringType,
    recurring_interval: "1",
    recurring_days_of_week: [] as number[],
    energy_level: "" as EnergyLevel | "",
    must_do_today: false,
  };

  const ensureProjectTaskForm = (projectId: number) => {
    if (newTaskByProject[projectId]) return;
    setNewTaskByProject((prev) => ({
      ...prev,
      [projectId]: { ...defaultNewTaskForm },
    }));
  };

  const updateProjectTaskForm = <
    K extends keyof NewTaskByProject[number]
  >(
    projectId: number,
    key: K,
    value: NewTaskByProject[number][K]
  ) => {
    ensureProjectTaskForm(projectId);

    setNewTaskByProject((prev) => ({
      ...prev,
      [projectId]: {
        ...(prev[projectId] || defaultNewTaskForm),
        [key]: value,
      },
    }));
  };

  const addTaskToProject = async (projectId: number) => {
    const form = newTaskByProject[projectId];
    if (!form || !form.title.trim()) {
      alert("任务标题不能为空");
      return;
    }

    const { error } = await supabase.from("tasks").insert({
      title: form.title,
      status: form.status,
      priority: form.priority,
      context: form.context,
      due_date: form.due_date || null,
      project_id: projectId,
      is_quick_task: form.is_quick_task,
      estimated_minutes: form.estimated_minutes
        ? Number(form.estimated_minutes)
        : null,
      notes: form.notes || null,
      reference_link: form.reference_link || null,
      scheduled_date: form.scheduled_date || null,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      recurring_enabled: form.recurring_enabled,
      recurring_type: form.recurring_enabled ? form.recurring_type : null,
      recurring_interval: form.recurring_enabled
        ? Number(form.recurring_interval || "1")
        : null,
      recurring_days_of_week:
        form.recurring_enabled && form.recurring_type === "weekly"
          ? form.recurring_days_of_week
          : null,
      energy_level: form.energy_level || null,
      must_do_today: form.must_do_today,
      user_id: null,
    });

    if (error) {
      alert("新增项目任务失败：" + error.message);
      return;
    }

    setNewTaskByProject((prev) => ({
      ...prev,
      [projectId]: { ...defaultNewTaskForm },
    }));

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
      alert("保存任务失败：" + error.message);
      return;
    }

    setEditingTaskId(null);
    setEditTaskForm(null);
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

  if (loading) {
    return (
      <div className="page-wrap">
        <div className="panel card-pad">Loading projects...</div>
      </div>
    );
  }

  return (
    <div className="page-wrap">
      <header className="page-header">
        <div className="page-kicker">Projects</div>
        <h1 className="page-title">Projects</h1>
        <div className="page-desc">
          项目默认收起，展开后可直接新增和编辑该项目下的完整任务。
        </div>
      </header>

      <section className="panel card-pad" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
          Add New Project
        </div>

        <div className="tight-grid-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
            style={{ padding: "10px 12px" }}
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            style={{ padding: "10px 12px" }}
          />
        </div>

        <div style={{ marginTop: 10 }}>
          <button onClick={handleAddProject} className="primary-btn">
            Add Project
          </button>
        </div>
      </section>

      <section className="tight-grid">
        {projectCards.length === 0 ? (
          <div className="panel card-pad text-muted">还没有项目。</div>
        ) : (
          projectCards.map((project) => {
            const isEditingProject = editingProjectId === project.id;
            const isExpanded = !!expandedProjects[project.id];
            const form = newTaskByProject[project.id] || defaultNewTaskForm;

            return (
              <div key={project.id} className="panel">
                <div className="card-pad">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>
                        {project.name}
                      </div>
                      <div className="task-meta">
                        {project.totalCount} tasks · {project.progress}% complete
                      </div>
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      <button
                        onClick={() => toggleProjectExpand(project.id)}
                        className="secondary-btn"
                      >
                        {isExpanded ? "Collapse" : "Expand"}
                      </button>
                      <button
                        onClick={() => startEditProject(project)}
                        className="blue-btn"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteProject(project.id)}
                        className="danger-btn"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="progress-track">
                    <div
                      className="progress-bar"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                </div>

                {isExpanded && (
                  <div
                    style={{
                      borderTop: "1px solid var(--border)",
                      padding: 14,
                    }}
                  >
                    {!isEditingProject ? (
                      <div className="notes-box" style={{ marginTop: 0 }}>
                        {project.description || "No description"}
                      </div>
                    ) : (
                      <div className="tight-grid" style={{ marginBottom: 12 }}>
                        <input
                          type="text"
                          value={editProjectForm?.name || ""}
                          onChange={(e) =>
                            setEditProjectForm((prev) =>
                              prev ? { ...prev, name: e.target.value } : prev
                            )
                          }
                          style={{ padding: "10px 12px" }}
                        />
                        <input
                          type="text"
                          value={editProjectForm?.description || ""}
                          onChange={(e) =>
                            setEditProjectForm((prev) =>
                              prev
                                ? { ...prev, description: e.target.value }
                                : prev
                            )
                          }
                          style={{ padding: "10px 12px" }}
                        />
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            onClick={() => saveProjectEdit(project.id)}
                            className="primary-btn"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEditProject}
                            className="secondary-btn"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="panel-soft card-pad" style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
                        Add Task To This Project
                      </div>

                      <div className="tight-grid">
                        <input
                          type="text"
                          value={form.title}
                          onFocus={() => ensureProjectTaskForm(project.id)}
                          onChange={(e) =>
                            updateProjectTaskForm(project.id, "title", e.target.value)
                          }
                          placeholder="Task title"
                          style={{ padding: "10px 12px" }}
                        />

                        <div className="tight-grid-2">
                          <select
                            value={form.status}
                            onChange={(e) =>
                              updateProjectTaskForm(
                                project.id,
                                "status",
                                e.target.value as TaskStatus
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
                            value={form.priority}
                            onChange={(e) =>
                              updateProjectTaskForm(
                                project.id,
                                "priority",
                                e.target.value as TaskPriority
                              )
                            }
                            style={{ padding: "10px 12px" }}
                          >
                            <option value="low">low</option>
                            <option value="medium">medium</option>
                            <option value="high">high</option>
                          </select>

                          <select
                            value={form.context}
                            onChange={(e) =>
                              updateProjectTaskForm(
                                project.id,
                                "context",
                                e.target.value as TaskContext
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
                            value={form.energy_level}
                            onChange={(e) =>
                              updateProjectTaskForm(
                                project.id,
                                "energy_level",
                                e.target.value as EnergyLevel | ""
                              )
                            }
                            style={{ padding: "10px 12px" }}
                          >
                            <option value="">Energy level</option>
                            <option value="low">low</option>
                            <option value="medium">medium</option>
                            <option value="high">high</option>
                          </select>

                          <input
                            type="date"
                            value={form.due_date}
                            onChange={(e) =>
                              updateProjectTaskForm(project.id, "due_date", e.target.value)
                            }
                            style={{ padding: "10px 12px" }}
                          />

                          <input
                            type="number"
                            value={form.estimated_minutes}
                            onChange={(e) =>
                              updateProjectTaskForm(
                                project.id,
                                "estimated_minutes",
                                e.target.value
                              )
                            }
                            placeholder="Estimated min"
                            style={{ padding: "10px 12px" }}
                          />

                          <input
                            type="date"
                            value={form.scheduled_date}
                            onChange={(e) =>
                              updateProjectTaskForm(
                                project.id,
                                "scheduled_date",
                                e.target.value
                              )
                            }
                            style={{ padding: "10px 12px" }}
                          />

                          <div className="tight-grid-2">
                            <input
                              type="time"
                              value={form.start_time}
                              onChange={(e) =>
                                updateProjectTaskForm(
                                  project.id,
                                  "start_time",
                                  e.target.value
                                )
                              }
                              style={{ padding: "10px 12px" }}
                            />
                            <input
                              type="time"
                              value={form.end_time}
                              onChange={(e) =>
                                updateProjectTaskForm(
                                  project.id,
                                  "end_time",
                                  e.target.value
                                )
                              }
                              style={{ padding: "10px 12px" }}
                            />
                          </div>
                        </div>

                        <input
                          type="text"
                          value={form.reference_link}
                          onChange={(e) =>
                            updateProjectTaskForm(
                              project.id,
                              "reference_link",
                              e.target.value
                            )
                          }
                          placeholder="Reference link / address"
                          style={{ padding: "10px 12px" }}
                        />

                        <textarea
                          value={form.notes}
                          onChange={(e) =>
                            updateProjectTaskForm(project.id, "notes", e.target.value)
                          }
                          rows={3}
                          placeholder="Notes"
                          style={{ padding: "10px 12px" }}
                        />

                        <div className="tight-grid-2">
                          <label
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              fontSize: 14,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={form.is_quick_task}
                              onChange={(e) =>
                                updateProjectTaskForm(
                                  project.id,
                                  "is_quick_task",
                                  e.target.checked
                                )
                              }
                            />
                            Quick Task
                          </label>

                          <label
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              fontSize: 14,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={form.must_do_today}
                              onChange={(e) =>
                                updateProjectTaskForm(
                                  project.id,
                                  "must_do_today",
                                  e.target.checked
                                )
                              }
                            />
                            Must do today
                          </label>

                          <label
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              fontSize: 14,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={form.recurring_enabled}
                              onChange={(e) => {
                                updateProjectTaskForm(
                                  project.id,
                                  "recurring_enabled",
                                  e.target.checked
                                );
                                if (!e.target.checked) {
                                  updateProjectTaskForm(project.id, "recurring_type", null);
                                  updateProjectTaskForm(
                                    project.id,
                                    "recurring_days_of_week",
                                    []
                                  );
                                }
                              }}
                            />
                            Recurring
                          </label>
                        </div>

                        {form.recurring_enabled && (
                          <div className="panel card-pad">
                            <div className="tight-grid-2">
                              <select
                                value={form.recurring_type || ""}
                                onChange={(e) =>
                                  updateProjectTaskForm(
                                    project.id,
                                    "recurring_type",
                                    (e.target.value || null) as RecurringType
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
                                value={form.recurring_interval}
                                onChange={(e) =>
                                  updateProjectTaskForm(
                                    project.id,
                                    "recurring_interval",
                                    e.target.value
                                  )
                                }
                                placeholder="Interval"
                                style={{ padding: "10px 12px" }}
                              />
                            </div>

                            {form.recurring_type === "weekly" && (
                              <div style={{ marginTop: 10 }}>
                                <div
                                  className="text-muted"
                                  style={{ fontSize: 12, marginBottom: 8 }}
                                >
                                  Days of week
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: 8,
                                  }}
                                >
                                  {WEEK_DAYS.map((day) => (
                                    <button
                                      key={day.value}
                                      type="button"
                                      onClick={() =>
                                        toggleRecurringDay(
                                          form.recurring_days_of_week,
                                          day.value,
                                          (next) =>
                                            updateProjectTaskForm(
                                              project.id,
                                              "recurring_days_of_week",
                                              next
                                            )
                                        )
                                      }
                                      className={
                                        form.recurring_days_of_week.includes(day.value)
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
                          <button
                            onClick={() => addTaskToProject(project.id)}
                            className="primary-btn"
                          >
                            Add Task
                          </button>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
                        Tasks In This Project
                      </div>

                                            {project.tasks.length === 0 ? (
                        <div className="panel-soft card-pad text-muted">
                          这个项目下面还没有任务。
                        </div>
                      ) : (
                        <SortableList
                          items={project.tasks}
                          onReorder={handleReorderProjectTasks}
                          renderItem={(task) => {
                            const isEditingTask = editingTaskId === task.id;

                            return (
                              <div className="panel-soft card-pad">
                                {!isEditingTask ? (
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
                                        <div style={{ fontSize: 14, fontWeight: 600 }}>
                                          {task.title}
                                        </div>
                                        <div className="task-meta">
                                          {task.priority} · {task.context} · Due:{" "}
                                          {task.due_date || "N/A"} · Time:{" "}
                                          {task.estimated_minutes !== null
                                            ? `${task.estimated_minutes} min`
                                            : "N/A"}
                                        </div>
                                        <div className="task-meta">
                                          Scheduled: {task.scheduled_date || "N/A"} ·
                                          Slot:{" "}
                                          {task.start_time || task.end_time
                                            ? `${task.start_time || "--"} - ${task.end_time || "--"}`
                                            : "N/A"}
                                          {task.energy_level ? ` · Energy: ${task.energy_level}` : ""}
                                          {task.must_do_today ? " · Must today" : ""}
                                        </div>

                                        {(task.reference_link || task.notes) && (
                                          <div className="notes-box" style={{ marginTop: 8 }}>
                                            {task.reference_link && (
                                              <div style={{ marginBottom: task.notes ? 8 : 0 }}>
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
                                                {task.notes}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    <div
                                      style={{
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: 8,
                                        marginTop: 10,
                                      }}
                                    >
                                      <button
                                        onClick={() => updateTaskStatus(task.id, "inbox")}
                                        className="secondary-btn"
                                      >
                                        Inbox
                                      </button>
                                      <button
                                        onClick={() => updateTaskStatus(task.id, "todo")}
                                        className="secondary-btn"
                                      >
                                        Todo
                                      </button>
                                      <button
                                        onClick={() => updateTaskStatus(task.id, "doing")}
                                        className="secondary-btn"
                                      >
                                        Doing
                                      </button>
                                      <button
                                        onClick={() => updateTaskStatus(task.id, "done")}
                                        className="primary-btn"
                                      >
                                        Done
                                      </button>
                                      <button
                                        onClick={() => startEditTask(task)}
                                        className="blue-btn"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => deleteTask(task.id)}
                                        className="danger-btn"
                                      >
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
                                            prev
                                              ? {
                                                  ...prev,
                                                  status: e.target.value as TaskStatus,
                                                }
                                              : prev
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
                                              ? {
                                                  ...prev,
                                                  priority: e.target.value as TaskPriority,
                                                }
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
                                              ? {
                                                  ...prev,
                                                  context: e.target.value as TaskContext,
                                                }
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
                                        value={editTaskForm?.energy_level || ""}
                                        onChange={(e) =>
                                          setEditTaskForm((prev) =>
                                            prev
                                              ? {
                                                  ...prev,
                                                  energy_level: e.target.value as EnergyLevel | "",
                                                }
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
                                            prev
                                              ? {
                                                  ...prev,
                                                  estimated_minutes: e.target.value,
                                                }
                                              : prev
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
                                            prev
                                              ? { ...prev, scheduled_date: e.target.value }
                                              : prev
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
                                              prev
                                                ? { ...prev, start_time: e.target.value }
                                                : prev
                                            )
                                          }
                                          style={{ padding: "10px 12px" }}
                                        />
                                        <input
                                          type="time"
                                          value={editTaskForm?.end_time || ""}
                                          onChange={(e) =>
                                            setEditTaskForm((prev) =>
                                              prev
                                                ? { ...prev, end_time: e.target.value }
                                                : prev
                                            )
                                          }
                                          style={{ padding: "10px 12px" }}
                                        />
                                      </div>
                                    </div>

                                    <input
                                      type="text"
                                      value={editTaskForm?.reference_link || ""}
                                      onChange={(e) =>
                                        setEditTaskForm((prev) =>
                                          prev
                                            ? { ...prev, reference_link: e.target.value }
                                            : prev
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
                                      <label
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 8,
                                          fontSize: 14,
                                        }}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={editTaskForm?.is_quick_task || false}
                                          onChange={(e) =>
                                            setEditTaskForm((prev) =>
                                              prev
                                                ? { ...prev, is_quick_task: e.target.checked }
                                                : prev
                                            )
                                          }
                                        />
                                        Quick Task
                                      </label>

                                      <label
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 8,
                                          fontSize: 14,
                                        }}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={editTaskForm?.must_do_today || false}
                                          onChange={(e) =>
                                            setEditTaskForm((prev) =>
                                              prev
                                                ? { ...prev, must_do_today: e.target.checked }
                                                : prev
                                            )
                                          }
                                        />
                                        Must do today
                                      </label>

                                      <label
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 8,
                                          fontSize: 14,
                                        }}
                                      >
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
                                      <div className="panel card-pad">
                                        <div className="tight-grid-2">
                                          <select
                                            value={editTaskForm?.recurring_type || ""}
                                            onChange={(e) =>
                                              setEditTaskForm((prev) =>
                                                prev
                                                  ? {
                                                      ...prev,
                                                      recurring_type: (e.target.value ||
                                                        null) as RecurringType,
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
                                                prev
                                                  ? {
                                                      ...prev,
                                                      recurring_interval: e.target.value,
                                                    }
                                                  : prev
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
                                                            ? {
                                                                ...prev,
                                                                recurring_days_of_week: next,
                                                              }
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
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}