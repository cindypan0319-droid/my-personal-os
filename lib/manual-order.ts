import { supabase } from "./supabase";

type OrderableItem = {
  id: number;
};

export async function persistManualOrder(
  table: "tasks" | "subtasks",
  items: OrderableItem[]
) {
  for (let index = 0; index < items.length; index++) {
    const item = items[index];

    const { error } = await supabase
      .from(table)
      .update({ manual_order: index + 1 })
      .eq("id", item.id);

    if (error) {
      throw new Error(error.message);
    }
  }
}