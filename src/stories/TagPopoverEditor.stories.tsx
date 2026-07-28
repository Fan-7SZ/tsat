import type { Meta, StoryObj } from "@storybook/react-vite"
import { Tag } from "lucide-react"
import { userEvent, within } from "storybook/test"

import { TagPopoverEditor, TagIcon } from "@/components/goal/TagPopoverEditor"
import { Button } from "@/components/ui/button"
import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TagDefinition } from "@/domain/entities/TagDefinition"
import type { GoalID, TagID } from "@/domain/value-objects/types"
import { db } from "@/persistence/db"
import { usePreparedStoryDb } from "@/stories/usePreparedStoryDb"

const GOAL_ID = "goal-tag-editor" as GoalID

const sampleGoal: GoalEntity = {
  id: GOAL_ID,
  title: "Tagged goal",
  createdAt: new Date(),
}

const presetUrgent: TagDefinition = {
  id: "tag-story-urgent" as TagID,
  name: "Urgent",
  color: "#ef4444",
  iconKey: "Flame",
  kind: "preset",
}

const presetImportant: TagDefinition = {
  id: "tag-story-important" as TagID,
  name: "Important",
  color: "#f59e0b",
  iconKey: "Star",
  kind: "preset",
}

const customReading: TagDefinition = {
  id: "tag-story-reading" as TagID,
  name: "Reading",
  color: "#14b8a6",
  iconKey: "BookOpen",
  kind: "custom",
}

const sampleTags = [presetUrgent, presetImportant, customReading]

async function setup() {
  await db.goals.put(sampleGoal)
  await db.tags.bulkPut(sampleTags)
}

async function teardown() {
  await db.goals.delete(sampleGoal.id)
  await db.tags.bulkDelete(sampleTags.map((tag) => tag.id))
}

function Harness({ tagMeta }: { tagMeta?: TagDefinition }) {
  const ready = usePreparedStoryDb(setup, teardown)
  if (!ready) return null

  return (
    <div className="p-6">
      <TagPopoverEditor
        goalId={GOAL_ID}
        tagMeta={tagMeta}
        align="start"
        trigger={
          <Button variant="outline" size="sm" className="gap-1.5">
            {tagMeta ? (
              <>
                <TagIcon iconKey={tagMeta.iconKey} />
                {tagMeta.name}
              </>
            ) : (
              <>
                <Tag className="size-3.5" />
                Add tag
              </>
            )}
          </Button>
        }
      />
    </div>
  )
}

const openEditor = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement)
  await userEvent.click(await canvas.findByRole("button"))
  const body = within(canvasElement.ownerDocument.body)
  // Seeded preset tag rendered inside the popover panel.
  await body.findByText("Urgent")
}

const meta = {
  title: "Goal/TagPopoverEditor",
  parameters: {
    layout: "centered",
    docs: { story: { inline: false, iframeHeight: 560 } },
  },
  tags: ["autodocs"],
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** Untagged goal — the trigger shows the "add tag" affordance. */
export const Untagged: Story = {
  render: () => <Harness />,
}

/** Goal already bound to a preset tag — trigger reflects icon + name. */
export const WithSelectedTag: Story = {
  render: () => <Harness tagMeta={presetUrgent} />,
}

/**
 * Editor open: preset and custom tag sections, the custom-tag creator (color,
 * name, icon grid) and the clear-tag action.
 */
export const EditorOpen: Story = {
  render: () => <Harness />,
  play: ({ canvasElement }) => openEditor(canvasElement),
}

/** Editor open with the current tag highlighted in its section. */
export const EditorOpenWithSelection: Story = {
  render: () => <Harness tagMeta={customReading} />,
  play: ({ canvasElement }) => openEditor(canvasElement),
}
