import { useLanguage } from "@/components/shared/language-provider"

export function RepeatPeriodLegend() {
  const { t } = useLanguage()
  const legendItems = [
    {
      label: t.repeatLegend.currentPeriod,
      markerClassName: "bg-primary",
    },
    {
      label: t.repeatLegend.ancestorPeriod,
      markerClassName: "bg-amber-200 dark:bg-amber-950/60",
    },
    {
      label: t.repeatLegend.plannedDates,
      markerClassName: "border border-primary/70 bg-background",
    },
  ] as const
  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <div className="flex w-full flex-col gap-2">
        {legendItems.map((item) => (
          <span
            key={item.label}
            className="inline-flex items-center gap-2 paragraph-mini text-muted-foreground"
          >
            <span
              className={`size-2.5 shrink-0 rounded-full ${item.markerClassName}`}
            />
            <span>{item.label}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
