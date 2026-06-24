import { useEffect, useMemo, useRef, useState } from 'react'
import Zone from './Zone'
import NodeCard from './NodeCard'
import DeepDiveRevealCard from './DeepDiveRevealCard'
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

// A box may carry its own colorVar (the OVN topology colour-codes switches /
// routers / pods like the classic diagram); otherwise it wears its zone's.
const accentOf = (zone, topic, box) =>
  `var(--${box?.colorVar || zone.colorVar || topic.colorVar || 'k-cyan'})`

// The cgroup box: a NodeCard-styled container that shows the processes the
// kernel pins inside the unit's cgroup. Clicking a PID kills it; clicking the
// box background opens its detail popup. Children sit visibly trapped here until
// systemd sweeps them.
function CgroupBox({ box, domId, accent, subtitle, highlight, hint, procs, locked, onKillMain, onKillChild, onOpen }) {
  const killProc = (e, p) => {
    e.stopPropagation()
    if (locked) return
    if (p.role === 'main') onKillMain()
    else onKillChild(p.pid)
  }
  return (
    <div
      id={domId}
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
      {/* Why these PIDs are clickable — shown until a walkthrough is armed, at
          which point the navigator's lede carries the framing instead. */}
      {!locked && hint && <p className="cgroup-hint">{hint}</p>}
    </div>
  )
}

