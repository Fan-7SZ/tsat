import { useRef, useState, useEffect } from "react"

export function InLineSwitchEditor({
  view,
  edit,
  className,
  onStatusChange,
}: {
  view: React.ReactNode
  edit: React.ReactNode
  className?: string
  onStatusChange?: (by: "blur" | "enter" | "escape" | "doubleClick") => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)

  const [isEditing, setIsEditing] = useState(false)
  useEffect(() => {
    if (!isEditing) return
    const root = rootRef.current
    if (!root) return
    const focusable = root.querySelector<HTMLElement>(
      "input, textarea, [tabindex]"
    )
    focusable?.focus()
  }, [isEditing])

  const handleDoubleClick = () => {
    setIsEditing(true)
    onStatusChange?.("doubleClick")
  }
  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!isEditing) return

    const nextFocused = e.relatedTarget as Node | null
    const root = rootRef.current

    if (root && nextFocused && root.contains(nextFocused)) return

    setIsEditing(false)
    onStatusChange?.("blur")
  }
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isEditing) return
    if (e.nativeEvent.isComposing) return
    if (e.key === "Enter") {
      setIsEditing(false)
      onStatusChange?.("enter")
      return
    }
    if (e.key === "Escape") {
      setIsEditing(false)
      onStatusChange?.("escape")
      return
    }
  }

  return (
    <div
      className={className}
      onDoubleClick={handleDoubleClick}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      ref={rootRef}
    >
      {isEditing ? edit : view}
    </div>
  )
}
