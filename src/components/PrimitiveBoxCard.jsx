import { useState } from 'react'
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
  // DOM-id namespace prefix — Network mode uses the default `nt-c` (its three
  // columns + edge overlay anchor to it); Primitives mode passes `pr-c` so its
  // cards never collide with another mode's raw / `nt-c` ids.
  idPrefix = 'nt-c',
  // The word shown beside the ▸ chevron when collapsed. Network mode shows
  // "internals"; Primitives mode passes null so the box carries no such label
  // (just the drill chevron).
  hint = 'internals',
}) {
  const domId = `${idPrefix}${colIndex}-${node.id}`
  const subId = (id) => `${idPrefix}${colIndex}-${id}`

  // Cross-highlight: hovering/focusing a relationship chip — or the socket / an
  // interface — lights up the boxes it links to. The [mnt] chip lights the
  // mount-ns frame; the process's [fd] chip lights its socket; the socket lights
  // eth0/lo + the process (residence + termination + fd-ownership). `hover` is the
  // transient set; clicking a chip pins a set so touch users get the highlight too.
  const [hover, setHover] = useState(null)
  const [pin, setPin] = useState(null)
  const hlSet = hover || pin?.ids
  const isHL = (id) => !!hlSet && hlSet.has(id)
  const linkHover = (ids) => ({
    onMouseEnter: () => setHover(new Set(ids)),
    onMouseLeave: () => setHover(null),
    onFocus: () => setHover(new Set(ids)),
    onBlur: () => setHover(null),
  })
  const pinToggle = (key, ids) => (e) => {
    e.stopPropagation()
    setPin((p) => (p?.key === key ? null : { key, ids: new Set(ids) }))
  }

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
        className={`primitive-port ${isHL(p.id) ? 'is-hl' : ''}`}
        style={{ '--node-accent': accent }}
        {...(p.linkIds ? linkHover(p.linkIds) : {})}
        onClick={(e) => { e.stopPropagation(); onSelectBox(p) }}
        title={p.caption ? `${p.title} — ${p.caption}` : p.title}
      >
        <span className="primitive-port-dot" aria-hidden />
        <span className="primitive-port-label" style={{ color: accent }}>{p.title}</span>
      </button>
    )
  }

  // A socket endpoint (variant: 'socket' / 'tunnel' / 'listen') is not a NIC —
  // it's a syscall-level endpoint. All share a "jack" ring (the bound port the
  // process holds an fd to) but differ in their trailing cue:
  //   • socket → radiating broadcast arcs ))) : a raw frame announced onto the
  //     wire (MetalLB's gratuitous ARP — emission)
  //   • tunnel → a nested bore/mouth: the persistent two-way reverse tunnel
  //     (Konnectivity)
  //   • listen → concentric inlet rings pointing inward: a passive TCP_LISTEN
  //     endpoint where inbound connections terminate (the Pod's app socket)
  // A listen socket carries `linkIds`, so hovering it lights eth0/lo (where its
  // packets arrive) and the process that owns its fd.
  const renderSocket = (s) => {
    const accent = `var(--${s.colorVar || 'k-orange'})`
    const tunnel = s.variant === 'tunnel'
    const listen = s.variant === 'listen'
    return (
      <button
        key={s.id}
        id={subId(s.id)}
        type="button"
        className={`primitive-socket${tunnel ? ' primitive-socket--tunnel' : ''}${listen ? ' primitive-socket--listen' : ''} ${isHL(s.id) ? 'is-hl' : ''}`}
        style={{ '--node-accent': accent }}
        {...(s.linkIds ? linkHover(s.linkIds) : {})}
        onClick={(e) => { e.stopPropagation(); onSelectBox(s) }}
        title={s.caption ? `${s.title} — ${s.caption}` : s.title}
      >
        <span className="primitive-socket-jack" aria-hidden />
        <span className="primitive-socket-label" style={{ color: accent }}>{s.title}</span>
        {tunnel ? (
          <span className="primitive-tunnel-bore" aria-hidden />
        ) : listen ? (
          <span className="primitive-socket-inlet" aria-hidden>
            <i /><i /><i />
          </span>
        ) : (
          <span className="primitive-socket-emit" aria-hidden>
            <i /><i /><i />
          </span>
        )}
      </button>
    )
  }

  // A guard (variant:'guard') is a filter the runtime applies to the container —
  // a SELinux MCS label, a seccomp profile, a capability set. It isn't a place
  // anything lives, so it reads as a small shield chip rather than a box.
  const renderGuard = (g) => {
    const accent = `var(--${g.colorVar || 'k-orange'})`
    return (
      <button
        key={g.id}
        id={subId(g.id)}
        type="button"
        className="primitive-guard"
        style={{ '--node-accent': accent }}
        onClick={(e) => { e.stopPropagation(); onSelectBox(g) }}
        title={g.caption ? `${g.title} — ${g.caption}` : g.title}
      >
        <span className="primitive-guard-ic" aria-hidden />
        <span className="primitive-guard-label" style={{ color: accent }}>{g.title}</span>
      </button>
    )
  }

  // A filesystem row (variant:'fsrow') — the mount namespace is drawn as a real
  // filesystem: a tight list of slim one-liners, each a path + the backing that
  // mounts it (overlayfs / tmpfs / block / hostPath / procfs) + its source. /proc
  // carries a link so hovering it lights the PID-ns frame whose contents it shows.
  const renderFsRow = (f) => {
    const accent = `var(--${f.colorVar || 'k-ghost'})`
    return (
      <button
        key={f.id}
        id={subId(f.id)}
        type="button"
        className={`primitive-fsrow ${isHL(f.id) ? 'is-hl' : ''}`}
        style={{ '--node-accent': accent }}
        {...(f.linkIds ? linkHover(f.linkIds) : {})}
        onClick={(e) => { e.stopPropagation(); onSelectBox(f) }}
        title={f.source ? `${f.title} — ${f.source}` : f.title}
      >
        <span className="fsrow-path fsrow-path--full">{f.title}</span>
        <span className="fsrow-path fsrow-path--short">{f.shortPath || f.title}</span>
        <span className="fsrow-type">{f.fsType}</span>
        <span className="fsrow-kind" style={{ color: accent }}>{f.kindLabel}</span>
        {f.source && <span className="fsrow-src">{f.source}</span>}
      </button>
    )
  }

  // The process card carries a row of namespace-membership chips: the process
  // isn't "inside" one namespace, it's a member of several at once. Each chip
  // lights up the frame of the namespace it joins on hover/focus (and pins it on
  // click for touch), making the orthogonal process↔namespace relationship legible
  // — the [mnt] chip → the mount-ns box (which holds the rootfs) is the
  // "this process sees those files" link.
  // One chip → one link to the box it references; hovering lights that box,
  // clicking pins it. Used for both the namespace memberships and the held fd.
  const renderLinkChip = (c, suffixTitle) => (
    <button
      key={c.tag}
      type="button"
      className={`primitive-membership ${isHL(c.boxId) ? 'is-active' : ''}`}
      style={{ '--node-accent': `var(--${c.colorVar})` }}
      {...linkHover([c.boxId])}
      onClick={pinToggle(c.boxId, [c.boxId])}
      title={`${c.tag} · ${c.view}${suffixTitle || ''}`}
    >
      {c.tag}
    </button>
  )

  const renderProcess = (b) => {
    const accent = `var(--${b.colorVar || 'k-green'})`
    return (
      <div
        key={b.id}
        id={subId(b.id)}
        role="button"
        tabIndex={0}
        className={`node primitive-process ${isHL(b.id) ? 'is-hl' : ''}`}
        style={{ '--node-accent': accent }}
        onClick={(e) => { e.stopPropagation(); onSelectBox(b) }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onSelectBox(b) }
        }}
      >
        {b.typePrefix && (
          <span className="node-type-prefix" style={{ color: 'var(--tx-muted)' }}>[{b.typePrefix}]</span>
        )}
        <div className="node-title" style={{ color: accent }}>{b.title}</div>
        {b.caption && <div className="node-subtitle">{b.caption}</div>}
        {b.memberships?.length > 0 && (
          <div className="primitive-memberships">
            <span className="primitive-memberships-lead">member of</span>
            {b.memberships.map((m) => renderLinkChip(m, ' — hover to find its box'))}
          </div>
        )}
        {b.holds?.length > 0 && (
          <div className="primitive-memberships">
            <span className="primitive-memberships-lead">holds</span>
            {b.holds.map((h) => renderLinkChip(h, ' — hover to find it'))}
          </div>
        )}
      </div>
    )
  }

  // A box may nest child boxes (ports drawn ON a bridge, rows INSIDE the NB DB).
  // Leaf → a plain NodeCard; container → a framed box with a clickable header.
  // A cgroup 'envelope' or a namespace 'ns' is always a frame even when it nests
  // nothing (an empty IPC/UTS boundary still reads as an isolation boundary).
  // Interface children peel off onto the rim as port tabs; the rest stay in the
  // body, recursively rendered (the NB DB rows, the guest's realized OpenFlow).
  // Every box keeps a per-column DOM id so the canvas edge overlay can wire it.
  const renderBox = (b) => {
    const accent = `var(--${b.colorVar || 'k-amber'})`
    if (b.variant === 'guard') return renderGuard(b)
    if (b.memberships?.length) return renderProcess(b)
    if (b.children?.length || b.variant === 'ns' || b.variant === 'envelope') {
      const kids = b.children || []
      const ports = kids.filter((c) => c.variant === 'iface')
      // Guard chips are collected into their own full-width strip so a row of
      // small chips never shoves the bigger namespace frames off to the right.
      const guards = kids.filter((c) => c.variant === 'guard')
      // Filesystem rows render as one tight list (a real-filesystem listing), not
      // loose boxes in the flex body.
      const fsrows = kids.filter((c) => c.variant === 'fsrow')
      const inner = kids.filter((c) => c.variant !== 'iface' && c.variant !== 'guard' && c.variant !== 'fsrow')
      return (
        <div
          key={b.id}
          id={subId(b.id)}
          className={`primitive-nest ${b.variant ? `primitive-nest--${b.variant}` : ''} ${b.stretch ? `primitive-nest--${b.stretch}` : ''} ${ports.length ? 'primitive-nest--has-ports' : ''} ${b.realized ? 'primitive-realized' : ''} ${isHL(b.id) ? 'is-hl' : ''}`}
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
          {(inner.length > 0 || guards.length > 0 || fsrows.length > 0) && (
            <div className="primitive-nest-body">
              {guards.length > 0 && (
                <div className="primitive-guard-strip">{guards.map(renderBox)}</div>
              )}
              {fsrows.length > 0 && (
                <div className="primitive-fslist">{fsrows.map(renderFsRow)}</div>
              )}
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
    // Standalone band primitives: a socket endpoint gets the socket form; a
    // real interface (tap0) gets the same port block as a bridge child, just
    // sitting in its band row rather than on a bridge rim.
    if (b.variant === 'socket' || b.variant === 'tunnel' || b.variant === 'listen') return renderSocket(b)
    if (b.variant === 'fsrow') return renderFsRow(b)
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
        className={`${b.realized ? 'primitive-realized' : ''} ${isHL(b.id) ? 'is-hl' : ''}`}
        hoverProps={b.linkIds ? linkHover(b.linkIds) : undefined}
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
        aria-label={`[${node.typePrefix}] ${node.title} — ${hint ? `show ${hint}` : 'open'}`}
        onClick={(e) => { e.stopPropagation(); onToggle() }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onToggle() }
        }}
        className="node intent-store"
        style={{ '--node-accent': color }}
        title={hint ? `Show ${hint}` : 'Open'}
      >
        {node.typePrefix !== 'Pod' && (
          <span className="node-type-prefix" style={{ color: 'var(--tx-muted)' }}>[{node.typePrefix}]</span>
        )}
        <div className="node-title" style={{ color }}>{node.title}</div>
        {hint && (
          <div className="intent-store-hint" style={{ color }}>
            {hint}
          </div>
        )}
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
          aria-label={`Collapse${hint ? ` ${hint}` : ''}`}
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
          {band.label && <div className="primitive-band-label">{band.label}</div>}
          <div className="primitive-band-boxes">
            {band.boxes.map(renderBox)}
          </div>
        </div>
      ))}
    </div>
  )
}
