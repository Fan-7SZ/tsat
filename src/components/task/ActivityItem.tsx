import { Link } from "react-router"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item"
import type { ActivityKind } from "@/domain/entities/ActivityEntity"
import type { TaskID } from "@/domain/value-objects/types"
import { useLanguage } from "@/components/shared/language-provider"

interface ActivityItemProps {
  kind: ActivityKind
  taskId: TaskID
  taskTitle: string
  recordedAt: string
}

export function ActivityItem({
  kind,
  taskId,
  taskTitle,
  recordedAt,
}: ActivityItemProps) {
  const { t } = useLanguage()
  const kindLabel: Record<ActivityKind, string> = {
    "task-done": t.activity.completed,
    "task-in-progress": t.activity.added,
    "repeat-skip": t.activity.skipped,
  }
  return (
    <Item
      variant="outline"
      size="sm"
      className="cursor-pointer hover:bg-accent"
    >
      <ItemContent>
        <ItemTitle>
          {kindLabel[kind]}{" "}
          <Link
            to={`/tasks/${taskId}`}
            className="text-primary underline-offset-2 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {taskTitle}
          </Link>
        </ItemTitle>
      </ItemContent>
      <ItemDescription className="ml-auto">{recordedAt}</ItemDescription>
    </Item>
  )
}
