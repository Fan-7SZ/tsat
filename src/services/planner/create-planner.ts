import { DefaultPlannerService } from "./default-planner"

/**
 * Returns the concrete `DefaultPlannerService` (not the `PlannerService`
 * interface)
 */
export function createPlannerService(): DefaultPlannerService {
  return new DefaultPlannerService()
}
