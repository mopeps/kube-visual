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
import { scrollIntoUpperThird } from '../lib/scroll'

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

// v2: the shared per-node SDN containers. A node's logical objects (logical
// switch, gateway router, external switch, br-int, eth0) are MANY → ONE of these
// (and collapse into ONE br-int), so the container expands once and the logical
// boxes anchor into its rows instead of each opening a redundant component copy.
const CONTAINER_COMPONENTS = new Set(['ovs-host', 'ovs-guest', 'ovn-node-host', 'ovn-node-guest'])

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

  // v2: map each shared-SDN logical leaf box → the container zone (its node's
  // ovs / ovnkube componentZone) it realizes into. Structural walk: each direct
  // child of the grid root is a node column; within a column a leaf resolves to
  // the container with the same componentId, so host vs guest and worker-1 vs
  // worker-2 stay distinct (their componentIds differ / their columns differ).
  // Also collects the container zones + their node labels for the strips.
  const { containerOf, containerMeta, containerIds } = useMemo(() => {
    const out = { containerOf: {}, containerMeta: {}, containerIds: [] }
    if (!expandable) return out
    const byColumn = {}   // columnRootId → { componentId → containerZoneId }
    const leaves = []     // { boxId, componentId, columnRootId }
    const walk = (zone, columnRootId, columnLabel) => {
      if (zone.componentId && CONTAINER_COMPONENTS.has(zone.componentId)
          && INTERNAL_TOPOLOGY[zone.componentId] && columnRootId) {
        (byColumn[columnRootId] ||= {})[zone.componentId] = zone.id
        out.containerMeta[zone.id] = { componentId: zone.componentId, nodeLabel: columnLabel }
        out.containerIds.push(zone.id)
      }
      for (const b of zone.boxes || []) {
        if (b.realizesRow && b.componentId && CONTAINER_COMPONENTS.has(b.componentId) && columnRootId) {
          leaves.push({ boxId: b.id, componentId: b.componentId, columnRootId })
        }
      }
      const isGridRoot = zone.layout === 'grid'
      for (const c of zone.zones || []) {
        walk(c, isGridRoot ? c.id : columnRootId, isGridRoot ? c.label : columnLabel)
      }
    }
    for (const z of topic.zones) walk(z, null, null)
    for (const { boxId, componentId, columnRootId } of leaves) {
      const cz = byColumn[columnRootId]?.[componentId]
      if (cz) out.containerOf[boxId] = cz
    }
    return out
  }, [topic, expandable])

  // v2: which container zones (ovs / ovnkube) are opened to their internals.
  const [openContainers, setOpenContainers] = useState(() => new Set())
  const toggleContainer = (zoneId) => setOpenContainers((prev) => {
    const next = new Set(prev)
    next.has(zoneId) ? next.delete(zoneId) : next.add(zoneId)
    return next
  })
  // v2: own-identity boxes (app pods) keep their genuine 1:1 per-box expansion.
  const [openBoxes, setOpenBoxes] = useState(() => new Set())
  const toggleBox = (id) => setOpenBoxes((prev) => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  // v2 anchor: clicking a logical leaf opens its container and lights up the
  // matching row inside it (scroll + a brief pulse) — the many → one made
  // literal. Retries across a few frames because the strip may have just mounted.
  const anchorTo = (box) => {
    const zoneId = containerOf[box.id]
    if (!zoneId) return
    setOpenContainers((prev) => (prev.has(zoneId) ? prev : new Set(prev).add(zoneId)))
    const rowDomId = `${idPrefix}-${zoneId}-${box.componentId}__${box.realizesRow}`
    let tries = 0
    const tryPulse = () => {
      const el = document.getElementById(rowDomId)
      if (el) {
        scrollIntoUpperThird(el)
        el.classList.add('dd-row-pulse')
        setTimeout(() => el.classList.remove('dd-row-pulse'), 1600)
      } else if (tries++ < 10) {
        requestAnimationFrame(tryPulse)
      }
    }
    requestAnimationFrame(tryPulse)
  }

  // Switching topics (or leaving v2) drops any expanded reveal / opened cards.
  useEffect(() => { setExpanded(new Set()) }, [topic])
  useEffect(() => { setOpenContainers(new Set()); setOpenBoxes(new Set()) }, [topic, expandable])

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

    // v2: a shared-SDN logical leaf is an ANCHOR — it never opens its own copy of
    // the (shared, many-to-one) container. It stays a flat box; clicking it opens
    // its node's container and lights up the row this object becomes. A small ⓘ
    // corner still reaches its own teaching popup. DOM id stays did(box) so the
    // topology edges and trace arrows keep anchoring to it.
    if (expandable && containerOf[box.id]) {
      return (
        <NodeCard
          key={box.id}
          id={did(box.id)}
          style={gridStyleFor(box)}
          className="dd-anchor"
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
          onClick={() => anchorTo(box)}
          cornerAction={{ label: 'ⓘ', title: `${box.title} — details`, onClick: () => onSelectBox(box.id) }}
        />
      )
    }

    // v2: an own-identity box (an app pod) keeps per-box primitive expansion —
    // that is a real 1:1 object, not a redundant copy of a shared container.
    const ownInternal = expandable && box.componentId && !CONTAINER_COMPONENTS.has(box.componentId)
      ? internalsFor(box.componentId) : null
    if (ownInternal) {
      if (openBoxes.has(box.id)) {
        const comp = findComponent(box.componentId)
        return (
          <div key={box.id} className="dd-open-slot" style={gridStyleFor(box)}>
            <PrimitiveBoxCard
              node={{
                id: box.componentId,
                title: comp?.displayName || box.title,
                typePrefix: comp?.typePrefix || box.typePrefix,
              }}
              internal={ownInternal}
              colIndex={box.id}
              idPrefix={`${idPrefix}-`}
              color={accent}
              domIdOverride={did(box.id)}
              hint={null}
              isOpen
              onToggle={() => toggleBox(box.id)}
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
          onClick={() => toggleBox(box.id)}
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

  // v2: the open container's internals, rendered as a full-width strip at the
  // bottom of the grid root (escaping the tight named-row subgrid). Reuses the
  // shared PrimitiveBoxCard; its sub-rows namespace under the container zone id
  // so the anchor pulse can find `<idPrefix>-<zoneId>-<componentId>__<row>`.
  const renderContainerStrip = (zoneId) => {
    const meta = containerMeta[zoneId]
    if (!meta) return null
    const comp = findComponent(meta.componentId)
    const internal = internalsFor(meta.componentId)
    if (!internal) return null
    const title = `${meta.nodeLabel ? `${meta.nodeLabel} · ` : ''}${comp?.displayName || meta.componentId}`
    return (
      <div key={`strip-${zoneId}`} className="dd-container-strip" style={{ gridColumn: '1 / -1' }}>
        <PrimitiveBoxCard
          node={{ id: meta.componentId, title, typePrefix: comp?.typePrefix }}
          internal={internal}
          colIndex={zoneId}
          idPrefix={`${idPrefix}-`}
          color={`var(--${comp?.colorVar || 'k-teal'})`}
          domIdOverride={`${idPrefix}-strip-${zoneId}`}
          hint={null}
          isOpen
          onToggle={() => toggleContainer(zoneId)}
          onSelectComponent={onSelectComponent}
          onSelectBox={onSelectSubBox}
        />
      </div>
    )
  }

  const renderZone = (zone, depth = 0) => {
    // v2: a componentZone whose component has internals (ovs / ovnkube) is a
    // CONTAINER — its label toggles its internals strip instead of opening the
    // sheet (still reachable from the strip header). Others keep the depth-door.
    const isContainer = expandable && zone.componentId
      && CONTAINER_COMPONENTS.has(zone.componentId) && INTERNAL_TOPOLOGY[zone.componentId]
    const isOpen = isContainer && openContainers.has(zone.id)
    const isGridRoot = expandable && zone.layout === 'grid'
    return (
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
      className={`${zone.className || ''} ${isContainer ? `dd-container ${isOpen ? 'is-open' : ''}` : ''}`.trim()}
      subgrid={zone.subgrid}
      gridStyle={{ ...gridRootStyle(zone), ...gridStyleFor(zone) }}
      componentId={zone.componentId}
      domId={zone.componentId ? did(zone.id) : undefined}
      onClick={isContainer ? () => toggleContainer(zone.id) : (zone.componentId ? onSelectComponent : undefined)}
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
      {/* v2: open container internals dock as full-width strips at the bottom of
          the grid root, below the topology. */}
      {isGridRoot && [...openContainers].map(renderContainerStrip)}
    </Zone>
    )
  }

  const allOpen = containerIds.length > 0 && containerIds.every((id) => openContainers.has(id))
  const toggleAllOpen = () => setOpenContainers(allOpen ? new Set() : new Set(containerIds))

  return (
    <div className="deep-dive-canvas">
      {expandable && containerIds.length > 0 && (
        <div className="dd-v2-bar">
          <span className="dd-v2-hint">Click a container (Open vSwitch / OVN-K8s Node) to open its realization; click a logical box to light up the row it becomes inside it.</span>
          <button type="button" className="dd-v2-expand-all" onClick={toggleAllOpen}>
            {allOpen ? 'Collapse all' : 'Expand all containers'}
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
