export type TaskStatus = "inbox" | "todo" | "doing" | "done";

export type TaskPriority = "low" | "medium" | "high";

export type TaskContext = "home" | "computer" | "shop" | "outside";

export type Project = {
  id: number;
  user_id: string;
  name: string;
  description: string;
  created_at: string;
};

export type Task = {
  id: number;
  user_id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  context: TaskContext;
  due_date: string | null;
  project_id: number | null;
  is_quick_task: boolean;
  created_at: string;
};