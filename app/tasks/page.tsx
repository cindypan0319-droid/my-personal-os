"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  Project,
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
};

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

  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [quickOnly, setQuickOnly] = useState(false);

  const [subtaskInputs, setSubtaskInputs] = useState<Record<number, string>>({});
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editTaskForm, setEditTaskForm] = useState<EditTaskForm | null>(null);
  const [editingSubtaskId, setEditingSubtaskId] = useState<number | null>(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState("");

  const loadData = async () => {
    setLoading(true);

    const { data: taskData, error: taskError } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: projectData, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: subtaskData, error: subtaskError } = await supabase
      .from("subtasks")
      .select("*")
      .order("created_at", { ascending: true });

    if (taskError) console.error("Load tasks error:", taskError.message);
    if (projectError) console.error("Load projects error:", projectError.message);
    if (subtaskError) console.error("Load subtasks error:", subtaskError.message);

    setTasks((taskData as Task[]) || []);
    setProjects((projectData as Project[]) || []);
    setSubtasks((subtaskData as Subtask[]) || []);
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
    return subtasks.filter((subtask) => subtask.task_id === taskId);
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
      user_id: null,
    });

    if (error) {
      console.error("Add task error:", error.message);
      alert("新增任务失败：" + error.message);
      return;
    }

    setTitle("");
    setStatus("todo");
    setPriority("medium");
    setContext("home");
    setDueDate("");
    setProjectId("");
    setIsQuickTask(false);

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
    });
  };

  const cancelEditTask = () => {
    setEditingTaskId(null);
    setEditTaskForm(null);
  };

  const saveTaskEdit = async (taskId: number) => {
    if (!editTaskForm) return;
    if (!editTaskForm.title.trim()) {
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
      })
      .eq("id", taskId);

    if (error) {
      console.error("Save task edit error:", error.message);
      alert("保存任务修改失败：" + error.message);
      return;
    }

    setEditingTaskId(null);
    setEditTaskForm(null);
    loadData();
  };

  const addSubtask = async (taskId: number) => {
    const value = (subtaskInputs[taskId] || "").trim();
    if (!value) return;

    const { error } = await supabase.from("subtasks").insert({
      task_id: taskId,
      title: value,
      status: "todo",
      user_id: null,
    });

    if (error) {
      console.error("Add subtask error:", error.message);
      alert("新增子任务失败：" + error.message);
      return;
    }

    setSubtaskInputs((prev) => ({
      ...prev,
      [taskId]: "",
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
      console.error("Toggle subtask status error:", error.message);
      alert("修改子任务状态失败：" + error.message);
      return;
    }

    loadData();
  };

  const deleteSubtask = async (subtaskId: number) => {
    const { error } = await supabase.from("subtasks").delete().eq("id", subtaskId);

    if (error) {
      console.error("Delete subtask error:", error.message);
      alert("删除子任务失败：" + error.message);
      return;
    }

    loadData();
  };

  const startEditSubtask = (subtask: Subtask) => {
    setEditingSubtaskId(subtask.id);
    setEditingSubtaskTitle(subtask.title);
  };

  const cancelEditSubtask = () => {
    setEditingSubtaskId(null);
    setEditingSubtaskTitle("");
  };

  const saveSubtaskEdit = async (subtaskId: number) => {
    if (!editingSubtaskTitle.trim()) {
      alert("子任务标题不能为空");
      return;
    }

    const { error } = await supabase
      .from("subtasks")
      .update({ title: editingSubtaskTitle })
      .eq("id", subtaskId);

    if (error) {
      console.error("Save subtask edit error:", error.message);
      alert("保存子任务修改失败：" + error.message);
      return;
    }

    setEditingSubtaskId(null);
    setEditingSubtaskTitle("");
    loadData();
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (statusFilter !== "all" && task.status !== statusFilter) return false;
      if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
      if (
        projectFilter !== "all" &&
        String(task.project_id ?? "none") !== projectFilter
      )
        return false;
      if (quickOnly && !task.is_quick_task) return false;
      return true;
    });
  }, [tasks, statusFilter, priorityFilter, projectFilter, quickOnly]);

  if (loading) {
    return (
      <div className="px-6 py-8 md:px-10">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          Loading tasks...
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 md:px-10">
      <header className="mb-8">
        <p className="text-sm text-neutral-500">Tasks</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          All Tasks
        </h1>
        <p className="mt-2 text-neutral-600">
          这里是完整任务管理区，支持编辑和子任务拆解。
        </p>
      </header>

      <section className="mb-8 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Add New Task</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：完成 CIV 作业第一部分"
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-neutral-400"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-neutral-400"
            >
              <option value="inbox">inbox</option>
              <option value="todo">todo</option>
              <option value="doing">doing</option>
              <option value="done">done</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-neutral-400"
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Context
            </label>
            <select
              value={context}
              onChange={(e) => setContext(e.target.value as TaskContext)}
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-neutral-400"
            >
              <option value="home">home</option>
              <option value="computer">computer</option>
              <option value="shop">shop</option>
              <option value="outside">outside</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-neutral-400"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Project
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-neutral-400"
            >
              <option value="">No Project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 pt-8">
            <input
              id="quick-task"
              type="checkbox"
              checked={isQuickTask}
              onChange={(e) => setIsQuickTask(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="quick-task" className="text-sm text-neutral-700">
              This is a Quick Task
            </label>
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={handleAddTask}
            className="rounded-xl bg-neutral-900 px-5 py-3 text-white hover:opacity-90"
          >
            Add Task
          </button>
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Filters</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-neutral-400"
            >
              <option value="all">all</option>
              <option value="inbox">inbox</option>
              <option value="todo">todo</option>
              <option value="doing">doing</option>
              <option value="done">done</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Priority
            </label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-neutral-400"
            >
              <option value="all">all</option>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Project
            </label>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-neutral-400"
            >
              <option value="all">all</option>
              <option value="none">No Project</option>
              {projects.map((project) => (
                <option key={project.id} value={String(project.id)}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 pt-8">
            <input
              id="quick-only"
              type="checkbox"
              checked={quickOnly}
              onChange={(e) => setQuickOnly(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="quick-only" className="text-sm text-neutral-700">
              Show quick tasks only
            </label>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        {filteredTasks.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm text-neutral-500">
            没有符合筛选条件的任务。
          </div>
        ) : (
          filteredTasks.map((task) => {
            const taskSubtasks = getSubtasksForTask(task.id);
            const progress = getSubtaskProgress(task.id);
            const isEditing = editingTaskId === task.id;

            return (
              <div
                key={task.id}
                className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
              >
                {!isEditing ? (
                  <>
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h2 className="text-lg font-semibold">{task.title}</h2>
                        <p className="mt-2 text-sm text-neutral-500">
                          Project: {getProjectName(task.project_id)}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-neutral-100 px-3 py-1">
                          Status: {task.status}
                        </span>
                        <span className="rounded-full bg-neutral-100 px-3 py-1">
                          Priority: {task.priority}
                        </span>
                        <span className="rounded-full bg-neutral-100 px-3 py-1">
                          Context: {task.context}
                        </span>
                        <span className="rounded-full bg-neutral-100 px-3 py-1">
                          Due: {task.due_date || "No date"}
                        </span>
                        {task.is_quick_task && (
                          <span className="rounded-full bg-neutral-900 px-3 py-1 text-white">
                            Quick Task
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={() => updateTaskStatus(task.id, "inbox")}
                        className="rounded-lg bg-white px-3 py-2 text-sm text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-100"
                      >
                        Inbox
                      </button>
                      <button
                        onClick={() => updateTaskStatus(task.id, "todo")}
                        className="rounded-lg bg-white px-3 py-2 text-sm text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-100"
                      >
                        Todo
                      </button>
                      <button
                        onClick={() => updateTaskStatus(task.id, "doing")}
                        className="rounded-lg bg-white px-3 py-2 text-sm text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-100"
                      >
                        Doing
                      </button>
                      <button
                        onClick={() => updateTaskStatus(task.id, "done")}
                        className="rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white hover:opacity-90"
                      >
                        Done
                      </button>
                      <button
                        onClick={() => startEditTask(task)}
                        className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-600 ring-1 ring-blue-200 hover:bg-blue-100"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-red-200 hover:bg-red-100"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-neutral-700">
                        Title
                      </label>
                      <input
                        type="text"
                        value={editTaskForm?.title || ""}
                        onChange={(e) =>
                          setEditTaskForm((prev) =>
                            prev ? { ...prev, title: e.target.value } : prev
                          )
                        }
                        className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-neutral-400"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-neutral-700">
                        Status
                      </label>
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
                        className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-neutral-400"
                      >
                        <option value="inbox">inbox</option>
                        <option value="todo">todo</option>
                        <option value="doing">doing</option>
                        <option value="done">done</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-neutral-700">
                        Priority
                      </label>
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
                        className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-neutral-400"
                      >
                        <option value="low">low</option>
                        <option value="medium">medium</option>
                        <option value="high">high</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-neutral-700">
                        Context
                      </label>
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
                        className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-neutral-400"
                      >
                        <option value="home">home</option>
                        <option value="computer">computer</option>
                        <option value="shop">shop</option>
                        <option value="outside">outside</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-neutral-700">
                        Due Date
                      </label>
                      <input
                        type="date"
                        value={editTaskForm?.due_date || ""}
                        onChange={(e) =>
                          setEditTaskForm((prev) =>
                            prev ? { ...prev, due_date: e.target.value } : prev
                          )
                        }
                        className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-neutral-400"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-neutral-700">
                        Project
                      </label>
                      <select
                        value={editTaskForm?.project_id || ""}
                        onChange={(e) =>
                          setEditTaskForm((prev) =>
                            prev ? { ...prev, project_id: e.target.value } : prev
                          )
                        }
                        className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-neutral-400"
                      >
                        <option value="">No Project</option>
                        {projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-3 pt-8">
                      <input
                        id={`edit-quick-${task.id}`}
                        type="checkbox"
                        checked={editTaskForm?.is_quick_task || false}
                        onChange={(e) =>
                          setEditTaskForm((prev) =>
                            prev
                              ? { ...prev, is_quick_task: e.target.checked }
                              : prev
                          )
                        }
                        className="h-4 w-4"
                      />
                      <label
                        htmlFor={`edit-quick-${task.id}`}
                        className="text-sm text-neutral-700"
                      >
                        Quick Task
                      </label>
                    </div>

                    <div className="md:col-span-2 flex flex-wrap gap-2">
                      <button
                        onClick={() => saveTaskEdit(task.id)}
                        className="rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white hover:opacity-90"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEditTask}
                        className="rounded-lg bg-white px-3 py-2 text-sm text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-6 rounded-xl bg-neutral-50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-neutral-900">
                      Subtasks
                    </h3>
                    <span className="text-xs text-neutral-500">
                      {progress.done}/{progress.total} done · {progress.percent}%
                    </span>
                  </div>

                  {taskSubtasks.length > 0 && (
                    <div className="mb-3 h-2 rounded-full bg-neutral-200">
                      <div
                        className="h-2 rounded-full bg-neutral-900"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    {taskSubtasks.length === 0 ? (
                      <div className="text-sm text-neutral-500">
                        还没有子任务
                      </div>
                    ) : (
                      taskSubtasks.map((subtask) => {
                        const isEditingSubtask = editingSubtaskId === subtask.id;

                        return (
                          <div
                            key={subtask.id}
                            className="flex items-center justify-between rounded-lg bg-white p-3"
                          >
                            {!isEditingSubtask ? (
                              <>
                                <div className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    checked={subtask.status === "done"}
                                    onChange={() => toggleSubtaskStatus(subtask)}
                                  />
                                  <span
                                    className={
                                      subtask.status === "done"
                                        ? "text-sm text-neutral-400 line-through"
                                        : "text-sm text-neutral-800"
                                    }
                                  >
                                    {subtask.title}
                                  </span>
                                </div>

                                <div className="flex gap-2">
                                  <button
                                    onClick={() => startEditSubtask(subtask)}
                                    className="rounded-lg bg-blue-50 px-2 py-1 text-xs text-blue-600 ring-1 ring-blue-200 hover:bg-blue-100"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => deleteSubtask(subtask.id)}
                                    className="rounded-lg bg-red-50 px-2 py-1 text-xs text-red-600 ring-1 ring-red-200 hover:bg-red-100"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </>
                            ) : (
                              <div className="flex w-full gap-2">
                                <input
                                  type="text"
                                  value={editingSubtaskTitle}
                                  onChange={(e) =>
                                    setEditingSubtaskTitle(e.target.value)
                                  }
                                  className="flex-1 rounded-xl border border-neutral-200 px-3 py-2 outline-none focus:border-neutral-400"
                                />
                                <button
                                  onClick={() => saveSubtaskEdit(subtask.id)}
                                  className="rounded-lg bg-neutral-900 px-3 py-2 text-xs text-white hover:opacity-90"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={cancelEditSubtask}
                                  className="rounded-lg bg-white px-3 py-2 text-xs text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-100"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="mt-4 flex gap-3">
                    <input
                      type="text"
                      value={subtaskInputs[task.id] || ""}
                      onChange={(e) =>
                        setSubtaskInputs((prev) => ({
                          ...prev,
                          [task.id]: e.target.value,
                        }))
                      }
                      placeholder="添加一个子任务，例如：先列出要做的3步"
                      className="flex-1 rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-neutral-400"
                    />
                    <button
                      onClick={() => addSubtask(task.id)}
                      className="rounded-xl bg-neutral-900 px-4 py-3 text-white hover:opacity-90"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}