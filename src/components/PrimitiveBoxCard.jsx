import NodeCard from './NodeCard'

// A network-mode component box that opens *in place* to show its own internal
// Linux primitives + integrations — partitioned inside the component's OWN card
// (never a zone). Expanded is the default; the ▴ control collapses just this one
// (independently of the others). The outer DOM id and every sub-box id are
// namespaced per column (`nt-c{N}-…`) so the three parallel columns never collide
// and the canvas edge overlay can wire them.
//
// Collapsed mirrors the RealizedFlowsCard affordance; clicking it re-expands.
export default function PrimitiveBoxCard({
  node,
  internal,
  colIndex,
  color,
  isOpen,
  onToggle,
  onSelectComponent,
  onSelectBox,
}) {
  const domId = `nt-c${colIndex}-${node.id}`
  const subId = (id) => `nt-c${colIndex}-${id}`

  // An interface/port (variant: 'iface') is no longer a full card stacked inside
  // its bridge — it's a small pill tab docked on the bridge's bottom rim, so it
  // reads as a port plugged into the switch (distinct from, and smaller than, the
  // primitive cards). Keeps its per-column DOM id for edge wiring.
  const renderPort = (p) => {
    const accent = `var(--${p.colorVar || 'k-teal'})`
    return (
      <button
        key={p.id}
        id={subId(p.id)}
        type="button"
        className="primitive-port"
        style={{ '--node-accent': accent }}
        onClick={(e) => { e.stopPropagation(); onSelectBox(p) }}
        title={p.caption ? `${p.title} — ${p.caption}` : p.title}
      >
        <span className="primitive-port-dot" aria-hidden />
        <span className="primitive-port-label" style={{ color: accent }}>{p.title}</span>
      </button>
    )
  }

  // A box may nest child boxes (ports drawn ON a bridge, rows INSIDE the NB DB).
  // Leaf → a plain NodeCard; container → a framed box with a clickable header.
  // Interface children peel off onto the rim as port tabs; the rest stay in the
  // body, recursively rendered (the NB DB rows, the guest's realized OpenFlow).
  // Every box keeps a per-column DOM id so the canvas edge overlay can wire it.
  const renderBox = (b) => {
    const accent = `var(--${b.colorVar || 'k-amber'})`
    if (b.children?.length) {
      const ports = b.children.filter((c) => c.variant === 'iface')
      const inner = b.children.filter((c) => c.variant !== 'iface')
      return (
        <div
          key={b.id}
          id={subId(b.id)}
          className={`primitive-nest ${b.variant ? `primitive-nest--${b.variant}` : ''} ${ports.length ? 'primitive-nest--has-ports' : ''}`}
          style={{ '--node-accent': accent }}
        >
          <button
            type="button"
            className="primitive-nest-head"
            onClick={(e) => { e.stopPropagation(); onSelectBox(b) }}
            title={`Open ${b.title} details`}
          >
            {b.typePrefix && (
              <span className="node-type-prefix" style={{ color: 'var(--tx-muted)' }}>[{b.typePrefix}]</span>
            )}
            <span className="primitive-nest-title" style={{ color: accent }}>{b.title}</span>
            {b.caption && <span className="primitive-nest-cap">{b.caption}</span>}
          </button>
          {inner.length > 0 && (
            <div className="primitive-nest-body">
              {inner.map(renderBox)}
            </div>
          )}
          {ports.length > 0 && (
            <div className="primitive-nest-ports">
              {ports.map(renderPort)}
            </div>
          )}
        </div>
      )
    }
    // A standalone interface primitive (a band box, not a bridge child — tap0,
    // the raw socket, the tunnel endpoint) renders as the same small pill so
    // every interface reads alike; it just sits in its band row rather than on
    // a bridge rim.
    if (b.variant === 'iface') return renderPort(b)
    return (
      <NodeCard
        key={b.id}
        id={subId(b.id)}
        title={b.title}
        typePrefix={b.typePrefix}
        variant={b.variant}
        color={accent}
        subtitle={b.caption}
        onClick={() => onSelectBox(b)}
      />
    )
  }

  if (!isOpen) {
    return (
      <div
        id={domId}
        role="button"
        tabIndex={0}
        aria-expanded={false}
        aria-label={`[${node.typePrefix}] ${node.title} — show internals`}
        onClick={(e) => { e.stopPropagation(); onToggle() }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onToggle() }
        }}
        className="node intent-store"
        style={{ '--node-accent': color }}
        title="Show internals"
      >
        {node.typePrefix !== 'Pod' && (
          <span className="node-type-prefix" style={{ color: 'var(--tx-muted)' }}>[{node.typePrefix}]</span>
        )}
        <div className="node-title" style={{ color }}>{node.title}</div>
        <div className="intent-store-hint" style={{ color }}>
          <span className="intent-store-chevron">▸</span>internals
        </div>
      </div>
    )
  }

  return (
    <div
      id={domId}
      className="intent-store-expanded primitive-box"
      style={{ '--node-accent': color, '--store-accent': color }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="intent-store-header">
        <button
          type="button"
          className="intent-store-title"
          style={{ color }}
          onClick={(e) => { e.stopPropagation(); onSelectComponent(node.id) }}
          title={`Open ${node.title} details`}
        >
          {node.typePrefix !== 'Pod' && (
            <span className="node-type-prefix" style={{ color: 'var(--tx-muted)', display: 'inline', marginRight: 6 }}>
              [{node.typePrefix}]
            </span>
          )}
          {node.title}
          <span className="intent-store-info" aria-hidden="true">ⓘ</span>
        </button>
        <button
          type="button"
          className="intent-store-collapse"
          onClick={(e) => { e.stopPropagation(); onToggle() }}
          aria-label="Collapse internals"
          title="Collapse"
        >
          ▴
        </button>
      </div>

      {internal.bands.map((band, bi) => (
        <div className="primitive-band" key={bi}>
          {band.boundary && (
            <div className="primitive-boundary" aria-hidden>
              <span>{band.boundary}</span>
            </div>
          )}
          <div className="primitive-band-label">{band.label}</div>
          <div className="primitive-band-boxes">
            {band.boxes.map(renderBox)}
          </div>
        </div>
      ))}
    </div>
  )
}
