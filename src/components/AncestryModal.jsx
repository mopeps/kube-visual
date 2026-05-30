import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import componentsData from '../data/components.json'
import { COMPONENT_COLOR, COMPONENT_ZONE } from '../data/zones'
import { buildPipeline } from '../data/pipeline-model'
import PipelineTree from './PipelineTree'
import DetailSections from './DetailSections'

// How far (px) the sheet must be dragged down by touch before it dismisses, and
// how far the finger must move before we decide a touch is a drag vs a scroll.
const DRAG_DISMISS_PX = 130
const DRAG_SLOP_PX = 8

export default function AncestryModal({ componentId, onClose, onSelectComponent }) {
  // Distance the modal is currently pushed down by a touch drag.
  const [offset, setOffset] = useState(0)
  // While true the modal animates (snapping back / sliding off); while false it
  // tracks the gesture 1:1 with no transition.
  const [snapping, setSnapping] = useState(false)
  // Whether the Manifest → Kernel pipeline section is expanded (open by default).
  const [treeOpen, setTreeOpen] = useState(true)
  const modalRef = useRef(null)
  // Drag gesture bookkeeping: startY, whether the modal was at the top when the
  // touch began, and the decided mode (null = undecided, 'drag', or 'scroll').
  const drag = useRef({ startY: 0, atTop: false, mode: 'scroll' })

  // Esc to close + reset transient state whenever a new component opens.
  useEffect(() => {
    if (!componentId) return
    setOffset(0)
    setSnapping(false)
    setTreeOpen(true)
    drag.current = { startY: 0, atTop: false, mode: 'scroll' }
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [componentId, onClose])

  // Lock the page behind the modal so it can't scroll while open. Pins <body>
  // at its current scroll position and restores it on close so the page doesn't
  // jump. Idempotent restore-from-`prev` keeps StrictMode double-mount safe.
  useEffect(() => {
    if (!componentId) return
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
  }, [componentId])

  // Touch-drag to dismiss — deliberate gesture only, so fast scrolling never
  // closes the sheet by accident. It engages only when ALL hold:
  //   • the modal was already scrolled to the very top when the touch began,
  //   • the first finger movement past the slop is downward (not an up-scroll),
  //   • the content does not scroll during the gesture, and
  //   • the total downward drag passes DRAG_DISMISS_PX.
  const onTouchStart = (e) => {
    const atTop = !modalRef.current || modalRef.current.scrollTop <= 0
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
    if (modalRef.current && modalRef.current.scrollTop > 0) {
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

  const component = componentsData.find(c => c.componentId === componentId)
  if (!component) return null

  const color = COMPONENT_COLOR[componentId] || 'var(--k-cyan)'
  const zone = COMPONENT_ZONE[componentId]

  const { bands } = buildPipeline(component)
  const hasTree = bands.length > 0

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

  return createPortal(
    <div
      className="ancestry-overlay animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={modalRef}
        className="ancestry-modal"
        role="dialog"
        aria-modal="true"
        aria-label={component.displayName}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        style={
          offset > 0 || snapping
            ? {
                transform: `translateY(${offset}px)`,
                transition: snapping ? 'transform 0.3s ease' : 'none',
              }
            : undefined
        }
      >
        <div className="ancestry-drag-handle" />
        <button className="detail-close" onClick={onClose} aria-label="Close (Esc)">✕</button>

        <div className="detail-title" style={{ color }}>
          {component.typePrefix && (
            <span className="detail-type-prefix">[{component.typePrefix}]&nbsp;</span>
          )}
          {component.displayName}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 22 }}>
          <span className="detail-type" style={{ color, marginBottom: 0 }}>
            {zone?.label || component.layer}
          </span>
        </div>

        <DetailSections
          component={component}
          color={color}
          suppressLegacyPrimitives={hasTree}
          onSelectComponent={onSelectComponent}
          pipelineSection={pipelineSection}
        />

        <div
          className="text-[0.6rem] mt-6 pt-4 border-t"
          style={{ color: 'var(--tx-dim)', borderColor: 'var(--border-d)' }}
        >
          Press <span style={{ color: 'var(--tx-muted)' }}>Esc</span> or tap outside to close · id:&nbsp;
          <span style={{ color: 'var(--tx-muted)' }}>{component.componentId}</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
