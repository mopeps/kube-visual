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
  // A Service card's type alias (svc_lb / svc_cip / svc_np) — replaces the
  // generic [Service] prefix so the card names its exposure model directly.
  typeAlias,
  // Optional, used by the Deep Dive canvas only — Overview never passes these,
  // so its cards are unchanged. `subtitle` is a status line; `badges` carry
  // relationship chips ({ label, kind: 'requires' | 'after' | 'stat' });
  // `variant` picks a diagram shape ('ellipse' for routers, 'bus' for the
  // full-width underlay) via a node--<variant> class.
  subtitle,
  badges,
  variant,
  // Optional extra class (Network mode tags realized-datapath leaf boxes with
  // `primitive-realized` so they read solid + lit).
  className,
  // Optional hover/focus handlers (Primitives mode spreads cross-highlight
  // handlers here so a leaf mount like /proc can light its PID-ns frame).
  hoverProps,
  replicaBadge,
  declarative,
  // Deep Dive (network views) only: keep `title` for the aria-label / popup but
  // omit the visible title line on the card face, so the box reads as
  // [TYPE] + tag (e.g. a node's GR / ext / LS logical objects).
  hideTitle,
  // Optional style passthrough — the OVN topology grid sets grid-row placement.
  style,
  // Optional small corner button (v2 anchors use it to reach the box's own
  // teaching popup, since the card body click is the anchor action). Stops
  // propagation so it doesn't trigger the card's onClick.
  cornerAction,
}) {
  const declarativeTypes = new Set(['Service', 'NWPOLICY', 'API Object', 'Custom Resource'])
  const isDeclarative = declarative ?? declarativeTypes.has(typePrefix)
  return (
    <div
      id={id}
      role="button"
      tabIndex={0}
      aria-label={`${typePrefix ? `[${typePrefix}] ` : ''}${title}`}
      {...(hoverProps || {})}
      onClick={(e) => { e.stopPropagation(); onClick?.(id) }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          e.stopPropagation()
          onClick?.(id)
        }
      }}
      className={`node ${isDeclarative ? 'node--declarative' : ''} ${variant ? `node--${variant}` : ''} ${isActive ? 'is-active' : ''} ${isOnPath ? 'is-on-path' : ''} ${isDimmed ? 'is-dimmed' : ''} ${isHighlighted ? 'is-highlighted' : ''} ${className || ''}`}
      style={{
        ...style,
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
      {cornerAction && (
        <button
          type="button"
          className="node-corner-action"
          title={cornerAction.title}
          aria-label={cornerAction.title}
          onClick={(e) => { e.stopPropagation(); cornerAction.onClick?.() }}
        >
          {cornerAction.label}
        </button>
      )}
      {typePrefix && typePrefix !== 'Pod' && (
        <span className="node-type-prefix" style={{ color: 'var(--tx-muted)' }}>
          {/* Static Pods drop the glyph so every [STATIC POD] card reads the
              same — the expand-in-place cards (etcd, controller-manager) never
              had one, and the thumbtack was the only thing making them differ. */}
          {typePrefix !== 'Static Pod' && <TypeIcon typePrefix={typePrefix} className="type-icon" />}
          [{typeAlias || typePrefix}]
        </span>
      )}
      {!hideTitle && <div className="node-title" style={{ color }}>{title}</div>}
      {subtitle && <div className="node-subtitle">{subtitle}</div>}
      {replicaBadge && (
        <div className="node-badges">
          <span className="node-badge node-badge--static" style={{ color }}>{replicaBadge}</span>
        </div>
      )}
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
