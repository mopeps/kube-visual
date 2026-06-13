import { Fragment, useEffect, useRef, useState } from 'react'
import { ZONES, INTENT_OBJECT_STORE, CONTROLLER_PARENT, OPERATOR_PARENT, FLOW_PARENT } from '../data/zones'
import Zone from './Zone'
import NodeCard from './NodeCard'
import DeepDiveModal from './DeepDiveModal'
import ReconLoopOverlay from './ReconLoopOverlay'
import { NET_LOGICAL, NET_CONNECTORS, NET_PAIRS } from '../data/network-zones'
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

export default function OverviewTab({
  activeEvent,
  activeComponentIds,
  onSelectComponent,
  activeStep,
  onSelectStep,
  highlightId,
  onClearHighlight,
  // Wide-desktop only: draw the OVN logical topology over the canvas.
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
  // Network-mode state: the popup content of a clicked logical switch / router
  // or connector label (shares the deep-dive sheet with the replica popup).
  const [netSheet, setNetSheet] = useState(null)
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

  function renderNode(node, zone) {
    const { isActive, isOnPath, isDimmed } = traceStates(node.id)
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
        id={node.id}
        title={node.title}
        typePrefix={node.typePrefix}
        typeAlias={serviceAlias(node)}
        color={zone.color}
        stepNum={stepNums.get(node.id)}
        isActive={isActive}
        isOnPath={isOnPath}
        isDimmed={isDimmed}
        isHighlighted={node.id === highlightId}
        // A replica-zone card mirrors a canonical component: it keeps its own
        // DOM id (unique anchor for overlays/arrows) but opens the canonical
        // component's detail modal — the software is identical.
        onClick={node.mirror ? () => onSelectComponent(node.mirror) : onSelectComponent}
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
  function renderZoneNodes(zone) {
    const nodes = zone.nodes ?? []
    const byId = new Map(nodes.map(n => [n.id, n]))
    // Either relation references its target by id; the target renders inside the
    // pair, not standalone.
    const targetOf = (n) => n.exposes || n.programs
    const pairedTargets = new Set(
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
            service={renderNode(node, zone)}
            target={renderNode(byId.get(target), zone)}
          />
        )
        continue
      }
      out.push(renderNode(node, zone))
    }
    if (out.length === 0) return null
    return <Masonry key={`${zone.id}-nodes`}>{out}</Masonry>
  }

  function renderZone(zone, depth = 0, parentZone = null) {
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
        {renderZoneNodes(zone)}
        {/* Child zones */}
        {zone.zones?.map(child => renderZone(child, depth + 1))}
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

  // Chip / edge-label clicks on the network overlay open the shared sheet
  // (displacing an open replica popup, and vice versa).
  const selectNetChip = (chip) => {
    setReplica(null)
    setNetSheet({
      id: chip.id,
      title: chip.title,
      typePrefix: chip.typePrefix,
      accent: `var(--${chip.colorVar || 'k-amber'})`,
      detail: chip.detail,
    })
  }
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

  // The normal Overview canvas content — the management context surfaced as its
  // master-node / worker-node stack. Shared by the normal canvas and rendered
  // once per parallel column in network mode.
  const renderOverviewStack = () =>
    visibleZones.flatMap(zone =>
      zone.hideWrapper
        ? [
            // Wrapper hidden: surface its own nodes and child zones directly
            // so neither is silently dropped.
            renderZoneNodes(zone),
            ...(zone.zones ?? []).map(child => renderZone(child)),
          ]
        : [renderZone(zone)]
    )

  // The shared OVN logical core (join switch + cluster router) — floats in a
  // reserved strip above (mgmt) or below (guest) the three columns, NOT a zone,
  // spanning all three pairs. Clicking one opens its teaching popup.
  const renderCore = (objects, extraClass) => (
    <div className={`net-core ${extraClass}`} aria-label="Shared OVN logical objects">
      {objects.map((o) => (
        <NodeCard
          key={o.id}
          id={o.id}
          title={o.title}
          typePrefix={o.typePrefix}
          variant={o.variant}
          color={`var(--${o.colorVar})`}
          subtitle={o.caption}
          onClick={() => selectNetChip(o)}
        />
      ))}
    </div>
  )

  return (
    <>
      {netOverlay && (
        <div className="net-bar">
          <span className="net-bar-label">Network map</span>
          <span className="net-bar-hint">
            The whole Overview, three node pairs in parallel — with the one OVN
            join switch &amp; cluster router they all share floating above, and the
            guest SDN core below. Click any card, switch or router for details.
          </span>
        </div>
      )}
      {netOverlay ? (
        // Network mode: the normal canvas rendered three times in parallel
        // columns (one per node pair), with the shared OVN core floating in the
        // reserved strips above and below (see network-zones.js).
        <div
          ref={canvasRef}
          className="border border-border-w rounded-lg overflow-visible overview-canvas net-bigpicture"
          style={{ background: 'rgba(0,0,0,0.2)', position: 'relative' }}
        >
          {renderCore(NET_LOGICAL.mgmt, 'net-core--mgmt')}
          <div className="net-cols">
            {NET_PAIRS.map((i) => (
              <div className="net-col" id={`net-col-${i}`} key={i}>
                <div className="net-col-cap" id={`net-col-top-${i}`}>
                  Node pair {i + 1}
                </div>
                {renderOverviewStack()}
                <div className="net-col-foot" id={`net-col-bot-${i}`} aria-hidden />
              </div>
            ))}
          </div>
          {renderCore(NET_LOGICAL.guest, 'net-core--guest')}
          <ReconLoopOverlay
            edges={NET_CONNECTORS}
            canvasRef={canvasRef}
            activeEdgeId={null}
            signal={null}
            onSelectEdge={selectNetEdge}
            idPrefix=""
          />
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
