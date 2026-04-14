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

  const [view, setView] = useState<TaskView>("today");
  const [search, setSearch] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewsCollapsed, setViewsCollapsed] = useState(false);

  const loadData = async () => {
    setLoading(true);

    const { data: taskData, error: taskError } = await supabase.from("tasks").select("*");
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

  const activeTasks = useMemo(
    () => tasks.filter((task) => task.is_active !== false),
    [tasks]
  );

  const filteredTasks = useMemo(() => {
    return [...tasks]
      .filter((task) => {
        const active = task.is_active !== false;

        if (view !== "done" && !active) return false;

        if (view === "today") {
          return (
            task.status !== "done" &&
            active &&
            (
              !!task.is_quick_task ||
              task.due_date === todayStr ||
              task.scheduled_date === todayStr ||
              !!task.must_do_today
            )
          );
        }

        if (view === "inbox") return task.status === "inbox" && active;
        if (view === "doing") return task.status === "doing" && active;
        if (view === "done") return task.status === "done";
        if (view === "quick") return !!task.is_quick_task && active && task.status !== "done";
        if (view === "must") return !!task.must_do_today && active && task.status !== "done";

        return active || task.status === "done";
      })
      .filter((task) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return (
          task.title.toLowerCase().includes(q) ||
          (task.description || "").toLowerCase().includes(q) ||
          (task.notes || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const aDone = a.status === "done" ? 1 : 0;
        const bDone = b.status === "done" ? 1 : 0;
        if (aDone !== bDone) return aDone - bDone;

        const aMust = a.must_do_today ? 1 : 0;
        const bMust = b.must_do_today ? 1 : 0;
        if (aMust !== bMust) return bMust - aMust;

        const aQuick = a.is_quick_task ? 1 : 0;
        const bQuick = b.is_quick_task ? 1 : 0;
        if (aQuick !== bQuick) return bQuick - aQuick;

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
    activeTasks.find((task) => task.id === selectedTaskId) ||
    tasks.find((task) => task.id === selectedTaskId) ||
    null;

  const toggleDone = async (task: Task) => {
    const nextStatus = task.status === "done" ? "todo" : "done";

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
    <div
      className="page-wrap"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        minHeight: "calc(100vh - 32px)",
        height: "calc(100vh - 32px)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          background: "var(--app-bg, #f7f8fb)",
          paddingTop: 4,
          flexShrink: 0,
        }}
      >
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
      </div>

      <section
        className="task-layout"
        style={{
          display: "grid",
          gridTemplateColumns: viewsCollapsed
            ? "72px minmax(0, 1fr) 420px"
            : "220px minmax(0, 1fr) 420px",
          gap: 16,
          alignItems: "stretch",
          minHeight: 0,
          flex: 1,
          overflow: "hidden",
        }}
      >
        <aside
          className="panel card-pad task-sidebar"
          style={{
            position: "sticky",
            top: 16,
            alignSelf: "start",
            height: "fit-content",
            maxHeight: "100%",
            overflow: "auto",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              marginBottom: 12,
            }}
          >
            {!viewsCollapsed ? (
              <div style={{ fontSize: 13, fontWeight: 700 }}>Views</div>
            ) : (
              <div style={{ fontSize: 13, fontWeight: 700 }}>☰</div>
            )}

            <button
              className="secondary-btn"
              onClick={() => setViewsCollapsed((prev) => !prev)}
              style={{ padding: "6px 10px" }}
            >
              {viewsCollapsed ? "→" : "←"}
            </button>
          </div>

          <div className="tight-grid">
            {VIEW_OPTIONS.map((item) => (
              <button
                key={item.value}
                className={view === item.value ? "blue-btn" : "secondary-btn"}
                onClick={() => setView(item.value)}
                style={{
                  textAlign: "left",
                  justifyContent: viewsCollapsed ? "center" : "flex-start",
                }}
                title={item.label}
              >
                {viewsCollapsed ? item.label.slice(0, 1) : item.label}
              </button>
            ))}
          </div>
        </aside>

        <div
          className="panel card-pad"
          style={{
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 10,
              background: "#fff",
              paddingBottom: 12,
              marginBottom: 12,
              borderBottom: "1px solid var(--border)",
              flexShrink: 0,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700 }}>
              Task List ({filteredTasks.length})
            </div>
          </div>

          <div
            className="tight-grid"
            style={{
              overflowY: "auto",
              paddingRight: 4,
              minHeight: 0,
            }}
          >
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

        <div
          style={{
            minHeight: 0,
            overflow: "auto",
          }}
        >
          <TaskDetailPanel
            task={selectedTask}
            projects={projects}
            onUpdated={loadData}
            onDeleted={async () => {
              setSelectedTaskId(null);
              await loadData();
            }}
          />
        </div>
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