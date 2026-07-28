import type { TagDefinition } from "@/domain/entities/TagDefinition"
import type { GoalID, TagID } from "@/domain/value-objects/types"
import {
  deleteTagAndUnbindGoals,
  patchGoal,
  putTag,
} from "@/persistence/repository"

export async function createTag(tag: TagDefinition): Promise<TagDefinition> {
  await putTag(tag)
  return tag
}

/**
 * Delete a custom tag and clear it from any goals currently bound to it.
 */
export async function deleteCustomTag(tagId: TagID): Promise<void> {
  await deleteTagAndUnbindGoals(tagId)
}

export async function assignGoalTag(goalId: GoalID, tagId: TagID) {
  const updatedCount = await patchGoal(goalId, { tagId })
  if (updatedCount === 0) {
    throw new Error(`Goal ${goalId} was not found`)
  }
}

export async function clearGoalTag(goalId: GoalID) {
  const updatedCount = await patchGoal(goalId, { tagId: undefined })
  if (updatedCount === 0) {
    throw new Error(`Goal ${goalId} was not found`)
  }
}
