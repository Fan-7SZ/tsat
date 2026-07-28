/**
 * Soft status tones, shared by the task-detail badges and the completion button
 * so a status reads the same whatever renders it: an accent border over a washed
 * accent fill, with the accent itself carrying the text. This replaces the older
 * solid-fill-plus-white-text treatment, which shouted louder than the content it
 * was annotating.
 *
 * Pair with `variant="outline"` on Badge / Button — these override its border,
 * background and text colour.
 */
export type StatusTone = "amber" | "green"

export const STATUS_TONE: Record<StatusTone, string> = {
  amber:
    "border-amber-600/30 bg-amber-500/10 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-400",
  green:
    "border-green-600/30 bg-green-600/10 text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-400",
}

/** Interactive variant of the tone; for buttons, which need a hover state. */
export const STATUS_TONE_HOVER: Record<StatusTone, string> = {
  amber: "hover:bg-amber-500/20 hover:text-amber-800 dark:hover:bg-amber-400/20",
  green: "hover:bg-green-600/20 hover:text-green-800 dark:hover:bg-green-500/20",
}
