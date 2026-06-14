import { Fragment, useEffect, useRef, useState } from 'react'
import { ZONES, INTENT_OBJECT_STORE, CONTROLLER_PARENT, OPERATOR_PARENT, FLOW_PARENT } from '../data/zones'
import Zone from './Zone'
import NodeCard from './NodeCard'
import DeepDiveModal from './DeepDiveModal'
import ReconLoopOverlay from './ReconLoopOverlay'
import { NET_PAIRS } from '../data/network-zones'
import { isNetworkComponent } from '../data/network-components'
import { INTERNAL_TOPOLOGY, buildNetworkEdges } from '../data/network-internals'
import PrimitiveBoxCard from './PrimitiveBoxCard'
import { serviceAlias } from '../data/service-alias'
import IntentStoreCard from './IntentStoreCard'
import ControllerManagerCard from './ControllerManagerCard'
import OperatorSetCard from './OperatorSetCard'
import RealizedFlowsCard from './RealizedFlowsCard'
import ServicePair from './ServicePair'
import Masonry from './Masonry'
import ArrowOverlay from './ArrowOverlay'
import { scrollIntoUpperThird } from '../lib/scroll'

// How long the reveal spotlight stays lit before it auto-clears. Kept in sync
// with the `.is-highlighted` pulse in index.css (reveal-pulse-* runs 1.3s × 2),
// so the highlight clears exactly when the animation finishes.
const SPOTLIGHT_MS = 1300 * 2

// Network-mode integration edges (db.sock, GARP→br-ex, tap0→br-int, tunnel…),
// pre-namespaced for the three columns. Drawn by one canvas-level overlay; each
// edge only renders when both its boxes are present (the owning components shown
// / expanded). Static — built once.
const NETWORK_EDGES = buildNetworkEdges(NET_PAIRS)

// The components that open to an internal topology in Network mode — used by the
// "collapse all / expand all" control.
const DRILLABLE_IDS = Object.keys(INTERNAL_TOPOLOGY)

// Map componentId → step number it first appears in the active event.
function buildStepNumMap(activeEvent) {
  const map = new Map()
  if (!activeEvent) return map
  activeEvent.steps.forEach(s => {
    if (!map.has(s.sourceComponentId)) map.set(s.sourceComponentId, s.step)
    if (!map.has(s.targetComponentId)) map.set(s.targetComponentId, s.step)
  })
  return map
}

// All node ids within a zone subtree (used to decide trace-only visibility).
function collectZoneNodeIds(zone, ids = []) {
  zone.nodes?.forEach(n => ids.push(n.id))
  zone.zones?.forEach(z => collectZoneNodeIds(z, ids))
  return ids
}

// Popup content for a replica node zone's label (a `zone.replicaNodes` entry):
// the cluster runs three of each bare-metal node, but only one is drawn in
// full — the replicas carry just the inter-node network plane. Rendered via
// DeepDiveModal.
function replicaDetail(title, parentZone) {
  const isMaster = parentZone.id === 'master-node'
  return {
    role: 'BARE METAL NODE · CONDENSED REPLICA',
    summary:
      `${title} runs the identical stack to the detailed "${parentZone.label}" above. ` +
      'It is drawn condensed — only the components that move traffic *between* nodes: the OVN-K8s Node agent programming this node\'s own Open vSwitch (br-int), and the MetalLB speaker. ' +
      (isMaster
        ? 'The cluster runs three masters: etcd needs an odd-sized quorum (three tolerates one node failure), and the management API servers sit behind one VIP across them.'
        : 'The cluster runs three workers: capacity and failure-domain spread for the KubeVirt VMs that make up the guest cluster’s nodes.'),
    sections: [
      {
        heading: 'Also runs (not drawn)',
        tags: isMaster
          ? ['Kubelet', 'CRI-O', 'static control-plane Pods']
          : ['Kubelet', 'CRI-O', 'virt-handler', 'guest worker VMs'],
      },
      {
        heading: 'In OVN terms',
        bullets: [
          `Every node — replicas included — gets its own gateway router (GR_${title}), node logical switch, and pod subnet, all compiled into its own br-int.`,
          'Toggle the Network overlay (or open the OVN topology deep dive) to see that per-node wiring.',
        ],
      },
      {
        heading: 'Explore',
        commands: [
          'oc get nodes -o wide',
          `oc get node ${title} -o jsonpath='{.metadata.annotations.k8s\\.ovn\\.org/node-subnets}'`,
        ],
      },
    ],
  }
}

