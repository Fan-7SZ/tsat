import { useState, type ReactNode } from "react"
import { ExternalLink, Trash2 } from "lucide-react"
import { useNavigate } from "react-router"

import { ConfirmDeleteDialog } from "@/components/dialogs/ConfirmDeleteDialog"
import { useLanguage } from "@/components/shared/language-provider"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"

interface DetailDeleteContextMenuProps {
  detailPath: string
  deleteTitle: string
  deleteDescription: string
  onDelete: () => void | Promise<unknown>
  children: ReactNode
}

export function DetailDeleteContextMenu({
  detailPath,
  deleteTitle,
  deleteDescription,
  onDelete,
  children,
}: DetailDeleteContextMenuProps) {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const navigate = useNavigate()
  const { t } = useLanguage()

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuGroup>
            <ContextMenuItem onSelect={() => navigate(detailPath)}>
              <ExternalLink />
              {t.actions.viewDetails}
            </ContextMenuItem>
          </ContextMenuGroup>

          <ContextMenuSeparator />

          <ContextMenuGroup>
            <ContextMenuItem
              variant="destructive"
              onSelect={() => setIsDeleteOpen(true)}
            >
              <Trash2 />
              {t.common.delete}
            </ContextMenuItem>
          </ContextMenuGroup>
        </ContextMenuContent>
      </ContextMenu>

      <ConfirmDeleteDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title={deleteTitle}
        description={deleteDescription}
        onConfirm={() => {
          void onDelete()
        }}
      />
    </>
  )
}
