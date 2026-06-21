import { useEffect, useRef, useState } from 'react'
import useMediaQuery from '../hooks/useMediaQuery'

// Horizontal, finger-tracking pager. The panels live in a flex track; the track
// follows the finger during a horizontal drag and snaps to the nearest panel on
// release (committing to the neighbour once the drag passes THRESHOLD of the
// width). We only own the horizontal axis: each pane is its own vertical scroll
// container (`overflow-y:auto`, see `.swipe-pane` in index.css), so every tab
// keeps its own scroll position and previews correctly during the swipe — no
// transforms, no scroll-restore, nothing to jump. `touch-action: pan-y` lets the
// browser drive that native vertical scroll.
//
// Gestures that begin inside a horizontally-scrollable / interactive element
// (code blocks, inputs, or anything marked [data-noswipe]) are ignored so the
// pager never steals those interactions.
const THRESHOLD = 0.22 // fraction of width that commits to the next panel
const LOCK = 8 // px of travel before we decide the gesture's axis

export default function SwipeViews({ index, count, tabs, onIndexChange, onActiveScroll, children }) {
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const viewportRef = useRef(null)
  const paneRefs = useRef([])
  const drag = useRef({ active: false, axis: null, startX: 0, startY: 0, dx: 0, width: 0 })
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)

  // Report the active pane's scroll offset so the host can scroll its chrome
  // (header + tabs) away in step with the content. Each pane keeps its own
  // scroll position, so on a tab switch we re-report the incoming pane's offset.
  useEffect(() => {
    onActiveScroll?.(paneRefs.current[index]?.scrollTop || 0)
  }, [index, onActiveScroll])

  function excluded(target) {
    return !!(target.closest &&
      target.closest('pre, input, textarea, select, [data-noswipe]'))
  }

  function onTouchStart(e) {
    if (e.touches.length !== 1 || excluded(e.target)) {
      drag.current.active = false
      return
    }
    const t = e.touches[0]
    drag.current = {
      active: true,
      axis: null,
      startX: t.clientX,
      startY: t.clientY,
      dx: 0,
      width: viewportRef.current?.clientWidth || window.innerWidth,
    }
  }

  function onTouchMove(e) {
    const d = drag.current
    if (!d.active) return
    const t = e.touches[0]
    const dx = t.clientX - d.startX
    const dy = t.clientY - d.startY

    if (d.axis == null) {
      if (Math.abs(dx) < LOCK && Math.abs(dy) < LOCK) return
      d.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (d.axis === 'x') setDragging(true)
    }
    if (d.axis !== 'x') return

    d.dx = dx
    // Rubber-band: resist dragging past the first / last panel.
    const atEdge = (index === 0 && dx > 0) || (index === count - 1 && dx < 0)
    setDragX(atEdge ? dx * 0.35 : dx)
  }

  function onTouchEnd() {
    const d = drag.current
    if (!d.active) return
    if (d.axis === 'x' && Math.abs(d.dx) > d.width * THRESHOLD) {
      const dir = d.dx < 0 ? 1 : -1
      const next = Math.min(count - 1, Math.max(0, index + dir))
      if (next !== index) onIndexChange(next)
    }
    drag.current = { ...d, active: false, axis: null, dx: 0 }
    setDragging(false)
    setDragX(0)
  }

  const transition =
    dragging || reduceMotion ? 'none' : 'transform 0.3s cubic-bezier(0.22, 0.61, 0.36, 1)'

  return (
    <div
      ref={viewportRef}
      className="swipe-viewport"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <div
        className="swipe-track"
        style={{
          transform: `translate3d(calc(${-index * 100}% + ${dragX}px), 0, 0)`,
          transition,
        }}
      >
        {children.map((child, i) => (
          <div
            className="swipe-pane"
            key={i}
            id={`panel-${tabs[i].id}`}
            role="tabpanel"
            aria-labelledby={`tab-${tabs[i].id}`}
            ref={(el) => { paneRefs.current[i] = el }}
            onScroll={(e) => { if (i === index) onActiveScroll?.(e.currentTarget.scrollTop) }}
            aria-hidden={i !== index}
            // Keep the inactive panes (always mounted, for the swipe preview) out
            // of the tab order and the a11y tree — focusable content inside an
            // aria-hidden subtree is otherwise reachable by keyboard / AT.
            inert={i !== index}
          >
            {child}
          </div>
        ))}
      </div>
    </div>
  )
}
