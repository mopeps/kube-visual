export default function Zone({
  label,
  color,
  dashed = false,
  depth = 0,
  children,
  // When a zone doubles as a component (e.g. the VM), these wire its label up
  // as an arrow anchor (id), a click target, and a trace step badge.
  componentId,
  stepNum,
  isActive = false,
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
      className={`zone ${dashed ? 'zone--dashed' : ''} ${depth > 0 ? 'zone--nested' : ''}`}
      style={{
        background: fill,
        '--zone-depth': depth,
        // nested zones pick this up via .zone--nested / .zone--dashed in index.css
        '--zone-border': line,
        // top-level zones get a clear border all around + a bolder left stripe
        ...(isTop && {
          border: `1px solid ${line}`,
          borderRadius: 12,
          borderLeft: `4px solid ${color}`,
        }),
      }}
    >
      <div
        id={componentId}
        onClick={isComponent ? (e) => { e.stopPropagation(); onClick?.(componentId) } : undefined}
        className="zone-label"
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
        }}
      >
        {label}
        {stepNum != null && (
          <span className="node-step-badge" title={`Step ${stepNum}`}>
            {stepNum}
          </span>
        )}
      </div>
      <div className="zone-content">
        <div className="zone-content-inner">
          {children}
        </div>
      </div>
    </div>
  )
}
