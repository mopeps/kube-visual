import { useEffect, useRef } from 'react'

// A controller-manager node that doubles as a "controller set". Collapsed, it
// looks like a regular node card with an expand affordance. Expanded, it
// enlarges in place to reveal the control loops running *inside* the
// kube-controller-manager binary — reconciliation goroutines, not separate
// Pods. This mirrors the etcd "intent store" (IntentStoreCard): the same
// expand-in-place interaction and layout, but the members here are active
// loops rather than inert desired-state records.
//
// Interaction model:
//   • click the collapsed card           → expand
//   • click the title / ⓘ (expanded)     → open this node's detail popup
//   • click a controller loop            → open that controller's detail popup
//   • click the empty body, the ▴ chevron, outside the card, or press Esc
//                                         → collapse
//
// The DOM `id` stays on the outer element in both states so ArrowOverlay can
// keep anchoring trace connectors to it.
export default function ControllerManagerCard({
  node,
  color,
  stepNum,
  isActive,
  isDimmed,
  isHighlighted,
  highlightId,
  isExpanded,
  onToggle,
  onSelectComponent,
}) {
  const ref = useRef(null)

  // While expanded, collapse on Escape or on a click anywhere outside the card.
  useEffect(() => {
    if (!isExpanded) return
    const onKey = (e) => { if (e.key === 'Escape') onToggle() }
    const onOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) onToggle() }
    window.addEventListener('keydown', onKey)
    // capture-phase so it still fires when inner handlers stopPropagation
    document.addEventListener('mousedown', onOutside, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onOutside, true)
    }
  }, [isExpanded, onToggle])

  if (!isExpanded) {
    return (
      <div
        id={node.id}
        ref={ref}
        role="button"
        tabIndex={0}
        aria-expanded={false}
        aria-label={`[${node.typePrefix}] ${node.title} — open controller set`}
        onClick={(e) => { e.stopPropagation(); onToggle() }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            e.stopPropagation()
            onToggle()
          }
        }}
        className={`node intent-store ${isActive ? 'is-active' : ''} ${isDimmed ? 'is-dimmed' : ''} ${isHighlighted ? 'is-highlighted' : ''}`}
        style={{ '--node-accent': color }}
        title="Open controller set"
      >
        {stepNum != null && (
          <span className="node-step-badge" title={`Step ${stepNum}`}>{stepNum}</span>
        )}
        <span className="node-type-prefix" style={{ color: 'var(--tx-muted)' }}>
          [{node.typePrefix}]
        </span>
        <div className="node-title" style={{ color }}>{node.title}</div>
        <div className="intent-store-hint" style={{ color }}>
          <span className="intent-store-chevron">▸</span>
          {node.controllers.length} control {node.controllers.length === 1 ? 'loop' : 'loops'}
        </div>
      </div>
    )
  }

  return (
    <div
      id={node.id}
      ref={ref}
      // Take a full row so the enlarged set doesn't crowd the static-pod cards.
      onClick={(e) => { e.stopPropagation(); onToggle() }}
      className={`intent-store-expanded ${isActive ? 'is-active' : ''} ${isHighlighted ? 'is-highlighted' : ''}`}
      style={{ '--node-accent': color, '--store-accent': color }}
    >
      {stepNum != null && (
        <span className="node-step-badge" title={`Step ${stepNum}`}>{stepNum}</span>
      )}

      <div className="intent-store-header">
        {/* Title opens this node's own detail popup. */}
        <button
          type="button"
          className="intent-store-title"
          style={{ color }}
          onClick={(e) => { e.stopPropagation(); onSelectComponent(node.id) }}
          title="Open controller-manager details"
        >
          <span className="node-type-prefix" style={{ color: 'var(--tx-muted)', display: 'inline', marginRight: 6 }}>
            [{node.typePrefix}]
          </span>
          {node.title}
          <span className="intent-store-info" aria-hidden="true">ⓘ</span>
        </button>

        {/* Explicit collapse control (clicking the body also collapses). */}
        <button
          type="button"
          className="intent-store-collapse"
          onClick={(e) => { e.stopPropagation(); onToggle() }}
          aria-label="Collapse controller set"
          title="Collapse (Esc)"
        >
          ▴
        </button>
      </div>

      <p className="intent-store-caption">
        Control loops — reconciliation goroutines running inside the single
        kube-controller-manager binary, not separate Pods. Each watches the API
        server and drives actual state toward desired; they share the manager's
        process, so they have no card on the overview and live in here.
      </p>

      <div className="intent-store-objects">
        {node.controllers.map((ctrl) => {
          // Every member is a "[Controller]", so the prefix is just noise on the
          // canvas — drop it and let the loop name carry the chip.
          // Long names can't fit when two boxes share a mobile row, so those
          // claim their own full-width line — readable names beat two-up.
          const isWide = ctrl.title.length > 14
          return (
            <button
              type="button"
              key={ctrl.id}
              id={ctrl.id}
              className={`intent-object controller-loop ${isWide ? 'intent-object--wide' : ''} ${ctrl.id === highlightId ? 'is-highlighted' : ''}`}
              style={{ '--node-accent': color }}
              onClick={(e) => { e.stopPropagation(); onSelectComponent(ctrl.id) }}
              title={`Open ${ctrl.title} details`}
            >
              <span className="node-title" style={{ color }}>
                <span className="controller-loop-mark" aria-hidden="true">↻</span>
                {ctrl.title}
              </span>
              {/* Badges (the watched API group) are hidden on the canvas to keep
                  loops compact; they still surface in the detail popup. */}
            </button>
          )
        })}
      </div>

      <div className="intent-store-footer">Click outside or press Esc to collapse</div>
    </div>
  )
}
