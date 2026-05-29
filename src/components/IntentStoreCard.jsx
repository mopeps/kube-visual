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
        onClick={(e) => { e.stopPropagation(); onToggle() }}
        className={`node intent-store ${isActive ? 'is-active' : ''} ${isDimmed ? 'is-dimmed' : ''}`}
        style={{ '--node-accent': color }}
        title="Open intent store"
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
          {node.intentObjects.length} intent {node.intentObjects.length === 1 ? 'object' : 'objects'}
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
      className={`intent-store-expanded ${isActive ? 'is-active' : ''}`}
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
          aria-label="Collapse intent store"
          title="Collapse (Esc)"
        >
          ▴
        </button>
      </div>

      <p className="intent-store-caption">
        API objects — desired-state records persisted in etcd, not running
        processes. They have no card on the overview; they live in here.
      </p>

      <div className="intent-store-objects">
        {node.intentObjects.map((obj) => (
          <button
            type="button"
            key={obj.id}
            id={obj.id}
            className="intent-object"
            style={{ '--node-accent': color }}
            onClick={(e) => { e.stopPropagation(); onSelectComponent(obj.id) }}
            title={`Open ${obj.title} details`}
          >
            <span className="node-type-prefix" style={{ color: 'var(--tx-muted)' }}>
              [{obj.typePrefix}]
            </span>
            <span className="node-title" style={{ color }}>{obj.title}</span>
            {obj.badges?.length > 0 && (
              <span className="node-badges">
                {obj.badges.map((b) => (
                  <span
                    key={b.label}
                    className="node-badge"
                    style={{ color: b.color, borderColor: `${b.color}66`, background: `${b.color}1a` }}
                  >
                    {b.label}
                  </span>
                ))}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="intent-store-footer">Click outside or press Esc to collapse</div>
    </div>
  )
}
