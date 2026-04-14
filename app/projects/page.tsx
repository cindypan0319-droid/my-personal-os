"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { PageHeader } from "../../components/app/PageHeader";
import { Project, Task } from "../../types/task";

type CardState = {
  expanded: boolean;
  editing: boolean;
  editName: string;
  editDescription: string;
  editNotes: string;
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [cardUi, setCardUi] = useState<Record<number, CardState>>({});
  const [creatingOpen, setCreatingOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);

    const { data: projectData, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: taskData, error: taskError } = await supabase.from("tasks").select("*");

    if (projectError) console.error(projectError.message);
    if (taskError) console.error(taskError.message);

    const nextProjects = (projectData as Project[]) || [];
    const nextTasks = (taskData as Task[]) || [];

    setProjects(nextProjects);
    setTasks(nextTasks);

    setCardUi((prev) => {
      const next = { ...prev };
      nextProjects.forEach((project) => {
        if (!next[project.id]) {
          next[project.id] = {
            expanded: false,
            editing: false,
            editName: project.name,
            editDescription: project.description || "",
            editNotes: project.notes || "",
          };
        }
      });
      return next;
    });

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const cards = useMemo(() => {
    return projects.map((project) => {
      const projectTasks = tasks.filter((task) => task.project_id === project.id);
      const activeTasks = projectTasks.filter(
        (task) => task.is_active !== false && task.status !== "done"
      );
      const doneCount = projectTasks.filter((task) => task.status === "done").length;
      const totalCount = projectTasks.length;

      const urgentTasks = [...activeTasks]
        .sort((a, b) => {
          const aMust = a.must_do_today ? 1 : 0;
          const bMust = b.must_do_today ? 1 : 0;
          if (aMust !== bMust) return bMust - aMust;

          const priorityOrder = { high: 3, medium: 2, low: 1 };
          if (priorityOrder[b.priority] !== priorityOrder[a.priority]) {
            return priorityOrder[b.priority] - priorityOrder[a.priority];
          }

          if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
          if (a.due_date && !b.due_date) return -1;
          if (!a.due_date && b.due_date) return 1;

          return b.created_at.localeCompare(a.created_at);
        })
        .slice(0, 5);

      return {
        ...project,
        totalCount,
        doneCount,
        activeCount: activeTasks.length,
        urgentTasks,
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
      description: description.trim() || null,
      notes: notes.trim() || null,
      status: "active",
      user_id: null,
    });

    if (error) {
      alert("Create project failed: " + error.message);
      return;
    }

    setName("");
    setDescription("");
    setNotes("");
    setCreatingOpen(false);
    await loadData();
  };

  const saveProject = async (projectId: number) => {
    const ui = cardUi[projectId];
    if (!ui?.editName.trim()) {
      alert("Project name is required");
      return;
    }

    const { error } = await supabase
      .from("projects")
      .update({
        name: ui.editName.trim(),
        description: ui.editDescription.trim() || null,
        notes: ui.editNotes.trim() || null,
      })
      .eq("id", projectId);

    if (error) {
      alert("Save project failed: " + error.message);
      return;
    }

    setCardUi((prev) => ({
      ...prev,
      [projectId]: {
        ...prev[projectId],
        editing: false,
      },
    }));

    await loadData();
  };

  const setProjectCompleted = async (projectId: number, completed: boolean) => {
    const projectPatch = completed
      ? { status: "completed", completed_at: new Date().toISOString() }
      : { status: "active", completed_at: null };

    const { error: projectError } = await supabase
      .from("projects")
      .update(projectPatch)
      .eq("id", projectId);

    if (projectError) {
      alert("Update project failed: " + projectError.message);
      return;
    }

    const { error: taskError } = await supabase
      .from("tasks")
      .update({
        is_active: !completed,
        status: completed ? "inactive" : "todo",
      })
      .eq("project_id", projectId)
      .neq("status", "done");

    if (taskError) {
      alert("Update project tasks failed: " + taskError.message);
      return;
    }

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
    <div
      className="page-wrap"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <PageHeader
        kicker="Projects"
        title="Projects"
        description="Open a project hub, review urgent work, and manage active or completed projects."
        actions={
          <button
            className="primary-btn"
            onClick={() => setCreatingOpen((prev) => !prev)}
          >
            {creatingOpen ? "Close" : "+ New Project"}
          </button>
        }
      />

      {creatingOpen ? (
        <section className="panel card-pad" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Create Project</div>

          <div className="tight-grid">
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

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Project notes"
              rows={4}
            />
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="primary-btn" onClick={addProject}>
              Add Project
            </button>
            <button className="secondary-btn" onClick={() => setCreatingOpen(false)}>
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      {cards.length === 0 ? (
        <div className="panel card-pad empty-state">No projects yet.</div>
      ) : (
        <section className="tight-grid-2">
          {cards.map((project) => {
            const ui = cardUi[project.id] || {
              expanded: false,
              editing: false,
              editName: project.name,
              editDescription: project.description || "",
              editNotes: project.notes || "",
            };

            return (
              <div
                key={project.id}
                className="panel card-pad"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                {!ui.editing ? (
                  <>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 14,
                        alignItems: "flex-start",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                            flexWrap: "wrap",
                            marginBottom: 6,
                          }}
                        >
                          <div style={{ fontSize: 18, fontWeight: 700 }}>{project.name}</div>
                          <div className="badge">{project.status}</div>
                        </div>

                        <div className="task-meta">
                          {project.description || "No description"}
                        </div>

                        <div className="task-meta" style={{ marginTop: 10 }}>
                          {project.doneCount}/{project.totalCount} tasks done · {project.activeCount} active
                        </div>
                      </div>

                      <Link href={`/projects/${project.id}`} className="blue-btn">
                        Open Hub
                      </Link>
                    </div>

                    <div className="progress-track">
                      <div className="progress-bar" style={{ width: `${project.progress}%` }} />
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <div className="task-meta">Progress: {project.progress}%</div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          className="secondary-btn"
                          onClick={() =>
                            setCardUi((prev) => ({
                              ...prev,
                              [project.id]: { ...ui, expanded: !ui.expanded },
                            }))
                          }
                        >
                          {ui.expanded ? "Hide details" : "Show details"}
                        </button>

                        <button
                          className="secondary-btn"
                          onClick={() =>
                            setCardUi((prev) => ({
                              ...prev,
                              [project.id]: { ...ui, editing: true },
                            }))
                          }
                        >
                          Edit
                        </button>

                        {project.status === "completed" ? (
                          <button
                            className="primary-btn"
                            onClick={() => setProjectCompleted(project.id, false)}
                          >
                            Resume
                          </button>
                        ) : (
                          <button
                            className="secondary-btn"
                            onClick={() => setProjectCompleted(project.id, true)}
                          >
                            Finish
                          </button>
                        )}

                        <button
                          className="danger-btn"
                          onClick={() => deleteProject(project.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="tight-grid">
                      <input
                        value={ui.editName}
                        onChange={(e) =>
                          setCardUi((prev) => ({
                            ...prev,
                            [project.id]: { ...ui, editName: e.target.value },
                          }))
                        }
                        placeholder="Project name"
                      />
                      <input
                        value={ui.editDescription}
                        onChange={(e) =>
                          setCardUi((prev) => ({
                            ...prev,
                            [project.id]: { ...ui, editDescription: e.target.value },
                          }))
                        }
                        placeholder="Description"
                      />
                      <textarea
                        value={ui.editNotes}
                        onChange={(e) =>
                          setCardUi((prev) => ({
                            ...prev,
                            [project.id]: { ...ui, editNotes: e.target.value },
                          }))
                        }
                        placeholder="Project notes"
                        rows={4}
                      />
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button className="primary-btn" onClick={() => saveProject(project.id)}>
                        Save
                      </button>
                      <button
                        className="secondary-btn"
                        onClick={() =>
                          setCardUi((prev) => ({
                            ...prev,
                            [project.id]: {
                              ...ui,
                              editing: false,
                              editName: project.name,
                              editDescription: project.description || "",
                              editNotes: project.notes || "",
                            },
                          }))
                        }
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}

                {ui.expanded && !ui.editing ? (
                  <div
                    className="panel-soft card-pad"
                    style={{
                      borderRadius: 18,
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 700 }}>
                      Most urgent items
                    </div>

                    {project.urgentTasks.length === 0 ? (
                      <div className="empty-state">No active items right now.</div>
                    ) : (
                      <div className="tight-grid">
                        {project.urgentTasks.map((task) => (
                          <div key={task.id} className="panel card-pad">
                            <div
                              style={{
                                fontSize: 14,
                                fontWeight: 700,
                                textDecoration: task.status === "done" ? "line-through" : "none",
                              }}
                            >
                              {task.title}
                            </div>
                            <div className="task-meta" style={{ marginTop: 6 }}>
                              {task.priority} · Due: {task.due_date || "N/A"}
                              {task.must_do_today ? " · Must today" : ""}
                              {task.is_quick_task ? " · Quick" : ""}
                            </div>
                            {task.description ? (
                              <div className="task-meta" style={{ marginTop: 6 }}>
                                {task.description}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}

                    {project.notes ? (
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
                          Project notes
                        </div>
                        <div className="task-meta" style={{ whiteSpace: "pre-wrap" }}>
                          {project.notes}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}