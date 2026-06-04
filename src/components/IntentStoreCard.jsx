import { useEffect, useRef } from 'react'

// An etcd node that doubles as a "cluster intent store". Collapsed, it looks
// like a regular node card with an expand affordance. Expanded, it enlarges in
// place to reveal the Custom Resources it persists — desired-state intent
// records, not running processes.
//
// Interaction model:
//   • click the collapsed card           → expand
//   • click the title / ⓘ (expanded)     → open this node's detail popup
//   • click an intent object             → open that CR's detail popup
//   • click the empty body, the ▴ chevron, outside the card, or press Esc
//                                         → collapse
//
// The DOM `id` stays on the outer element in both states so ArrowOverlay can
// keep anchoring trace connectors to it.
export default function IntentStoreCard({
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
        aria-label={`[${node.typePrefix}] ${node.title} — open intent store`}
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
        title="Open intent store"
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
          {node.intentObjects.length} {node.intentObjects.length === 1 ? 'object' : 'objects'}
        </div>
      </div>
    )
  }

  return (
    <div
      id={node.id}
      ref={ref}
      // Take a full row so the enlarged store doesn't crowd the static-pod cards.
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
          title="Open etcd details"
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
          aria-label="Collapse intent store"
          title="Collapse (Esc)"
        >
          ▴
        </button>
      </div>

      <p className="intent-store-caption">
        The objects the cluster saves in etcd to track its desired state — stored records, not running Pods.
      </p>

      <div className="intent-store-objects">
        {node.intentObjects.map((obj) => {
          // Almost every intent object is a Custom Resource, so the
          // "[Custom Resource]" prefix is just noise on the canvas — hide it
          // for CRs and keep it only for any other type.
          const showPrefix = obj.typePrefix !== 'Custom Resource'
          // Long names can't fit when two boxes share a mobile row, so those
          // claim their own full-width line — readable names beat two-up.
          const isWide = obj.title.length > 14
          return (
            <button
              type="button"
              key={obj.id}
              id={obj.id}
              className={`intent-object ${isWide ? 'intent-object--wide' : ''} ${obj.id === highlightId ? 'is-highlighted' : ''}`}
              style={{ '--node-accent': color }}
              onClick={(e) => { e.stopPropagation(); onSelectComponent(obj.id) }}
              title={`Open ${obj.title} details`}
            >
              {showPrefix && (
                <span className="node-type-prefix" style={{ color: 'var(--tx-muted)' }}>
                  [{obj.typePrefix}]
                </span>
              )}
              <span className="node-title" style={{ color }}>{obj.title}</span>
              {/* Badges (API-group tags) are intentionally hidden on the canvas to
                  keep intent objects compact; they still surface in the detail popup. */}
            </button>
          )
        })}
      </div>

      <div className="intent-store-footer">Click outside or press Esc to collapse</div>
    </div>
  )
}
