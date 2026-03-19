export type TaskStatus = "inbox" | "todo" | "doing" | "done";

export type TaskPriority = "low" | "medium" | "high";

export type TaskContext = "home" | "computer" | "shop" | "outside";

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
  created_at: string;
};

export type SubtaskStatus = "todo" | "done";

export type Subtask = {
  id: number;
  user_id: string | null;
  task_id: number;
  title: string;
  status: SubtaskStatus;
  created_at: string;
};