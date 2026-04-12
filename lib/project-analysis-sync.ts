import { supabase } from "./supabase";
import { TaskDependency, TimelineTask } from "../types/project-timeline";

type SchedulingTask = TimelineTask & {
  estimated_duration_days: number | null;
};

type CalculatedTaskFields = {
  id: number;
  earliest_start_day: number;
  earliest_finish_day: number;
  latest_start_day: number;
  latest_finish_day: number;
  total_float_days: number;
  is_critical: boolean;
  remaining_float_days: number;
};

type GraphNode = {
  task: SchedulingTask;
  predecessors: TaskDependency[];
  successors: TaskDependency[];
};

function getDuration(task: SchedulingTask): number {
  const raw = task.estimated_duration_days ?? task.normal_duration_days ?? 1;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return n;
}

function onlySupportedDependencies(dependencies: TaskDependency[]) {
  return dependencies.filter((d) => d.dependency_type === "FS");
}

function calculateProjectSchedule(
  tasks: SchedulingTask[],
  dependencies: TaskDependency[]
): {
  calculated: CalculatedTaskFields[];
  projectDuration: number;
} {
  const supportedDeps = onlySupportedDependencies(dependencies);

  const nodeMap = new Map<number, GraphNode>();

  for (const task of tasks) {
    nodeMap.set(task.id, {
      task,
      predecessors: [],
      successors: [],
    });
  }

  for (const dep of supportedDeps) {
    const pred = nodeMap.get(dep.predecessor_task_id);
    const succ = nodeMap.get(dep.successor_task_id);
    if (!pred || !succ) continue;

    pred.successors.push(dep);
    succ.predecessors.push(dep);
  }

  const inDegree = new Map<number, number>();
  for (const task of tasks) {
    inDegree.set(task.id, nodeMap.get(task.id)?.predecessors.length || 0);
  }

  const queue: number[] = [];
  for (const [taskId, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(taskId);
  }

  const topo: number[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    topo.push(current);

    const node = nodeMap.get(current);
    if (!node) continue;

    for (const dep of node.successors) {
      const nextId = dep.successor_task_id;
      const currentDeg = inDegree.get(nextId) ?? 0;
      const newDeg = currentDeg - 1;
      inDegree.set(nextId, newDeg);
      if (newDeg === 0) queue.push(nextId);
    }
  }

  if (topo.length !== tasks.length) {
    throw new Error(
      "Dependency cycle detected, or there are unsupported dependency issues. Please check the task network."
    );
  }

  const ES = new Map<number, number>();
  const EF = new Map<number, number>();

  for (const taskId of topo) {
    const node = nodeMap.get(taskId)!;
    const duration = getDuration(node.task);

    let es = 0;

    for (const dep of node.predecessors) {
      const predEF = EF.get(dep.predecessor_task_id) ?? 0;
      const lag = dep.lag_days ?? 0;
      es = Math.max(es, predEF + lag);
    }

    const ef = es + duration;
    ES.set(taskId, es);
    EF.set(taskId, ef);
  }

  const projectDuration = Math.max(...Array.from(EF.values()), 0);

  const LS = new Map<number, number>();
  const LF = new Map<number, number>();

  const reverseTopo = [...topo].reverse();

  for (const taskId of reverseTopo) {
    const node = nodeMap.get(taskId)!;
    const duration = getDuration(node.task);

    if (node.successors.length === 0) {
      LF.set(taskId, projectDuration);
      LS.set(taskId, projectDuration - duration);
      continue;
    }

    let lf = Number.POSITIVE_INFINITY;

    for (const dep of node.successors) {
      const succLS = LS.get(dep.successor_task_id);
      const lag = dep.lag_days ?? 0;

      if (succLS === undefined) continue;
      lf = Math.min(lf, succLS - lag);
    }

    if (!Number.isFinite(lf)) {
      lf = projectDuration;
    }

    LF.set(taskId, lf);
    LS.set(taskId, lf - duration);
  }

  const calculated: CalculatedTaskFields[] = tasks.map((task) => {
    const es = ES.get(task.id) ?? 0;
    const ef = EF.get(task.id) ?? getDuration(task);
    const ls = LS.get(task.id) ?? 0;
    const lf = LF.get(task.id) ?? getDuration(task);
    const totalFloat = ls - es;

    return {
      id: task.id,
      earliest_start_day: es,
      earliest_finish_day: ef,
      latest_start_day: ls,
      latest_finish_day: lf,
      total_float_days: totalFloat,
      is_critical: totalFloat === 0,
      remaining_float_days: totalFloat,
    };
  });

  return {
    calculated,
    projectDuration,
  };
}

export async function recomputeAndSaveProjectAnalysis(projectId: number) {
  const { data: taskData, error: taskError } = await supabase
    .from("tasks")
    .select("*")
    .eq("project_id", projectId);

  if (taskError) {
    throw new Error(taskError.message);
  }

  const { data: depData, error: depError } = await supabase
    .from("task_dependencies")
    .select("*")
    .eq("project_id", projectId);

  if (depError) {
    throw new Error(depError.message);
  }

  const tasks = ((taskData as TimelineTask[]) || []).filter(
    (task) => task.estimated_duration_days !== null
  ) as SchedulingTask[];

  const dependencies = (depData as TaskDependency[]) || [];

  if (tasks.length === 0) {
    return { projectDuration: 0, updatedCount: 0 };
  }

  const result = calculateProjectSchedule(tasks, dependencies);

  for (const row of result.calculated) {
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

  return {
    projectDuration: result.projectDuration,
    updatedCount: result.calculated.length,
  };
}