import { useEffect, useMemo } from "react"

import { deleteGoal } from "@/commands/goal.commands"
import { PageHeader } from "@/components/shared/PageHeader"
import { ButtonGroup } from "@/components/ui/button-group"
import { ChevronLeft, ChevronRight, Trash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAppNavigation } from "@/hooks/use-app-navigation"
import { SquareMousePointer, Plus } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { GoalItem } from "@/components/goal/GoalItem"
import { GoalContextMenu } from "@/components/contextMenus/GoalContextMenu"
import { Checkbox } from "@/components/ui/checkbox"
import { FocusQuotaView } from "@/components/goal/FocusQuotaView"
import { useMyGoalsPageVM } from "@/hooks/use-page-view-models"
import { useTagMap } from "@/hooks/use-tags"
import { useLanguage } from "@/components/shared/language-provider"
import { useMyGoalsPageStore } from "@/store/pages/my-goals-page.store"
import { useLoaderData, useSearchParams } from "react-router"
import type { ListPagesSnapshot } from "@/hooks/use-page-view-models"
import { CreateGoalGuidanceDialog } from "@/components/dialogs/CreateGoalGuidanceDialog"
import { ConfirmDeleteDialog } from "@/components/dialogs/ConfirmDeleteDialog"

type MyGoalsTab = "inProgress" | "done"

