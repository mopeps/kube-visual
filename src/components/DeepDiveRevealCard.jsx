import { Fragment, useEffect, useRef } from 'react'

// A deep-dive box that doubles as a "zoom-in store". Collapsed, it looks like a
// regular NodeCard with a reveal affordance. Expanded, it enlarges in place to
// reveal an ordered sequence of sub-step boxes inside it — exactly the way the
// etcd IntentStoreCard reveals its records. It replaces the old standalone
// "Zoom-in" zones (the tmux parser FSM, the sudo fd inheritance): those steps
// now live *inside* the object they describe, in the main canvas.
//
// Interaction model (mirrors IntentStoreCard):
//   • click the collapsed card            → expand
//   • click the title / ⓘ (expanded)      → open this box's own detail popup
//   • click a sub-step                    → open that step's detail popup
//   • click the ▴ chevron, outside, or Esc → collapse
//
// The DOM `id` (dd-<boxId>) stays on the outer element in both states so the
// trace ArrowOverlay can keep anchoring connectors to it.
export default function DeepDiveRevealCard({
  box,
  accent,
  isActive,
  isOnPath,
  isDimmed,
  isExpanded,
  highlightId,
  onToggle,
  onSelectBox,
}) {
  const ref = useRef(null)
  const reveal = box.reveal
  const steps = reveal?.boxes || []

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
        id={`dd-${box.id}`}
        ref={ref}
        role="button"
        tabIndex={0}
        aria-expanded={false}
        aria-label={`${box.typePrefix ? `[${box.typePrefix}] ` : ''}${box.title} — reveal ${reveal?.hint || 'the steps'}`}
        onClick={(e) => { e.stopPropagation(); onToggle() }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            e.stopPropagation()
            onToggle()
          }
        }}
        className={`node dd-reveal ${isActive ? 'is-active' : ''} ${isOnPath ? 'is-on-path' : ''} ${isDimmed ? 'is-dimmed' : ''}`}
        style={{ '--node-accent': accent }}
        title={`Reveal ${reveal?.hint || 'the steps'}`}
      >
        {box.typePrefix && (
          <span className="node-type-prefix" style={{ color: 'var(--tx-muted)' }}>
            [{box.typePrefix}]
          </span>
        )}
        <div className="node-title" style={{ color: accent }}>{box.title}</div>
        {box.badges?.length > 0 && (
          <div className="node-badges">
            {box.badges.map((b) => (
              <span key={b.label} className={`node-badge node-badge--${b.kind || 'stat'}`} style={{ color: accent }}>
                {b.label}
              </span>
            ))}
          </div>
        )}
        <div className="dd-reveal-hint" style={{ color: accent }}>
          <span className="intent-store-chevron">▸</span>
          {steps.length} {steps.length === 1 ? 'step' : 'steps'}
          {reveal?.hint ? ` · ${reveal.hint}` : ''}
        </div>
      </div>
    )
  }

  return (
    <div
      id={`dd-${box.id}`}
      ref={ref}
      // Take a full row so the revealed sequence doesn't crowd the sibling boxes.
      onClick={(e) => { e.stopPropagation(); onToggle() }}
      className={`intent-store-expanded dd-reveal-expanded ${isActive ? 'is-active' : ''} ${isOnPath ? 'is-on-path' : ''}`}
      style={{ '--node-accent': accent, '--store-accent': accent }}
    >
      <div className="intent-store-header">
        {/* Title opens this box's own detail popup. */}
        <button
          type="button"
          className="intent-store-title"
          style={{ color: accent }}
          onClick={(e) => { e.stopPropagation(); onSelectBox(box.id) }}
          title="Open this box's details"
        >
          {box.typePrefix && (
            <span className="node-type-prefix" style={{ color: 'var(--tx-muted)', display: 'inline', marginRight: 6 }}>
              [{box.typePrefix}]
            </span>
          )}
          {box.title}
          <span className="intent-store-info" aria-hidden="true">ⓘ</span>
        </button>

        {/* Explicit collapse control (clicking the body also collapses). */}
        <button
          type="button"
          className="intent-store-collapse"
          onClick={(e) => { e.stopPropagation(); onToggle() }}
          aria-label="Collapse"
          title="Collapse (Esc)"
        >
          ▴
        </button>
      </div>

      {reveal?.caption && <p className="intent-store-caption">{reveal.caption}</p>}

      <div className="dd-reveal-steps">
        {steps.map((child, i) => (
          <Fragment key={child.id}>
            {i > 0 && <span className="dd-reveal-arrow" aria-hidden>→</span>}
            <button
              type="button"
              id={`dd-${child.id}`}
              className={`intent-object dd-reveal-step ${child.id === highlightId ? 'is-highlighted' : ''}`}
              style={{ '--node-accent': accent }}
              onClick={(e) => { e.stopPropagation(); onSelectBox(child.id) }}
              title={`Open ${child.title}`}
            >
              <span className="dd-reveal-step-num" aria-hidden>{i + 1}</span>
              {child.typePrefix && (
                <span className="node-type-prefix" style={{ color: 'var(--tx-muted)' }}>
                  [{child.typePrefix}]
                </span>
              )}
              <span className="node-title" style={{ color: accent }}>{child.title}</span>
              {child.subtitle && <span className="dd-reveal-step-sub">{child.subtitle}</span>}
            </button>
          </Fragment>
        ))}
      </div>

      <div className="intent-store-footer">Click a step to open it · Esc or click outside to collapse</div>
    </div>
  )
}