export default function DeepDiveCanvas({
  topic,
  loop,
  onSelectBox,
  onSelectEdge,
  // Open a registered component's real object sheet — used when a grey ghost
  // zone IS a component (its label is the clickable depth-door).
  onSelectComponent,
  selectedBoxId,
  activeFlow,
  activeFlowStep,
  onSelectFlowStep,
  colorOf,
  // DOM-id namespace for every box on this canvas (and the overlays that anchor
  // to them): 'dd' for the Deep Dive tab, 'lg' for the Network lens's Map
  // altitude. Keeps the two from colliding when both render the same topic.
  idPrefix = 'dd',
}) {
  const overlays = loop.overlays
  const recon = topic.reconciliation
  const stackRef = useRef(null)
  const did = (id) => `${idPrefix}-${id}`

  // Which reveal-in-place boxes are expanded (the tmux parser FSM, the sudo fd
  // inheritance). Independent toggles, mirroring the etcd intent store.
  const [expanded, setExpanded] = useState(() => new Set())
  const toggleReveal = (id) => setExpanded((prev) => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  // child-step id → owning reveal box id, so opening a sub-step (e.g. via search)
  // can auto-expand its parent.
  const parentOf = useMemo(() => {
    const m = {}
    const walk = (zones) => {
      for (const z of zones || []) {
        for (const b of z.boxes || []) {
          for (const c of b.reveal?.boxes || []) m[c.id] = b.id
        }
        if (z.zones) walk(z.zones)
      }
    }
    walk(topic.zones)
    return m
  }, [topic])

  // Switching topics drops any expanded reveal cards.
  useEffect(() => { setExpanded(new Set()) }, [topic])

  // Opening a sub-step's popup expands its parent so the step is on screen.
  useEffect(() => {
    const parent = selectedBoxId && parentOf[selectedBoxId]
    if (parent) setExpanded((prev) => (prev.has(parent) ? prev : new Set(prev).add(parent)))
  }, [selectedBoxId, parentOf])

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
  // Every box the active flow touches — while a hop is focused, these keep an
  // .is-on-path tint so the rest of the route stays readable against the
  // dimmed off-path boxes (mirrors the Overview's figure/ground).
  const flowIds = useMemo(() => {
    if (!activeFlow) return null
    const ids = new Set()
    activeFlow.steps.forEach(s => { ids.add(s.sourceBoxId); ids.add(s.targetBoxId) })
    return ids
  }, [activeFlow])

  // Boxes carry only their heading on the canvas — the static descriptive
  // subtitle lives in the popup (DeepDiveModal) so the canvas stays uncluttered.
  // The one exception is the reconciliation overlay's *live* status line (ov),
  // shown only while the systemd walkthrough is armed: dynamic feedback, not a
  // description.
  const renderBox = (box, zone) => {
    // A spacer pseudo-box: an empty flex-grow gap inside a stretch-aligned
    // stack column (the OVN node columns push their pod group to the bottom
    // with one, mirroring the diagram's empty mid-section).
    if (box.spacer) return <div key={box.id} className="dd-spacer" aria-hidden />

    const ov = overlays[box.id]
    const accent = ov?.accent || accentOf(zone, topic, box)
    const isActive = focusedIds?.has(box.id) || false
    const isOnPath = focusedIds != null && !isActive && (flowIds?.has(box.id) || false)
    const isDimmed = focusedIds ? !isActive && !isOnPath : false

    // Static subtitles are hidden on the resting canvas for every topic; on the
    // systemd topic the overlay's live status line returns while armed. A box
    // may opt back in with `caption` — a one-line scope note the diagram needs
    // on the canvas itself (the OVN core's "spans every node").
    const subtitle = recon
      ? (loop.armed ? ov?.subtitle : undefined)
      : box.caption

    if (recon && box.id === recon.cgroupBoxId) {
      return (
        <CgroupBox
          key={box.id}
          box={box}
          domId={did(box.id)}
          accent={accent}
          subtitle={subtitle}
          highlight={ov?.highlight}
          hint={recon.hint}
          procs={loop.procs}
          locked={loop.armed}
          onKillMain={loop.killMain}
          onKillChild={loop.killChild}
          onOpen={() => onSelectBox(box.id)}
        />
      )
    }

    // A box that reveals its sub-steps in place (the tmux parser FSM, the sudo
    // fd inheritance) — expands like the etcd intent store instead of opening a
    // separate "Zoom-in" zone.
    if (box.reveal) {
      return (
        <DeepDiveRevealCard
          key={box.id}
          box={box}
          accent={accent}
          isActive={isActive}
          isOnPath={isOnPath}
          isDimmed={isDimmed}
          isExpanded={expanded.has(box.id)}
          highlightId={selectedBoxId}
          onToggle={() => toggleReveal(box.id)}
          onSelectBox={onSelectBox}
          idPrefix={idPrefix}
        />
      )
    }

    return (
      <NodeCard
        key={box.id}
        id={did(box.id)}
        title={box.title}
        hideTitle={box.hideTitleOnCanvas}
        typePrefix={box.typePrefix}
        variant={box.variant}
        color={accent}
        subtitle={subtitle}
        badges={box.badges}
        isActive={isActive}
        isOnPath={isOnPath}
        isDimmed={isDimmed}
        isHighlighted={ov?.highlight}
        onClick={() => onSelectBox(box.id)}
      />
    )
  }

  // Consecutive boxes flagged `inline` render side by side in one row (the OVN
  // pods sitting two-up under their logical switch); everything else stacks
  // per the zone layout as before.
  const renderZoneBoxes = (zone) => {
    const out = []
    let row = null
    for (const box of zone.boxes ?? []) {
      if (box.inline) {
        if (!row) { row = []; out.push(row) }
        row.push(box)
      } else {
        row = null
        out.push(box)
      }
    }
    return out.map((entry) =>
      Array.isArray(entry) ? (
        <div key={`row-${entry[0].id}`} className="dd-box-row">
          {entry.map((box) => renderBox(box, zone))}
        </div>
      ) : (
        renderBox(entry, zone)
      )
    )
  }

  const renderZone = (zone, depth = 0) => (
    <Zone
      key={zone.id}
      label={zone.label}
      labelBadges={zone.labelBadges}
      color={accentOf(zone, topic)}
      dashed={zone.dashed}
      boundaryKind={zone.boundaryKind}
      depth={depth}
      layout={zone.layout}
      bare={zone.bare}
      ghost={zone.ghost}
      className={zone.className}
      componentId={zone.componentId}
      domId={zone.componentId ? did(zone.id) : undefined}
      onClick={zone.componentId ? onSelectComponent : undefined}
    >
      {renderZoneBoxes(zone)}
      {/* A child entry may be a spacer pseudo-zone — the flex-grow gap between
          sibling zones (the OVN big view's mid-column gap, where the node
          column holds zones, not boxes). */}
      {zone.zones?.map((child) =>
        child.spacer
          ? <div key={child.id} className="dd-spacer" aria-hidden />
          : renderZone(child, depth + 1)
      )}
    </Zone>
  )

  return (
    <div className="deep-dive-canvas">
      <div
        className={`overview-canvas recon-stack ${recon?.edges ? 'recon-stack--edges' : ''} ${topic.topology?.edges ? 'recon-stack--topology' : ''} ${topic.canvasClass || ''}`}
        ref={stackRef}
      >
        {recon?.edges && (
          <ReconLoopOverlay
            edges={recon.edges}
            canvasRef={stackRef}
            activeEdgeId={loop.activeEdgeId}
            signal={loop.signal}
            onSelectEdge={onSelectEdge}
            idPrefix={idPrefix}
          />
        )}
        {/* Static topology edges — the always-on structural links of a topic
            (e.g. the OVN logical wiring), reusing the recon-loop edge renderer
            with no live phase and no travelling signal. */}
        {topic.topology?.edges && (
          <ReconLoopOverlay
            edges={topic.topology.edges}
            canvasRef={stackRef}
            activeEdgeId={null}
            signal={null}
            onSelectEdge={onSelectEdge}
            idPrefix={idPrefix}
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
            onSelectBox={onSelectBox}
            colorOf={colorOf}
            idPrefix={idPrefix}
          />
        )}
      </div>
    </div>
  )
}
