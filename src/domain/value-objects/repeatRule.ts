type ActiveRepeatRule =
  | { mode: "daily"; interval: number }
  | { mode: "weekly"; interval: number; daysOfWeek: number[] }

export type { ActiveRepeatRule }