// Services & NetworkPolicy have no datapath of their own — in network mode they
// live inside the layer that realizes them (Load_Balancer / ACL rows in the OVN
// NB DB, realized as flows on br-int), so they don't get a standalone card.
const isServiceLike = (node) =>
  node.typePrefix === 'Service' || node.typePrefix === 'NWPOLICY' || !!node.serviceType

// Network mode (Big view): prune a zone to its network components. Keeps network
// nodes (minus the service-like ones now shown inside br-int / the NB DB);
// surfaces the network control-plane operators out of the CPO/CVO operator-set
// cards as standalone nodes; drops everything else and any zone that ends up
// empty. Preserves zone metadata (hideWrapper / componentId / replicaNodes / …).
function filterNetworkZone(zone) {
  const nodes = []
  for (const node of zone.nodes ?? []) {
    if (isServiceLike(node)) {
      continue
    } else if (isNetworkComponent(node)) {
      nodes.push(node)
    } else if (node.operators) {
      // A non-network operator set (CPO/CVO): lift out its network operators.
      for (const op of node.operators) {
        if (isNetworkComponent(op)) nodes.push(op)
      }
    }
  }
  const zones = (zone.zones ?? []).map(filterNetworkZone).filter(Boolean)
  if (!nodes.length && !zones.length) return null
  return { ...zone, nodes, zones }
}

