import { useEffect, useRef, useState, useCallback } from 'react'

// Shared behaviour for the bottom-docked navigators (the Overview / Deep-Dive hop
// inspectors and the systemd reconciliation navigator): a grip-resizable panel
// that defaults to a third of the viewport and publishes its height so the canvas
// behind it can be scrolled clear.
//
// The panel is bottom-anchored, so dragging the grip up grows it and down shrinks
// it. Pointer capture (set on the grip by the consumer via `gripProps`) routes
// move/up back to the grip even if the cursor leaves it, so mouse and touch
// behave the same. Double-clicking the grip resets to the default height.

const MIN_PANEL_PX = 150

// A third of the viewport by default, clamped so it is never unusably short nor
// tall enough to swallow the page. Recomputed on demand (reset / first mount) so
// it tracks the device the panel actually opens on.
const defaultHeight = () =>
  Math.round(Math.min(Math.max(window.innerHeight / 3, 220), window.innerHeight * 0.85))

export function useDockPanel(deps = []) {
  const panelRef = useRef(null)
  const [height, setHeight] = useState(() =>
    typeof window === 'undefined' ? null : defaultHeight(),
  )
  // True while the grip is being dragged, so height tracks the pointer 1:1 and
  // the --hop-inset write is frozen (see below).
  const [resizing, setResizing] = useState(false)
  // Bottom edge captured at grab time (kept fixed so the top edge follows the
  // pointer) plus whether a resize is currently active.
  const resize = useRef({ active: false, bottom: 0 })

  // Tear the --hop-inset variable down once, on unmount, so the canvas tail
  // spacer collapses back when the panel closes.
  useEffect(() => {
    return () => document.documentElement.style.removeProperty('--hop-inset')
  }, [])

  // Publish the settled height as --hop-inset so the overview/canvas reserves
  // room to scroll its bottom node clear of this fixed panel. Skipped mid-drag:
  // reflowing the scroller on every pointermove lurches its scroll position,
  // which on touch fires pointercancel on the grip's captured pointer and aborts
  // the resize (the same hazard AncestryModal guards against).
  useEffect(() => {
    if (resizing || height == null) return
    document.documentElement.style.setProperty('--hop-inset', `${Math.round(height) + 24}px`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height, resizing, ...deps])

  const onPointerDown = useCallback((e) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    resize.current = { active: true, bottom: window.innerHeight }
    setResizing(true)
  }, [])

  const onPointerMove = useCallback((e) => {
    if (!resize.current.active) return
    const next = Math.max(
      MIN_PANEL_PX,
      Math.min(resize.current.bottom - e.clientY, window.innerHeight),
    )
    setHeight(next)
  }, [])

  // Settle on a deliberate release; a spurious pointercancel just stops tracking
  // at the current height rather than doing anything destructive.
  const settle = useCallback(() => {
    if (!resize.current.active) return
    resize.current.active = false
    setResizing(false)
  }, [])

  const onDoubleClick = useCallback(() => setHeight(defaultHeight()), [])

  const gripProps = {
    onPointerDown,
    onPointerMove,
    onPointerUp: settle,
    onPointerCancel: settle,
    onDoubleClick,
  }

  return { panelRef, height, resizing, gripProps }
}
