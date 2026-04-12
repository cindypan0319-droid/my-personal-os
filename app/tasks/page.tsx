"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { PageHeader } from "../../components/app/PageHeader";
import { NewTaskModal } from "../../components/tasks/NewTaskModal";
import { TaskDetailPanel } from "../../components/tasks/TaskDetailPanel";
import { TaskRow } from "../../components/tasks/TaskRow";
import { Project, Task } from "../../types/task";

type TaskView =
  | "all"
  | "today"
  | "inbox"
  | "doing"
  | "done"
  | "quick"
  | "must";

const VIEW_OPTIONS: Array<{ value: TaskView; label: string }> = [
  { value: "all", label: "All Tasks" },
  { value: "today", label: "Today" },
  { value: "inbox", label: "Inbox" },
  { value: "doing", label: "Doing" },
  { value: "done", label: "Done" },
  { value: "quick", label: "Quick Tasks" },
  { value: "must", label: "Must Do Today" },
];

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState<TaskView>("all");
  const [search, setSearch] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);

    const { data: taskData, error: taskError } = await supabase
      .from("tasks")
      .select("*");

    const { data: projectData, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (taskError) console.error("Load tasks error:", taskError.message);
    if (projectError) console.error("Load projects error:", projectError.message);

    setTasks((taskData as Task[]) || []);
    setProjects((projectData as Project[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const todayStr = new Date().toISOString().split("T")[0];

  const filteredTasks = useMemo(() => {
    return [...tasks]
      .filter((task) => {
        if (view === "today") {
          return (
            task.status !== "done" &&
            (task.due_date === todayStr || task.scheduled_date === todayStr)
          );
        }
        if (view === "inbox") return task.status === "inbox";
        if (view === "doing") return task.status === "doing";
        if (view === "done") return task.status === "done";
        if (view === "quick") return !!task.is_quick_task;
        if (view === "must") return !!task.must_do_today;
        return true;
      })
      .filter((task) =>
        task.title.toLowerCase().includes(search.trim().toLowerCase())
      )
      .sort((a, b) => {
        const aDone = a.status === "done" ? 1 : 0;
        const bDone = b.status === "done" ? 1 : 0;
        if (aDone !== bDone) return aDone - bDone;

        const aMust = a.must_do_today ? 1 : 0;
        const bMust = b.must_do_today ? 1 : 0;
        if (aMust !== bMust) return bMust - aMust;

        const aOrder = a.manual_order ?? 999999;
        const bOrder = b.manual_order ?? 999999;
        if (aOrder !== bOrder) return aOrder - bOrder;

        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        if (a.due_date && !b.due_date) return -1;
        if (!a.due_date && b.due_date) return 1;

        return b.created_at.localeCompare(a.created_at);
      });
  }, [tasks, view, search, todayStr]);

  useEffect(() => {
    if (!selectedTaskId && filteredTasks.length > 0) {
      setSelectedTaskId(filteredTasks[0].id);
    }
  }, [filteredTasks, selectedTaskId]);

  const selectedTask =
    filteredTasks.find((task) => task.id === selectedTaskId) ||
    tasks.find((task) => task.id === selectedTaskId) ||
    null;

  const toggleDone = async (task: Task) => {
    const nextStatus = task.status === "done" ? "todo" : "done";

    // 先本地更新，避免每次点击都像整页刷新
    setTasks((prev) =>
      prev.map((item) =>
        item.id === task.id ? { ...item, status: nextStatus } : item
      )
    );

    const { error } = await supabase
      .from("tasks")
      .update({ status: nextStatus })
      .eq("id", task.id);

    if (error) {
      alert("修改任务状态失败：" + error.message);
      await loadData();
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
      <PageHeader
        kicker="Tasks"
        title="Tasks"
        description="Plan, sort, and complete your work."
        actions={
          <>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks"
              style={{ minWidth: 220 }}
            />
            <button className="primary-btn" onClick={() => setModalOpen(true)}>
              + New Task
            </button>
          </>
        }
      />

      <section className="task-layout">
        <aside className="panel card-pad task-sidebar">
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
            Views
          </div>

          <div className="tight-grid">
            {VIEW_OPTIONS.map((item) => (
              <button
                key={item.value}
                className={view === item.value ? "blue-btn" : "secondary-btn"}
                onClick={() => setView(item.value)}
                style={{ textAlign: "left" }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </aside>

        <div className="panel card-pad">
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
            Task List ({filteredTasks.length})
          </div>

          <div className="tight-grid">
            {filteredTasks.length === 0 ? (
              <div className="panel-soft card-pad empty-state">No tasks found.</div>
            ) : (
              filteredTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  projects={projects}
                  active={selectedTaskId === task.id}
                  onSelect={() => setSelectedTaskId(task.id)}
                  onToggleDone={() => toggleDone(task)}
                />
              ))
            )}
          </div>
        </div>

        <TaskDetailPanel
          task={selectedTask}
          projects={projects}
          onUpdated={loadData}
          onDeleted={async () => {
            setSelectedTaskId(null);
            await loadData();
          }}
        />
      </section>

      <NewTaskModal
        open={modalOpen}
        projects={projects}
        onClose={() => setModalOpen(false)}
        onCreated={loadData}
      />
    </div>
  );
}