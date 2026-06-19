import { useEffect, useRef } from 'react'
import { serviceAlias } from '../data/service-alias'

// An Open vSwitch node that doubles as a "realized-flows" store. Collapsed, it
// looks like a regular node card with an expand affordance. Expanded, it
// enlarges in place to reveal the Services / NetworkPolicies that have no
// datapath of their own — OVN-Kubernetes compiles them into load-balancer / ACL
// OpenFlow rules installed on this switch's br-int, so they live here as the
// flows they're realized as, not as standalone cards.
//
// Mirrors IntentStoreCard's interaction model:
//   • click the collapsed card           → expand
//   • click the title / ⓘ (expanded)     → open this switch's detail popup
//   • click a realized flow               → open that object's detail popup
//   • click the empty body, the ▴ chevron, outside the card, or press Esc
//                                         → collapse
//
// The DOM `id` stays on the outer element in both states so ArrowOverlay can
// keep anchoring trace connectors to it.
export default function RealizedFlowsCard({
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
        aria-label={`[${node.typePrefix}] ${node.title} — show realized flows`}
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
        title="Show realized flows"
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
          {node.realizes.length} {node.realizes.length === 1 ? 'flow' : 'flows'}
        </div>
      </div>
    )
  }

  return (
    <div
      id={node.id}
      ref={ref}
      // Take a full row so the enlarged switch doesn't crowd its neighbours.
      onClick={(e) => { e.stopPropagation(); onToggle() }}
      className={`intent-store-expanded ${isActive ? 'is-active' : ''} ${isOnPath ? 'is-on-path' : ''} ${isHighlighted ? 'is-highlighted' : ''}`}
      style={{ '--node-accent': color, '--store-accent': color }}
    >
      {stepNum != null && (
        <span className="node-step-badge" title={`Step ${stepNum}`}>{stepNum}</span>
      )}

      <div className="intent-store-header">
        {/* Title opens this switch's own detail popup. */}
        <button
          type="button"
          className="intent-store-title"
          style={{ color }}
          onClick={(e) => { e.stopPropagation(); onSelectComponent(node.mirror || node.id) }}
          title="Open Open vSwitch details"
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
          aria-label="Collapse realized flows"
          title="Collapse (Esc)"
        >
          ▴
        </button>
      </div>

      <p className="intent-store-caption">
        Realized as OpenFlow flows on br-int — not separate processes.
      </p>

      <div className="intent-store-objects">
        {node.realizes.map((obj) => {
          // Long names can't fit when two boxes share a mobile row, so those
          // claim their own full-width line — readable names beat two-up.
          const displayTitle = obj.realizationTitle || obj.title
          const isWide = displayTitle.length > 14
          return (
            <button
              type="button"
              key={obj.id}
              id={obj.id}
              className={`intent-object ${isWide ? 'intent-object--wide' : ''} ${obj.id === highlightId ? 'is-highlighted' : ''}`}
              style={{ '--node-accent': color }}
              onClick={(e) => { e.stopPropagation(); onSelectComponent(obj.mirror || obj.id) }}
              title={`Open ${obj.title} details`}
            >
              <span className="node-type-prefix" style={{ color: 'var(--tx-muted)' }}>
                [{obj.realizationType || serviceAlias(obj) || obj.typePrefix}]
              </span>
              <span className="node-title" style={{ color }}>{displayTitle}</span>
            </button>
          )
        })}
      </div>

      <div className="intent-store-footer">Click outside or press Esc to collapse</div>
    </div>
  )
}
