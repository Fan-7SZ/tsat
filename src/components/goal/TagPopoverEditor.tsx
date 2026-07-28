import { cloneElement, useRef, useState } from "react"
import { toast } from "sonner"
import {
  CircleAlert,
  Flag,
  Flame,
  Sparkles,
  Tag,
  Star,
  Heart,
  Zap,
  Trophy,
  Target,
  Bookmark,
  Clock,
  Calendar,
  Sun,
  Moon,
  Cloud,
  Umbrella,
  Music,
  Camera,
  Gift,
  Rocket,
  Compass,
  Anchor,
  Shield,
  Crown,
  Diamond,
  Gem,
  Lightbulb,
  Puzzle,
  Palette,
  Pen,
  BookOpen,
  GraduationCap,
  Brain,
  Dumbbell,
  Bike,
  Mountain,
  TreePine,
  Leaf,
  Flower2,
  Apple,
  Coffee,
  Utensils,
  Home,
  Building,
  Plane,
  Car,
  Globe,
  Map,
  Users,
  Baby,
  Dog,
  Cat,
  Bug,
  Smile,
  PartyPopper,
  Megaphone,
  Bell,
  Mail,
  Phone,
  Wallet,
  Banknote,
  ShoppingCart,
  Wrench,
  Code,
  Trash2,
} from "lucide-react"
import type { LucideProps } from "lucide-react"
import type { ComponentType, MouseEventHandler, ReactElement } from "react"

import type { TagDefinition, TagIconKey } from "@/domain/entities/TagDefinition"
import type { GoalID, TagID } from "@/domain/value-objects/types"
import {
  assignGoalTag,
  clearGoalTag,
  createTag,
  deleteCustomTag,
} from "@/commands/tag.commands"
import { useAllTags } from "@/hooks/use-tags"
import { useLanguage } from "@/components/shared/language-provider"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const ICON_MAP: Record<TagIconKey, ComponentType<LucideProps>> = {
  Tag,
  Flag,
  Flame,
  CircleAlert,
  Sparkles,
  Star,
  Heart,
  Zap,
  Trophy,
  Target,
  Bookmark,
  Clock,
  Calendar,
  Sun,
  Moon,
  Cloud,
  Umbrella,
  Music,
  Camera,
  Gift,
  Rocket,
  Compass,
  Anchor,
  Shield,
  Crown,
  Diamond,
  Gem,
  Lightbulb,
  Puzzle,
  Palette,
  Pen,
  BookOpen,
  GraduationCap,
  Brain,
  Dumbbell,
  Bike,
  Mountain,
  TreePine,
  Leaf,
  Flower2,
  Apple,
  Coffee,
  Utensils,
  Home,
  Building,
  Plane,
  Car,
  Globe,
  Map,
  Users,
  Baby,
  Dog,
  Cat,
  Bug,
  Smile,
  PartyPopper,
  Megaphone,
  Bell,
  Mail,
  Phone,
  Wallet,
  Banknote,
  ShoppingCart,
  Wrench,
  Code,
}

const ICON_KEYS = Object.keys(ICON_MAP) as TagIconKey[]

export function TagIcon({
  iconKey,
  className,
}: {
  iconKey: TagIconKey
  className?: string
}) {
  const Icon = ICON_MAP[iconKey] ?? Tag
  return <Icon className={className ?? "size-3.5"} />
}

const LONG_PRESS_MS = 500

/**
 * A custom-tag chip. Long-pressing it reveals a trash badge in the top-right
 * corner (via `showDelete`) so the tag can be deleted. The long-press is
 * detected with pointer events (works for touch and mouse) and suppresses the
 * click that would otherwise select the tag.
 */
