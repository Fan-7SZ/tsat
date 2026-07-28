import { useEffect, useLayoutEffect, useRef } from "react"
import { useGanttContext } from "./use-gantt-context"

export function GanttContent({ children }: { children?: React.ReactNode }) {
  const { px, setPx, contentWidthPx } = useGanttContext()
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const pendingAnchor = useRef<{ minute: number; offsetX: number } | null>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      const offsetX = e.clientX - el.getBoundingClientRect().left
      const factor = Math.pow(1.1, -e.deltaY / 100)
      setPx((prev) => {
        pendingAnchor.current = {
          minute: (el.scrollLeft + offsetX) / prev,
          offsetX,
        }
        return prev * factor
      })
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [setPx])

  useLayoutEffect(() => {
    const el = scrollRef.current
    const a = pendingAnchor.current
    if (!el || !a) return
    el.scrollLeft = a.minute * px - a.offsetX
    pendingAnchor.current = null
  }, [px])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let start: { x: number; y: number; left: number; top: number } | null = null
    const down = (e: PointerEvent) => {
      if (e.button !== 1) return
      e.preventDefault() // 挡掉系统中键自动滚动
      start = {
        x: e.clientX,
        y: e.clientY,
        left: el.scrollLeft,
        top: el.scrollTop,
      }
      el.setPointerCapture(e.pointerId)
    }
    const move = (e: PointerEvent) => {
      if (!start) return
      el.scrollLeft = start.left - (e.clientX - start.x)
      el.scrollTop = start.top - (e.clientY - start.y)
    }
    const up = (e: PointerEvent) => {
      if (!start) return
      start = null
      el.releasePointerCapture?.(e.pointerId)
    }
    el.addEventListener("pointerdown", down)
    el.addEventListener("pointermove", move)
    el.addEventListener("pointerup", up)
    return () => {
      el.removeEventListener("pointerdown", down)
      el.removeEventListener("pointermove", move)
      el.removeEventListener("pointerup", up)
    }
  }, [])

  return (
    <div ref={scrollRef} className="relative h-full overflow-auto">
      <div className="relative" style={{ width: contentWidthPx }}>
        {children}
      </div>
    </div>
  )
}
