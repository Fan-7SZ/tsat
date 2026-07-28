import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { TaskRuntimeID } from "@/domain/value-objects/types"
import type { LocalDateKey } from "@/domain/value-objects/schemas"
import { toLocalDateKey } from "@/utils/date"

/**
 * One scheduled time span on a task's gantt row. `from`/`to` are minutes from
 * local midnight (0..1440). The `id` is a stable React/edit key — the persisted
 * essence is still just `{ from, to }`.
 */
export interface PlannerBlock {
  id: string
  from: number
  to: number
}

interface PlannerState {
  /** The day these blocks belong to; blocks reset when it rolls over. */
  dateKey: LocalDateKey
  /** Per-task-runtime time spans. A task may hold multiple blocks. */
  blocks: Record<TaskRuntimeID, PlannerBlock[]>

  addBlock: (runtimeId: TaskRuntimeID, from: number, to: number) => void
  updateBlock: (
    runtimeId: TaskRuntimeID,
    blockId: string,
    from: number,
    to: number
  ) => void
  removeBlock: (runtimeId: TaskRuntimeID, blockId: string) => void
  clearAll: () => void
  /** Drop everything if the stored day is no longer today. Call on dialog open. */
  ensureToday: () => void
}

/**
 * Local-only planner result: a map of task-runtime → its gantt blocks, persisted
 * to its own localStorage key. Deliberately NOT part of the synced app store —
 * this is per-device scratch scheduling, mirroring the sketch's "planner state".
 */
export const usePlannerState = create<PlannerState>()(
  persist(
    (set, get) => ({
      dateKey: toLocalDateKey(new Date()),
      blocks: {},

      addBlock: (runtimeId, from, to) =>
        set((state) => ({
          blocks: {
            ...state.blocks,
            [runtimeId]: [
              ...(state.blocks[runtimeId] ?? []),
              { id: crypto.randomUUID(), from, to },
            ],
          },
        })),

      updateBlock: (runtimeId, blockId, from, to) =>
        set((state) => {
          const list = state.blocks[runtimeId]
          if (!list) return state
          return {
            blocks: {
              ...state.blocks,
              [runtimeId]: list.map((b) =>
                b.id === blockId ? { ...b, from, to } : b
              ),
            },
          }
        }),

      removeBlock: (runtimeId, blockId) =>
        set((state) => {
          const list = state.blocks[runtimeId]
          if (!list) return state
          const next = list.filter((b) => b.id !== blockId)
          const blocks = { ...state.blocks }
          if (next.length === 0) delete blocks[runtimeId]
          else blocks[runtimeId] = next
          return { blocks }
        }),

      clearAll: () =>
        set({ blocks: {}, dateKey: toLocalDateKey(new Date()) }),

      ensureToday: () => {
        const today = toLocalDateKey(new Date())
        if (get().dateKey !== today) set({ blocks: {}, dateKey: today })
      },
    }),
    {
      name: "track-planner-state",
      partialize: (state) => ({
        dateKey: state.dateKey,
        blocks: state.blocks,
      }),
    }
  )
)