function CustomTagButton({
  tag,
  selected,
  showDelete,
  onSelect,
  onLongPress,
  onDelete,
  deleteLabel,
}: {
  tag: TagDefinition
  selected: boolean
  showDelete: boolean
  onSelect: () => void
  onLongPress: () => void
  onDelete: () => void
  deleteLabel: string
}) {
  const timerRef = useRef<number | null>(null)
  const longPressedRef = useRef(false)

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const startTimer = () => {
    longPressedRef.current = false
    clearTimer()
    timerRef.current = window.setTimeout(() => {
      longPressedRef.current = true
      onLongPress()
    }, LONG_PRESS_MS)
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant={selected ? "default" : "outline"}
        size="sm"
        className="h-7 gap-1 px-2"
        style={
          selected
            ? { backgroundColor: tag.color, borderColor: tag.color }
            : undefined
        }
        onPointerDown={startTimer}
        onPointerUp={clearTimer}
        onPointerLeave={clearTimer}
        onClick={(event) => {
          if (longPressedRef.current) {
            // Keep this click from bubbling to the panel's dismiss handler,
            // which would hide the just-revealed trash badge.
            event.preventDefault()
            event.stopPropagation()
            longPressedRef.current = false
            return
          }
          onSelect()
        }}
      >
        <TagIcon iconKey={tag.iconKey} />
        {tag.name}
      </Button>
      {showDelete && (
        <button
          type="button"
          aria-label={deleteLabel}
          className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-white shadow-sm"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onDelete()
          }}
        >
          <Trash2 className="size-2.5" />
        </button>
      )}
    </div>
  )
}

interface TagPopoverEditorProps {
  goalId: GoalID
  tagMeta: TagDefinition | undefined
  /** The trigger element — PopoverTrigger props will be merged onto it */
  trigger: ReactElement<{
    onClick?: MouseEventHandler<HTMLElement>
    onMouseDown?: MouseEventHandler<HTMLElement>
  }>
  align?: "start" | "center" | "end"
  /**
   * Set to true when the trigger is inside a <Link>, so click events are
   * intercepted to prevent navigation.
   */
  interceptLinkClick?: boolean
}

