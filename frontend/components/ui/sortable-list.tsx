"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { createContext, useContext, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Drag-and-drop reordering, layered on top of the arrow-button reorder every
 * list in this app already has (Phase 38/42/43/44/53) rather than replacing
 * it. Arrow buttons stay as the keyboard/screen-reader path — dragging alone
 * is a worse experience for both than what already existed — so this is
 * purely an additional input method wired to the same `onReorder` callback
 * a caller's arrow buttons already call.
 */
export function SortableList({
  ids,
  onReorder,
  disabled,
  strategy = "vertical",
  as: Tag = "ul",
  className,
  children,
}: {
  /** Every item's id, in current order — same full-list contract every
   *  reorder endpoint here already demands. */
  ids: string[];
  onReorder: (nextIds: string[]) => void;
  disabled?: boolean;
  strategy?: "vertical" | "grid";
  /** The wrapping element — `<ul>` by default so list semantics survive the
   *  swap from a plain `<ul>`; `"div"` for a nested reorder group (e.g. one
   *  category's children within the top-level list) that shouldn't itself
   *  count as a second list. */
  as?: "ul" | "div";
  className?: string;
  children: ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(ids, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext
        items={ids}
        strategy={strategy === "grid" ? rectSortingStrategy : verticalListSortingStrategy}
        disabled={disabled}
      >
        <Tag className={className}>{children}</Tag>
      </SortableContext>
    </DndContext>
  );
}

const SortableItemContext = createContext<{
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  setActivatorNodeRef: (node: HTMLElement | null) => void;
  isDragging: boolean;
} | null>(null);

/** Wraps one row/tile. Renders as `<li>` by default since every reorderable
 *  list in this app is a `<ul>` — pass `as="div"` for the photo grid, which
 *  is one too, but keep that as the one override rather than defaulting to
 *  the less common case. */
export function SortableItem({
  id,
  as: Tag = "li",
  disabled,
  className,
  children,
}: {
  id: string;
  as?: "li" | "div" | "section";
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled });

  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <SortableItemContext.Provider value={{ attributes, listeners, setActivatorNodeRef, isDragging }}>
      <Tag
        ref={setNodeRef}
        style={style}
        className={cn(isDragging && "z-10 opacity-60", className)}
      >
        {children}
      </Tag>
    </SortableItemContext.Provider>
  );
}

/** The actual drag target inside a `SortableItem` — separate from the row
 *  itself so a click anywhere else in the row (a title link, a toggle
 *  button) is never mistaken for the start of a drag. */
export function DragHandle({ className, label = "Drag to reorder" }: { className?: string; label?: string }) {
  const ctx = useContext(SortableItemContext);
  const { attributes, listeners, setActivatorNodeRef, isDragging } = ctx ?? {};
  if (!ctx) return null;
  return (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={label}
      className={cn(
        "flex size-6 shrink-0 touch-none items-center justify-center rounded-md text-muted-foreground/60 hover:bg-muted hover:text-foreground active:cursor-grabbing",
        isDragging ? "cursor-grabbing" : "cursor-grab",
        className
      )}
    >
      <GripVertical className="size-4" />
    </button>
  );
}
