import { Checkbox } from "@/components/ui/checkbox"
import { Item, ItemTitle } from "@/components/ui/item"
interface TaskStepItemProps {
  id: string
  title: string
  done: boolean
  showCheckbox?: boolean
  onToggleDone?: (id: string) => void
}

export function TaskStepItem({
  id,
  title,
  done,
  showCheckbox,
  onToggleDone,
}: TaskStepItemProps) {
  return (
    <Item variant="outline" className="flex-nowrap" size="xs" id={id}>
      {showCheckbox && (
        <Checkbox
          checked={done}
          onCheckedChange={onToggleDone ? () => onToggleDone(id) : undefined}
          aria-label={`Mark step "${title}" as ${done ? "not done" : "done"}`}
        />
      )}
      <ItemTitle>{title}</ItemTitle>
    </Item>
  )
}
