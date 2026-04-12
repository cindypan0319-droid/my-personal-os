"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { PageHeader } from "../../components/app/PageHeader";
import { Project, Task } from "../../types/task";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const loadData = async () => {
    setLoading(true);

    const { data: projectData, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: taskData, error: taskError } = await supabase
      .from("tasks")
      .select("*");

    if (projectError) console.error(projectError.message);
    if (taskError) console.error(taskError.message);

    setProjects((projectData as Project[]) || []);
    setTasks((taskData as Task[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const cards = useMemo(() => {
    return projects.map((project) => {
      const projectTasks = tasks.filter((task) => task.project_id === project.id);
      const doneCount = projectTasks.filter((task) => task.status === "done").length;
      const totalCount = projectTasks.length;

      return {
        ...project,
        totalCount,
        doneCount,
        progress: totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100),
      };
    });
  }, [projects, tasks]);

  const addProject = async () => {
    if (!name.trim()) {
      alert("Project name is required");
      return;
    }

    const { error } = await supabase.from("projects").insert({
      name: name.trim(),
      description: description || null,
      user_id: null,
    });

    if (error) {
      alert("Create project failed: " + error.message);
      return;
    }

    setName("");
    setDescription("");
    await loadData();
  };

  const deleteProject = async (projectId: number) => {
    const ok = window.confirm("Delete this project?");
    if (!ok) return;

    const { error } = await supabase.from("projects").delete().eq("id", projectId);

    if (error) {
      alert("Delete project failed: " + error.message);
      return;
    }

    await loadData();
  };

  if (loading) {
    return (
      <div className="page-wrap">
        <div className="panel card-pad">Loading projects...</div>
      </div>
    );
  }

  return (
    <div className="page-wrap">
      <PageHeader
        kicker="Projects"
        title="Projects"
        description="Open a project hub, then go into timeline, analysis, workload, and dependencies."
      />

      <section className="panel card-pad" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Create Project</div>

        <div className="tight-grid-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <button className="primary-btn" onClick={addProject}>
            Add Project
          </button>
        </div>
      </section>

      {cards.length === 0 ? (
        <div className="panel card-pad empty-state">No projects yet.</div>
      ) : (
        <section className="tight-grid-2">
          {cards.map((project) => (
            <div key={project.id} className="panel card-pad">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "flex-start",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{project.name}</div>
                  <div className="task-meta">{project.description || "No description"}</div>
                  <div className="task-meta" style={{ marginTop: 8 }}>
                    {project.doneCount}/{project.totalCount} tasks done
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link href={`/projects/${project.id}`} className="blue-btn">
                    Open Hub
                  </Link>
                  <button className="danger-btn" onClick={() => deleteProject(project.id)}>
                    Delete
                  </button>
                </div>
              </div>

              <div className="progress-track">
                <div className="progress-bar" style={{ width: `${project.progress}%` }} />
              </div>

              <div className="task-meta">Progress: {project.progress}%</div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}