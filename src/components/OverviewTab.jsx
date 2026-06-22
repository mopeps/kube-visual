import { useEffect, useMemo, useRef, useState } from 'react'
import { ZONES, INTENT_OBJECT_STORE, CONTROLLER_PARENT, OPERATOR_PARENT, FLOW_PARENT } from '../data/zones'
import Zone from './Zone'
import NodeCard from './NodeCard'
import DeepDiveModal from './DeepDiveModal'
import ReconLoopOverlay from './ReconLoopOverlay'
import { NET_PAIRS } from '../data/network-zones'
import { isNetworkComponent, NETWORK_CONTROL_PLANE_IDS } from '../data/network-components'
import { INTERNAL_TOPOLOGY, buildNetworkEdges } from '../data/network-internals'
import { buildPrimitiveInternals, isRuntimeInstance } from '../data/primitive-internals'
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
// pre-namespaced per column. Drawn by one canvas-level overlay; each edge only
// renders when both its boxes are present (the owning components shown /
// expanded). Static — built once. The full set wires all three big-view columns;
// the single set wires the lone column used below wide (the mobile network view).
const NETWORK_EDGES = buildNetworkEdges(NET_PAIRS)
const NETWORK_EDGES_SINGLE = buildNetworkEdges([0])

// The components that open to an internal topology in Network mode — used by the
// "collapse all / expand all" control.
const DRILLABLE_IDS = Object.keys(INTERNAL_TOPOLOGY)

// Every drillable instance id across all modeled columns. Used to seed the
// mobile default: on small screens the network boxes start collapsed (the
// expanded internals are a tall wall on a phone), so we pre-fill the collapsed
// set with every column's ids — collapsing an id that isn't rendered is a no-op.
const ALL_NET_INSTANCE_IDS = NET_PAIRS.flatMap((_, colIndex) =>
  DRILLABLE_IDS.map((id) => `nt-c${colIndex}-${id}`)
)

// Resolve the expand-in-place store that holds a nested object — an etcd intent
// CR, a controller-manager loop, an operator-set Pod, or an Open vSwitch realized
// flow — or null when the id is an ordinary top-level card.
const parentStoreOf = (id) =>
  INTENT_OBJECT_STORE[id] || CONTROLLER_PARENT[id] || OPERATOR_PARENT[id] || FLOW_PARENT[id] || null

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

function HcpPlacementSummary({ placement }) {
  return (
    <div className="hcp-placement" role="note" aria-label="Hosted control plane placement model">
      <div className="hcp-placement-copy">
        <span className="hcp-placement-kicker">One logical namespace</span>
        <span className="hcp-placement-summary">{placement.summary}</span>
      </div>
      <div className="hcp-placement-hosts" aria-label="Eligible modeled hosts">
        {placement.hosts.map((host) => (
          <span className="hcp-placement-host" key={host}>
            <span className="hcp-placement-dot" aria-hidden />
            <span>{host}</span>
            <small>eligible</small>
          </span>
        ))}
      </div>
    </div>
  )
}

