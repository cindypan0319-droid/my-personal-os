"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { PageHeader } from "../../components/app/PageHeader";
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

  const monthLabel = useMemo(() => {
    return currentMonth.toLocaleDateString("en-AU", {
      year: "numeric",
      month: "long",
    });
  }, [currentMonth]);

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const firstWeekday = firstDayOfMonth.getDay();
    const startDate = new Date(year, month, 1 - firstWeekday);

    const days: CalendarDay[] = [];

    for (let i = 0; i < 42; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);

      const dateStr = new Date(d.getFullYear(), d.getMonth(), d.getDate())
        .toISOString()
        .split("T")[0];

      days.push({
        date: dateStr,
        dayNumber: d.getDate(),
        inCurrentMonth: d.getMonth() === month,
      });
    }

    return days;
  }, [currentMonth]);

  const getTasksForDate = (date: string) => {
    return tasks
      .filter(
        (task) =>
          task.status !== "done" &&
          (task.scheduled_date === date || task.due_date === date)
      )
      .sort((a, b) => {
        const aScheduled = a.scheduled_date === date ? 1 : 0;
        const bScheduled = b.scheduled_date === date ? 1 : 0;
        if (aScheduled !== bScheduled) return bScheduled - aScheduled;

        if (a.start_time && b.start_time) return a.start_time.localeCompare(b.start_time);
        if (a.start_time && !b.start_time) return -1;
        if (!a.start_time && b.start_time) return 1;

        return a.title.localeCompare(b.title);
      });
  };

  const selectedDateTasks = useMemo(() => getTasksForDate(selectedDate), [tasks, selectedDate]);

  const getProjectName = (projectId: number | null) => {
    if (projectId === null) return "No Project";
    return projects.find((p) => p.id === projectId)?.name || "No Project";
  };

  const toggleDone = async (task: Task) => {
    const nextStatus = task.status === "done" ? "todo" : "done";

    const { error } = await supabase
      .from("tasks")
      .update({ status: nextStatus })
      .eq("id", task.id);

    if (error) {
      alert("修改任务状态失败：" + error.message);
      return;
    }

    await loadData();
  };

  if (loading) {
    return (
      <div className="page-wrap">
        <div className="panel card-pad">Loading calendar...</div>
      </div>
    );
  }

  return (
    <div className="page-wrap calendar-layout">
      <PageHeader
        kicker="Calendar"
        title="Calendar"
        description="A lighter month view for due and scheduled tasks."
        actions={
          <>
            <button
              className="secondary-btn"
              onClick={() =>
                setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
              }
            >
              Prev
            </button>

            <button
              className="secondary-btn"
              onClick={() => {
                const now = new Date();
                setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                setSelectedDate(now.toISOString().split("T")[0]);
              }}
            >
              Today
            </button>

            <button
              className="secondary-btn"
              onClick={() =>
                setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
              }
            >
              Next
            </button>
          </>
        }
      />

      <section className="panel card-pad" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{monthLabel}</div>
      </section>

      <section className="calendar-main">
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
                style={{ fontSize: 12, textAlign: "center", fontWeight: 700, padding: "4px 0" }}
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
                    padding: 10,
                    borderRadius: 16,
                    border: isSelected ? "1px solid var(--primary)" : "1px solid var(--border)",
                    background: day.inCurrentMonth ? "#fff" : "var(--panel-soft)",
                    color: "var(--text)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 10,
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

                    {isToday ? (
                      <span
                        style={{
                          fontSize: 10,
                          padding: "4px 6px",
                          borderRadius: 999,
                          background: "var(--primary)",
                          color: "#fff",
                          lineHeight: 1,
                        }}
                      >
                        Today
                      </span>
                    ) : null}
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    {dayTasks.slice(0, 3).map((task) => (
                      <div key={task.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 999,
                            background:
                              task.scheduled_date === day.date
                                ? "var(--primary)"
                                : "var(--warning)",
                          }}
                        />
                        <div
                          style={{
                            fontSize: 11,
                            overflow: "hidden",
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {task.title}
                        </div>
                      </div>
                    ))}

                    {dayTasks.length > 3 ? (
                      <div className="text-muted" style={{ fontSize: 11 }}>
                        +{dayTasks.length - 3} more
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="panel card-pad">
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{selectedDate}</div>

          <div className="tight-grid">
            {selectedDateTasks.length === 0 ? (
              <div className="panel-soft card-pad empty-state">
                No due or scheduled tasks on this day.
              </div>
            ) : (
              selectedDateTasks.map((task) => (
                <div key={task.id} className="panel-soft card-pad">
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{task.title}</div>
                  <div className="task-meta">
                    {getProjectName(task.project_id)} · {task.priority} · {task.context}
                  </div>

                  <div className="badge-row">
                    <div className="badge">
                      {task.scheduled_date === selectedDate && task.due_date === selectedDate
                        ? "scheduled + due"
                        : task.scheduled_date === selectedDate
                        ? "scheduled"
                        : "due"}
                    </div>

                    {task.start_time || task.end_time ? (
                      <div className="badge">
                        {task.start_time || "--"} - {task.end_time || "--"}
                      </div>
                    ) : null}
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <button className="primary-btn" onClick={() => toggleDone(task)}>
                      Done
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}