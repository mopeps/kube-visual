import { useRef, useState, useEffect, useLayoutEffect } from 'react'
import useMediaQuery from '../hooks/useMediaQuery'

// Horizontal, finger-tracking pager. The panels live in a flex track; the track
// follows the finger during a horizontal drag and snaps to the nearest panel on
// release (committing to the neighbour once the drag passes THRESHOLD of the
// width). Vertical scrolling is left to the browser via `touch-action: pan-y`,
// so we only ever own the horizontal axis — no manual scroll-locking needed.
//
// Per-pane scroll memory: every pane shares the one window scroll, so without
// help a tab would inherit wherever its neighbour was scrolled. We keep the
// window scroll synced to the *active* pane (offset 0) and remember each tab's
// own scrollY; the inactive panes are shifted vertically by translateY =
// (activeScroll − savedScroll) so they preview at their own remembered position.
// On a tab commit we restore the window to the incoming tab's scroll and reset
// the offsets in the same paint — the outgoing/incoming panes stay visually put
// across the swap, so the page never jumps.
//
// Gestures that begin inside a horizontally-scrollable / interactive element
// (code blocks, inputs, or anything marked [data-noswipe]) are ignored so the
// pager never steals those interactions.
const THRESHOLD = 0.22 // fraction of width that commits to the next panel
const LOCK = 8 // px of travel before we decide the gesture's axis

export default function SwipeViews({ index, count, onIndexChange, children }) {
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const viewportRef = useRef(null)
  const paneRefs = useRef([])
  const scrollStore = useRef({})
  const indexRef = useRef(index)
  const drag = useRef({ active: false, axis: null, startX: 0, startY: 0, dx: 0, width: 0 })
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)

  // Position a single inactive pane so it previews at its own remembered
  // scrollY. translateY = activeScroll − savedScroll maps its saved slice to the
  // top, given the shared window scroll. The active pane is left untransformed
  // (it *is* the window scroll) so it never becomes a containing block for its
  // descendants.
  function applyOffsets(activeScroll) {
    paneRefs.current.forEach((el, i) => {
      if (!el) return
      el.style.transform =
        i === indexRef.current
          ? ''
          : `translateY(${activeScroll - (scrollStore.current[i] ?? 0)}px)`
    })
  }

  // Keep the active tab's saved scroll in step with the window, and slide the
  // inactive panes so their preview tracks the live scroll. Refs only — no
  // re-render per scroll event.
  useEffect(() => {
    const onScroll = () => {
      const s = window.scrollY
      scrollStore.current[indexRef.current] = s
      applyOffsets(s)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // On a tab change, restore the incoming tab's own scroll and recompute the
  // offsets for that scroll — both before paint, so the swap is seamless.
  useLayoutEffect(() => {
    indexRef.current = index
    const s = scrollStore.current[index] ?? 0
    window.scrollTo(0, s)
    applyOffsets(s)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

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
    // Make sure the neighbours are parked at their remembered positions before
    // they can be revealed by the drag.
    applyOffsets(window.scrollY)
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
            ref={el => { paneRefs.current[i] = el }}
            aria-hidden={i !== index}
          >
            {child}
          </div>
        ))}
      </div>
    </div>
  )
}
