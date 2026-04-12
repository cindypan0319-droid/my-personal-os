export type DependencyType = "FS" | "SS" | "FF" | "SF";

export type ProjectWorkPackage = {
  id: number;
  project_id: number;
  name: string;
  description: string | null;
  manual_order: number | null;
  created_at: string;
};

export type TaskDependency = {
  id: number;
  project_id: number;
  predecessor_task_id: number;
  successor_task_id: number;
  dependency_type: DependencyType;
  lag_days: number;
  created_at: string;
};

export type TimelineTask = {
  id: number;
  title: string;
  status: "inbox" | "todo" | "doing" | "done";
  project_id: number | null;
  work_package_id: number | null;
  wbs_code: string | null;

  estimated_duration_days: number | null;
  planned_start_date: string | null;
  planned_finish_date: string | null;
  actual_start_date: string | null;
  actual_finish_date: string | null;
  is_milestone: boolean | null;

  earliest_start_day: number | null;
  earliest_finish_day: number | null;
  latest_start_day: number | null;
  latest_finish_day: number | null;
  total_float_days: number | null;
  free_float_days: number | null;
  remaining_float_days: number | null;
  is_critical: boolean | null;

  normal_duration_days: number | null;
  crash_duration_days: number | null;
  normal_cost: number | null;
  crash_cost: number | null;
  cost_to_expedite: number | null;

  assignee: string | null;
  required_resource: string | null;
  resource_units: number | null;
  daily_hours: number | null;

  start_time: string | null;
  end_time: string | null;
  scheduled_date: string | null;

  priority: "low" | "medium" | "high";
  context: "home" | "computer" | "shop" | "outside";

  notes: string | null;
  reference_link: string | null;
  user_id: string | null;
  created_at: string;
};