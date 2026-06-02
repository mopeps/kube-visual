import Zone from './Zone'
import NodeCard from './NodeCard'
import useReconciliationLoop from '../hooks/useReconciliationLoop'

// Renders a deep-dive topic as an Overview-style canvas: a stack of labelled
// zones holding clickable boxes. Reuses Zone / NodeCard (pure presentational),
// with a custom onClick that opens the deep-dive popup instead of the node
// modal. When the topic declares `reconciliation`, it also drives the animated
// systemd loop — the cgroup box becomes an interactive process table (click a
// PID to kill it), with live status overlays, a control bar and a travelling
// signal courier.

const accentOf = (zone, topic) => `var(--${zone.colorVar || topic.colorVar || 'k-cyan'})`

// The cgroup box: a NodeCard-styled container that shows the processes the
// kernel pins inside the unit's cgroup. Clicking a PID kills it; clicking the
// box background opens its detail popup. Children sit visibly trapped here until
// systemd sweeps them.
function CgroupBox({ box, accent, subtitle, highlight, procs, running, onKillMain, onKillChild, onOpen }) {
  const killProc = (e, p) => {
    e.stopPropagation()
    if (running) return
    if (p.role === 'main') onKillMain()
    else onKillChild(p.pid)
  }
  return (
    <div
      id={`dd-${box.id}`}
      role="button"
      tabIndex={0}
      className={`node deep-cgroup-box ${highlight ? 'is-highlighted' : ''}`}
      style={{ '--node-accent': accent }}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
    >
      {box.typePrefix && <span className="node-type-prefix" style={{ color: 'var(--tx-muted)' }}>[{box.typePrefix}]</span>}
      <div className="node-title" style={{ color: accent }}>{box.title}</div>
      {subtitle && <div className="node-subtitle">{subtitle}</div>}

      <div className="cgroup-frame">
        <span className="cgroup-frame-label">cgroup.procs · kernel-pinned</span>
        <div className="cgroup-procs">
          {procs.length === 0 && (
            <span className="cgroup-empty">swept — re-execing fresh process…</span>
          )}
          {procs.map((p) => (
            <button
              key={p.pid}
              type="button"
              className={`cgroup-proc cgroup-proc--${p.state} ${p.role === 'main' ? 'is-main' : ''}`}
              onClick={(e) => killProc(e, p)}
              disabled={running || p.state !== 'running'}
              title={
                p.state === 'trapped' ? 'Trapped — the kernel won’t let it escape the cgroup'
                : p.role === 'main' ? 'Kill the main PID → unit restarts'
                : 'Kill this child → reaped, no restart'
              }
            >
              <span className="cgroup-proc-pid">{p.pid}</span>
              <span className="cgroup-proc-label">{p.label}</span>
              {p.role === 'main' && <span className="cgroup-proc-tag">main</span>}
              {p.state === 'trapped' && <span className="cgroup-proc-lock" aria-hidden>🔒</span>}
              {p.state === 'running' && <span className="cgroup-proc-x" aria-hidden>✕</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function DeepDiveCanvas({ topic, onSelectBox }) {
  const loop = useReconciliationLoop(topic.reconciliation)
  const overlays = loop.overlays
  const recon = topic.reconciliation

  const renderBox = (box, zone) => {
    const ov = overlays[box.id]
    const accent = ov?.accent || accentOf(zone, topic)

    if (recon && box.id === recon.cgroupBoxId) {
      return (
        <CgroupBox
          key={box.id}
          box={box}
          accent={accent}
          subtitle={ov?.subtitle ?? box.subtitle}
          highlight={ov?.highlight}
          procs={loop.procs}
          running={loop.running}
          onKillMain={loop.killMain}
          onKillChild={loop.killChild}
          onOpen={() => onSelectBox(box.id)}
        />
      )
    }

    return (
      <NodeCard
        key={box.id}
        id={`dd-${box.id}`}
        title={box.title}
        typePrefix={box.typePrefix}
        color={accent}
        subtitle={ov?.subtitle ?? box.subtitle}
        badges={box.badges}
        isHighlighted={ov?.highlight}
        onClick={() => onSelectBox(box.id)}
      />
    )
  }

  const renderZone = (zone, depth = 0) => (
    <Zone
      key={zone.id}
      label={zone.label}
      color={accentOf(zone, topic)}
      dashed={zone.dashed}
      depth={depth}
    >
      {zone.boxes?.map((box) => renderBox(box, zone))}
      {zone.zones?.map((child) => renderZone(child, depth + 1))}
    </Zone>
  )

  return (
    <div className="deep-dive-canvas">
      {recon && (
        <div className="recon-controls" data-noswipe>
          <span className="recon-controls-label">Reconciliation loop</span>
          <button
            type="button"
            className="recon-btn recon-btn--kill"
            onClick={loop.killMain}
            disabled={loop.running}
          >
            ⚡ Kill Main PID {recon.main.pid}
          </button>
          <button
            type="button"
            className="recon-btn"
            onClick={loop.reset}
            disabled={loop.running}
          >
            ↺ Reset
          </button>
          <span className="recon-phase">{phaseLabel(loop.phase)}</span>
        </div>
      )}

      <div className="overview-canvas recon-stack">
        {loop.courier?.active && (
          <div className={`recon-courier is-${loop.courier.dir}`} aria-hidden>
            {loop.courier.label}
          </div>
        )}
        {topic.zones.map((zone) => renderZone(zone))}
      </div>
    </div>
  )
}

function phaseLabel(phase) {
  switch (phase) {
    case 'killed': return 'main process killed'
    case 'sigchld': return 'kernel fired SIGCHLD ↑'
    case 'failed': return 'engine woke · UNIT_FAILED'
    case 'sweep': return 'sweeping trapped children'
    case 'restart': return 'fork() / execve() ↓'
    case 'active': return 'restarted · UNIT_ACTIVE'
    case 'child-killed': return 'child killed · SIGCHLD ↑'
    case 'child-reaped': return 'child reaped · unit ACTIVE'
    default: return 'idle · UNIT_ACTIVE'
  }
}