export default function OverviewTab({
  activeEvent,
  activeComponentIds,
  onSelectComponent,
  activeStep,
  onSelectStep,
  highlightId,
  onClearHighlight,
  // Wide-desktop only: "Big view" renders the whole overview three times in
  // parallel columns (one per node pair).
  bigView = false,
  // On top of the big view, float the shared OVN logical core + connectors.
  netOverlay = false,
  // Whether the condensed replica nodes (master-2/3, worker-2/3) are shown —
  // off by default so the main overview stays clean.
  showReplicas = false,
}) {
  const canvasRef = useRef(null)
  const [expandedStoreId, setExpandedStoreId] = useState(null)
  // A clicked condensed replica node ({ id, title, zone }) — opens a small
  // explainer popup, separate from the componentId-keyed AncestryModal flow.
  const [replica, setReplica] = useState(null)
  // Network-mode state: the popup content of a clicked sub-box / integration
  // edge (shares the deep-dive sheet with the replica popup).
  const [netSheet, setNetSheet] = useState(null)
  // Which drillable network components the user has collapsed. Default expanded:
  // an id is in the set only once collapsed; each toggles independently.
  const [netCollapsedIds, setNetCollapsedIds] = useState(() => new Set())
  const toggleNetCollapse = (id) => setNetCollapsedIds((prev) => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const allNetCollapsed = DRILLABLE_IDS.every((id) => netCollapsedIds.has(id))
  const toggleAllNet = () => setNetCollapsedIds(allNetCollapsed ? new Set() : new Set(DRILLABLE_IDS))
  // Optional "connectors only on hover" mode: when on, the wiring lines are
  // hidden until you point at a box. Independently, the descriptor LABELS are
  // shown only for rail edges (in the empty gutter) or for edges of the box you're
  // hovering — so a label never covers a box at rest. Hover is tracked whenever
  // network mode is on.
  const [netWiresOnHover, setNetWiresOnHover] = useState(false)
  const [netHoverId, setNetHoverId] = useState(null)
  const onNetHover = (e) => {
    const el = e.target.closest?.('[id^="nt-c"]')
    setNetHoverId(el ? el.id : null)
  }
  // Touch has no hover, so in "wires on focus" mode a TAP focuses a box (lights
  // its wires) — and we stop the tap (capture phase) from opening the box's
  // detail modal, so tapping is a pure trace gesture. Mouse hover still works
  // alongside; this just makes the mode usable on touch and adds click-to-pin.
  const onNetFocusTap = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const el = e.target.closest?.('[id^="nt-c"]')
    setNetHoverId((prev) => (el && el.id === prev ? null : el ? el.id : null))
  }
  // An edge belongs to a box if either endpoint is that box or one of its nested
  // sub-boxes (ids are `<box>__<child>`), or vice-versa.
  const netRelated = (e, h) => {
    const rel = (a) => a === h || a.startsWith(`${h}__`) || h.startsWith(`${a}__`)
    return rel(e.from) || rel(e.to)
  }
  const shownNetEdges = (
    !netWiresOnHover
      ? NETWORK_EDGES
      : (netHoverId ? NETWORK_EDGES.filter((e) => netRelated(e, netHoverId)) : [])
  ).map((e) => ({
    // A label shows only when it can't block a box: rail edges live in the gutter;
    // every other edge reveals its label only while a box it touches is hovered.
    ...e,
    showLabel: e.rail || (netHoverId != null && netRelated(e, netHoverId)),
  }))
  const stepNums = buildStepNumMap(activeEvent)
  const hasActive = activeComponentIds && activeComponentIds.size > 0

  // Toggle an expand-in-place store (etcd / controller set / operator set /
  // realized flows). On expand, gently scroll the card into the upper third so
  // its freshly revealed objects are in view — a store can be tall (etcd holds
  // 11), and on a phone it may open below the fold. Collapse never scrolls.
  function toggleStore(id) {
    const willExpand = expandedStoreId !== id
    setExpandedStoreId(willExpand ? id : null)
    if (!willExpand) return
    // Two frames so the scroll measures the post-expand height, not the
    // collapsed card's.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      scrollIntoUpperThird(document.getElementById(id))
    }))
  }

  // Figure/ground for the trace: with a hop focused, the packet-red .is-active
  // glow narrows to that hop's two endpoints while the rest of the route keeps
  // an .is-on-path tint — distinct from unrelated .is-dimmed nodes. With no hop
  // focused, the whole path glows (status quo).
  const hopStep = activeEvent && activeStep != null
    ? activeEvent.steps.find(s => s.step === activeStep)
    : null
  const hopIds = hopStep ? new Set([hopStep.sourceComponentId, hopStep.targetComponentId]) : null

  function traceStates(id) {
    const onPath = activeComponentIds?.has?.(id) || false
    return {
      isActive: hopIds ? hopIds.has(id) : onPath,
      isOnPath: hopIds != null && onPath && !hopIds.has(id),
      isDimmed: hasActive ? !onPath : false,
    }
  }

  // Spotlight a component requested from elsewhere (e.g. a detail popup's
  // location badge): expand its parent store if it lives in one — an etcd
  // intent store or a controller-manager controller set — scroll the target
  // into the upper third of the viewport, and clear the highlight once its
  // pulse animation has had time to play.
  useEffect(() => {
    if (!highlightId) return
    const storeId =
      INTENT_OBJECT_STORE[highlightId] ||
      CONTROLLER_PARENT[highlightId] ||
      OPERATOR_PARENT[highlightId] ||
      FLOW_PARENT[highlightId]
    if (storeId) setExpandedStoreId(storeId)
    // Two frames so the scroll measures the post-expand layout when a store
    // had to open to reveal the target.
    let raf2
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        scrollIntoUpperThird(document.getElementById(highlightId))
      })
    })
    const clear = setTimeout(() => onClearHighlight?.(), SPOTLIGHT_MS)
    return () => {
      cancelAnimationFrame(raf1)
      if (raf2) cancelAnimationFrame(raf2)
      clearTimeout(clear)
    }
  }, [highlightId, onClearHighlight])

  // When an active trace references an object nested inside an expand-in-place
  // store (an intent CR, a controller loop, an operator Pod, or a realized
  // flow), expand that store so the hop's arrow endpoint has a DOM node to
  // anchor to — otherwise ArrowLines silently drops the step. Keyed on the
  // memoized id set, so it fires only when the active event changes, never
  // re-expanding after a manual collapse mid-trace.
  useEffect(() => {
    if (!activeComponentIds || activeComponentIds.size === 0) return
    for (const id of activeComponentIds) {
      const storeId =
        INTENT_OBJECT_STORE[id] ||
        CONTROLLER_PARENT[id] ||
        OPERATOR_PARENT[id] ||
        FLOW_PARENT[id]
      if (storeId) { setExpandedStoreId(storeId); break }
    }
  }, [activeComponentIds])

  // Trace-only zones (e.g. the external Client) stay hidden until an active
  // trace flow actually references a node inside them.
  const visibleZones = ZONES.filter(zone =>
    !zone.traceOnly ||
    collectZoneNodeIds(zone).some(id => activeComponentIds?.has?.(id))
  )

  function renderNode(node, zone, colIndex = 0) {
    const { isActive, isOnPath, isDimmed } = traceStates(node.id)
    // Network mode: a drillable component opens in place to show its own internal
    // primitives + integrations inside its own box (never a zone). Takes
    // precedence over the other expand cards (e.g. ovs-guest's realized flows).
    if (netOverlay && INTERNAL_TOPOLOGY[node.id]) {
      return (
        <PrimitiveBoxCard
          key={node.id}
          node={node}
          internal={INTERNAL_TOPOLOGY[node.id]}
          colIndex={colIndex}
          color={zone.color}
          isOpen={!netCollapsedIds.has(node.id)}
          onToggle={() => toggleNetCollapse(node.id)}
          onSelectComponent={onSelectComponent}
          onSelectBox={selectNetBox}
        />
      )
    }
    // Nodes carrying intent objects (the etcd "intent store") render as an
    // expandable card instead of a plain box.
    if (node.intentObjects) {
      return (
        <IntentStoreCard
          key={node.id}
          node={node}
          color={zone.color}
          stepNum={stepNums.get(node.id)}
          isActive={isActive}
          isOnPath={isOnPath}
          isDimmed={isDimmed}
          isHighlighted={node.id === highlightId}
          highlightId={highlightId}
          isExpanded={expandedStoreId === node.id}
          onToggle={() => toggleStore(node.id)}
          onSelectComponent={onSelectComponent}
        />
      )
    }
    // Nodes carrying controllers (a controller-manager "controller set") render
    // as the same expand-in-place card, revealing the loops inside the binary.
    if (node.controllers) {
      return (
        <ControllerManagerCard
          key={node.id}
          node={node}
          color={zone.color}
          stepNum={stepNums.get(node.id)}
          isActive={isActive}
          isOnPath={isOnPath}
          isDimmed={isDimmed}
          isHighlighted={node.id === highlightId}
          highlightId={highlightId}
          isExpanded={expandedStoreId === node.id}
          onToggle={() => toggleStore(node.id)}
          onSelectComponent={onSelectComponent}
        />
      )
    }
    // Nodes carrying operators (an "operator set" owned by the CVO / Control
    // Plane Operator) render as the same expand-in-place card, revealing the
    // operator Pods that owner deploys and reconciles in the HCP namespace.
    if (node.operators) {
      return (
        <OperatorSetCard
          key={node.id}
          node={node}
          color={zone.color}
          stepNum={stepNums.get(node.id)}
          isActive={isActive}
          isOnPath={isOnPath}
          isDimmed={isDimmed}
          isHighlighted={node.id === highlightId}
          highlightId={highlightId}
          isExpanded={expandedStoreId === node.id}
          onToggle={() => toggleStore(node.id)}
          onSelectComponent={onSelectComponent}
        />
      )
    }
    // An Open vSwitch node carrying `realizes` renders as the same expand-in-place
    // card, revealing the Services / NetworkPolicies it realizes as br-int flows.
    if (node.realizes) {
      return (
        <RealizedFlowsCard
          key={node.id}
          node={node}
          color={zone.color}
          stepNum={stepNums.get(node.id)}
          isActive={isActive}
          isOnPath={isOnPath}
          isDimmed={isDimmed}
          isHighlighted={node.id === highlightId}
          highlightId={highlightId}
          isExpanded={expandedStoreId === node.id}
          onToggle={() => toggleStore(node.id)}
          onSelectComponent={onSelectComponent}
        />
      )
    }
    return (
      <NodeCard
        key={node.id}
        // Network mode renders the same tree in three columns, so card ids are
        // namespaced per column to stay unique (integration edges anchor to them);
        // the normal canvas keeps the raw componentId.
        id={netOverlay ? `nt-c${colIndex}-${node.id}` : node.id}
        title={node.title}
        typePrefix={node.typePrefix}
        typeAlias={serviceAlias(node)}
        color={zone.color}
        stepNum={stepNums.get(node.id)}
        isActive={isActive}
        isOnPath={isOnPath}
        isDimmed={isDimmed}
        isHighlighted={node.id === highlightId}
        // Open the canonical component's modal regardless of the (possibly
        // namespaced) DOM id — a replica mirrors its canonical component.
        onClick={() => onSelectComponent(node.mirror || node.id)}
      />
    )
  }

  // Render a zone's nodes, collapsing a node that points at an in-zone sibling
  // into a single stacked ServicePair (carrier on top, target below). Two
  // relations stack this way:
  //   • `exposes`  — a Service fronts the workload it load-balances
  //   • `programs` — an OVN-K8s Node configures the Open vSwitch data plane
  // The target only gets absorbed when its carrier lives in the same zone; an
  // orphaned reference (cross-zone target) falls through to normal rendering.
  //
  // The cards come back wrapped in a <Masonry>: a hand-rolled shortest-column
  // packing (desktop and phone alike) so cards fill the gaps a flex grid would
  // leave under shorter neighbours, while an expanded store still spans the full
  // width in place (see Masonry.jsx).
  function renderZoneNodes(zone, colIndex = 0) {
    const nodes = zone.nodes ?? []
    const byId = new Map(nodes.map(n => [n.id, n]))
    // Either relation references its target by id; the target renders inside the
    // pair, not standalone. Network mode skips pairing — an opened Open vSwitch
    // is full-width, and its OVN-K8s Node link reads as a db.sock edge instead.
    const targetOf = (n) => n.exposes || n.programs
    const pairedTargets = netOverlay ? new Set() : new Set(
      nodes.filter(n => targetOf(n) && byId.has(targetOf(n))).map(n => targetOf(n))
    )
    const out = []
    for (const node of nodes) {
      if (pairedTargets.has(node.id)) continue
      const target = targetOf(node)
      if (target && byId.has(target)) {
        out.push(
          <ServicePair
            key={node.id}
            color={zone.color}
            relation={node.programs ? 'programs' : 'exposes'}
            service={renderNode(node, zone, colIndex)}
            target={renderNode(byId.get(target), zone, colIndex)}
          />
        )
        continue
      }
      out.push(renderNode(node, zone, colIndex))
    }
    if (out.length === 0) return null
    return <Masonry key={`${zone.id}-nodes`}>{out}</Masonry>
  }

  function renderZone(zone, depth = 0, parentZone = null, colIndex = 0) {
    // A replica node zone's label opens the replica explainer popup instead of
    // a component modal (the zone is a stand-in, not a registered component).
    const isReplica = !!zone.replica
    const zoneEl = (
      <Zone
        key={zone.id}
        label={zone.label}
        color={zone.color}
        dashed={zone.dashed}
        depth={depth}
        layout={zone.layout}
        bare={zone.bare}
        className={zone.className}
        // A zone may double as a component (e.g. the VM); wire up its identity
        // so it can anchor arrows, highlight, and open the detail panel. A
        // replica zone borrows the same wiring for its explainer popup.
        componentId={isReplica ? zone.id : zone.componentId}
        stepNum={zone.componentId ? stepNums.get(zone.componentId) : undefined}
        isActive={zone.componentId ? traceStates(zone.componentId).isActive : false}
        isOnPath={zone.componentId ? traceStates(zone.componentId).isOnPath : false}
        isHighlighted={zone.componentId ? zone.componentId === highlightId : false}
        onClick={isReplica
          ? () => { setNetSheet(null); setReplica({ title: zone.label, zone: parentZone }) }
          : onSelectComponent}
      >
        {/* Nodes in this zone (Service→target pairs stacked together) */}
        {renderZoneNodes(zone, colIndex)}
        {/* Child zones */}
        {zone.zones?.map(child => renderZone(child, depth + 1, null, colIndex))}
      </Zone>
    )
    if (!zone.replicaNodes?.length || !showReplicas) return zoneEl
    // The zone's condensed siblings (master-2/3, worker-2/3) trail it as a row
    // of real node zones — same border/label as the primary, but holding only
    // the inter-node network plane (OVN-K8s Node → Open vSwitch, MetalLB).
    return (
      <Fragment key={zone.id}>
        {zoneEl}
        <div className="replica-row">
          {zone.replicaNodes.map((rz) => renderZone(rz, depth, zone))}
        </div>
      </Fragment>
    )
  }

  // Edge-label clicks on the network overlay open the shared sheet (displacing
  // an open replica popup, and vice versa).
  const selectNetEdge = (edge) => {
    setReplica(null)
    setNetSheet({
      id: edge.id,
      title: edge.title || edge.label?.replace(/\n/g, ' '),
      accent: `var(--${edge.accent || 'k-orange'})`,
      detail: edge.detail,
      peekDefault: 0.34,
    })
  }
  // Click on a component's internal primitive sub-box → its teaching popup.
  const selectNetBox = (box) => {
    setReplica(null)
    setNetSheet({
      id: box.id,
      title: box.title,
      typePrefix: box.typePrefix,
      accent: `var(--${box.colorVar || 'k-amber'})`,
      detail: box.detail,
    })
  }

  // The normal Overview canvas content — the management context surfaced as its
  // master-node / worker-node stack. Shared by the normal canvas and rendered
  // once per parallel column in network mode.
  // `networkOnly` (Network mode) prunes the tree to network components first —
  // see filterNetworkZone. The normal/big-view paths pass nothing and render the
  // full stack.
  const renderOverviewStack = (networkOnly = false, colIndex = 0) =>
    (networkOnly ? visibleZones.map(filterNetworkZone).filter(Boolean) : visibleZones)
      .flatMap(zone =>
        zone.hideWrapper
          ? [
              // Wrapper hidden: surface its own nodes and child zones directly
              // so neither is silently dropped.
              renderZoneNodes(zone, colIndex),
              ...(zone.zones ?? []).map(child => renderZone(child, 0, null, colIndex)),
            ]
          : [renderZone(zone, 0, null, colIndex)]
      )

  return (
    <>
      {bigView && (
        <div className="net-bar">
          <span className="net-bar-label">{netOverlay ? 'Network map' : 'Big view'}</span>
          {netOverlay && (
            <button type="button" className="net-bar-btn" onClick={toggleAllNet}>
              {allNetCollapsed ? 'Expand all' : 'Collapse all'}
            </button>
          )}
          {netOverlay && (
            <button
              type="button"
              className={`net-bar-btn ${netWiresOnHover ? 'is-active' : ''}`}
              onClick={() => { setNetWiresOnHover((v) => !v); setNetHoverId(null) }}
              title={netWiresOnHover
                ? 'Showing connectors only for the box you hover or tap — click to show them all'
                : 'Hide the connectors until you hover (or tap) a box, then light up just that box’s'}
            >
              {netWiresOnHover ? 'Wires: on focus' : 'Wires: all'}
            </button>
          )}
          <span className="net-bar-hint">
            {netOverlay
              ? 'Every network component is opened to show where its abstractions live and how they’re implemented. Hover (or tap) a box to label its connectors; ▴ collapses a box; click a sub-box for detail.'
              : 'The whole Overview, three node pairs side by side. Switch to Network to open each component and trace the real networking topology.'}
          </span>
        </div>
      )}
      {bigView ? (
        // Big view: the normal canvas rendered three times in parallel columns
        // (one per node pair). Network mode opens each drillable component box to
        // show its internals, wired by the integration edges (network-internals.js).
        <div
          ref={canvasRef}
          className={`border border-border-w rounded-lg overflow-visible overview-canvas net-bigpicture ${netOverlay ? 'net-bigpicture--net' : ''}`}
          style={{ background: 'rgba(0,0,0,0.2)', position: 'relative' }}
          onMouseOver={netOverlay ? onNetHover : undefined}
          onMouseLeave={netOverlay && !netWiresOnHover ? () => setNetHoverId(null) : undefined}
          onClickCapture={netOverlay && netWiresOnHover ? onNetFocusTap : undefined}
        >
          <div className="net-cols">
            {NET_PAIRS.map((i) => (
              <div className="net-col" id={`net-col-${i}`} key={i}>
                {renderOverviewStack(netOverlay, i)}
              </div>
            ))}
          </div>
          {netOverlay && (
            <ReconLoopOverlay
              edges={shownNetEdges}
              canvasRef={canvasRef}
              activeEdgeId={null}
              signal={null}
              onSelectEdge={selectNetEdge}
              idPrefix=""
            />
          )}
        </div>
      ) : (
        <div
          ref={canvasRef}
          className="border border-border-w rounded-lg overflow-visible overview-canvas"
          style={{ background: 'rgba(0,0,0,0.2)', position: 'relative' }}
        >
          {renderOverviewStack()}
          <ArrowOverlay
            activeEvent={activeEvent}
            canvasRef={canvasRef}
            activeStep={activeStep}
            onSelectStep={onSelectStep}
          />
        </div>
      )}
      {/* Tail spacer: a little room to scroll past the last object, growing by
          the height of whichever bottom panel is open — the hop inspector
          (--hop-inset) or a resized detail sheet in peek mode (--peek-inset) —
          so the bottom objects can always be scrolled clear of that fixed panel.
          Extends whichever scroller owns the overview — the window on desktop,
          the pane in the compact swipe pager. */}
      <div aria-hidden style={{ height: 'calc(2rem + var(--hop-inset, 0px) + var(--peek-inset, 0px))' }} />
      {/* The replica explainer and network-overlay chip/edge popups share the
          deep-dive sheet (one popup at a time). */}
      <DeepDiveModal
        content={replica ? {
          id: `replica-${replica.title}`,
          title: `${replica.title} — identical replica`,
          typePrefix: 'BareMetal',
          accent: replica.zone.color,
          detail: replicaDetail(replica.title, replica.zone),
        } : netSheet}
        onClose={() => { setReplica(null); setNetSheet(null) }}
      />
    </>
  )
}