export function MyGoals() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initial = useLoaderData<ListPagesSnapshot>()
  const mygoalsPageVM = useMyGoalsPageVM(initial)
  const isCreateGoalOpen = useMyGoalsPageStore(
    (state) => state.isCreateGoalOpen
  )
  const isSelectMode = useMyGoalsPageStore((state) => state.isSelectMode)
  const selectedGoalIds = useMyGoalsPageStore((state) => state.selectedGoalIds)
  const isDeleteOpen = useMyGoalsPageStore((state) => state.isDeleteOpen)
  const setCreateGoalOpen = useMyGoalsPageStore(
    (state) => state.setCreateGoalOpen
  )
  const enterSelectMode = useMyGoalsPageStore((state) => state.enterSelectMode)
  const exitSelectMode = useMyGoalsPageStore((state) => state.exitSelectMode)
  const toggleGoalSelection = useMyGoalsPageStore(
    (state) => state.toggleGoalSelection
  )
  const syncSelectableGoalIds = useMyGoalsPageStore(
    (state) => state.syncSelectableGoalIds
  )
  const setDeleteOpen = useMyGoalsPageStore((state) => state.setDeleteOpen)
  const resetUiState = useMyGoalsPageStore((state) => state.resetUiState)
  const tagsById = useTagMap()
  const { t } = useLanguage()
  const rawTab = searchParams.get("tab")
  const activeTab: MyGoalsTab = rawTab === "done" ? "done" : "inProgress"

  useEffect(
    () => () => {
      resetUiState()
    },
    [resetUiState]
  )

  const selectedGoalIdSet = useMemo(
    () => new Set(selectedGoalIds),
    [selectedGoalIds]
  )
  const selectableGoalIdList = useMemo(
    () =>
      [...mygoalsPageVM.inProgress, ...mygoalsPageVM.done]
        .filter((item) => item.isForced !== true)
        .map((item) => item.goal.id),
    [mygoalsPageVM.done, mygoalsPageVM.inProgress]
  )
  const selectableGoalIds = useMemo(
    () => new Set(selectableGoalIdList),
    [selectableGoalIdList]
  )

  useEffect(() => {
    syncSelectableGoalIds(selectableGoalIdList)
  }, [selectableGoalIdList, syncSelectableGoalIds])

  const handleDeleteSelected = () => {
    setDeleteOpen(true)
  }

  const confirmDeleteSelected = async () => {
    const selectableSelectedIds = selectedGoalIds.filter((id) =>
      selectableGoalIds.has(id)
    )

    for (const id of selectableSelectedIds) {
      await deleteGoal(id, t.commands.goalDeleteFailed)
    }
    setDeleteOpen(false)
    exitSelectMode()
  }

  const inProgressGoalItems = (mygoalsPageVM.inProgress || []).map((item) => {
    const isSelectable = item.isForced !== true
    const goalEl = (
      <GoalItem
        data-testid={`goal-${item.goal.id}`}
        title={item.goal.title}
        tasksCount={[item.completedCount, item.totalCount]}
        id={item.goal.id}
        tagMeta={item.goal.tagId ? tagsById[item.goal.tagId] : undefined}
        isFocused={item.isFocused}
        dueLabel={item.isFocused ? item.dueLabel : undefined}
        leading={
          isSelectMode ? (
            <Checkbox
              checked={isSelectable && selectedGoalIdSet.has(item.goal.id)}
              disabled={!isSelectable}
              className={
                isSelectable
                  ? "cursor-pointer"
                  : "cursor-not-allowed opacity-50"
              }
            />
          ) : undefined
        }
        onClick={
          isSelectMode
            ? (e) => {
                e.preventDefault()
                toggleGoalSelection(item.goal.id, isSelectable)
              }
            : undefined
        }
      />
    )

    if (isSelectMode) {
      return <div key={item.goal.id}>{goalEl}</div>
    }

    return (
      <GoalContextMenu
        key={item.goal.id}
        goalId={item.goal.id}
        goalTitle={item.goal.title}
        isFocused={item.isFocused}
        isDone={item.isDone}
        isForced={item.isForced}
        focusStatuses={item.focusStatuses}
      >
        {goalEl}
      </GoalContextMenu>
    )
  })

  const doneGoalItems = (mygoalsPageVM.done || []).map((item) => {
    const isSelectable = item.isForced !== true
    const goalEl = (
      // Done goals render badge-free (no focused/unfocused or due badge) for a
      // cleaner list — omit isFocused/dueLabel so GoalItem hides the badge row.
      <GoalItem
        data-testid={`goal-${item.goal.id}`}
        title={item.goal.title}
        tasksCount={[item.completedCount, item.totalCount]}
        id={item.goal.id}
        tagMeta={item.goal.tagId ? tagsById[item.goal.tagId] : undefined}
        leading={
          isSelectMode ? (
            <Checkbox
              checked={isSelectable && selectedGoalIdSet.has(item.goal.id)}
              disabled={!isSelectable}
              className={
                isSelectable
                  ? "cursor-pointer"
                  : "cursor-not-allowed opacity-50"
              }
            />
          ) : undefined
        }
        onClick={
          isSelectMode
            ? (e) => {
                e.preventDefault()
                toggleGoalSelection(item.goal.id, isSelectable)
              }
            : undefined
        }
      />
    )

    if (isSelectMode) {
      return <div key={item.goal.id}>{goalEl}</div>
    }

    return (
      <GoalContextMenu
        key={item.goal.id}
        goalId={item.goal.id}
        goalTitle={item.goal.title}
        isFocused={item.isFocused}
        isDone={item.isDone}
        isForced={item.isForced}
        focusStatuses={item.focusStatuses}
      >
        {goalEl}
      </GoalContextMenu>
    )
  })
  return (
    <div className="flex min-h-full flex-col lg:h-full lg:min-h-0">
      <CreateGoalGuidanceDialog
        open={isCreateGoalOpen}
        onOpenChange={setCreateGoalOpen}
      />
      <ConfirmDeleteDialog
        open={isDeleteOpen}
        onOpenChange={setDeleteOpen}
        title={t.myGoals.deleteGoalsTitle(selectedGoalIds.length)}
        description={t.myGoals.deleteGoalsDescription}
        onConfirm={() => {
          void confirmDeleteSelected()
        }}
      />
      <PageHeader>
        <Header
          isSelectMode={isSelectMode}
          selectedCount={selectedGoalIds.length}
          onEnterSelect={enterSelectMode}
          onCancelSelect={exitSelectMode}
          onDeleteSelected={handleDeleteSelected}
          onOpenCreateGoal={() => setCreateGoalOpen(true)}
          focusQuota={mygoalsPageVM.focusQuota}
        />
      </PageHeader>
      <div className="flex min-h-0 flex-1 flex-col py-2">
        <Tabs
          value={activeTab}
          onValueChange={(nextTab) => {
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev)
              if (nextTab === "inProgress") {
                next.delete("tab")
              } else {
                next.set("tab", nextTab)
              }
              return next
            })
          }}
          className="flex min-h-0 w-full flex-1 flex-col"
        >
          <TabsList className="mx-auto w-50 shrink-0 shadow-sm">
            <TabsTrigger value="inProgress">{t.myGoals.inProgress}</TabsTrigger>
            <TabsTrigger value="done">{t.myGoals.done}</TabsTrigger>
          </TabsList>

          <TabsContent value="inProgress" className="min-h-0 flex-1">
            {inProgressGoalItems.length > 0 ? (
              <ScrollArea className="h-full px-4">
                <div className="flex flex-col gap-2 pb-2">
                  {inProgressGoalItems}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex h-full items-center justify-center px-4">
                <p className="heading-4 text-center text-muted-foreground">
                  {t.myGoals.noGoalsInProgress}
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="done" className="min-h-0 flex-1">
            {doneGoalItems.length > 0 ? (
              <ScrollArea className="h-full px-4">
                <div className="flex flex-col gap-2 pb-2">{doneGoalItems}</div>
              </ScrollArea>
            ) : (
              <div className="flex h-full items-center justify-center px-4">
                <p className="heading-4 text-center text-muted-foreground">
                  {t.myGoals.noGoalsDone}
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function Header({
  isSelectMode,
  selectedCount,
  onEnterSelect,
  onCancelSelect,
  onDeleteSelected,
  onOpenCreateGoal,
  focusQuota,
}: {
  isSelectMode: boolean
  selectedCount: number
  onEnterSelect: () => void
  onCancelSelect: () => void
  onDeleteSelected: () => void
  onOpenCreateGoal: () => void
  focusQuota: import("@/domain/view-models/HomePageVM").FocusQuotaVM
}) {
  const { goBack, goForward, canGoBack, canGoForward } = useAppNavigation()
  const { t } = useLanguage()
  return (
    <div className="flex w-full items-center px-4">
      <div className="flex items-center gap-2">
        {/* Button Group */}
        <ButtonGroup className="hidden sm:flex">
          <Button
            variant="outline"
            size="lg"
            disabled={!canGoBack}
            onClick={goBack}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="lg"
            disabled={!canGoForward}
            onClick={goForward}
          >
            <ChevronRight />
          </Button>
        </ButtonGroup>
        {/* Page Title */}
        <span className="paragraph-regular">{t.myGoals.title}</span>
        <FocusQuotaView {...focusQuota} />
      </div>

      <div className="ml-auto flex gap-1">
        {isSelectMode ? (
          <>
            <Button
              variant="destructive"
              size="lg"
              disabled={selectedCount === 0}
              onClick={onDeleteSelected}
            >
              <Trash />
              {t.myGoals.deleteCount(selectedCount)}
            </Button>
            <Button variant="outline" size="lg" onClick={onCancelSelect}>
              {t.common.cancel}
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" size="lg" onClick={onEnterSelect}>
              <SquareMousePointer />
              {t.myGoals.select}
            </Button>
            <Button variant="default" size="lg" onClick={onOpenCreateGoal}>
              <Plus />
              {t.myGoals.newGoal}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