export function TagPopoverEditor({
  goalId,
  tagMeta,
  trigger,
  align = "end",
  interceptLinkClick = false,
}: TagPopoverEditorProps) {
  const allTags = useAllTags()

  const [editorOpen, setEditorOpen] = useState(false)
  const [customTagName, setCustomTagName] = useState("")
  const [customTagColor, setCustomTagColor] = useState("#14b8a6")
  const [customTagIcon, setCustomTagIcon] = useState<TagIconKey>("Tag")
  const [deleteTagId, setDeleteTagId] = useState<TagID | null>(null)
  const { t } = useLanguage()

  const presetTags = allTags.filter((tag) => tag.kind === "preset")
  const customTags = allTags.filter((tag) => tag.kind === "custom")

  const mergeInterceptHandler = (
    handler?: MouseEventHandler<HTMLElement>
  ): MouseEventHandler<HTMLElement> | undefined => {
    if (!interceptLinkClick) {
      return handler
    }

    return (event) => {
      event.preventDefault()
      event.stopPropagation()
      handler?.(event)
    }
  }

  const triggerElement = cloneElement(trigger, {
    onClick: mergeInterceptHandler(trigger.props.onClick),
    onMouseDown: mergeInterceptHandler(trigger.props.onMouseDown),
  })

  const selectTag = async (tagId: TagID | undefined) => {
    try {
      if (tagId) {
        await assignGoalTag(goalId, tagId)
      } else {
        await clearGoalTag(goalId)
      }

      toast.success(t.tagEditor.tagUpdated)
      setEditorOpen(false)
    } catch {
      toast.error(t.tagEditor.tagUpdateFailed)
    }
  }

  const createCustomTag = async () => {
    const normalizedName = customTagName.trim()
    if (!normalizedName) return

    const nextId = `tag-${crypto.randomUUID()}` as TagID
    const nextTag: TagDefinition = {
      id: nextId,
      name: normalizedName,
      color: customTagColor,
      iconKey: customTagIcon,
      kind: "custom",
    }

    try {
      await createTag(nextTag)
      await selectTag(nextId)
      setCustomTagName("")
    } catch {
      toast.error(t.tagEditor.tagCreateFailed)
    }
  }

  const handleDeleteCustomTag = async (tagId: TagID) => {
    try {
      // Also clears this tag from any goals bound to it (handled atomically in
      // the command/repository layer).
      await deleteCustomTag(tagId)
      toast.success(t.tagEditor.tagDeleted)
    } catch {
      toast.error(t.tagEditor.tagDeleteFailed)
    } finally {
      setDeleteTagId(null)
    }
  }

  return (
    <Popover
      open={editorOpen}
      onOpenChange={(open) => {
        setEditorOpen(open)
        if (!open) setDeleteTagId(null)
      }}
    >
      <PopoverTrigger asChild>{triggerElement}</PopoverTrigger>
      <PopoverContent align={align} className="w-72 p-0">
        <Card className="border-0 shadow-none">
          <CardContent
            className="flex flex-col gap-2 p-2"
            // Clicking anywhere else in the panel dismisses the delete badge.
            // The tag's own long-press click and the trash button both
            // stopPropagation, so they don't trigger this.
            onClick={() => {
              if (deleteTagId) setDeleteTagId(null)
            }}
          >
            <div className="flex flex-col gap-2">
              {presetTags.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p className="paragraph-small-medium text-muted-foreground">
                    {t.tagEditor.preset}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {presetTags.map((tag) => (
                      <Button
                        key={tag.id}
                        type="button"
                        variant={tagMeta?.id === tag.id ? "default" : "outline"}
                        size="sm"
                        className="h-7 gap-1 px-2"
                        style={
                          tagMeta?.id === tag.id
                            ? {
                                backgroundColor: tag.color,
                                borderColor: tag.color,
                              }
                            : undefined
                        }
                        onClick={() => void selectTag(tag.id)}
                      >
                        <TagIcon iconKey={tag.iconKey} />
                        {tag.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {customTags.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p className="paragraph-small-medium text-muted-foreground">
                    {t.tagEditor.custom}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {customTags.map((tag) => (
                      <CustomTagButton
                        key={tag.id}
                        tag={tag}
                        selected={tagMeta?.id === tag.id}
                        showDelete={deleteTagId === tag.id}
                        onSelect={() => void selectTag(tag.id)}
                        onLongPress={() => setDeleteTagId(tag.id)}
                        onDelete={() => void handleDeleteCustomTag(tag.id)}
                        deleteLabel={t.tagEditor.deleteTagLabel}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <p className="paragraph-small-medium text-muted-foreground">
                {t.tagEditor.custom}
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  value={customTagColor}
                  onChange={(event) => setCustomTagColor(event.target.value)}
                  className="h-8 w-12 p-1"
                />
                <Input
                  value={customTagName}
                  onChange={(event) => setCustomTagName(event.target.value)}
                  placeholder={t.tagEditor.tagNamePlaceholder}
                  className="h-8 flex-1"
                />
              </div>
              <ScrollArea className="h-48 w-full">
                <div className="grid grid-cols-6 gap-1 pr-2">
                  {ICON_KEYS.map((iconKey) => (
                    <button
                      key={iconKey}
                      type="button"
                      className={cn(
                        "flex items-center justify-center rounded-md p-1.5 transition-colors hover:bg-accent",
                        customTagIcon === iconKey &&
                          "bg-primary text-primary-foreground hover:bg-primary/90"
                      )}
                      onClick={() => setCustomTagIcon(iconKey)}
                    >
                      <TagIcon iconKey={iconKey} className="size-4" />
                    </button>
                  ))}
                </div>
              </ScrollArea>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void createCustomTag()}
                disabled={!customTagName.trim()}
              >
                {t.tagEditor.addCustomTag}
              </Button>
            </div>

            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={() => void selectTag(undefined)}
            >
              {t.tagEditor.clearTag}
            </Button>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  )
}
