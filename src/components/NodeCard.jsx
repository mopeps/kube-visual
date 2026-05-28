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
        '--node-accent': color,
        background: isActive
          ? `linear-gradient(180deg, ${color}14 0%, rgba(0,0,0,0.35) 100%)`
          : undefined,
      }}
    >
      {stepNum != null && (
        <span className="node-step-badge" title={`Step ${stepNum}`}>
          {stepNum}
        </span>
      )}
      {typePrefix && (
        <span className="node-type-prefix" style={{ color: 'var(--tx-muted)' }}>
          [{typePrefix}]
        </span>
      )}
      <div className="node-title" style={{ color }}>{title}</div>
    </div>
  )
}
