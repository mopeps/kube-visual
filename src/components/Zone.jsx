export default function Zone({
  label,
  color,
  dashed = false,
  depth = 0,
  // layout: 'columns' lays this zone's child zones out side-by-side (each an
  // equal-width column), stacking back to full width under 640px. 'stack'
  // stacks the zone's boxes vertically, centred — a chain read top-to-bottom.
  // Used by deep-dive topics that mirror a symmetric diagram (the OVN topology).
  layout,
  // bare: no label bar, no border, no fill — an invisible layout container.
  // Lets diagram-shaped topics float content (the OVN shared core between the
  // two node columns) without drawing a box around it.
  bare = false,
  children,
  // When a zone doubles as a component (e.g. the VM), these wire its label up
  // as an arrow anchor (id), a click target, and a trace step badge.
  componentId,
  stepNum,
  isActive = false,
  isOnPath = false,
  isHighlighted = false,
  onClick,
}) {
  const isTop = depth === 0

  // color-mix blends the zone accent into the page background (#0a0f1e) for
  // a solid, opaque fill — no transparency.
  const fill = `color-mix(in srgb, ${color} ${isTop ? 18 : 13}%, #0a0f1e)`
  const line = `color-mix(in srgb, ${color} ${dashed ? 70 : 65}%, #0a0f1e)`

  const isComponent = !!componentId

  return (
    <div
      className={`zone ${dashed ? 'zone--dashed' : ''} ${depth > 0 && !bare ? 'zone--nested' : ''} ${layout === 'columns' ? 'zone--columns' : ''} ${layout === 'stack' ? 'zone--stack' : ''} ${bare ? 'zone--bare' : ''}`}
      style={{
        ...(!bare && { background: fill }),
        '--zone-depth': depth,
        // nested zones pick this up via .zone--nested / .zone--dashed in index.css
        '--zone-border': line,
        // top-level zones get a clear border all around + a bolder left stripe
        ...(isTop && !bare && {
          border: `1px solid ${line}`,
          borderRadius: 12,
          borderLeft: `4px solid ${color}`,
        }),
      }}
    >
      {!bare && <div
        id={componentId}
        role={isComponent ? 'button' : undefined}
        tabIndex={isComponent ? 0 : undefined}
        aria-label={isComponent ? label : undefined}
        onClick={isComponent ? (e) => { e.stopPropagation(); onClick?.(componentId) } : undefined}
        onKeyDown={isComponent ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            e.stopPropagation()
            onClick?.(componentId)
          }
        } : undefined}
        className={`zone-label ${isHighlighted ? 'is-highlighted' : ''}`}
        style={{
          position: 'relative',
          color,
          borderColor: `${color}55`,
          background: `${color}10`,
          borderStyle: dashed ? 'dashed' : 'solid',
          cursor: isComponent ? 'pointer' : undefined,
          ...(isActive && {
            boxShadow: `inset 0 0 0 1px ${color}, 0 0 16px ${color}40`,
          }),
          // On the trace path but not the focused hop: a quieter inset ring.
          ...(isOnPath && {
            boxShadow: `inset 0 0 0 1px ${color}88`,
          }),
        }}
      >
        {label}
        {stepNum != null && (
          <span className="node-step-badge" title={`Step ${stepNum}`}>
            {stepNum}
          </span>
        )}
      </div>}
      <div className="zone-content">
        <div className="zone-content-inner">
          {children}
        </div>
      </div>
    </div>
  )
}
