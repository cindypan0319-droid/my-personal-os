"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Project, Task } from "../../types/task";

type CalendarDay = {
  date: string;
  dayNumber: number;
  inCurrentMonth: boolean;
};

export default function CalendarPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });

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

  const monthLabel = useMemo(() => {
    return currentMonth.toLocaleDateString("en-AU", {
      year: "numeric",
      month: "long",
    });
  }, [currentMonth]);

  const getProjectName = (projectId: number | null) => {
    if (projectId === null) return "No Project";
    const project = projects.find((item) => item.id === projectId);
    return project ? project.name : "No Project";
  };

  const changeMonth = (offset: number) => {
    setCurrentMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1)
    );
  };

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const firstWeekday = firstDayOfMonth.getDay(); // 0=Sun
    const startDate = new Date(year, month, 1 - firstWeekday);

    const days: CalendarDay[] = [];

    for (let i = 0; i < 42; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);

      const dateStr = new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate()
      ).toISOString().split("T")[0];

      days.push({
        date: dateStr,
        dayNumber: d.getDate(),
        inCurrentMonth: d.getMonth() === month,
      });
    }

    return days;
  }, [currentMonth]);

  const getTasksForDate = (date: string) => {
    const dayTasks = tasks.filter(
      (task) =>
        task.status !== "done" &&
        (task.scheduled_date === date || task.due_date === date)
    );

    return [...dayTasks].sort((a, b) => {
      const aScheduled = a.scheduled_date === date ? 1 : 0;
      const bScheduled = b.scheduled_date === date ? 1 : 0;
      if (aScheduled !== bScheduled) return bScheduled - aScheduled;

      if (a.start_time && b.start_time) return a.start_time.localeCompare(b.start_time);
      if (a.start_time && !b.start_time) return -1;
      if (!a.start_time && b.start_time) return 1;

      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const diff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (diff !== 0) return diff;

      return a.title.localeCompare(b.title);
    });
  };

  const selectedDateTasks = useMemo(() => {
    return getTasksForDate(selectedDate);
  }, [tasks, selectedDate]);

  if (loading) {
    return (
      <div className="page-wrap">
        <div className="panel card-pad">Loading calendar...</div>
      </div>
    );
  }

  return (
    <div className="page-wrap">
      <header className="page-header">
        <div className="page-kicker">Calendar</div>
        <h1 className="page-title">Calendar View</h1>
        <div className="page-desc">
          看每一天的 scheduled task 和 due task。
        </div>
      </header>

      <section className="panel card-pad" style={{ marginBottom: 12 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 600 }}>{monthLabel}</div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => changeMonth(-1)} className="secondary-btn">
              Prev
            </button>
            <button
              onClick={() => {
                const now = new Date();
                setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                setSelectedDate(now.toISOString().split("T")[0]);
              }}
              className="secondary-btn"
            >
              Today
            </button>
            <button onClick={() => changeMonth(1)} className="secondary-btn">
              Next
            </button>
          </div>
        </div>
      </section>

      <section className="tight-grid-2">
        <div className="panel card-pad">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
              gap: 8,
              marginBottom: 8,
            }}
          >
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
              <div
                key={label}
                className="text-muted"
                style={{
                  fontSize: 12,
                  textAlign: "center",
                  fontWeight: 600,
                  padding: "4px 0",
                }}
              >
                {label}
              </div>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
              gap: 8,
            }}
          >
            {calendarDays.map((day) => {
              const dayTasks = getTasksForDate(day.date);
              const isSelected = selectedDate === day.date;
              const isToday = todayStr === day.date;

              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedDate(day.date)}
                  style={{
                    minHeight: 108,
                    textAlign: "left",
                    padding: 8,
                    borderRadius: 14,
                    border: isSelected
                      ? "1px solid var(--primary)"
                      : "1px solid var(--border)",
                    background: day.inCurrentMonth
                      ? "var(--panel)"
                      : "var(--panel-2)",
                    color: "var(--text)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: isToday ? 700 : 600,
                        color: day.inCurrentMonth ? "var(--text)" : "var(--muted)",
                      }}
                    >
                      {day.dayNumber}
                    </span>

                    {isToday && (
                      <span
                        style={{
                          fontSize: 10,
                          padding: "4px 6px",
                          borderRadius: 999,
                          background: "var(--primary)",
                          color: "var(--primary-text)",
                          lineHeight: 1,
                        }}
                      >
                        Today
                      </span>
                    )}
                  </div>

                  <div style={{ display: "grid", gap: 4 }}>
                    {dayTasks.slice(0, 3).map((task) => {
                      const isScheduled = task.scheduled_date === day.date;
                      const isDue = task.due_date === day.date;

                      return (
                        <div
                          key={task.id}
                          style={{
                            fontSize: 11,
                            lineHeight: 1.25,
                            padding: "5px 6px",
                            borderRadius: 10,
                            background: "var(--panel-2)",
                            border: "1px solid var(--border)",
                            color: "var(--text)",
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 600,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {task.title}
                          </div>
                          <div className="text-muted" style={{ fontSize: 10, marginTop: 2 }}>
                            {isScheduled && isDue
                              ? "scheduled + due"
                              : isScheduled
                              ? "scheduled"
                              : "due"}
                          </div>
                        </div>
                      );
                    })}

                    {dayTasks.length > 3 && (
                      <div className="text-muted" style={{ fontSize: 11 }}>
                        +{dayTasks.length - 3} more
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="panel card-pad">
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>
            {selectedDate}
          </div>

          <div className="tight-grid">
            {selectedDateTasks.length === 0 ? (
              <div className="panel-soft card-pad text-muted">
                这一天没有 scheduled / due 任务。
              </div>
            ) : (
              selectedDateTasks.map((task) => {
                const isScheduled = task.scheduled_date === selectedDate;
                const isDue = task.due_date === selectedDate;

                return (
                  <div key={task.id} className="panel-soft card-pad">
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{task.title}</div>

                    <div className="task-meta">
                      {getProjectName(task.project_id)} · {task.priority} · {task.context}
                    </div>

                    <div className="badge-row">
                      <div className="badge">
                        {isScheduled && isDue
                          ? "scheduled + due"
                          : isScheduled
                          ? "scheduled"
                          : "due"}
                      </div>
                      <div className="badge">Status: {task.status}</div>
                      <div className="badge">
                        Time:{" "}
                        {task.estimated_minutes !== null
                          ? `${task.estimated_minutes} min`
                          : "N/A"}
                      </div>
                      <div className="badge">
                        Slot:{" "}
                        {task.start_time || task.end_time
                          ? `${task.start_time || "--"} - ${task.end_time || "--"}`
                          : "N/A"}
                      </div>
                      <div className="badge">Energy: {task.energy_level || "N/A"}</div>
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

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                      <button
                        onClick={async () => {
                          const { error } = await supabase
                            .from("tasks")
                            .update({ status: "doing" })
                            .eq("id", task.id);

                          if (error) {
                            alert("修改任务状态失败：" + error.message);
                            return;
                          }

                          loadData();
                        }}
                        className="secondary-btn"
                      >
                        Move to doing
                      </button>

                      <button
                        onClick={async () => {
                          const { error } = await supabase
                            .from("tasks")
                            .update({ status: "done" })
                            .eq("id", task.id);

                          if (error) {
                            alert("修改任务状态失败：" + error.message);
                            return;
                          }

                          loadData();
                        }}
                        className="primary-btn"
                      >
                        Mark done
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>
    </div>
  );
}