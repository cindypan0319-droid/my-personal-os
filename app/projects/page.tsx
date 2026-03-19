"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  Project,
  Task,
  TaskContext,
  TaskPriority,
  TaskStatus,
} from "../../types/task";

type EditProjectForm = {
  name: string;
  description: string;
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
  }
>;

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

  const [newTaskByProject, setNewTaskByProject] = useState<NewTaskByProject>({});

  const loadData = async () => {
    setLoading(true);

    const { data: projectData, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: taskData, error: taskError } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (projectError) {
      console.error("Load projects error:", projectError.message);
    }
    if (taskError) {
      console.error("Load tasks error:", taskError.message);
    }

    setProjects((projectData as Project[]) || []);
    setTasks((taskData as Task[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const getTasksForProject = (projectId: number) => {
    return tasks.filter((task) => task.project_id === projectId);
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
      console.error("Add project error:", error.message);
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
      console.error("Delete project error:", error.message);
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
    if (!editProjectForm) return;
    if (!editProjectForm.name.trim()) {
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
      console.error("Save project edit error:", error.message);
      alert("保存项目失败：" + error.message);
      return;
    }

    setEditingProjectId(null);
    setEditProjectForm(null);
    loadData();
  };

  const ensureProjectTaskForm = (projectId: number) => {
    if (newTaskByProject[projectId]) return;

    setNewTaskByProject((prev) => ({
      ...prev,
      [projectId]: {
        title: "",
        status: "todo",
        priority: "medium",
        context: "home",
        due_date: "",
        is_quick_task: false,
      },
    }));
  };

  const updateProjectTaskForm = <K extends keyof NewTaskByProject[number]>(
    projectId: number,
    key: K,
    value: NewTaskByProject[number][K]
  ) => {
    ensureProjectTaskForm(projectId);

    setNewTaskByProject((prev) => ({
      ...prev,
      [projectId]: {
        ...(prev[projectId] || {
          title: "",
          status: "todo",
          priority: "medium",
          context: "home",
          due_date: "",
          is_quick_task: false,
        }),
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
      user_id: null,
    });

    if (error) {
      console.error("Add project task error:", error.message);
      alert("新增项目任务失败：" + error.message);
      return;
    }

    setNewTaskByProject((prev) => ({
      ...prev,
      [projectId]: {
        title: "",
        status: "todo",
        priority: "medium",
        context: "home",
        due_date: "",
        is_quick_task: false,
      },
    }));

    loadData();
  };

  const updateTaskStatus = async (taskId: number, newStatus: TaskStatus) => {
    const { error } = await supabase
      .from("tasks")
      .update({ status: newStatus })
      .eq("id", taskId);

    if (error) {
      console.error("Update task status error:", error.message);
      alert("修改任务状态失败：" + error.message);
      return;
    }

    loadData();
  };

  const deleteTask = async (taskId: number) => {
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);

    if (error) {
      console.error("Delete task error:", error.message);
      alert("删除任务失败：" + error.message);
      return;
    }

    loadData();
  };

  if (loading) {
    return (
      <div className="px-6 py-8 md:px-10">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          Loading projects...
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 md:px-10">
      <header className="mb-8">
        <p className="text-sm text-neutral-500">Projects</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Projects</h1>
        <p className="mt-2 text-neutral-600">
          这里管理你的大项目，并直接看到每个项目下面的任务。
        </p>
      </header>

      <section className="mb-8 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Add New Project</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Project Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：Final studio portfolio"
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-neutral-400"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简单写一下这个项目是做什么的"
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-neutral-400"
            />
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={handleAddProject}
            className="rounded-xl bg-neutral-900 px-5 py-3 text-white hover:opacity-90"
          >
            Add Project
          </button>
        </div>
      </section>

      <section className="space-y-6">
        {projectCards.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm text-neutral-500">
            还没有项目。
          </div>
        ) : (
          projectCards.map((project) => {
            const isEditing = editingProjectId === project.id;
            const form = newTaskByProject[project.id] || {
              title: "",
              status: "todo" as TaskStatus,
              priority: "medium" as TaskPriority,
              context: "home" as TaskContext,
              due_date: "",
              is_quick_task: false,
            };

            return (
              <div
                key={project.id}
                className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
              >
                {!isEditing ? (
                  <>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <h2 className="text-xl font-semibold">{project.name}</h2>
                        <p className="mt-2 text-sm text-neutral-500">
                          {project.description || "No description"}
                        </p>
                        <p className="mt-4 text-sm text-neutral-700">
                          {project.doneCount}/{project.totalCount} tasks done
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => startEditProject(project)}
                          className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-600 ring-1 ring-blue-200 hover:bg-blue-100"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteProject(project.id)}
                          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-red-200 hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 h-2 rounded-full bg-neutral-100">
                      <div
                        className="h-2 rounded-full bg-neutral-900"
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                    <div className="mt-2 text-xs text-neutral-500">
                      Progress: {project.progress}%
                    </div>
                  </>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-neutral-700">
                        Project Name
                      </label>
                      <input
                        type="text"
                        value={editProjectForm?.name || ""}
                        onChange={(e) =>
                          setEditProjectForm((prev) =>
                            prev ? { ...prev, name: e.target.value } : prev
                          )
                        }
                        className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-neutral-400"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-neutral-700">
                        Description
                      </label>
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
                        className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-neutral-400"
                      />
                    </div>

                    <div className="md:col-span-2 flex gap-2">
                      <button
                        onClick={() => saveProjectEdit(project.id)}
                        className="rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white hover:opacity-90"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEditProject}
                        className="rounded-lg bg-white px-3 py-2 text-sm text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-6 rounded-xl bg-neutral-50 p-4">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-neutral-900">
                      Add Task To This Project
                    </h3>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      type="text"
                      value={form.title}
                      onFocus={() => ensureProjectTaskForm(project.id)}
                      onChange={(e) =>
                        updateProjectTaskForm(project.id, "title", e.target.value)
                      }
                      placeholder="任务标题"
                      className="md:col-span-2 rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-neutral-400"
                    />

                    <select
                      value={form.status}
                      onChange={(e) =>
                        updateProjectTaskForm(
                          project.id,
                          "status",
                          e.target.value as TaskStatus
                        )
                      }
                      className="rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-neutral-400"
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
                      className="rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-neutral-400"
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
                      className="rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-neutral-400"
                    >
                      <option value="home">home</option>
                      <option value="computer">computer</option>
                      <option value="shop">shop</option>
                      <option value="outside">outside</option>
                    </select>

                    <input
                      type="date"
                      value={form.due_date}
                      onChange={(e) =>
                        updateProjectTaskForm(project.id, "due_date", e.target.value)
                      }
                      className="rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-neutral-400"
                    />

                    <div className="flex items-center gap-3 pt-3">
                      <input
                        id={`quick-${project.id}`}
                        type="checkbox"
                        checked={form.is_quick_task}
                        onChange={(e) =>
                          updateProjectTaskForm(
                            project.id,
                            "is_quick_task",
                            e.target.checked
                          )
                        }
                        className="h-4 w-4"
                      />
                      <label
                        htmlFor={`quick-${project.id}`}
                        className="text-sm text-neutral-700"
                      >
                        Quick Task
                      </label>
                    </div>
                  </div>

                  <div className="mt-4">
                    <button
                      onClick={() => addTaskToProject(project.id)}
                      className="rounded-xl bg-neutral-900 px-4 py-3 text-white hover:opacity-90"
                    >
                      Add Task
                    </button>
                  </div>
                </div>

                <div className="mt-6">
                  <h3 className="mb-3 text-sm font-semibold text-neutral-900">
                    Tasks In This Project
                  </h3>

                  {project.tasks.length === 0 ? (
                    <div className="rounded-xl bg-neutral-50 p-4 text-sm text-neutral-500">
                      这个项目下面还没有任务。
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {project.tasks.map((task) => (
                        <div
                          key={task.id}
                          className="rounded-xl border border-neutral-200 p-4"
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <div className="font-medium text-neutral-900">
                                {task.title}
                              </div>
                              <div className="mt-1 text-sm text-neutral-500">
                                {task.priority} · {task.context} ·{" "}
                                {task.due_date || "No due date"}
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => updateTaskStatus(task.id, "inbox")}
                                className="rounded-lg bg-white px-3 py-2 text-xs text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-100"
                              >
                                Inbox
                              </button>
                              <button
                                onClick={() => updateTaskStatus(task.id, "todo")}
                                className="rounded-lg bg-white px-3 py-2 text-xs text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-100"
                              >
                                Todo
                              </button>
                              <button
                                onClick={() => updateTaskStatus(task.id, "doing")}
                                className="rounded-lg bg-white px-3 py-2 text-xs text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-100"
                              >
                                Doing
                              </button>
                              <button
                                onClick={() => updateTaskStatus(task.id, "done")}
                                className="rounded-lg bg-neutral-900 px-3 py-2 text-xs text-white hover:opacity-90"
                              >
                                Done
                              </button>
                              <button
                                onClick={() => deleteTask(task.id)}
                                className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 ring-1 ring-red-200 hover:bg-red-100"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}