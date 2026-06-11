import TypeIcon from './TypeIcon'

export default function NodeCard({
  id,
  title,
  typePrefix,
  color,
  stepNum,
  isActive,
  isOnPath,
  isDimmed,
  isHighlighted,
  onClick,
  // Optional, used by the Deep Dive canvas only — Overview never passes these,
  // so its cards are unchanged. `subtitle` is a status line; `badges` carry
  // relationship chips ({ label, kind: 'requires' | 'after' | 'stat' }).
  subtitle,
  badges,
}) {
  return (
    <div
      id={id}
      role="button"
      tabIndex={0}
      aria-label={`${typePrefix ? `[${typePrefix}] ` : ''}${title}`}
      onClick={(e) => { e.stopPropagation(); onClick?.(id) }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          e.stopPropagation()
          onClick?.(id)
        }
      }}
      className={`node ${isActive ? 'is-active' : ''} ${isOnPath ? 'is-on-path' : ''} ${isDimmed ? 'is-dimmed' : ''} ${isHighlighted ? 'is-highlighted' : ''}`}
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
      {typePrefix && typePrefix !== 'Pod' && (
        <span className="node-type-prefix" style={{ color: 'var(--tx-muted)' }}>
          {/* Static Pods drop the glyph so every [STATIC POD] card reads the
              same — the expand-in-place cards (etcd, controller-manager) never
              had one, and the thumbtack was the only thing making them differ. */}
          {typePrefix !== 'Static Pod' && <TypeIcon typePrefix={typePrefix} className="type-icon" />}
          [{typePrefix}]
        </span>
      )}
      <div className="node-title" style={{ color }}>{title}</div>
      {subtitle && <div className="node-subtitle">{subtitle}</div>}
      {badges?.length > 0 && (
        <div className="node-badges">
          {badges.map((b) => (
            <span
              key={b.label}
              className={`node-badge node-badge--${b.kind || 'stat'}`}
              style={{ color }}
            >
              {b.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
