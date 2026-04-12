import { supabase } from "./supabase";

type OrderableItem = {
  id: number;
};

export async function persistManualOrder(
  table: "tasks" | "subtasks",
  items: OrderableItem[]
) {
  const updates = items.map((item, index) =>
    supabase.from(table).update({ manual_order: index + 1 }).eq("id", item.id)
  );

  const results = await Promise.all(updates);
  const failed = results.find((result) => result.error);

  if (failed?.error) {
    throw new Error(failed.error.message);
  }
}