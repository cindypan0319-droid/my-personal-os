"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { PageHeader } from "../components/app/PageHeader";
import { Project, Task } from "../types/task";

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [inboxInput, setInboxInput] = useState("");
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);

    const { data: taskData, error: taskError } = await supabase.from("tasks").select("*");
    const { data: projectData, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (taskError) console.error(taskError.message);
    if (projectError) console.error(projectError.message);

    setTasks((taskData as Task[]) || []);
    setProjects((projectData as Project[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const todayStr = new Date().toISOString().split("T")[0];

  const activeTasks = tasks.filter((task) => task.status !== "done");
  const overdueTasks = tasks.filter(
    (task) => task.status !== "done" && task.due_date && task.due_date < todayStr
  );
  const dueTodayTasks = tasks.filter(
    (task) => task.status !== "done" && task.due_date === todayStr
  );
  const scheduledTodayTasks = tasks
    .filter((task) => task.status !== "done" && task.scheduled_date === todayStr)
    .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));

  const todayFocus = [...tasks]
    .filter((task) => task.status !== "done" && task.status !== "inbox")
    .sort((a, b) => {
      const aMust = taskBool(a.must_do_today) ? 1 : 0;
      const bMust = taskBool(b.must_do_today) ? 1 : 0;
      if (aMust !== bMust) return bMust - aMust;

      const aToday = a.due_date === todayStr || a.scheduled_date === todayStr ? 1 : 0;
      const bToday = b.due_date === todayStr || b.scheduled_date === todayStr ? 1 : 0;
      if (aToday !== bToday) return bToday - aToday;

      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    })
    .slice(0, 3);

  const inboxTasks = tasks.filter((task) => task.status === "inbox").slice(0, 6);

  const projectsSnapshot = projects.map((project) => {
    const projectTasks = tasks.filter((task) => task.project_id === project.id);
    const doneCount = projectTasks.filter((task) => task.status === "done").length;
    const totalCount = projectTasks.length;
    return {
      ...project,
      doneCount,
      totalCount,
      progress: totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100),
    };
  });

  const addInbox = async () => {
    if (!inboxInput.trim()) return;

    const { error } = await supabase.from("tasks").insert({
      title: inboxInput.trim(),
      status: "inbox",
      priority: "medium",
      context: "home",
      due_date: null,
      project_id: null,
      is_quick_task: true,
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
      user_id: null,
    });

    if (error) {
      alert("新增 Inbox 失败：" + error.message);
      return;
    }

    setInboxInput("");
    await loadData();
  };

  const markDone = async (taskId: number) => {
    const { error } = await supabase.from("tasks").update({ status: "done" }).eq("id", taskId);
    if (error) {
      alert("修改任务状态失败：" + error.message);
      return;
    }
    await loadData();
  };

  const moveToDoing = async (taskId: number) => {
    const { error } = await supabase.from("tasks").update({ status: "doing" }).eq("id", taskId);
    if (error) {
      alert("修改任务状态失败：" + error.message);
      return;
    }
    await loadData();
  };

  if (loading) {
    return (
      <div className="page-wrap">
        <div className="panel card-pad">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="page-wrap dashboard-layout">
      <PageHeader
        kicker="Dashboard"
        title="Today"
        description="A lighter overview of what matters today."
      />

      <section className="panel card-pad" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Quick Access</div>
        <div className="tight-grid-3">
          <Link href="/tasks" className="panel-soft card-pad">
            <div style={{ fontSize: 16, fontWeight: 700 }}>Tasks</div>
            <div className="task-meta">Capture, sort, and complete all tasks</div>
          </Link>

          <Link href="/projects" className="panel-soft card-pad">
            <div style={{ fontSize: 16, fontWeight: 700 }}>Projects</div>
            <div className="task-meta">Open project hubs, timelines, and workload</div>
          </Link>

          <Link href="/timeline" className="panel-soft card-pad">
            <div style={{ fontSize: 16, fontWeight: 700 }}>Daily Timeline</div>
            <div className="task-meta">See today’s schedule and assign time blocks</div>
          </Link>

          <Link href="/calendar" className="panel-soft card-pad">
            <div style={{ fontSize: 16, fontWeight: 700 }}>Calendar</div>
            <div className="task-meta">See due dates and scheduled tasks by date</div>
          </Link>

          <Link href="/projects" className="panel-soft card-pad">
            <div style={{ fontSize: 16, fontWeight: 700 }}>Project Analysis</div>
            <div className="task-meta">Open a project to check critical path and float</div>
          </Link>

          <Link href="/projects" className="panel-soft card-pad">
            <div style={{ fontSize: 16, fontWeight: 700 }}>Project Workload</div>
            <div className="task-meta">Open a project to rebalance overloaded days</div>
          </Link>
        </div>
      </section>

      <section className="dashboard-grid-4">
        <div className="panel card-pad stat-card">
          <div className="stat-label">Active</div>
          <div className="stat-number">{activeTasks.length}</div>
        </div>
        <div className="panel card-pad stat-card">
          <div className="stat-label">Overdue</div>
          <div className="stat-number">{overdueTasks.length}</div>
        </div>
        <div className="panel card-pad stat-card">
          <div className="stat-label">Due Today</div>
          <div className="stat-number">{dueTodayTasks.length}</div>
        </div>
        <div className="panel card-pad stat-card">
          <div className="stat-label">Scheduled Today</div>
          <div className="stat-number">{scheduledTodayTasks.length}</div>
        </div>
      </section>

      <section className="dashboard-grid-2">
        <div className="panel card-pad">
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Today Focus</div>
          <div className="tight-grid">
            {todayFocus.length === 0 ? (
              <div className="panel-soft card-pad empty-state">No focus tasks yet.</div>
            ) : (
              todayFocus.map((task, index) => (
                <div key={task.id} className="panel-soft card-pad">
                  <div className="text-muted" style={{ fontSize: 12 }}>
                    {index + 1}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{task.title}</div>
                  <div className="task-meta">
                    {task.priority} · Due: {task.due_date || "N/A"}
                    {task.must_do_today ? " · Must today" : ""}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    <button className="secondary-btn" onClick={() => moveToDoing(task.id)}>
                      Doing
                    </button>
                    <button className="primary-btn" onClick={() => markDone(task.id)}>
                      Done
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="panel card-pad">
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Today Timeline</div>
          <div className="tight-grid">
            {scheduledTodayTasks.length === 0 ? (
              <div className="panel-soft card-pad empty-state">No scheduled tasks today.</div>
            ) : (
              scheduledTodayTasks.map((task) => (
                <div key={task.id} className="panel-soft card-pad">
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{task.title}</div>
                  <div className="task-meta">
                    {task.start_time || "--"} - {task.end_time || "--"} · {task.priority}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="dashboard-grid-2">
        <div className="panel card-pad">
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Inbox Capture</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              value={inboxInput}
              onChange={(e) => setInboxInput(e.target.value)}
              placeholder="Quick capture"
            />
            <button className="primary-btn" onClick={addInbox}>
              Add
            </button>
          </div>
          <div className="tight-grid">
            {inboxTasks.length === 0 ? (
              <div className="panel-soft card-pad empty-state">Inbox is empty.</div>
            ) : (
              inboxTasks.map((task) => (
                <div key={task.id} className="panel-soft card-pad">
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{task.title}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    <button className="secondary-btn" onClick={() => moveToDoing(task.id)}>
                      Doing
                    </button>
                    <button className="primary-btn" onClick={() => markDone(task.id)}>
                      Done
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="panel card-pad">
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Due Soon</div>
          <div className="tight-grid">
            <div>
              <div className="text-muted" style={{ fontSize: 12, marginBottom: 8 }}>
                Overdue
              </div>
              <div className="tight-grid">
                {overdueTasks.length === 0 ? (
                  <div className="panel-soft card-pad empty-state">No overdue tasks.</div>
                ) : (
                  overdueTasks.slice(0, 4).map((task) => (
                    <div key={task.id} className="panel-soft card-pad">
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{task.title}</div>
                      <div className="task-meta">{task.due_date}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="text-muted" style={{ fontSize: 12, marginBottom: 8 }}>
                Due Today
              </div>
              <div className="tight-grid">
                {dueTodayTasks.length === 0 ? (
                  <div className="panel-soft card-pad empty-state">Nothing due today.</div>
                ) : (
                  dueTodayTasks.slice(0, 4).map((task) => (
                    <div key={task.id} className="panel-soft card-pad">
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{task.title}</div>
                      <div className="task-meta">{task.priority}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="panel card-pad">
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Projects Snapshot</div>
        {projectsSnapshot.length === 0 ? (
          <div className="panel-soft card-pad empty-state">No projects yet.</div>
        ) : (
          <div className="dashboard-grid-2">
            {projectsSnapshot.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="panel-soft card-pad"
              >
                <div style={{ fontSize: 14, fontWeight: 600 }}>{project.name}</div>
                <div className="task-meta">{project.description || "No description"}</div>
                <div className="task-meta" style={{ marginTop: 8 }}>
                  {project.doneCount}/{project.totalCount} tasks done
                </div>
                <div className="progress-track">
                  <div className="progress-bar" style={{ width: `${project.progress}%` }} />
                </div>
                <div className="task-meta">Progress: {project.progress}%</div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function taskBool(value: boolean | null | undefined) {
  return !!value;
}