import { useRef } from 'react'
import Zone from './Zone'
import NodeCard from './NodeCard'
import ReconLoopOverlay from './ReconLoopOverlay'
import ReconControls from './ReconControls'
import DeepDiveArrowOverlay from './DeepDiveArrowOverlay'
import useReconciliationLoop from '../hooks/useReconciliationLoop'

// Map a flow's box ids → the step number each first appears in (mirrors the
// Overview's buildStepNumMap), so boxes can show a corner step badge.
function buildStepNumMap(flow) {
  const map = new Map()
  if (!flow) return map
  flow.steps.forEach(s => {
    if (!map.has(s.sourceBoxId)) map.set(s.sourceBoxId, s.step)
    if (!map.has(s.targetBoxId)) map.set(s.targetBoxId, s.step)
  })
  return map
}

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
function CgroupBox({ box, accent, subtitle, highlight, procs, locked, onKillMain, onKillChild, onOpen }) {
  const killProc = (e, p) => {
    e.stopPropagation()
    if (locked) return
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
              disabled={locked || p.state !== 'running'}
              title={
                locked ? 'Walkthrough in progress — Reset to kill a different PID'
                : p.state === 'trapped' ? 'Trapped — the kernel won’t let it escape the cgroup'
                : p.role === 'main' ? 'Kill the main PID → walk the restart'
                : 'Kill this child → walk the reap (no restart)'
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

export default function DeepDiveCanvas({
  topic,
  onSelectBox,
  activeFlow,
  activeFlowStep,
  onSelectFlowStep,
  activeBoxIds,
  colorOf,
}) {
  const loop = useReconciliationLoop(topic.reconciliation)
  const overlays = loop.overlays
  const recon = topic.reconciliation
  const stackRef = useRef(null)

  // Trace-flow highlighting (mirrors the Overview): boxes touched by the active
  // flow light up + carry a step badge, the rest dim down.
  const stepNums = buildStepNumMap(activeFlow)
  const hasActive = activeBoxIds && activeBoxIds.size > 0

  const renderBox = (box, zone) => {
    const ov = overlays[box.id]
    const accent = ov?.accent || accentOf(zone, topic)
    const isActive = activeBoxIds?.has?.(box.id)
    const isDimmed = hasActive && !isActive

    if (recon && box.id === recon.cgroupBoxId) {
      return (
        <CgroupBox
          key={box.id}
          box={box}
          accent={accent}
          subtitle={ov?.subtitle ?? box.subtitle}
          highlight={ov?.highlight}
          procs={loop.procs}
          locked={loop.armed}
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
        stepNum={stepNums.get(box.id)}
        isActive={isActive}
        isDimmed={isDimmed}
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
      {recon && <ReconControls loop={loop} recon={recon} />}

      <div className={`overview-canvas recon-stack ${recon?.edges ? 'recon-stack--edges' : ''}`} ref={stackRef}>
        {recon?.edges && (
          <ReconLoopOverlay
            edges={recon.edges}
            canvasRef={stackRef}
            activeEdgeId={loop.activeEdgeId}
            signal={loop.signal}
          />
        )}
        {activeFlow && (
          <DeepDiveArrowOverlay
            activeFlow={activeFlow}
            canvasRef={stackRef}
            activeStep={activeFlowStep}
            onSelectStep={onSelectFlowStep}
            colorOf={colorOf}
          />
        )}
        {topic.zones.map((zone) => renderZone(zone))}
      </div>
    </div>
  )
}
