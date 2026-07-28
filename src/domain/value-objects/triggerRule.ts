export type triggerRule =
  | { mode: "daily"; interval: number }
  | { mode: "weekly"; interval: number; daysOfWeek: number[] }
  | { mode: "monthly"; dayOfMonth: number }
  | { mode: "custom"; date: Date[] }
