import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import useDialogFocus from '../hooks/useDialogFocus'
import { findComponent } from '../data/components-index'
import { COMPONENT_COLOR, COMPONENT_ZONE } from '../data/zones'
import { buildPipeline } from '../data/pipeline-model'
import { MANIFESTS } from '../data/manifests'
import PipelineTree from './PipelineTree'
import DetailSections from './DetailSections'

// How far (px) the sheet must be dragged down by touch before it dismisses, and
// how far the finger must move before we decide a touch is a drag vs a scroll.
const DRAG_DISMISS_PX = 130
const DRAG_SLOP_PX = 8

// Resize-via-grip thresholds. The sheet is bottom-anchored, so dragging the top
// grip down shrinks it and dragging it up grows it. Released below
// DISMISS_SHEET_PX it closes; otherwise it never settles smaller than
// MIN_SHEET_PX. The last chosen height is remembered for the session so the
// sheet reopens at the size the user fixed it to.
const MIN_SHEET_PX = 220
const DISMISS_SHEET_PX = 120
let lastSheetHeight = null

export default function AncestryModal({ componentId, onClose, onSelectComponent, onRevealInOverview, onOpenDeepDive }) {
  // Distance the modal is currently pushed down by a touch drag.
  const [offset, setOffset] = useState(0)
  // While true the modal animates (snapping back / sliding off); while false it
  // tracks the gesture 1:1 with no transition.
  const [snapping, setSnapping] = useState(false)
  // Whether the Manifest → Kernel pipeline section is expanded (open by default).
  const [treeOpen, setTreeOpen] = useState(true)
  // Explicit sheet height in px set by dragging the grip; null = default (auto,
  // capped at max-height). Seeded from the last size the user fixed it to.
  const [sheetHeight, setSheetHeight] = useState(lastSheetHeight)
  // True while the grip is being dragged, so height tracks the pointer 1:1.
  const [resizing, setResizing] = useState(false)
  const modalRef = useRef(null)
  const bodyRef = useRef(null)
  // Body swipe-dismiss bookkeeping: startY, whether the body was at the top when
  // the touch began, and the decided mode (null = undecided, 'drag', 'scroll').
  const drag = useRef({ startY: 0, atTop: false, mode: 'scroll' })
  // Grip resize bookkeeping: whether a resize is active and the modal's bottom
  // edge captured at grab time (kept fixed so the top edge follows the pointer).
  const resize = useRef({ active: false, bottom: 0 })

  // Once the user fixes an explicit (reduced) height via the grip, the sheet
  // stops behaving like a full-screen modal and becomes a non-modal "peek"
  // panel: the backdrop dimming/blur is dropped, pointer events fall through
  // above the sheet, and the page is no longer scroll-locked — so the
  // architecture overview behind it stays both visible and scrollable.
  const peek = sheetHeight != null

  useDialogFocus(!!componentId, modalRef, onClose, { modal: !peek })

  // Reset transient gesture state whenever a new component opens.
  // Sheet height is intentionally NOT reset — the size the user picked sticks.
  useEffect(() => {
    if (!componentId) return
    setOffset(0)
    setSnapping(false)
    setTreeOpen(true)
    drag.current = { startY: 0, atTop: false, mode: 'scroll' }
  }, [componentId])

  // Lock the page behind the modal so it can't scroll while open. Pins <body>
  // at its current scroll position and restores it on close so the page doesn't
  // jump. Idempotent restore-from-`prev` keeps StrictMode double-mount safe.
  // Skipped in peek mode: a resized sheet deliberately leaves the overview
  // scrollable, so re-running this effect when `peek` flips unlocks the page.
  useEffect(() => {
    if (!componentId || peek) return
    const scrollY = window.scrollY
    const body = document.body
    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    }
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.width = '100%'
    body.style.overflow = 'hidden'
    return () => {
      body.style.position = prev.position
      body.style.top = prev.top
      body.style.width = prev.width
      body.style.overflow = prev.overflow
      window.scrollTo(0, scrollY)
    }
  }, [componentId, peek])

  // In peek mode the bottom-anchored sheet covers the lower slice of the
  // viewport, so the overview's last objects could never be scrolled out from
  // behind it (at max scroll they stay pinned under the sheet). Publish the
  // sheet height as the --peek-inset CSS variable; the overview's tail spacer
  // reserves that much extra room so every object can be scrolled clear of the
  // sheet and clicked. A variable reserves the room *inside* whichever element
  // actually scrolls — the window on desktop, the compact swipe pane below
  // 1024px — where padding <body> would do nothing for the pane.
  //
  // Split in two so the inset is set up/torn down once per peek session but its
  // *value* is only written when the sheet is settled — never mid-drag.
  // Reflowing the scroller on every pointermove lurches its scroll position,
  // which on touch fires `pointercancel` on the grip's captured pointer and
  // aborts the resize. Freezing it during an active drag keeps the resize
  // smooth.
  useEffect(() => {
    if (!componentId || !peek) return
    const root = document.documentElement
    return () => root.style.removeProperty('--peek-inset')
  }, [componentId, peek])
  useEffect(() => {
    if (!componentId || !peek || resizing) return
    document.documentElement.style.setProperty('--peek-inset', `${Math.round(sheetHeight) + 24}px`)
  }, [componentId, peek, resizing, sheetHeight])

  // ── Grip resize ──────────────────────────────────────────────────────
  // The grip is the top bar. Drag it to set the sheet height: the sheet is
  // bottom-anchored, so its bottom edge stays put (captured at grab time) and
  // the top edge tracks the pointer. Pointer capture routes move/up back to the
  // grip even if the cursor leaves it. Works for mouse and touch alike.
  const onGripPointerDown = (e) => {
    if (!modalRef.current) return
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    // Resizing docks the sheet flush to the bottom of the viewport (see the
    // is-peek styles), so its bottom edge sits at innerHeight. Capturing that
    // — rather than the current floating bottom — lets the grip drag the top
    // edge all the way to the top of the screen, i.e. to full height.
    resize.current = { active: true, bottom: window.innerHeight }
    setResizing(true)
    setOffset(0)
  }
  const onGripPointerMove = (e) => {
    if (!resize.current.active) return
    const max = window.innerHeight
    const next = Math.max(0, Math.min(resize.current.bottom - e.clientY, max))
    setSheetHeight(next)
  }
  // `dismissable` is true only for a deliberate pointer release: a spurious
  // pointercancel (the browser reclaiming the gesture mid-drag) must never
  // close the sheet — it just settles at the current height, clamped to MIN.
  const settleResize = (dismissable) => {
    if (!resize.current.active) return
    resize.current.active = false
    setResizing(false)
    setSheetHeight((h) => {
      if (dismissable && h != null && h < DISMISS_SHEET_PX) { onClose(); return h }
      const settled = h == null ? null : Math.max(h, MIN_SHEET_PX)
      lastSheetHeight = settled
      return settled
    })
  }
  const onGripPointerUp = () => settleResize(true)
  const onGripPointerCancel = () => settleResize(false)
  // Double-click / -tap the grip to clear the fixed size and return to default.
  const onGripDoubleClick = () => {
    lastSheetHeight = null
    setSheetHeight(null)
  }

  // ── Body swipe-to-dismiss (touch) ──────────────────────────────────────
  // A deliberate downward swipe over the content dismisses the sheet, so fast
  // scrolling never closes it by accident. It engages only when ALL hold:
  //   • the body was already scrolled to the very top when the touch began,
  //   • the first finger movement past the slop is downward (not an up-scroll),
  //   • the content does not scroll during the gesture, and
  //   • the total downward drag passes DRAG_DISMISS_PX.
  const onTouchStart = (e) => {
    const atTop = !bodyRef.current || bodyRef.current.scrollTop <= 0
    drag.current = { startY: e.touches[0].clientY, atTop, mode: null }
    setSnapping(false)
  }
  const onTouchMove = (e) => {
    const st = drag.current
    if (!st.atTop) return // started mid-scroll → leave scrolling alone
    const dy = e.touches[0].clientY - st.startY
    if (st.mode === null) {
      if (Math.abs(dy) < DRAG_SLOP_PX) return // not enough movement to decide yet
      st.mode = dy > 0 ? 'drag' : 'scroll' // first intent: down = drag, up = scroll
      if (st.mode === 'scroll') return
    }
    if (st.mode !== 'drag') return
    // If the content scrolled after we started dragging, the user is scrolling.
    if (bodyRef.current && bodyRef.current.scrollTop > 0) {
      st.mode = 'scroll'
      setOffset(0)
      return
    }
    setOffset(dy > 0 ? dy : 0)
  }
  const onTouchEnd = () => {
    const wasDrag = drag.current.mode === 'drag'
    const dragged = offset
    drag.current.mode = 'scroll'
    if (!wasDrag) return
    setSnapping(true)
    if (dragged >= DRAG_DISMISS_PX) onClose()
    else setOffset(0)
  }

  if (!componentId) return null

  const component = findComponent(componentId)
  if (!component) return null

  const color = COMPONENT_COLOR[componentId] || 'var(--k-cyan)'
  const zone = COMPONENT_ZONE[componentId]
  // The location chip can jump to the canvas only when the object actually has
  // a home on the default overview: it must belong to a known zone that isn't
  // trace-only (the external Client is hidden unless a trace references it).
  const locatable = !!onRevealInOverview && !!zone && !zone.traceOnly

  const { bands } = buildPipeline(component)
  const hasTree = bands.length > 0

  // The object's minimal example manifest, surfaced behind a [MANIFEST]/[UNIT]
  // tag in two places: the detail badge row (passed to DetailSections), and
  // inside the pipeline's logical-intent node detail — attach it to that node
  // (the declarative top of the descent) for PipelineTree to render it there.
  const manifest = MANIFESTS[componentId] || null
  if (manifest) {
    const intentBand = bands.find(b => b.layerId === 'logical-intent') || bands[0]
    const node = intentBand?.groups?.[0]?.nodes?.[0]
    if (node) node.manifest = manifest
  }

  // The Manifest → Kernel pipeline is passed into DetailSections as a slot so it
  // can be positioned (after Tags, before Explore) within the section ordering.
  const pipelineSection = hasTree ? (
    <div className="detail-section">
      <button
        type="button"
        className="tree-section-toggle"
        onClick={() => setTreeOpen(o => !o)}
        aria-expanded={treeOpen}
        style={{ color }}
      >
        <span className="tree-section-caret">{treeOpen ? '▾' : '▸'}</span>
        <h4 style={{ margin: 0, border: 'none', padding: 0, color: 'var(--tx-muted)' }}>
          Manifest → Kernel Pipeline
        </h4>
      </button>
      {treeOpen && (
        <div style={{ marginTop: 12 }}>
          <PipelineTree bands={bands} onSelectComponent={onSelectComponent} selfId={componentId} />
        </div>
      )}
    </div>
  ) : null

  const transition = resizing
    ? 'none'
    : snapping
      ? 'transform 0.3s ease'
      : 'height 0.18s ease'

  return createPortal(
    <div
      className={`ancestry-overlay animate-fade-in${peek ? ' is-peek' : ''}${resizing ? ' is-resizing' : ''}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={modalRef}
        className="ancestry-modal"
        role="dialog"
        aria-modal={peek ? undefined : 'true'}
        aria-label={component.displayName}
        tabIndex={-1}
        style={{
          height: sheetHeight != null ? `${sheetHeight}px` : undefined,
          transform: offset > 0 ? `translateY(${offset}px)` : undefined,
          transition,
        }}
      >
        <div
          className="ancestry-grip"
          role="separator"
          aria-label="Drag to resize · double-click to reset"
          onPointerDown={onGripPointerDown}
          onPointerMove={onGripPointerMove}
          onPointerUp={onGripPointerUp}
          onPointerCancel={onGripPointerCancel}
          onDoubleClick={onGripDoubleClick}
        >
          <span className="ancestry-grip-bar" />
        </div>
        <button className="detail-close" onClick={onClose} aria-label="Close (Esc)">✕</button>

        <div
          ref={bodyRef}
          className="ancestry-modal-body"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
        >
          <div className="detail-title" style={{ color }}>
            {component.typePrefix && (
              <span className="detail-type-prefix">[{component.typePrefix}]&nbsp;</span>
            )}
            {component.displayName}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 22 }}>
            {locatable ? (
              // The location chip doubles as a "find it on the canvas" jump:
              // close the sheet, surface the overview, and pulse this object
              // (and its zone) into view.
              <button
                type="button"
                className="detail-type detail-type--locate"
                style={{ color, marginBottom: 0 }}
                onClick={() => onRevealInOverview(componentId)}
                title="Show in the cluster overview"
              >
                <svg className="detail-type-pin" width="11" height="11" viewBox="0 0 16 16"
                  fill="none" stroke="currentColor" strokeWidth="1.6"
                  strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M8 1.6c-2.5 0-4.5 2-4.5 4.5C3.5 9.4 8 14.4 8 14.4s4.5-5 4.5-8.3C12.5 3.6 10.5 1.6 8 1.6Z" />
                  <circle cx="8" cy="6.1" r="1.6" />
                </svg>
                {zone.label}
              </button>
            ) : (
              <span className="detail-type" style={{ color, marginBottom: 0 }}>
                {zone?.label || component.layer}
              </span>
            )}
          </div>

          <DetailSections
            component={component}
            color={color}
            suppressLegacyPrimitives={hasTree}
            onSelectComponent={onSelectComponent}
            pipelineSection={pipelineSection}
            manifest={manifest}
            onOpenDeepDive={onOpenDeepDive ? (topicId) => { onClose(); onOpenDeepDive(topicId) } : null}
          />

          <div
            className="text-[0.75rem] mt-6 pt-4 border-t"
            style={{ color: 'var(--tx-dim)', borderColor: 'var(--border-d)' }}
          >
            Press <span style={{ color: 'var(--tx-muted)' }}>Esc</span> or tap outside to close · id:&nbsp;
            <span style={{ color: 'var(--tx-muted)' }}>{component.componentId}</span>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