// Popup content for a replica node zone's label (a `zone.replicaNodes` entry).
// Rendered via DeepDiveModal.
function replicaDetail(title, parentZone) {
  const isMaster = parentZone.id === 'master-node'
  return {
    role: 'BARE METAL NODE · CONDENSED REPLICA',
    summary:
      `${title} runs the same node role as "${parentZone.label}". ` +
      'Cards with a node-local runtime are repeated here; cluster-scoped logical boundaries are not. ' +
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

// Network lens: prune a zone to its network components. Keeps network
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
  onClearEvent,
  // All-node scope renders three placement-aware node-pair columns/sections.
  bigView = false,
  // Network lens opens and wires each rendered node's networking internals.
  netOverlay = false,
  // Architecture lens: each runtime instance opens in place to its Linux
  // kernel primitives. Collapsed by default.
  primOverlay = false,
  // Small screens (phones / narrow tablets). Drives the network mode's
  // start-collapsed default so the canvas isn't a tall wall of opened boxes.
  isCompact = false,
}) {
  const canvasRef = useRef(null)
  const [expandedStoreId, setExpandedStoreId] = useState(null)
  // A clicked condensed replica node ({ id, title, zone }) — opens a small
  // explainer popup, separate from the componentId-keyed AncestryModal flow.
  const [replica, setReplica] = useState(null)
  // Network-mode state: the popup content of a clicked sub-box / integration
  // edge (shares the deep-dive sheet with the replica popup).
  const [netSheet, setNetSheet] = useState(null)
  // Which drillable network components the user has collapsed. Default expanded
  // on desktop (the set is empty), but start COLLAPSED on mobile — the opened
  // internals stack into a tall wall on a phone, so a small screen begins with
  // every box closed and the user taps the ones they want. An instance-scoped
  // DOM id is in the set only once collapsed, so matching components on replica
  // nodes still toggle independently.
  const [netCollapsedIds, setNetCollapsedIds] = useState(() =>
    isCompact ? new Set(ALL_NET_INSTANCE_IDS) : new Set()
  )
  // Expanding one replica also points out the matching component on the other
  // modeled nodes. This is a visual relationship only; their open/closed state
  // remains independent.
  const [netLinkedExpansion, setNetLinkedExpansion] = useState(null)
  const toggleNetCollapse = (instanceId, canonicalId) => {
    const willExpand = netCollapsedIds.has(instanceId)
    setNetCollapsedIds((prev) => {
      const next = new Set(prev)
      next.has(instanceId) ? next.delete(instanceId) : next.add(instanceId)
      return next
    })
    setNetLinkedExpansion(willExpand ? { canonicalId, sourceId: instanceId } : null)
  }
  const netColumns = bigView ? NET_PAIRS.map((_, index) => index) : [0]
  const netInstanceIds = netColumns.flatMap((colIndex) =>
    DRILLABLE_IDS.map((id) => `nt-c${colIndex}-${id}`)
  )
  const allNetCollapsed = netInstanceIds.every((id) => netCollapsedIds.has(id))
  const toggleAllNet = () => {
    setNetCollapsedIds(allNetCollapsed ? new Set() : new Set(netInstanceIds))
    setNetLinkedExpansion(null)
  }
  // Primitives-mode state: which runtime instances the user has opened. Default
  // COLLAPSED (the inverse of network mode) so the canvas stays quiet and the
  // word "internals" never sits on every card — an id is in the set only once
  // expanded.
  const [primExpandedIds, setPrimExpandedIds] = useState(() => new Set())
  const togglePrimExpand = (id) => setPrimExpandedIds((prev) => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  // A node opens to its primitives only if it's a runtime instance AND isn't one
  // of the expand-in-place cards (etcd store / controller set / operator set /
  // OVS realized flows) or a mirrored replica — those keep their own behaviour.
  const isPrimDrillable = (node) =>
    isRuntimeInstance(node) &&
    !node.intentObjects && !node.controllers && !node.operators && !node.realizes
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
    const el = e.target.closest?.('[id^="nt-c"]')
    if (!el) return
    // Don't swallow clicks on a box's real controls: the collapse ▴ / title ⓘ /
    // nested container headers (<button>s), a collapsed box's expand toggle
    // ([aria-expanded]), or a leaf sub-box nested inside an opened box (it opens
    // a detail popup). Capture-phase stopPropagation would otherwise eat them and
    // break collapsing/expanding the objects. Focus mode only repurposes a tap on
    // a top-level component card, whose sole action would be opening its modal —
    // there we light its wires instead.
    const nested = el.parentElement?.closest('[id^="nt-c"]')
    if (nested || e.target.closest('button, [aria-expanded]')) return
    e.preventDefault()
    e.stopPropagation()
    setNetHoverId((prev) => (el.id === prev ? null : el.id))
  }
  // An edge belongs to a box if either endpoint is that box or one of its nested
  // sub-boxes (ids are `<box>__<child>`), or vice-versa.
  const netRelated = (e, h) => {
    const rel = (a) => a === h || a.startsWith(`${h}__`) || h.startsWith(`${a}__`)
    return rel(e.from) || rel(e.to)
  }
  // One-pair scope wires column zero; All nodes wires all three modeled pairs.
  const netEdges = bigView ? NETWORK_EDGES : NETWORK_EDGES_SINGLE
  const shownNetEdges = (
    !netWiresOnHover
      ? netEdges
      : (netHoverId ? netEdges.filter((e) => netRelated(e, netHoverId)) : [])
  ).map((e) => {
    // Every connector is faint (`dim`) by default so the canvas reads calmly; the
    // connectors of the box you hover light up (`active`) and reveal their label
    // (a label only ever appears on an active edge, so it never blocks a box).
    const active = netHoverId != null && netRelated(e, netHoverId)
    return { ...e, dim: true, active, showLabel: active }
  })
  const stepNums = buildStepNumMap(activeEvent)
  const hasActive = activeComponentIds && activeComponentIds.size > 0

  // Stores that MUST stay expanded because the active trace references an object
  // nested inside them (an intent CR, a controller loop, an operator Pod, or a
  // realized flow) — otherwise that hop's arrow endpoint has no DOM node and
  // ArrowLines silently drops the step. Derived, not state, so it covers EVERY
  // referenced store at once (the single `expandedStoreId` could force only one
  // open) and resolves in the same render the trace changes, so ArrowLines
  // measures the freshly revealed nodes. A store is open if the user opened it
  // (expandedStoreId) OR the active trace needs it (here).
  const forcedStoreIds = useMemo(() => {
    const set = new Set()
    if (activeComponentIds) {
      for (const id of activeComponentIds) {
        const store = parentStoreOf(id)
        if (store) set.add(store)
      }
    }
    return set
  }, [activeComponentIds])
  const isStoreExpanded = (id) => expandedStoreId === id || forcedStoreIds.has(id)

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

  // (Stores referenced by the active trace are forced open via `forcedStoreIds`
  // above — derived in render so every referenced store opens at once and the
  // arrow endpoints resolve in the same pass.)

  // Trace-only zones (e.g. the external Client) stay hidden until an active
  // trace flow actually references a node inside them.
  const visibleZones = ZONES.filter(zone =>
    !zone.traceOnly ||
    collectZoneNodeIds(zone).some(id => activeComponentIds?.has?.(id))
  )

  // Architecture: every drillable runtime-instance id in the visible tree,
  // driving the bar's Expand-all / Collapse-all control.
  const collectPrimDrillable = (zone, ids = []) => {
    zone.nodes?.forEach((n) => { if (isPrimDrillable(n)) ids.push(n.id) })
    zone.zones?.forEach((z) => collectPrimDrillable(z, ids))
    if (bigView) zone.replicaNodes?.forEach((z) => collectPrimDrillable(z, ids))
    return ids
  }
  const primDrillableIds = primOverlay ? visibleZones.flatMap((z) => collectPrimDrillable(z)) : []
  const allPrimExpanded = primDrillableIds.length > 0 && primDrillableIds.every((id) => primExpandedIds.has(id))
  const toggleAllPrim = () => setPrimExpandedIds(allPrimExpanded ? new Set() : new Set(primDrillableIds))

  function renderNode(node, zone, colIndex = 0) {
    const { isActive, isOnPath, isDimmed } = traceStates(node.id)
    const canonicalId = node.mirror || node.id
    const netInstanceId = `nt-c${colIndex}-${canonicalId}`
    // Network mode: a drillable component opens in place to show its own internal
    // primitives + integrations inside its own box (never a zone). Takes
    // precedence over the other expand cards (e.g. ovs-guest's realized flows).
    if (netOverlay && INTERNAL_TOPOLOGY[canonicalId]) {
      return (
        <PrimitiveBoxCard
          key={node.id}
          node={node}
          internal={INTERNAL_TOPOLOGY[canonicalId]}
          colIndex={colIndex}
          // No "internals" label beside the chevron — the drill chevron alone
          // signals the box opens.
          hint={null}
          color={zone.color}
          domIdOverride={netInstanceId}
          isOpen={!netCollapsedIds.has(netInstanceId)}
          onToggle={() => toggleNetCollapse(netInstanceId, canonicalId)}
          onSelectComponent={onSelectComponent}
          onSelectBox={selectNetBox}
          stepNum={stepNums.get(node.id)}
          isActive={isActive}
          isOnPath={isOnPath}
          isDimmed={isDimmed}
          isHighlighted={node.id === highlightId}
          isReplicaLinked={bigView && netLinkedExpansion?.canonicalId === canonicalId && netLinkedExpansion.sourceId !== netInstanceId}
        />
      )
    }
    // Architecture: a runtime instance opens in place to its Linux kernel
    // primitives (collapsed by default; no "internals" label). Built from
    // PRIMITIVES_BY_TYPE + the component's linuxPrimitive (primitive-internals.js).
    if (primOverlay && isPrimDrillable(node)) {
      const internal = buildPrimitiveInternals(node)
      if (internal) {
        return (
          <PrimitiveBoxCard
            key={node.id}
            node={node}
            internal={internal}
            colIndex={colIndex}
            idPrefix="pr-c"
          hint={null}
          color={zone.color}
          domIdOverride={colIndex === 0 ? node.id : undefined}
            isOpen={primExpandedIds.has(node.id)}
            onToggle={() => togglePrimExpand(node.id)}
            onSelectComponent={onSelectComponent}
            onSelectBox={selectNetBox}
            stepNum={stepNums.get(node.id)}
            isActive={isActive}
            isOnPath={isOnPath}
            isDimmed={isDimmed}
            isHighlighted={node.id === highlightId}
          />
        )
      }
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
          isExpanded={isStoreExpanded(node.id)}
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
          isExpanded={isStoreExpanded(node.id)}
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
          isExpanded={isStoreExpanded(node.id)}
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
          isExpanded={isStoreExpanded(node.id)}
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
        id={netOverlay
          ? `nt-c${colIndex}-${canonicalId}`
          : primOverlay && bigView && colIndex > 0
            ? `pr-c${colIndex}-${node.id}`
            : node.id}
        title={node.title}
        typePrefix={node.typePrefix}
        typeAlias={serviceAlias(node)}
        color={zone.color}
        stepNum={stepNums.get(node.id)}
        isActive={isActive}
        isOnPath={isOnPath}
        isDimmed={isDimmed}
        isHighlighted={node.id === highlightId}
        // In network mode the surfaced control-plane components (CNO / Ingress /
        // DNS operators, the kubevirt CCM, the MetalLB Controller) don't drill to a
        // datapath — they read as control plane that configures the components
        // below them (wired by a "configures" edge). `net-control-plane` draws the
        // card dashed = not the realized datapath (no descriptive subtitle — that
        // role reads from the dashed style + the "configures" edge).
        className={netOverlay && NETWORK_CONTROL_PLANE_IDS.has(canonicalId) ? 'net-control-plane' : undefined}
        replicaBadge={node.replicaBadge}
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
    // pair, not standalone. Network mode skips pairing entirely — an opened Open
    // vSwitch is full-width, and its OVN-K8s Node link reads as a db.sock edge
    // instead. (targetOf must return null in network mode for BOTH steps below:
    // otherwise pairedTargets stays empty yet the loop still forms a ServicePair,
    // pulling the target — e.g. ovs-master — into the pair AND leaving it
    // standalone, so it draws twice.)
    const targetOf = (n) => netOverlay ? null : (n.exposes || n.programs)
    const pairedTargets = new Set(
      nodes.filter(n => targetOf(n) && byId.has(targetOf(n))).map(n => targetOf(n))
    )
    const renderList = (list, key) => {
      const out = []
      for (const node of list) {
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
      return out.length ? <Masonry key={key}>{out}</Masonry> : null
    }

    if (!zone.nodeGroups?.length) return renderList(nodes, `${zone.id}-nodes`)
    const grouped = new Set(zone.nodeGroups.flatMap((group) => group.nodeIds))
    return (
      <div className="zone-node-groups">
        {zone.nodeGroups.map((group) => {
          const groupNodes = group.nodeIds.map((id) => byId.get(id)).filter(Boolean)
          const content = renderList(groupNodes, `${zone.id}-${group.id}`)
          if (!content) return null
          return (
            <section className="zone-node-group" key={group.id} style={{ '--group-accent': zone.color }}>
              <div className="zone-node-group-label">{group.label}</div>
              {content}
            </section>
          )
        })}
        {renderList(nodes.filter((node) => !grouped.has(node.id)), `${zone.id}-ungrouped`)}
      </div>
    )
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
        boundaryKind={zone.boundaryKind}
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
          : zone.mirrorComponentId
            ? () => onSelectComponent(zone.mirrorComponentId)
            : onSelectComponent}
      >
        {bigView && zone.allNodesShared && zone.placement && (
          <HcpPlacementSummary placement={zone.placement} />
        )}
        {/* Nodes in this zone (Service→target pairs stacked together) */}
        {renderZoneNodes(zone, colIndex)}
        {/* Child zones */}
        {zone.zones?.map(child => renderZone(child, depth + 1, null, colIndex))}
      </Zone>
    )
    return zoneEl
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
  const zonesForColumn = (colIndex) => {
    if (colIndex === 0) return visibleZones
    const replicaIndex = colIndex - 1
    return visibleZones.flatMap((zone) => {
      if (!zone.hideWrapper) return []
      return (zone.zones ?? [])
        .map((child) => child.replicaNodes?.[replicaIndex])
        .filter(Boolean)
    })
  }

  const renderOverviewStack = (networkOnly = false, colIndex = 0) =>
    (networkOnly
      ? zonesForColumn(colIndex).map(filterNetworkZone).filter(Boolean)
      : zonesForColumn(colIndex))
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

  // All nodes separates physical placement from Kubernetes ownership:
  // masters form one three-column row, the single HCP namespace spans that
  // complete row, then workers/VMIs form a second three-column row. Copying the
  // namespace into each master would falsely imply three namespaces and one
  // replica of every workload per host.
  const renderAllNodesStack = (networkOnly = false) => {
    const management = visibleZones.find((zone) => zone.id === 'management-context')
    if (!management) return renderOverviewStack(networkOnly)

    const master = management.zones?.find((zone) => zone.id === 'master-node')
    const worker = management.zones?.find((zone) => zone.id === 'worker-node')
    const sharedHcp = master?.zones?.find((zone) => zone.allNodesShared)
    if (!master || !worker || !sharedHcp) return renderOverviewStack(networkOnly)

    const prepare = (zone) => networkOnly ? filterNetworkZone(zone) : zone
    const masterOne = {
      ...master,
      label: 'master-1 · Bare Metal Master',
      zones: (master.zones ?? []).filter((zone) => zone !== sharedHcp),
    }
    const workerOne = { ...worker, label: 'worker-1 · Bare Metal Worker' }
    const masterRow = [masterOne, ...(master.replicaNodes ?? [])]
    const workerRow = [workerOne, ...(worker.replicaNodes ?? [])]
    const outsideManagement = visibleZones.filter((zone) => zone !== management)

    const renderRow = (label, zones, rowClass) => (
      <section className={`all-nodes-band ${rowClass}`} key={rowClass}>
        <div className="all-nodes-band-label">{label}</div>
        <div className="net-cols">
          {zones.map((zone, colIndex) => {
            const visible = prepare(zone)
            return visible ? (
              <div className="net-col" id={`net-col-${colIndex}-${rowClass}`} key={zone.id}>
                {renderZone(visible, 0, null, colIndex)}
              </div>
            ) : null
          })}
        </div>
      </section>
    )

    const visibleSharedHcp = prepare({
      ...sharedHcp,
      className: `${sharedHcp.className ?? ''} zone--hcp-shared`.trim(),
    })

    return (
      <div className="all-nodes-layout">
        {outsideManagement.map((zone) => {
          const visible = prepare(zone)
          return visible ? renderZone(visible, 0, null, 0) : null
        })}
        {renderRow('Management control-plane hosts', masterRow, 'all-nodes-band--masters')}
        {visibleSharedHcp && (
          <section className="all-nodes-shared" aria-label="Shared guest control plane namespace">
            {renderZone(visibleSharedHcp, 0, null, 0)}
          </section>
        )}
        {renderRow('Management compute hosts · guest workers', workerRow, 'all-nodes-band--workers')}
      </div>
    )
  }

  // Both lenses share the column canvas. One pair renders column zero; All
  // nodes renders the three placement-aware master/worker pairs.
  const columnsView = bigView || netOverlay || primOverlay
  const cols = bigView ? NET_PAIRS : [0]

  return (
    <>
      {columnsView && (
        <div className="net-bar">
          <span className="net-bar-label">{netOverlay ? 'Network' : 'Architecture'}</span>
          {netOverlay && (
            <button type="button" className="net-bar-btn" onClick={toggleAllNet}>
              {allNetCollapsed ? 'Expand all' : 'Collapse all'}
            </button>
          )}
          {primOverlay && (
            <button type="button" className="net-bar-btn" onClick={toggleAllPrim}>
              {allPrimExpanded ? 'Collapse all' : 'Expand all'}
            </button>
          )}
          {primOverlay && !bigView && (
            <span className="net-bar-hint">
              Each Pod / systemd / VMI opens in place to its Linux kernel primitives — click a card to drill in.
            </span>
          )}
          {primOverlay && bigView && <span className="net-bar-hint">Modeled placement · three masters · three workers</span>}
          {primOverlay && activeEvent && (
            <button type="button" className="net-bar-btn net-bar-btn--clear" onClick={onClearEvent}>
              × Clear flow
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
          {!netOverlay && !primOverlay && (
            <span className="net-bar-hint">
              The whole Overview, three node pairs side by side. Switch to Network to open each component and trace the real networking topology.
            </span>
          )}
        </div>
      )}
      {columnsView ? (
        // Columns canvas: the normal canvas rendered once per node pair — three
        // three placement-aware pair columns/sections, or a single primary pair.
        // Network mode opens each drillable component
        // box to show its internals, wired by the integration edges
        // (network-internals.js).
        <div
          ref={canvasRef}
          className={`border border-border-w rounded-lg overflow-visible overview-canvas net-bigpicture ${netOverlay ? 'net-bigpicture--net' : ''} ${columnsView && !bigView ? 'net-bigpicture--single' : ''}`}
          style={{ background: 'rgba(0,0,0,0.2)', position: 'relative' }}
          onMouseOver={netOverlay ? onNetHover : undefined}
          onMouseLeave={netOverlay && !netWiresOnHover ? () => setNetHoverId(null) : undefined}
          onClickCapture={netOverlay && netWiresOnHover ? onNetFocusTap : undefined}
        >
          {bigView ? renderAllNodesStack(netOverlay) : (
            <div className="net-cols">
              {cols.map((i) => (
                <div className="net-col" id={`net-col-${i}`} key={i}>
                  {renderOverviewStack(netOverlay, i)}
                </div>
              ))}
            </div>
          )}
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
          {primOverlay && (
            <ArrowOverlay
              activeEvent={activeEvent}
              canvasRef={canvasRef}
              activeStep={activeStep}
              onSelectStep={onSelectStep}
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
