import { useEffect, useMemo, useRef, useState } from 'react'
import Zone from './Zone'
import NodeCard from './NodeCard'
import DeepDiveRevealCard from './DeepDiveRevealCard'
import PrimitiveBoxCard from './PrimitiveBoxCard'
import ReconLoopOverlay from './ReconLoopOverlay'
import DeepDiveArrowOverlay from './DeepDiveArrowOverlay'
import { INTERNAL_TOPOLOGY } from '../data/network-internals'
import { buildPrimitiveInternals } from '../data/primitive-internals'
import { findComponent } from '../data/components-index'

// v2 (Network Map "expandable" mode): resolve a box's realizing component's
// in-place internals — SDN datapath/control components via the hand-authored
// INTERNAL_TOPOLOGY, generic runtime wrappers (launcher pod, VMI, app pods) via
// the Linux-primitive builder — or null if the component bottoms out in nothing
// drillable. Cached so the per-render scan stays cheap.
const _internalsCache = new Map()
function internalsFor(componentId) {
  if (!componentId) return null
  if (_internalsCache.has(componentId)) return _internalsCache.get(componentId)
  const internal = INTERNAL_TOPOLOGY[componentId] || buildPrimitiveInternals({ id: componentId }) || null
  _internalsCache.set(componentId, internal)
  return internal
}

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
  // v2 only: a clicked internal primitive sub-box opens its own teaching popup.
  onSelectSubBox,
  // v2 (Network Map): render boxes that name a realizing `componentId` as cards
  // that open in place to that component's internals, instead of flat popup-only
  // boxes. Off for every other topic.
  expandable = false,
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

  // ── Grid-row layout (the OVN topology) ───────────────────────────────────
  // A node/box may carry grid placement that maps to the shared row tracks:
  //   row        a single named row track (a box sits in it)
  //   rowStart/rowEnd  a span of tracks (a zone wrapping several rows)
  //   rowSpan:'all'    spans every row of the parent grid (a node column)
  //   col / spanColumns  a column, or span all columns (the shared core row)
  // Subgrids inherit the root's named lines, so the names work at every depth.
  const gridRowOf = (n) =>
    n.rowSpan === 'all' ? '1 / -1'
      : n.rowStart ? `${n.rowStart} / ${n.rowEnd}`
        : n.row || undefined
  const gridColOf = (n) =>
    n.spanColumns ? '1 / -1' : n.col != null ? String(n.col) : undefined
  const gridStyleFor = (n) => {
    const gridRow = gridRowOf(n)
    const gridColumn = gridColOf(n)
    if (!gridRow && !gridColumn) return undefined
    return {
      ...(gridRow && { gridRow }),
      ...(gridColumn && { gridColumn }),
      // A column-spanning item (the shared core) centres on the seam instead of
      // stretching the full width.
      ...(n.spanColumns && { justifySelf: 'center' }),
    }
  }
  // The grid root (layout:'grid') publishes its column + named-row tracks as
  // custom props the .zone--grid CSS reads (they inherit to .zone-content-inner).
  const gridRootStyle = (zone) => zone.layout !== 'grid' ? undefined : {
    '--grid-cols': `repeat(${zone.gridCols || 2}, minmax(0, 1fr))`,
    '--grid-rows': (zone.rows || []).map((r) => `[${r}] auto`).join(' ') + ' [grid-end]',
  }

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

  // v2: every box on the canvas that can open to a realizing component — drives
  // the expand-all / collapse-all control.
  const expandableIds = useMemo(() => {
    if (!expandable) return []
    const ids = []
    const walk = (zones) => {
      for (const z of zones || []) {
        for (const b of z.boxes || []) {
          if (b.componentId && internalsFor(b.componentId)) ids.push(b.id)
        }
        if (z.zones) walk(z.zones)
      }
    }
    walk(topic.zones)
    return ids
  }, [topic, expandable])

  // v2: which boxes are opened to their realizing component's internals.
  const [openIds, setOpenIds] = useState(() => new Set())
  const toggleOpen = (id) => setOpenIds((prev) => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  // Switching topics (or leaving v2) drops any expanded reveal / opened cards.
  useEffect(() => { setExpanded(new Set()) }, [topic])
  useEffect(() => { setOpenIds(new Set()) }, [topic, expandable])

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

    // v2: a box that names a realizing component opens in place to that
    // component's internals. Collapsed it keeps the v1 NodeCard look (same grid
    // slot, same accent) but clicking expands instead of opening a popup; opened
    // it hands its slot to the shared PrimitiveBoxCard. The DOM id stays did(box)
    // either way, so the topology edges and trace arrows still anchor to it.
    const internal = expandable && box.componentId ? internalsFor(box.componentId) : null
    if (internal) {
      if (openIds.has(box.id)) {
        const comp = findComponent(box.componentId)
        return (
          <div key={box.id} className="dd-open-slot" style={gridStyleFor(box)}>
            <PrimitiveBoxCard
              node={{
                id: box.componentId,
                title: comp?.displayName || box.title,
                typePrefix: comp?.typePrefix || box.typePrefix,
              }}
              internal={internal}
              colIndex={box.id}
              idPrefix={`${idPrefix}-`}
              color={accent}
              domIdOverride={did(box.id)}
              hint={null}
              isOpen
              onToggle={() => toggleOpen(box.id)}
              onSelectComponent={onSelectComponent}
              onSelectBox={onSelectSubBox}
              isActive={isActive}
              isOnPath={isOnPath}
              isDimmed={isDimmed}
            />
          </div>
        )
      }
      return (
        <NodeCard
          key={box.id}
          id={did(box.id)}
          style={gridStyleFor(box)}
          className="dd-can-expand"
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
          onClick={() => toggleOpen(box.id)}
        />
      )
    }

    return (
      <NodeCard
        key={box.id}
        id={did(box.id)}
        style={gridStyleFor(box)}
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
        <div key={`row-${entry[0].id}`} className="dd-box-row" style={gridStyleFor(entry[0])}>
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
      subgrid={zone.subgrid}
      gridStyle={{ ...gridRootStyle(zone), ...gridStyleFor(zone) }}
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

  const allOpen = expandableIds.length > 0 && expandableIds.every((id) => openIds.has(id))
  const toggleAllOpen = () => setOpenIds(allOpen ? new Set() : new Set(expandableIds))

  return (
    <div className="deep-dive-canvas">
      {expandable && expandableIds.length > 0 && (
        <div className="dd-v2-bar">
          <span className="dd-v2-hint">Click a coloured box to open its OpenShift object → Linux primitives</span>
          <button type="button" className="dd-v2-expand-all" onClick={toggleAllOpen}>
            {allOpen ? 'Collapse all' : 'Expand all'}
          </button>
        </div>
      )}
      <div
        className={`overview-canvas recon-stack ${recon?.edges ? 'recon-stack--edges' : ''} ${topic.topology?.edges ? 'recon-stack--topology' : ''} ${expandable ? 'recon-stack--v2' : ''} ${topic.canvasClass || ''}`}
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
