"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import { BackButton } from "../../../../components/app/BackButton";
import { PageHeader } from "../../../../components/app/PageHeader";
import { Project } from "../../../../types/task";
import {
  TaskDependency,
  TimelineTask,
} from "../../../../types/project-timeline";
import { calculateProjectSchedule } from "../../../../lib/project-scheduling";

export default function ProjectAnalysisPage() {
  const params = useParams();
  const projectId = Number(params.id);

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<TimelineTask[]>([]);
  const [dependencies, setDependencies] = useState<TaskDependency[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [projectDuration, setProjectDuration] = useState<number | null>(null);
  const [errorText, setErrorText] = useState<string>("");

  const loadData = async () => {
    setLoading(true);
    setErrorText("");

    const { data: projectData } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    const { data: taskData } = await supabase
      .from("tasks")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

    const { data: depData } = await supabase
      .from("task_dependencies")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

    setProject((projectData as Project) || null);
    setTasks((taskData as TimelineTask[]) || []);
    setDependencies((depData as TaskDependency[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!Number.isNaN(projectId)) loadData();
  }, [projectId]);

  const calculation = useMemo(() => {
    try {
      if (tasks.length === 0) {
        return { calculated: [], projectDuration: 0, error: "" };
      }

      const result = calculateProjectSchedule(tasks, dependencies);
      return { ...result, error: "" };
    } catch (error) {
      return {
        calculated: [],
        projectDuration: 0,
        error: error instanceof Error ? error.message : "Unknown calculation error",
      };
    }
  }, [tasks, dependencies]);

  useEffect(() => {
    setProjectDuration(calculation.projectDuration);
    setErrorText(calculation.error);
  }, [calculation]);

  const saveAnalysisToDatabase = async () => {
    if (calculation.error) {
      alert(calculation.error);
      return;
    }

    setSaving(true);

    try {
      for (const row of calculation.calculated) {
        const { error } = await supabase
          .from("tasks")
          .update({
            earliest_start_day: row.earliest_start_day,
            earliest_finish_day: row.earliest_finish_day,
            latest_start_day: row.latest_start_day,
            latest_finish_day: row.latest_finish_day,
            total_float_days: row.total_float_days,
            remaining_float_days: row.remaining_float_days,
            is_critical: row.is_critical,
          })
          .eq("id", row.id);

        if (error) {
          throw new Error(error.message);
        }
      }

      await loadData();
      alert("Analysis saved successfully.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save analysis.");
    } finally {
      setSaving(false);
    }
  };

  const mergedRows = useMemo(() => {
    const calcMap = new Map(calculation.calculated.map((c) => [c.id, c]));
    return tasks.map((task) => ({
      task,
      calc: calcMap.get(task.id) || null,
    }));
  }, [tasks, calculation.calculated]);

  const supportedDependencyCount = dependencies.filter(
    (d) => d.dependency_type === "FS"
  ).length;
  const unsupportedDependencyCount = dependencies.length - supportedDependencyCount;

  if (loading) {
    return (
      <div className="page-wrap">
        <div className="panel card-pad">Loading analysis...</div>
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
        title={`${project.name} Analysis`}
        description="Automatic CPM analysis for FS dependencies with lag. Calculates earliest/latest times, total float and critical path."
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <BackButton
              label="Back to Project"
              fallbackHref={`/projects/${projectId}`}
            />
            <button
              className="primary-btn"
              onClick={saveAnalysisToDatabase}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Analysis"}
            </button>
          </div>
        }
      />

      <section className="tight-grid-3" style={{ marginBottom: 16 }}>
        <div className="panel card-pad stat-card">
          <div className="stat-label">Activities</div>
          <div className="stat-number">{tasks.length}</div>
        </div>

        <div className="panel card-pad stat-card">
          <div className="stat-label">Project Duration</div>
          <div className="stat-number">{projectDuration ?? 0}</div>
        </div>

        <div className="panel card-pad stat-card">
          <div className="stat-label">Critical Activities</div>
          <div className="stat-number">
            {calculation.calculated.filter((row) => row.is_critical).length}
          </div>
        </div>
      </section>

      <section className="tight-grid-2" style={{ marginBottom: 16 }}>
        <div className="panel card-pad">
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
            Dependency Support
          </div>
          <div className="tight-grid">
            <div>Supported in calculation: {supportedDependencyCount} FS links</div>
            <div>Stored but not yet calculated: {unsupportedDependencyCount} SS/FF/SF links</div>
          </div>
        </div>

        <div className="panel card-pad">
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
            Notes
          </div>
          <div className="tight-grid">
            <div>• This version uses forward pass and backward pass.</div>
            <div>• Critical activities are the ones with zero total float.</div>
            <div>• Project duration is the maximum earliest finish.</div>
          </div>
        </div>
      </section>

      {errorText ? (
        <section className="panel card-pad" style={{ marginBottom: 16 }}>
          <div style={{ color: "var(--danger)", fontWeight: 700, marginBottom: 8 }}>
            Calculation Error
          </div>
          <div>{errorText}</div>
        </section>
      ) : null}

      <section className="panel card-pad" style={{ overflowX: "auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "100px 220px 80px 80px 80px 80px 80px 80px 80px 100px",
            gap: 12,
            alignItems: "center",
          }}
        >
          <div className="text-muted" style={{ fontSize: 12, fontWeight: 700 }}>WBS</div>
          <div className="text-muted" style={{ fontSize: 12, fontWeight: 700 }}>Activity</div>
          <div className="text-muted" style={{ fontSize: 12, fontWeight: 700 }}>Dur</div>
          <div className="text-muted" style={{ fontSize: 12, fontWeight: 700 }}>ES</div>
          <div className="text-muted" style={{ fontSize: 12, fontWeight: 700 }}>EF</div>
          <div className="text-muted" style={{ fontSize: 12, fontWeight: 700 }}>LS</div>
          <div className="text-muted" style={{ fontSize: 12, fontWeight: 700 }}>LF</div>
          <div className="text-muted" style={{ fontSize: 12, fontWeight: 700 }}>Float</div>
          <div className="text-muted" style={{ fontSize: 12, fontWeight: 700 }}>Critical</div>
          <div className="text-muted" style={{ fontSize: 12, fontWeight: 700 }}>Status</div>

          {mergedRows.map(({ task, calc }) => (
            <div
              key={task.id}
              style={{
                display: "contents",
              }}
            >
              <div style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                {task.wbs_code || "—"}
              </div>
              <div style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{task.title}</div>
              </div>
              <div style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                {task.estimated_duration_days ?? "—"}
              </div>
              <div style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                {calc ? calc.earliest_start_day : "—"}
              </div>
              <div style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                {calc ? calc.earliest_finish_day : "—"}
              </div>
              <div style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                {calc ? calc.latest_start_day : "—"}
              </div>
              <div style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                {calc ? calc.latest_finish_day : "—"}
              </div>
              <div style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                {calc ? calc.total_float_days : "—"}
              </div>
              <div style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                {calc?.is_critical ? (
                  <span className="badge" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
                    Yes
                  </span>
                ) : (
                  <span className="badge">No</span>
                )}
              </div>
              <div style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                {task.status}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}