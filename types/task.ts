export type TaskStatus = "inbox" | "todo" | "doing" | "done";

export type TaskPriority = "low" | "medium" | "high";

export type TaskContext = "home" | "computer" | "shop" | "outside";

export type EnergyLevel = "low" | "medium" | "high";

export type RecurringType = "daily" | "weekly" | "monthly" | null;

export type Project = {
  id: number;
  user_id: string | null;
  name: string;
  description: string;
  created_at: string;
};

export type Task = {
  id: number;
  user_id: string | null;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  context: TaskContext;
  due_date: string | null;
  project_id: number | null;
  is_quick_task: boolean;
  estimated_minutes: number | null;
  notes: string | null;
  reference_link: string | null;
  manual_order: number | null;
  scheduled_date: string | null;
  start_time: string | null;
  end_time: string | null;
  recurring_enabled: boolean | null;
  recurring_type: RecurringType;
  recurring_interval: number | null;
  recurring_days_of_week: number[] | null;
  last_generated_at: string | null;
  ai_score: number | null;
  energy_level: EnergyLevel | null;
  must_do_today: boolean | null;
  created_at: string;
};

export type SubtaskStatus = "todo" | "done";

export type Subtask = {
  id: number;
  user_id: string | null;
  task_id: number;
  title: string;
  status: SubtaskStatus;
  estimated_minutes: number | null;
  due_date: string | null;
  manual_order: number | null;
  scheduled_date: string | null;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
};