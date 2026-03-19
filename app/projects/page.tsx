"use client";

import { useEffect, useMemo, useState } from "react";
import AuthGate from "../../components/AuthGate";
import { supabase } from "../../lib/supabase";
import { Project, Task } from "../../types/task";

export default function ProjectsPage() {
  return (
    <AuthGate>
      <ProjectsContent />
    </AuthGate>
  );
}

function ProjectsContent() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const loadData = async () => {
    const { data: projectData } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: taskData } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

    setProjects((projectData as Project[]) || []);
    setTasks((taskData as Task[]) || []);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddProject = async () => {
    if (!name.trim()) return;

    await supabase.from("projects").insert({
      name,
      description,
    });

    setName("");
    setDescription("");
    loadData();
  };

  const deleteProject = async (projectId: number) => {
    await supabase.from("projects").delete().eq("id", projectId);
    loadData();
  };

  const projectCards = useMemo(() => {
    return projects.map((project) => ({
      ...project,
      taskCount: tasks.filter((task) => task.project_id === project.id).length,
    }));
  }, [projects, tasks]);

  return (
    <div className="px-6 py-8 md:px-10">
      <header className="mb-8">
        <p className="text-sm text-neutral-500">Projects</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Projects
        </h1>
        <p className="mt-2 text-neutral-600">
          这里管理你的大项目和长期计划。
        </p>
      </header>

      <section className="mb-8 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Add New Project</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Project Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：Final studio portfolio"
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-neutral-400"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简单写一下这个项目是做什么的"
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-neutral-400"
            />
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={handleAddProject}
            className="rounded-xl bg-neutral-900 px-5 py-3 text-white hover:opacity-90"
          >
            Add Project
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {projectCards.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm text-neutral-500">
            还没有项目。
          </div>
        ) : (
          projectCards.map((project) => (
            <div
              key={project.id}
              className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
            >
              <h2 className="text-lg font-semibold">{project.name}</h2>
              <p className="mt-2 text-sm text-neutral-500">
                {project.description || "No description"}
              </p>
              <p className="mt-4 text-sm text-neutral-700">
                Tasks inside: {project.taskCount}
              </p>

              <div className="mt-4">
                <button
                  onClick={() => deleteProject(project.id)}
                  className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-red-200 hover:bg-red-100"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}