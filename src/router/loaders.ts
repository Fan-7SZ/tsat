/**
 * Route loaders — the data half of the route table (see ./routes.tsx).
 *
 * Division of labor: loaders own the FIRST frame (they resolve before a
 * navigation commits, so pages never mount against empty live queries),
 * Dexie liveQuery owns every update after mount. Loader results reach the
 * hooks through their optional `initial` parameters.
 */
import { data, type LoaderFunctionArgs } from "react-router"

import { awaitBootReady } from "@/store/app-store"
import {
  fetchGoalDetailSource,
  fetchGoalTaskHierarchySource,
  fetchTaskDetailSource,
  type GoalTaskHierarchySource,
  type TaskDetailSource,
} from "@/hooks/use-entities"
import { fetchDayRunRows } from "@/hooks/use-day-runs"
import {
  fetchListPagesSnapshot,
  type ListPagesSnapshot,
} from "@/hooks/use-page-view-models"
import type { DayRunEntity } from "@/domain/entities/TaskRuntimeEntity"
import type { GoalID, TaskID } from "@/domain/value-objects/types"

/**
 * Shared by every bootstrapped route (main app + auth callbacks). Idempotent:
 * concurrent loaders and later navigations all await the same promise, which
 * is already resolved after the first load. Doc routes have no loader, so a
 * tab opened straight into /doc never bootstraps (they're pure static pages).
 */
export async function bootLoader() {
  await awaitBootReady()
  return null
}

/**
 * Main layout: waits for app bootstrap (splash handled by the router's
 * HydrateFallback), then prefetches the sidebar hierarchy so its groups render
 * against real data from the very first paint — no `loaded` flag holds the
 * groups back, and the first-load layout shift is avoided.
 */
export async function mainLayoutLoader(): Promise<GoalTaskHierarchySource> {
  await awaitBootReady()
  return fetchGoalTaskHierarchySource()
}

/**
 * Shared by the four list pages (Home / Tasks / AllTasks / MyGoals). Every
 * navigation between them remounts the page and re-creates its live queries,
 * whose first emission is asynchronous — without this snapshot each switch
 * visibly rendered empty lists for a frame before the data arrived. All reads
 * are local Dexie queries (milliseconds), so blocking the navigation on them
 * is imperceptible.
 */
export async function listPagesLoader(): Promise<ListPagesSnapshot> {
  await awaitBootReady()
  return fetchListPagesSnapshot()
}

/**
 * Goal detail: resolves the goal's data BEFORE the navigation commits, so the
 * page never renders a loading placeholder — the router keeps the previous
 * page visible until this settles. A missing goal becomes a 404 handled by
 * the route's ErrorBoundary instead of an in-page "not found" flash.
 */
export async function goalDetailLoader({ params }: LoaderFunctionArgs) {
  await awaitBootReady()
  const source = await fetchGoalDetailSource(params.id as GoalID | undefined)
  if (!source.goal) {
    throw data(null, { status: 404 })
  }
  return source
}

export type TaskDetailLoaderData = {
  source: TaskDetailSource
  dayRuns: DayRunEntity[]
}

/**
 * Task detail: resolves the task's data (and the dayRuns first frame for the
 * completion control) BEFORE the navigation commits — the router keeps the
 * previous page visible until this settles, so no blank/skeleton frame. A
 * missing task becomes a 404 handled by the route's ErrorBoundary.
 */
export async function taskDetailLoader({
  params,
}: LoaderFunctionArgs): Promise<TaskDetailLoaderData> {
  await awaitBootReady()
  const [source, dayRuns] = await Promise.all([
    fetchTaskDetailSource(params.id as TaskID | undefined),
    fetchDayRunRows(),
  ])
  if (!source.task) {
    throw data(null, { status: 404 })
  }
  return { source, dayRuns }
}
