import { z } from "zod"

/** A "YYYY-MM-DD" string representing a calendar day in the user's local timezone. */
export const LocalDateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date key, expected YYYY-MM-DD")
  .brand<"LocalDateKey">()

export type LocalDateKey = z.infer<typeof LocalDateKeySchema>
