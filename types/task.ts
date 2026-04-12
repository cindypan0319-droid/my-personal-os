export type TaskStatus = "inbox" | "todo" | "doing" | "done";
export type TaskPriority = "low" | "medium" | "high";
export type TaskContext = "home" | "computer" | "shop" | "outside";
export type RecurringType = "daily" | "weekly" | "monthly" | null;
export type EnergyLevel = "low" | "medium" | "high" | null;

export type Project = {
  id: number;
  name: string;
  description: string | null;
  user_id: string | null;
  created_at: string;
};

export type Task = {
  id: number;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  context: TaskContext;

  due_date: string | null;
  project_id: number | null;

  is_quick_task: boolean | null;
  estimated_minutes: number | null;

  notes: string | null;
  reference_link: string | null;

  scheduled_date: string | null;
  start_time: string | null;
  end_time: string | null;

  recurring_enabled: boolean | null;
  recurring_type: RecurringType;
  recurring_interval: number | null;
  recurring_days_of_week: number[] | null;

  energy_level: EnergyLevel;
  must_do_today: boolean | null;

  manual_order: number | null;
  user_id: string | null;
  created_at: string;
};

export type Subtask = {
  id: number;
  task_id: number;
  title: string;
  status: "todo" | "done";

  estimated_minutes: number | null;
  due_date: string | null;
  scheduled_date: string | null;
  start_time: string | null;
  end_time: string | null;

  manual_order: number | null;
  user_id: string | null;
  created_at: string;
};