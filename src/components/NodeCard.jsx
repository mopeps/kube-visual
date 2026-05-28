export default function NodeCard({
  id,
  title,
  typePrefix,
  badges = [],
  color,
  stepNum,
  isActive,
  isDimmed,
  onClick,
}) {
  return (
    <div
      id={id}
      onClick={(e) => { e.stopPropagation(); onClick?.(id) }}
      className={`node ${isActive ? 'is-active' : ''} ${isDimmed ? 'is-dimmed' : ''}`}
      style={{
        borderColor: isActive ? 'var(--packet)' : color,
        background: isActive
          ? `linear-gradient(180deg, ${color}14 0%, rgba(0,0,0,0.35) 100%)`
          : undefined,
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.borderColor = '#ffffff'
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.borderColor = color
      }}
    >
      {stepNum != null && (
        <span className="node-step-badge" title={`Step ${stepNum}`}>
          {stepNum}
        </span>
      )}
      {typePrefix && (
        <span className="node-type-prefix">[{typePrefix}]</span>
      )}
      <div className="node-title" style={{ color }}>{title}</div>
      {badges.length > 0 && (
        <div className="node-badges">
          {badges.map((b, i) => (
            <span
              key={i}
              className="node-badge"
              style={{
                color: b.color,
                borderColor: `${b.color}55`,
                background: `${b.color}1a`,
              }}
            >
              {b.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
