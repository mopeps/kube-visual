import { useEffect, useRef } from 'react'

// An operator node that doubles as an "operator set". Collapsed, it looks like a
// regular node card with an expand affordance. Expanded, it enlarges in place to
// reveal the operator Pods this owner deploys and reconciles in the HCP
// namespace (e.g. the second-level OpenShift cluster operators the CVO keeps at
// their release-pinned versions, or the control-plane operands the Control Plane
// Operator stamps out).
//
// This reuses the IntentStoreCard / ControllerManagerCard expand-in-place layout
// and interaction model, but with a deliberate difference the spec calls out
// (ARCHITECTURE.md §2): the members here are *real, separate Deployment Pods*,
// not records in a key-value store or goroutines sharing one process. The nesting
// is a progressive-disclosure grouping by owner — it keeps ~20 operator Pods off
// the primary canvas so the management cluster stays legible (and two-up on
// mobile) — not a claim that the children live inside the parent's process.
//
// Interaction model:
//   • click the collapsed card           → expand
//   • click the title / ⓘ (expanded)     → open this node's detail popup
//   • click an operator                  → open that operator's detail popup
//   • click the empty body, the ▴ chevron, outside the card, or press Esc
//                                         → collapse
//
// The DOM `id` stays on the outer element in both states so ArrowOverlay can
// keep anchoring trace connectors to it.
export default function OperatorSetCard({
  node,
  color,
  stepNum,
  isActive,
  isOnPath,
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
        aria-label={`[${node.typePrefix}] ${node.title} — open operator set`}
        onClick={(e) => { e.stopPropagation(); onToggle() }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            e.stopPropagation()
            onToggle()
          }
        }}
        className={`node intent-store ${isActive ? 'is-active' : ''} ${isOnPath ? 'is-on-path' : ''} ${isDimmed ? 'is-dimmed' : ''} ${isHighlighted ? 'is-highlighted' : ''}`}
        style={{ '--node-accent': color }}
        title="Open operator set"
      >
        {stepNum != null && (
          <span className="node-step-badge" title={`Step ${stepNum}`}>{stepNum}</span>
        )}
        {node.typePrefix !== 'Pod' && (
          <span className="node-type-prefix" style={{ color: 'var(--tx-muted)' }}>
            [{node.typePrefix}]
          </span>
        )}
        <div className="node-title" style={{ color }}>{node.title}</div>
        <div className="intent-store-hint" style={{ color }}>
          <span className="intent-store-chevron">▸</span>
          {node.operators.length} {node.operators.length === 1 ? 'operator' : 'operators'}
        </div>
      </div>
    )
  }

  return (
    <div
      id={node.id}
      ref={ref}
      // Take a full row so the enlarged set doesn't crowd the sibling cards.
      onClick={(e) => { e.stopPropagation(); onToggle() }}
      className={`intent-store-expanded ${isActive ? 'is-active' : ''} ${isOnPath ? 'is-on-path' : ''} ${isHighlighted ? 'is-highlighted' : ''}`}
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
          title="Open owner details"
        >
          {node.typePrefix !== 'Pod' && (
            <span className="node-type-prefix" style={{ color: 'var(--tx-muted)', display: 'inline', marginRight: 6 }}>
              [{node.typePrefix}]
            </span>
          )}
          {node.title}
          <span className="intent-store-info" aria-hidden="true">ⓘ</span>
        </button>

        {/* Explicit collapse control (clicking the body also collapses). */}
        <button
          type="button"
          className="intent-store-collapse"
          onClick={(e) => { e.stopPropagation(); onToggle() }}
          aria-label="Collapse operator set"
          title="Collapse (Esc)"
        >
          ▴
        </button>
      </div>

      <p className="intent-store-caption">
        {node.operatorSetCaption ||
          'Operator Pods this owner deploys and reconciles — separate Deployments, grouped here to keep the canvas legible.'}
      </p>

      <div className="intent-store-objects">
        {node.operators.map((op) => {
          // Every member is a "[Pod]", so the prefix is just noise on the
          // canvas — drop it and let the operator name carry the chip. Long
          // names can't fit when two boxes share a mobile row, so those claim
          // their own full-width line — readable names beat two-up.
          const isWide = op.title.length > 14
          return (
            <button
              type="button"
              key={op.id}
              id={op.id}
              className={`intent-object operator-pod ${isWide ? 'intent-object--wide' : ''} ${op.id === highlightId ? 'is-highlighted' : ''}`}
              style={{ '--node-accent': color }}
              onClick={(e) => { e.stopPropagation(); onSelectComponent(op.id) }}
              title={`Open ${op.title} details`}
            >
              <span className="node-title" style={{ color }}>
                <span className="operator-pod-mark" aria-hidden="true">◆</span>
                {op.title}
              </span>
              {/* Badges surface in the detail popup, not on the compact chip. */}
            </button>
          )
        })}
      </div>

      <div className="intent-store-footer">Click outside or press Esc to collapse</div>
    </div>
  )
}
