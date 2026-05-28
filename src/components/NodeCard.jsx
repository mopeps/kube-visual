export default function NodeCard({
  id,
  title,
  typePrefix,
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
        <span
          className="node-type-prefix"
          style={{ color: 'var(--k-purple)', textShadow: '0 0 8px #7c3aed80' }}
        >
          [{typePrefix}]
        </span>
      )}
      <div className="node-title" style={{ color }}>{title}</div>
    </div>
  )
}
