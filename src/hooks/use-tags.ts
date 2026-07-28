import { useMemo } from "react"
import { useLiveQuery } from "dexie-react-hooks"

import type { TagDefinition } from "@/domain/entities/TagDefinition"
import type { TagID } from "@/domain/value-objects/types"
import { queryAllTags } from "@/persistence/repository"

export function useAllTags(): TagDefinition[] {
  return useLiveQuery(() => queryAllTags(), []) ?? []
}

export function useTagMap(): Record<TagID, TagDefinition> {
  const tags = useAllTags()

  return useMemo(
    () =>
      Object.fromEntries(tags.map((tag) => [tag.id, tag])) as Record<
        TagID,
        TagDefinition
      >,
    [tags]
  )
}
