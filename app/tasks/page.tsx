"use client";

import { useEffect, useMemo, useState } from "react";
import AuthGate from "../../components/AuthGate";
import { supabase } from "../../lib/supabase";
import { Project, Task, TaskContext, TaskPriority, TaskStatus } from "../../types/task";

export default function TasksPage() {
  return (
    <AuthGate>
      <TasksContent />
    </AuthGate>
  );
}

function TasksContent() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [context, setContext] = useState<TaskContext>("home");
  const [dueDate, setDueDate] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [isQuickTask, setIsQuickTask] = useState(false);

  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [quickOnly, setQuickOnly] = useState(false);

  const loadData = async () => {
    const { data: taskData } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: projectData } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    setTasks((taskData as Task[]) || []);
    setProjects((projectData as Project[]) || []);
  };

  useEffect(() => {
    loadData();
  }, []);

  const getProjectName = (projectId: number | null) => {
    if (projectId === null) return "No Project";
    const project = projects.find((item) => item.id === projectId);
    return project ? project.name : "No Project";
  };

  const handleAddTask = async () => {
    if (!title.trim()) return;

    await supabase.from("tasks").insert({
      title,
      status,
      priority,
      context,
      due_date: dueDate || null,
      project_id: projectId ? Number(projectId) : null,
      is_quick_task: isQuickTask,
    });

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
    await supabase.from("tasks").update({ status: newStatus }).eq("id", taskId);
    loadData();
  };

  const deleteTask = async (taskId: number) => {
    await supabase.from("tasks").delete().eq("id", taskId);
    loadData();
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (statusFilter !== "all" && task.status !== statusFilter) return false;
      if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
      if (quickOnly && !task.is_quick_task) return false;
      return true;
    });
  }, [tasks, statusFilter, priorityFilter, quickOnly]);

  return (
    <div className="px-6 py-8 md:px-10">
      <header className="mb-8">
        <p className="text-sm text-neutral-500">Tasks</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">All Tasks</h1>
        <p className="mt-2 text-neutral-600">
          这里是完整任务管理区。
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

        <div className="grid gap-4 md:grid-cols-3">
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
          filteredTasks.map((task) => (
            <div
              key={task.id}
              className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
            >
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
                  onClick={() => deleteTask(task.id)}
                  className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-red-200 hover:bg-red-100"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}