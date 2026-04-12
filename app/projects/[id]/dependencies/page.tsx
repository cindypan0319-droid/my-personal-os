"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import { BackButton } from "../../../../components/app/BackButton";
import { recomputeAndSaveProjectAnalysis } from "../../../../lib/project-analysis-sync";
import { PageHeader } from "../../../../components/app/PageHeader";
import { Project } from "../../../../types/task";
import { TaskDependency, TimelineTask } from "../../../../types/project-timeline";

type DependencyType = "FS" | "SS" | "FF" | "SF";

export default function ProjectDependenciesPage() {
  const params = useParams();
  const projectId = Number(params.id);

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<TimelineTask[]>([]);
  const [dependencies, setDependencies] = useState<TaskDependency[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const [predecessorTaskId, setPredecessorTaskId] = useState("");
  const [successorTaskId, setSuccessorTaskId] = useState("");
  const [dependencyType, setDependencyType] = useState<DependencyType>("FS");
  const [lagDays, setLagDays] = useState("0");

  const loadData = async () => {
    setLoading(true);

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

  const taskLabel = (taskId: number) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return String(taskId);
    return `${task.wbs_code || task.id} - ${task.title}`;
  };

  const addDependency = async () => {
    if (!predecessorTaskId || !successorTaskId) {
      alert("Please select both predecessor and successor");
      return;
    }

    if (predecessorTaskId === successorTaskId) {
      alert("A task cannot depend on itself");
      return;
    }

    const exists = dependencies.some(
      (d) =>
        d.predecessor_task_id === Number(predecessorTaskId) &&
        d.successor_task_id === Number(successorTaskId)
    );

    if (exists) {
      alert("This dependency already exists");
      return;
    }

    setWorking(true);

    const { error } = await supabase.from("task_dependencies").insert({
      project_id: projectId,
      predecessor_task_id: Number(predecessorTaskId),
      successor_task_id: Number(successorTaskId),
      dependency_type: dependencyType,
      lag_days: Number(lagDays || 0),
    });

    if (error) {
      setWorking(false);
      alert("Create dependency failed: " + error.message);
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

    setPredecessorTaskId("");
    setSuccessorTaskId("");
    setDependencyType("FS");
    setLagDays("0");
    setWorking(false);
    await loadData();
  };

  const deleteDependency = async (id: number) => {
    const ok = window.confirm("Delete this dependency?");
    if (!ok) return;

    setWorking(true);

    const { error } = await supabase
      .from("task_dependencies")
      .delete()
      .eq("id", id);

    if (error) {
      setWorking(false);
      alert("Delete dependency failed: " + error.message);
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

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const aCode = a.wbs_code || "";
      const bCode = b.wbs_code || "";
      if (aCode && bCode) return aCode.localeCompare(bCode);
      return a.title.localeCompare(b.title);
    });
  }, [tasks]);

  if (loading) {
    return (
      <div className="page-wrap">
        <div className="panel card-pad">Loading dependencies...</div>
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
        title={`${project.name} Dependencies`}
        description="Set precedence relationships between activities. Analysis will recompute automatically after each change."
        actions={
          <BackButton
            label="Back to Project"
            fallbackHref={`/projects/${projectId}`}
          />
        }
      />

      <section className="panel card-pad" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
          Add Dependency
        </div>

        <div className="tight-grid-2">
          <select
            value={predecessorTaskId}
            onChange={(e) => setPredecessorTaskId(e.target.value)}
          >
            <option value="">Select predecessor</option>
            {sortedTasks.map((task) => (
              <option key={task.id} value={task.id}>
                {taskLabel(task.id)}
              </option>
            ))}
          </select>

          <select
            value={successorTaskId}
            onChange={(e) => setSuccessorTaskId(e.target.value)}
          >
            <option value="">Select successor</option>
            {sortedTasks.map((task) => (
              <option key={task.id} value={task.id}>
                {taskLabel(task.id)}
              </option>
            ))}
          </select>

          <select
            value={dependencyType}
            onChange={(e) => setDependencyType(e.target.value as DependencyType)}
          >
            <option value="FS">FS - Finish to Start</option>
            <option value="SS">SS - Start to Start</option>
            <option value="FF">FF - Finish to Finish</option>
            <option value="SF">SF - Start to Finish</option>
          </select>

          <input
            type="number"
            value={lagDays}
            onChange={(e) => setLagDays(e.target.value)}
            placeholder="Lag days"
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <button className="primary-btn" onClick={addDependency} disabled={working}>
            {working ? "Working..." : "Add Dependency"}
          </button>
        </div>
      </section>

      <section className="panel card-pad">
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
          Dependency List
        </div>

        <div className="tight-grid">
          {dependencies.length === 0 ? (
            <div className="panel-soft card-pad empty-state">
              No dependencies yet.
            </div>
          ) : (
            dependencies.map((dep) => (
              <div key={dep.id} className="panel-soft card-pad">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 120px 100px auto",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {taskLabel(dep.predecessor_task_id)}
                    </div>
                    <div className="task-meta">Predecessor</div>
                  </div>

                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                    {dep.dependency_type}
                    {dep.lag_days ? ` +${dep.lag_days}d` : ""}
                  </div>

                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {taskLabel(dep.successor_task_id)}
                    </div>
                    <div className="task-meta">Successor</div>
                  </div>

                  <button
                    className="danger-btn"
                    onClick={() => deleteDependency(dep.id)}
                    disabled={working}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}