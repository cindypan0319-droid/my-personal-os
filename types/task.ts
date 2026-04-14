export type TaskStatus = "inbox" | "todo" | "doing" | "done" | "inactive";
export type TaskPriority = "low" | "medium" | "high";
export type DurationUnit = "hours" | "days" | "weeks" | "months";
export type ProjectStatus = "active" | "completed" | "archived";

export type Project = {
  id: number;
  name: string;
  description: string | null;
  notes: string | null;
  status: ProjectStatus;
  completed_at: string | null;
  archived_at: string | null;
  created_at: string;
  user_id: string | null;
};

export type Task = {
  id: number;
  title: string;
  description: string | null;
  notes: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  context: string | null;

  due_date: string | null;
  scheduled_date: string | null;
  start_time: string | null;
  end_time: string | null;

  project_id: number | null;
  user_id: string | null;

  is_quick_task: boolean | null;
  must_do_today: boolean | null;
  is_active: boolean | null;

  duration_input_value: number | null;
  duration_input_unit: DurationUnit | null;
  estimated_minutes: number | null;

  manual_order: number | null;
  recurring_enabled: boolean | null;
  recurring_type: string | null;
  recurring_interval: number | null;
  recurring_days_of_week: number[] | null;
  reference_link: string | null;
  energy_level: string | null;

  created_at: string;
};

export function durationToMinutes(
  value: number | null | undefined,
  unit: DurationUnit | null | undefined
) {
  if (value == null || Number.isNaN(Number(value))) return null;

  const numericValue = Number(value);
  const safeUnit = unit || "days";

  if (safeUnit === "hours") return Math.round(numericValue * 60);
  if (safeUnit === "days") return Math.round(numericValue * 8 * 60);
  if (safeUnit === "weeks") return Math.round(numericValue * 5 * 8 * 60);
  return Math.round(numericValue * 20 * 8 * 60);
}

export function formatDuration(task: Pick<Task, "duration_input_value" | "duration_input_unit" | "estimated_minutes">) {
  if (task.duration_input_value != null && task.duration_input_unit) {
    const unit =
      task.duration_input_value === 1
        ? task.duration_input_unit.slice(0, -1)
        : task.duration_input_unit;
    return `${task.duration_input_value} ${unit}`;
  }

  if (task.estimated_minutes == null) return "No duration";

  if (task.estimated_minutes < 60) return `${task.estimated_minutes} min`;

  const hours = task.estimated_minutes / 60;
  if (hours < 8) return `${hours % 1 === 0 ? hours : hours.toFixed(1)} hours`;

  const days = hours / 8;
  return `${days % 1 === 0 ? days : days.toFixed(1)} days`;
}