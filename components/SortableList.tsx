"use client";

import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type SortableItemBase = {
  id: number;
};

type SortableListProps<T extends SortableItemBase> = {
  items: T[];
  onReorder: (items: T[]) => Promise<void> | void;
  renderItem: (item: T) => React.ReactNode;
};

function SortableRow<T extends SortableItemBase>({
  item,
  renderItem,
}: {
  item: T;
  renderItem: (item: T) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "28px 1fr",
          gap: 8,
          alignItems: "start",
        }}
      >
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="secondary-btn"
          style={{
            padding: "8px 0",
            minHeight: 36,
            lineHeight: 1,
            cursor: "grab",
          }}
          aria-label="Drag to reorder"
          title="Drag to reorder"
        >
          ≡
        </button>

        <div>{renderItem(item)}</div>
      </div>
    </div>
  );
}

export default function SortableList<T extends SortableItemBase>({
  items,
  onReorder,
  renderItem,
}: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const ids = items.map((item) => item.id);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(items, oldIndex, newIndex);
    await onReorder(reordered);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="tight-grid">
          {items.map((item) => (
            <SortableRow key={item.id} item={item} renderItem={renderItem} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}