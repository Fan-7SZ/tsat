import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useLanguage } from "@/components/shared/language-provider"

interface ChecklistDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  steps: { id: string; title: string; done: boolean }[]
  onConfirm: () => void
  /**
   * Called on every toggle with the full list of completed step ids, so the
   * dialog's per-step changes write straight back to the runtime progress.
   */
  onStepsChange?: (completedStepIds: string[]) => void
}

export function ChecklistDialog({
  open,
  onOpenChange,
  steps,
  onConfirm,
  onStepsChange,
}: ChecklistDialogProps) {
  const [checked, setChecked] = useState<boolean[]>(() =>
    steps.map((s) => s.done)
  )
  const [wasOpen, setWasOpen] = useState(open)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setChecked(steps.map((s) => s.done))
    }
  }

  const { t } = useLanguage()
  const allChecked: boolean = checked.length > 0 && checked.every(Boolean)

  const toggle = (index: number) => {
    setChecked((prev) => {
      const next = [...prev]
      next[index] = !next[index]
      // Mirror the full completed set back to the runtime progress.
      onStepsChange?.(steps.filter((_, i) => next[i]).map((s) => s.id))
      return next
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle>{t.checklist.title}</DialogTitle>
          <DialogDescription>{t.checklist.description}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[50vh] sm:max-h-[40vh]">
          <div className="flex flex-col gap-1 p-4">
            {steps.map((step, index) => (
              <label
                key={index}
                className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors hover:bg-accent"
              >
                <Checkbox
                  checked={checked[index] ?? false}
                  onCheckedChange={() => toggle(index)}
                />
                <span className="paragraph-small">{step.title}</span>
              </label>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter className="p-4 pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.common.cancel}
          </Button>
          {/* submit button is disabled until all steps are checked */}
          <Button
            data-testid="checklist-confirm"
            disabled={!allChecked}
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            {t.checklist.confirmDone}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
