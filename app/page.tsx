"use client";

import { useEffect, useMemo, useState } from "react";
import AuthGate from "../components/AuthGate";
import { supabase } from "../lib/supabase";
import { Project, Task } from "../types/task";

export default function DashboardPage() {
  return (
    <AuthGate>
      <DashboardContent />
    </AuthGate>
  );
}

function DashboardContent() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [inboxInput, setInboxInput] = useState("");
  const [loading, setLoading] = useState(true);

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

    if (taskError) {
      console.error("Load tasks error:", taskError.message);
    }

    if (projectError) {
      console.error("Load projects error:", projectError.message);
    }

    setTasks((taskData as Task[]) || []);
    setProjects((projectData as Project[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const todayStr = new Date().toISOString().split("T")[0];

  const getProjectName = (projectId: number | null) => {
    if (projectId === null) return "No Project";
    const project = projects.find((item) => item.id === projectId);
    return project ? project.name : "No Project";
  };

  const activeTasks = useMemo(() => {
    return tasks.filter((task) => task.status !== "done");
  }, [tasks]);

  const inboxTasks = useMemo(() => {
    return tasks.filter((task) => task.status === "inbox");
  }, [tasks]);

  const quickTasks = useMemo(() => {
    return tasks
      .filter((task) => task.is_quick_task && task.status !== "done")
      .sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      })
      .slice(0, 6);
  }, [tasks]);

  const overdueTasks = useMemo(() => {
    return tasks.filter(
      (task) =>
        task.status !== "done" &&
        task.due_date &&
        task.due_date < todayStr
    );
  }, [tasks, todayStr]);

  const dueSoonTasks = useMemo(() => {
    return tasks
      .filter(
        (task) =>
          task.status !== "done" &&
          task.due_date &&
          task.due_date >= todayStr
      )
      .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""))
      .slice(0, 5);
  }, [tasks, todayStr]);

  const todayTop3 = useMemo(() => {
    return [...tasks]
      .filter((task) => task.status !== "done" && task.status !== "inbox")
      .sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };

        if (a.due_date && a.due_date < todayStr && (!b.due_date || b.due_date >= todayStr)) {
          return -1;
        }
        if (b.due_date && b.due_date < todayStr && (!a.due_date || a.due_date >= todayStr)) {
          return 1;
        }

        const priorityDiff =
          priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;

        if (a.due_date && b.due_date) {
          return a.due_date.localeCompare(b.due_date);
        }
        if (a.due_date) return -1;
        if (b.due_date) return 1;

        return 0;
      })
      .slice(0, 3);
  }, [tasks, todayStr]);

  const projectSummary = useMemo(() => {
    return projects.map((project) => {
      const projectTasks = tasks.filter((task) => task.project_id === project.id);
      const doneCount = projectTasks.filter((task) => task.status === "done").length;
      const totalCount = projectTasks.length;

      return {
        ...project,
        totalCount,
        doneCount,
        progress:
          totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100),
      };
    });
  }, [projects, tasks]);

  const handleAddInbox = async () => {
    if (!inboxInput.trim()) return;

    const { error } = await supabase.from("tasks").insert({
      title: inboxInput,
      status: "inbox",
      priority: "medium",
      context: "home",
      due_date: null,
      project_id: null,
      is_quick_task: true,
    });

    if (error) {
      console.error("Add inbox task error:", error.message);
      return;
    }

    setInboxInput("");
    loadData();
  };

  const updateTaskStatus = async (
    taskId: number,
    newStatus: Task["status"]
  ) => {
    const { error } = await supabase
      .from("tasks")
      .update({ status: newStatus })
      .eq("id", taskId);

    if (error) {
      console.error("Update task status error:", error.message);
      return;
    }

    loadData();
  };

  const makeQuickTaskDone = async (taskId: number) => {
    await updateTaskStatus(taskId, "done");
  };

  if (loading) {
    return (
      <div className="px-6 py-8 md:px-10">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          Loading dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 md:px-10">
      <header className="mb-8">
        <p className="text-sm text-neutral-500">Dashboard</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Today</h1>
        <p className="mt-2 text-neutral-600">
          打开这个页面，就知道今天最值得先做什么。
        </p>
      </header>

      <section className="mb-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-neutral-500">Active Tasks</p>
          <p className="mt-2 text-3xl font-semibold">{activeTasks.length}</p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-neutral-500">Inbox</p>
          <p className="mt-2 text-3xl font-semibold">{inboxTasks.length}</p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-neutral-500">Quick Tasks</p>
          <p className="mt-2 text-3xl font-semibold">{quickTasks.length}</p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-neutral-500">Overdue</p>
          <p className="mt-2 text-3xl font-semibold">{overdueTasks.length}</p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Today Top 3</h2>
            <span className="text-sm text-neutral-400">最值得先做</span>
          </div>

          <div className="space-y-3">
            {todayTop3.length === 0 ? (
              <div className="rounded-xl bg-neutral-50 p-4 text-sm text-neutral-500">
                还没有可执行任务。先去 All Tasks 新增，或者先在 Inbox 记下来。
              </div>
            ) : (
              todayTop3.map((task, index) => (
                <div
                  key={task.id}
                  className="rounded-xl border border-neutral-200 p-4"
                >
                  <p className="text-sm text-neutral-400">{index + 1}</p>
                  <p className="mt-1 font-medium">{task.title}</p>
                  <p className="mt-1 text-sm text-neutral-500">
                    {getProjectName(task.project_id)} · {task.priority} ·{" "}
                    {task.context} · {task.due_date || "No due date"}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => updateTaskStatus(task.id, "doing")}
                      className="rounded-lg bg-white px-3 py-2 text-sm text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-100"
                    >
                      Move to doing
                    </button>
                    <button
                      onClick={() => updateTaskStatus(task.id, "done")}
                      className="rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white hover:opacity-90"
                    >
                      Mark done
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Quick Tasks</h2>
            <span className="text-sm text-neutral-400">3 分钟</span>
          </div>

          <div className="space-y-3 text-sm">
            {quickTasks.length === 0 ? (
              <div className="rounded-xl bg-neutral-50 p-3 text-neutral-500">
                暂时没有 quick tasks
              </div>
            ) : (
              quickTasks.map((task) => (
                <div key={task.id} className="rounded-xl bg-neutral-50 p-3">
                  <div className="font-medium text-neutral-900">{task.title}</div>
                  <div className="mt-1 text-xs text-neutral-500">
                    {task.context} · {task.priority}
                  </div>
                  <div className="mt-3">
                    <button
                      onClick={() => makeQuickTaskDone(task.id)}
                      className="rounded-lg bg-white px-3 py-2 text-xs text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-100"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Inbox</h2>
            <span className="text-sm text-neutral-400">先记下来</span>
          </div>

          <div className="mb-4 flex gap-3">
            <input
              type="text"
              value={inboxInput}
              onChange={(e) => setInboxInput(e.target.value)}
              placeholder="输入一句话，比如：明天记得交作业"
              className="flex-1 rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-neutral-400"
            />
            <button
              onClick={handleAddInbox}
              className="rounded-xl bg-neutral-900 px-5 py-3 text-white hover:opacity-90"
            >
              Add
            </button>
          </div>

          <div className="space-y-2 text-sm text-neutral-600">
            {inboxTasks.length === 0 ? (
              <div className="rounded-xl bg-neutral-50 p-3 text-neutral-500">
                Inbox 目前是空的
              </div>
            ) : (
              inboxTasks.slice(0, 6).map((task) => (
                <div key={task.id} className="rounded-xl bg-neutral-50 p-3">
                  <div className="font-medium text-neutral-900">{task.title}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      onClick={() => updateTaskStatus(task.id, "todo")}
                      className="rounded-lg bg-white px-3 py-2 text-xs text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-100"
                    >
                      Move to todo
                    </button>
                    <button
                      onClick={() => updateTaskStatus(task.id, "done")}
                      className="rounded-lg bg-white px-3 py-2 text-xs text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-100"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Due Soon / Overdue</h2>
            <span className="text-sm text-neutral-400">提醒</span>
          </div>

          <div className="space-y-3">
            {overdueTasks.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-red-600">Overdue</p>
                <div className="space-y-2">
                  {overdueTasks.slice(0, 4).map((task) => (
                    <div
                      key={task.id}
                      className="rounded-xl border border-red-200 bg-red-50 p-3"
                    >
                      <div className="font-medium text-neutral-900">
                        {task.title}
                      </div>
                      <div className="mt-1 text-xs text-neutral-600">
                        {task.due_date} · {getProjectName(task.project_id)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">
                Due Soon
              </p>
              <div className="space-y-2">
                {dueSoonTasks.length === 0 ? (
                  <div className="rounded-xl bg-neutral-50 p-3 text-sm text-neutral-500">
                    暂时没有即将到期任务
                  </div>
                ) : (
                  dueSoonTasks.map((task) => (
                    <div
                      key={task.id}
                      className="rounded-xl bg-neutral-50 p-3"
                    >
                      <div className="font-medium text-neutral-900">
                        {task.title}
                      </div>
                      <div className="mt-1 text-xs text-neutral-600">
                        {task.due_date} · {getProjectName(task.project_id)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Projects Overview</h2>
          <span className="text-sm text-neutral-400">进度概览</span>
        </div>

        {projectSummary.length === 0 ? (
          <div className="rounded-xl bg-neutral-50 p-4 text-sm text-neutral-500">
            还没有项目，先去 Projects 页面创建。
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projectSummary.map((project) => (
              <div
                key={project.id}
                className="rounded-xl border border-neutral-200 p-4"
              >
                <div className="font-medium">{project.name}</div>
                <div className="mt-1 text-sm text-neutral-500">
                  {project.description || "No description"}
                </div>
                <div className="mt-3 text-sm text-neutral-700">
                  {project.doneCount}/{project.totalCount} tasks done
                </div>
                <div className="mt-3 h-2 rounded-full bg-neutral-100">
                  <div
                    className="h-2 rounded-full bg-neutral-900"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
                <div className="mt-2 text-xs text-neutral-500">
                  Progress: {project.progress}%
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}