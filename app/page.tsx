"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { Project, Task } from "../types/task";

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [inboxInput, setInboxInput] = useState("");
  const [loading, setLoading] = useState(true);

  const sortTasksByPriorityAndDate = (taskList: Task[], todayStr: string) => {
    return [...taskList].sort((a, b) => {
      const aMust = a.must_do_today ? 1 : 0;
      const bMust = b.must_do_today ? 1 : 0;
      if (aMust !== bMust) return bMust - aMust;

      const aOverdue = a.due_date && a.due_date < todayStr ? 1 : 0;
      const bOverdue = b.due_date && b.due_date < todayStr ? 1 : 0;
      if (aOverdue !== bOverdue) return bOverdue - aOverdue;

      const aDueToday = a.due_date === todayStr ? 1 : 0;
      const bDueToday = b.due_date === todayStr ? 1 : 0;
      if (aDueToday !== bDueToday) return bDueToday - aDueToday;

      const aScheduledToday = a.scheduled_date === todayStr ? 1 : 0;
      const bScheduledToday = b.scheduled_date === todayStr ? 1 : 0;
      if (aScheduledToday !== bScheduledToday) return bScheduledToday - aScheduledToday;

      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;

      const aMinutes = a.estimated_minutes ?? 9999;
      const bMinutes = b.estimated_minutes ?? 9999;
      if (aMinutes !== bMinutes) return aMinutes - bMinutes;

      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date && !b.due_date) return -1;
      if (!a.due_date && b.due_date) return 1;

      return b.created_at.localeCompare(a.created_at);
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

    if (taskError) console.error("Load tasks error:", taskError.message);
    if (projectError) console.error("Load projects error:", projectError.message);

    setTasks((taskData as Task[]) || []);
    setProjects((projectData as Project[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const endOfWeek = new Date(today);
  const day = endOfWeek.getDay();
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  endOfWeek.setDate(endOfWeek.getDate() + daysUntilSunday);
  const endOfWeekStr = endOfWeek.toISOString().split("T")[0];

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

  const overdueTasks = useMemo(() => {
    return sortTasksByPriorityAndDate(
      tasks.filter(
        (task) =>
          task.status !== "done" &&
          task.due_date &&
          task.due_date < todayStr
      ),
      todayStr
    );
  }, [tasks, todayStr]);

  const dueTodayTasks = useMemo(() => {
    return sortTasksByPriorityAndDate(
      tasks.filter(
        (task) =>
          task.status !== "done" &&
          task.due_date === todayStr
      ),
      todayStr
    );
  }, [tasks, todayStr]);

  const dueThisWeekTasks = useMemo(() => {
    return sortTasksByPriorityAndDate(
      tasks.filter(
        (task) =>
          task.status !== "done" &&
          task.due_date &&
          task.due_date >= todayStr &&
          task.due_date <= endOfWeekStr
      ),
      todayStr
    );
  }, [tasks, todayStr, endOfWeekStr]);

  const scheduledTodayTasks = useMemo(() => {
    return [...tasks]
      .filter(
        (task) =>
          task.status !== "done" &&
          task.scheduled_date === todayStr
      )
      .sort((a, b) => {
        if (a.start_time && b.start_time) return a.start_time.localeCompare(b.start_time);
        if (a.start_time && !b.start_time) return -1;
        if (!a.start_time && b.start_time) return 1;
        return 0;
      });
  }, [tasks, todayStr]);

  const todayTop3 = useMemo(() => {
    return sortTasksByPriorityAndDate(
      tasks.filter((task) => task.status !== "done" && task.status !== "inbox"),
      todayStr
    ).slice(0, 3);
  }, [tasks, todayStr]);

  const quickWins = useMemo(() => {
    return sortTasksByPriorityAndDate(
      tasks.filter(
        (task) =>
          task.status !== "done" &&
          task.status !== "inbox" &&
          task.estimated_minutes !== null &&
          task.estimated_minutes <= 15
      ),
      todayStr
    ).slice(0, 6);
  }, [tasks, todayStr]);

  const mediumFocus = useMemo(() => {
    return sortTasksByPriorityAndDate(
      tasks.filter(
        (task) =>
          task.status !== "done" &&
          task.status !== "inbox" &&
          task.estimated_minutes !== null &&
          task.estimated_minutes > 15 &&
          task.estimated_minutes <= 60
      ),
      todayStr
    ).slice(0, 6);
  }, [tasks, todayStr]);

  const deepWork = useMemo(() => {
    return sortTasksByPriorityAndDate(
      tasks.filter(
        (task) =>
          task.status !== "done" &&
          task.status !== "inbox" &&
          task.estimated_minutes !== null &&
          task.estimated_minutes > 60
      ),
      todayStr
    ).slice(0, 6);
  }, [tasks, todayStr]);

  const noEstimateTasks = useMemo(() => {
    return sortTasksByPriorityAndDate(
      tasks.filter(
        (task) =>
          task.status !== "done" &&
          task.status !== "inbox" &&
          task.estimated_minutes === null
      ),
      todayStr
    ).slice(0, 6);
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
      alert("修改任务状态失败：" + error.message);
      return;
    }

    loadData();
  };

  const renderTaskCard = (task: Task) => (
    <div key={task.id} className="panel-soft card-pad">
      <div style={{ fontSize: 14, fontWeight: 600 }}>{task.title}</div>
      <div className="task-meta">
        {getProjectName(task.project_id)} · {task.priority} · {task.context}
      </div>

      <div className="badge-row">
        <div className="badge">Due: {task.due_date || "N/A"}</div>
        <div className="badge">
          Time: {task.estimated_minutes !== null ? `${task.estimated_minutes} min` : "N/A"}
        </div>
        <div className="badge">Scheduled: {task.scheduled_date || "N/A"}</div>
        <div className="badge">
          Slot:{" "}
          {task.start_time || task.end_time
            ? `${task.start_time || "--"} - ${task.end_time || "--"}`
            : "N/A"}
        </div>
        <div className="badge">Energy: {task.energy_level || "N/A"}</div>
        {task.must_do_today && <div className="badge">Must Today</div>}
        {task.is_quick_task && <div className="badge">Quick</div>}
        {task.recurring_enabled && (
          <div className="badge">Repeat: {task.recurring_type || "yes"}</div>
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
        <button
          onClick={() => updateTaskStatus(task.id, "doing")}
          className="secondary-btn"
        >
          Move to doing
        </button>
        <button
          onClick={() => updateTaskStatus(task.id, "done")}
          className="primary-btn"
        >
          Mark done
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="page-wrap">
        <div className="panel card-pad">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="page-wrap">
      <header className="page-header">
        <div className="page-kicker">Dashboard</div>
        <h1 className="page-title">Today</h1>
        <div className="page-desc">
          首页会根据今天、截止日期、时间块和精力等级帮你安排任务。
        </div>
      </header>

      <section className="tight-grid-2" style={{ marginBottom: 12 }}>
        <div className="panel card-pad">
          <div className="text-muted" style={{ fontSize: 12 }}>Active</div>
          <div className="stat-number">{activeTasks.length}</div>
        </div>

        <div className="panel card-pad">
          <div className="text-muted" style={{ fontSize: 12 }}>Overdue</div>
          <div className="stat-number">{overdueTasks.length}</div>
        </div>

        <div className="panel card-pad">
          <div className="text-muted" style={{ fontSize: 12 }}>Due Today</div>
          <div className="stat-number">{dueTodayTasks.length}</div>
        </div>

        <div className="panel card-pad">
          <div className="text-muted" style={{ fontSize: 12 }}>Scheduled Today</div>
          <div className="stat-number">{scheduledTodayTasks.length}</div>
        </div>
      </section>

      <section className="tight-grid-2" style={{ marginBottom: 12 }}>
        <div className="panel card-pad">
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>
            Today Top 3
          </div>

          <div className="tight-grid">
            {todayTop3.length === 0 ? (
              <div className="panel-soft card-pad text-muted">
                还没有可执行任务。
              </div>
            ) : (
              todayTop3.map((task, index) => (
                <div key={task.id} className="panel-soft card-pad">
                  <div className="text-muted" style={{ fontSize: 12 }}>
                    {index + 1}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>
                    {task.title}
                  </div>
                  <div className="task-meta">
                    {getProjectName(task.project_id)} · {task.priority} · {task.context}
                  </div>
                  <div className="task-meta">
                    Due: {task.due_date || "N/A"} · Time:{" "}
                    {task.estimated_minutes !== null
                      ? `${task.estimated_minutes} min`
                      : "N/A"}
                    {task.must_do_today ? " · Must Today" : ""}
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    <button
                      onClick={() => updateTaskStatus(task.id, "doing")}
                      className="secondary-btn"
                    >
                      Move to doing
                    </button>
                    <button
                      onClick={() => updateTaskStatus(task.id, "done")}
                      className="primary-btn"
                    >
                      Mark done
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="panel card-pad">
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>
            Today Timeline
          </div>

          <div className="tight-grid">
            {scheduledTodayTasks.length === 0 ? (
              <div className="panel-soft card-pad text-muted">
                今天还没有安排到具体时间的任务。
              </div>
            ) : (
              scheduledTodayTasks.map((task) => (
                <div key={task.id} className="panel-soft card-pad">
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{task.title}</div>
                  <div className="task-meta">
                    {task.start_time || "--"} - {task.end_time || "--"} ·{" "}
                    {getProjectName(task.project_id)}
                  </div>
                  <div className="task-meta">
                    Time:{" "}
                    {task.estimated_minutes !== null
                      ? `${task.estimated_minutes} min`
                      : "N/A"}
                    {task.energy_level ? ` · Energy: ${task.energy_level}` : ""}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="tight-grid-2" style={{ marginBottom: 12 }}>
        <div className="panel card-pad">
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>
            Quick Wins
          </div>
          <div className="text-muted" style={{ fontSize: 12, marginBottom: 10 }}>
            ≤ 15 min
          </div>

          <div className="tight-grid">
            {quickWins.length === 0 ? (
              <div className="panel-soft card-pad text-muted">没有短任务</div>
            ) : (
              quickWins.map(renderTaskCard)
            )}
          </div>
        </div>

        <div className="panel card-pad">
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>
            Medium Focus
          </div>
          <div className="text-muted" style={{ fontSize: 12, marginBottom: 10 }}>
            16–60 min
          </div>

          <div className="tight-grid">
            {mediumFocus.length === 0 ? (
              <div className="panel-soft card-pad text-muted">没有中等时长任务</div>
            ) : (
              mediumFocus.map(renderTaskCard)
            )}
          </div>
        </div>
      </section>

      <section className="tight-grid-2" style={{ marginBottom: 12 }}>
        <div className="panel card-pad">
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>
            Deep Work
          </div>
          <div className="text-muted" style={{ fontSize: 12, marginBottom: 10 }}>
            &gt; 60 min
          </div>

          <div className="tight-grid">
            {deepWork.length === 0 ? (
              <div className="panel-soft card-pad text-muted">
                没有长时专注任务
              </div>
            ) : (
              deepWork.map(renderTaskCard)
            )}
          </div>
        </div>

        <div className="panel card-pad">
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>
            No Estimate Yet
          </div>
          <div className="text-muted" style={{ fontSize: 12, marginBottom: 10 }}>
            还没估时
          </div>

          <div className="tight-grid">
            {noEstimateTasks.length === 0 ? (
              <div className="panel-soft card-pad text-muted">
                所有任务都已经有预计时长
              </div>
            ) : (
              noEstimateTasks.map(renderTaskCard)
            )}
          </div>
        </div>
      </section>

      <section className="tight-grid-2" style={{ marginBottom: 12 }}>
        <div className="panel card-pad">
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>
            Inbox
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input
              type="text"
              value={inboxInput}
              onChange={(e) => setInboxInput(e.target.value)}
              placeholder="快速记下一件事"
              style={{ padding: "10px 12px", flex: 1 }}
            />
            <button onClick={handleAddInbox} className="primary-btn">
              Add
            </button>
          </div>

          <div className="tight-grid">
            {inboxTasks.length === 0 ? (
              <div className="panel-soft card-pad text-muted">
                Inbox 目前是空的
              </div>
            ) : (
              inboxTasks.slice(0, 8).map((task) => (
                <div key={task.id} className="panel-soft card-pad">
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{task.title}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    <button
                      onClick={() => updateTaskStatus(task.id, "todo")}
                      className="secondary-btn"
                    >
                      Move to todo
                    </button>
                    <button
                      onClick={() => updateTaskStatus(task.id, "done")}
                      className="primary-btn"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="panel card-pad">
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>
            Due / Overdue
          </div>

          <div className="tight-grid">
            <div>
              <div
                className="text-muted"
                style={{ fontSize: 12, marginBottom: 8, color: "var(--danger-text)" }}
              >
                Overdue
              </div>

              <div className="tight-grid">
                {overdueTasks.length === 0 ? (
                  <div className="panel-soft card-pad text-muted">
                    没有 overdue 任务
                  </div>
                ) : (
                  overdueTasks.slice(0, 4).map((task) => (
                    <div key={task.id} className="panel-soft card-pad">
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{task.title}</div>
                      <div className="task-meta">
                        {task.due_date} · {getProjectName(task.project_id)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="text-muted" style={{ fontSize: 12, marginBottom: 8 }}>
                Due This Week
              </div>

              <div className="tight-grid">
                {dueThisWeekTasks.length === 0 ? (
                  <div className="panel-soft card-pad text-muted">
                    本周没有即将到期任务
                  </div>
                ) : (
                  dueThisWeekTasks.slice(0, 5).map((task) => (
                    <div key={task.id} className="panel-soft card-pad">
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{task.title}</div>
                      <div className="task-meta">
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

      <section className="panel card-pad">
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>
          Projects Overview
        </div>

        {projectSummary.length === 0 ? (
          <div className="panel-soft card-pad text-muted">
            还没有项目，先去 Projects 页面创建。
          </div>
        ) : (
          <div className="tight-grid-2">
            {projectSummary.map((project) => (
              <div key={project.id} className="panel-soft card-pad">
                <div style={{ fontSize: 14, fontWeight: 600 }}>{project.name}</div>
                <div className="task-meta">
                  {project.description || "No description"}
                </div>
                <div className="task-meta" style={{ marginTop: 8 }}>
                  {project.doneCount}/{project.totalCount} tasks done
                </div>
                <div className="progress-track">
                  <div
                    className="progress-bar"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
                <div className="task-meta">Progress: {project.progress}%</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}