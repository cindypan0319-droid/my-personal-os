"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import { recomputeAndSaveProjectAnalysis } from "../../../../lib/project-analysis-sync";
import { PageHeader } from "../../../../components/app/PageHeader";
import { Project } from "../../../../types/task";
import {
  ProjectWorkPackage,
  TimelineTask,
} from "../../../../types/project-timeline";

export default function ProjectWorkPackagesPage() {
  const params = useParams();
  const projectId = Number(params.id);

  const [project, setProject] = useState<Project | null>(null);
  const [workPackages, setWorkPackages] = useState<ProjectWorkPackage[]>([]);
  const [tasks, setTasks] = useState<TimelineTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const [wpName, setWpName] = useState("");
  const [wpDescription, setWpDescription] = useState("");

  const [taskTitle, setTaskTitle] = useState("");
  const [taskWorkPackageId, setTaskWorkPackageId] = useState<string>("");
  const [taskWbsCode, setTaskWbsCode] = useState("");
  const [taskDuration, setTaskDuration] = useState("");
  const [taskStartDate, setTaskStartDate] = useState("");
  const [taskFinishDate, setTaskFinishDate] = useState("");

  const loadData = async () => {
    setLoading(true);

    const { data: projectData, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    const { data: wpData, error: wpError } = await supabase
      .from("project_work_packages")
      .select("*")
      .eq("project_id", projectId)
      .order("manual_order", { ascending: true });

    const { data: taskData, error: taskError } = await supabase
      .from("tasks")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

    if (projectError) console.error(projectError.message);
    if (wpError) console.error(wpError.message);
    if (taskError) console.error(taskError.message);

    setProject((projectData as Project) || null);
    setWorkPackages((wpData as ProjectWorkPackage[]) || []);
    setTasks((taskData as TimelineTask[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!Number.isNaN(projectId)) loadData();
  }, [projectId]);

  const grouped = useMemo(() => {
    return workPackages.map((wp) => ({
      ...wp,
      tasks: tasks.filter((task) => task.work_package_id === wp.id),
    }));
  }, [workPackages, tasks]);

  const addWorkPackage = async () => {
    if (!wpName.trim()) {
      alert("Work package name is required");
      return;
    }

    setWorking(true);

    const nextOrder =
      workPackages.length === 0
        ? 1
        : Math.max(...workPackages.map((w) => w.manual_order || 0)) + 1;

    const { error } = await supabase.from("project_work_packages").insert({
      project_id: projectId,
      name: wpName.trim(),
      description: wpDescription || null,
      manual_order: nextOrder,
    });

    setWorking(false);

    if (error) {
      alert("Create work package failed: " + error.message);
      return;
    }

    setWpName("");
    setWpDescription("");
    await loadData();
  };

  const addTask = async () => {
    if (!taskTitle.trim()) {
      alert("Task title is required");
      return;
    }

    setWorking(true);

    const { error } = await supabase.from("tasks").insert({
      title: taskTitle.trim(),
      status: "todo",
      priority: "medium",
      context: "computer",
      project_id: projectId,
      work_package_id: taskWorkPackageId ? Number(taskWorkPackageId) : null,
      wbs_code: taskWbsCode || null,
      estimated_duration_days: taskDuration ? Number(taskDuration) : null,
      planned_start_date: taskStartDate || null,
      planned_finish_date: taskFinishDate || null,
      is_quick_task: false,
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
      is_milestone: false,
      user_id: null,
    });

    if (error) {
      setWorking(false);
      alert("Create task failed: " + error.message);
      return;
    }

    try {
      await recomputeAndSaveProjectAnalysis(projectId);
    } catch (error) {
      setWorking(false);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to recompute project analysis."
      );
      return;
    }

    setTaskTitle("");
    setTaskWorkPackageId("");
    setTaskWbsCode("");
    setTaskDuration("");
    setTaskStartDate("");
    setTaskFinishDate("");
    setWorking(false);
    await loadData();
  };

  const deleteWorkPackage = async (id: number) => {
    const ok = window.confirm(
      "Delete this work package? Tasks linked to it will remain, but their work_package_id may be cleared depending on database settings."
    );
    if (!ok) return;

    setWorking(true);

    const { error } = await supabase
      .from("project_work_packages")
      .delete()
      .eq("id", id);

    if (error) {
      setWorking(false);
      alert("Delete work package failed: " + error.message);
      return;
    }

    try {
      await recomputeAndSaveProjectAnalysis(projectId);
    } catch (error) {
      setWorking(false);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to recompute project analysis."
      );
      return;
    }

    setWorking(false);
    await loadData();
  };

  if (loading) {
    return (
      <div className="page-wrap">
        <div className="panel card-pad">Loading work packages...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="page-wrap">
        <div className="panel card-pad">Project not found.</div>
      </div>
    );
  }

  return (
    <div className="page-wrap">
      <PageHeader
        kicker="Projects"
        title={`${project.name} Work Packages`}
        description="Define WBS structure first, then add activities into each work package. Adding activities will automatically refresh project analysis."
      />

      <section className="tight-grid-2" style={{ marginBottom: 16 }}>
        <div className="panel card-pad">
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
            Create Work Package
          </div>

          <div className="tight-grid">
            <input
              value={wpName}
              onChange={(e) => setWpName(e.target.value)}
              placeholder="Work package name"
            />
            <input
              value={wpDescription}
              onChange={(e) => setWpDescription(e.target.value)}
              placeholder="Description"
            />
            <button className="primary-btn" onClick={addWorkPackage} disabled={working}>
              {working ? "Working..." : "Add Work Package"}
            </button>
          </div>
        </div>

        <div className="panel card-pad">
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
            Add Activity
          </div>

          <div className="tight-grid">
            <input
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Activity name"
            />

            <div className="tight-grid-2">
              <select
                value={taskWorkPackageId}
                onChange={(e) => setTaskWorkPackageId(e.target.value)}
              >
                <option value="">No Work Package</option>
                {workPackages.map((wp) => (
                  <option key={wp.id} value={wp.id}>
                    {wp.name}
                  </option>
                ))}
              </select>

              <input
                value={taskWbsCode}
                onChange={(e) => setTaskWbsCode(e.target.value)}
                placeholder="WBS code (e.g. 2.1)"
              />

              <input
                type="number"
                value={taskDuration}
                onChange={(e) => setTaskDuration(e.target.value)}
                placeholder="Duration (days)"
              />

              <input
                type="date"
                value={taskStartDate}
                onChange={(e) => setTaskStartDate(e.target.value)}
              />

              <input
                type="date"
                value={taskFinishDate}
                onChange={(e) => setTaskFinishDate(e.target.value)}
              />
            </div>

            <button className="primary-btn" onClick={addTask} disabled={working}>
              {working ? "Working..." : "Add Activity"}
            </button>
          </div>
        </div>
      </section>

      <section className="panel card-pad">
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
          WBS Overview
        </div>

        <div className="tight-grid">
          {grouped.length === 0 ? (
            <div className="panel-soft card-pad empty-state">
              No work packages yet.
            </div>
          ) : (
            grouped.map((wp) => (
              <div key={wp.id} className="panel-soft card-pad">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "flex-start",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{wp.name}</div>
                    <div className="task-meta">{wp.description || "No description"}</div>
                  </div>

                  <button
                    className="danger-btn"
                    onClick={() => deleteWorkPackage(wp.id)}
                    disabled={working}
                  >
                    Delete
                  </button>
                </div>

                <div className="tight-grid" style={{ marginTop: 12 }}>
                  {wp.tasks.length === 0 ? (
                    <div className="text-muted" style={{ fontSize: 13 }}>
                      No activities in this work package.
                    </div>
                  ) : (
                    wp.tasks.map((task) => (
                      <div
                        key={task.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "100px 1fr 100px 180px",
                          gap: 12,
                          padding: "10px 0",
                          borderTop: "1px solid var(--border)",
                        }}
                      >
                        <div style={{ fontSize: 13 }}>{task.wbs_code || "—"}</div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{task.title}</div>
                          <div className="task-meta">
                            {task.is_critical ? "Critical" : "Non-critical"}
                            {task.total_float_days !== null &&
                            task.total_float_days !== undefined
                              ? ` · Float ${task.total_float_days}d`
                              : ""}
                          </div>
                        </div>
                        <div style={{ fontSize: 13 }}>
                          {task.estimated_duration_days ?? "—"} d
                        </div>
                        <div style={{ fontSize: 13 }}>
                          {task.planned_start_date || "—"} → {task.planned_finish_date || "—"}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}