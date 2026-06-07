import { useRef } from 'react'
import Zone from './Zone'
import NodeCard from './NodeCard'
import ReconLoopOverlay from './ReconLoopOverlay'
import DeepDiveArrowOverlay from './DeepDiveArrowOverlay'

// Renders a deep-dive topic as an Overview-style canvas: a stack of labelled
// zones holding clickable boxes. Reuses Zone / NodeCard (pure presentational),
// with a custom onClick that opens the deep-dive popup instead of the node
// modal. When the topic declares `reconciliation`, it also drives the animated
// systemd loop — the cgroup box becomes an interactive process table (click a
// PID to kill it), with live status overlays and a travelling signal courier.
// The `loop` state (and its bottom-docked navigator) is owned by App and passed
// in, so the navigator can dock to the viewport like the hop inspectors.

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
        <span className="cgroup-frame-label" title="The PIDs the kernel tracks inside this unit’s cgroup (the cgroup.procs file)">cgroup.procs</span>
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
  loop,
  onSelectBox,
  onSelectEdge,
  activeFlow,
  activeFlowStep,
  onSelectFlowStep,
  colorOf,
}) {
  const overlays = loop.overlays
  const recon = topic.reconciliation
  const stackRef = useRef(null)

  // Figure/ground for the trace, mirroring the Overview: the packet-red highlight
  // is reserved for the *focused* hop's two boxes. With no hop focused the canvas
  // stays quiet — every box just wears its own zone accent (the whole topic is one
  // flow, so highlighting every box would leave nothing to stand out against).
  // Boxes are already ordered by their [STAGE n] / [STEP n] labels, so they carry
  // no separate corner step-badge (which used to contradict those labels).
  const focusedStep = activeFlow && activeFlowStep != null
    ? activeFlow.steps.find(s => s.step === activeFlowStep)
    : null
  const focusedIds = focusedStep
    ? new Set([focusedStep.sourceBoxId, focusedStep.targetBoxId])
    : null

  // Boxes carry only their heading on the canvas — the static descriptive
  // subtitle lives in the popup (DeepDiveModal) so the canvas stays uncluttered.
  // The one exception is the reconciliation overlay's *live* status line (ov),
  // shown only while the systemd walkthrough is armed: dynamic feedback, not a
  // description.
  const renderBox = (box, zone) => {
    const ov = overlays[box.id]
    const accent = ov?.accent || accentOf(zone, topic)
    const isActive = focusedIds?.has(box.id) || false
    const isDimmed = focusedIds ? !focusedIds.has(box.id) : false

    // Static subtitles are hidden on the resting canvas for every topic; on the
    // systemd topic the overlay's live status line returns while armed.
    const subtitle = recon
      ? (loop.armed ? ov?.subtitle : undefined)
      : undefined

    if (recon && box.id === recon.cgroupBoxId) {
      return (
        <CgroupBox
          key={box.id}
          box={box}
          accent={accent}
          subtitle={subtitle}
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
        subtitle={subtitle}
        badges={box.badges}
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
      parallel={zone.parallel}
      depth={depth}
    >
      {zone.boxes?.map((box) => renderBox(box, zone))}
      {zone.zones?.map((child) => renderZone(child, depth + 1))}
    </Zone>
  )

  return (
    <div className="deep-dive-canvas">
      <div className={`overview-canvas recon-stack ${recon?.edges ? 'recon-stack--edges' : ''}`} ref={stackRef}>
        {recon?.edges && (
          <ReconLoopOverlay
            edges={recon.edges}
            canvasRef={stackRef}
            activeEdgeId={loop.activeEdgeId}
            signal={loop.signal}
            onSelectEdge={onSelectEdge}
          />
        )}
        {topic.zones.map((zone) => renderZone(zone))}
        {/* Trace arrows paint last (over the boxes), exactly like the Overview's
            ArrowOverlay sits as the final child of its canvas. */}
        {activeFlow && (
          <DeepDiveArrowOverlay
            activeFlow={activeFlow}
            canvasRef={stackRef}
            activeStep={activeFlowStep}
            onSelectStep={onSelectFlowStep}
            colorOf={colorOf}
          />
        )}
      </div>
    </div>
  )
}
