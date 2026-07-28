import type { TagDefinition } from "./TagDefinition"

// Icon and color choices deliberately avoid the app chrome's vocabulary:
// Sparkles (AI actions), Flag (nav / due markers), Focus & Star (goal focus),
// Repeat / BellElectric (scheduling), and violet (AI accent) are all taken.
export const PRESET_TAGS: TagDefinition[] = [
  {
    id: "tag-daily",
    name: "Daily",
    color: "#F0C000",
    iconKey: "Sun",
    kind: "preset",
  },
  {
    id: "tag-focus",
    name: "Focus",
    color: "#0088FF",
    iconKey: "Target",
    kind: "preset",
  },
  {
    id: "tag-urgent",
    name: "Urgent",
    color: "#FF4142",
    iconKey: "CircleAlert",
    kind: "preset",
  },
  {
    id: "tag-habit",
    name: "Habit",
    color: "#2EA74A",
    iconKey: "Leaf",
    kind: "preset",
  },
  {
    id: "tag-milestone",
    name: "Milestone",
    color: "#F57F0D",
    iconKey: "Trophy",
    kind: "preset",
  },
]
