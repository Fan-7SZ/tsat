import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"

import { DataTable } from "@/components/shared/DataTable"

interface DemoRow {
  id: string
  title: string
  status: string
  duration: number
}

const columns: ColumnDef<DemoRow>[] = [
  {
    accessorKey: "title",
    header: "Title",
    meta: { align: "left" },
  },
  { accessorKey: "status", header: "Status" },
  { accessorKey: "duration", header: "Duration (min)" },
]

const rows: DemoRow[] = [
  { id: "t1", title: "Write weekly review", status: "todo", duration: 30 },
  { id: "t2", title: "Morning run", status: "done", duration: 45 },
  { id: "t3", title: "Read one chapter", status: "inProgress", duration: 25 },
  { id: "t4", title: "Refactor sync module", status: "todo", duration: 90 },
  { id: "t5", title: "Plan next sprint", status: "todo", duration: 60 },
]

const manyRows: DemoRow[] = Array.from({ length: 23 }, (_, i) => ({
  id: `row-${i + 1}`,
  title: `Task ${i + 1}`,
  status: i % 3 === 0 ? "done" : "todo",
  duration: 15 + (i % 5) * 15,
}))

function Harness({
  data,
  pagination,
  clickable,
}: {
  data: DemoRow[]
  pagination?: boolean
  clickable?: boolean
}) {
  const [lastClicked, setLastClicked] = useState<string | null>(null)
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  })

  return (
    <div className="flex w-[40rem] max-w-full flex-col gap-2 p-6">
      <DataTable
        table={table}
        columns={columns}
        pagination={pagination}
        onRowClick={clickable ? (row) => setLastClicked(row.title) : undefined}
      />
      {clickable && (
        <p className="paragraph-small text-muted-foreground">
          Last clicked: {lastClicked ?? "—"}
        </p>
      )}
    </div>
  )
}

const meta = {
  title: "Shared/DataTable",
  parameters: {
    layout: "centered",
    docs: { story: { inline: false, iframeHeight: 560 } },
  },
  tags: ["autodocs"],
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** Plain table — first column left-aligned via `meta.align`, rest centered. */
export const WithData: Story = {
  render: () => <Harness data={rows} />,
}

/** No rows — the localized "no results" placeholder spans all columns. */
export const Empty: Story = {
  render: () => <Harness data={[]} />,
}

/** Pagination footer: page-size select plus previous/next controls. */
export const WithPagination: Story = {
  render: () => <Harness data={manyRows} pagination />,
}

/** `onRowClick` makes rows interactive (pointer cursor + click handler). */
export const ClickableRows: Story = {
  render: () => <Harness data={rows} clickable />,
}
