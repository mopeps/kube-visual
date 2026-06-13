// ── The Overview's network-mode "bigger picture" ────────────────────────────
// When the "Network" toggle is on (wide desktop), the Overview rearranges its
// REAL components into a network-first map and floats the OVN logical objects
// over the top of it. Nothing here redefines a component — it pulls the actual
// zone/node objects out of zones.js and regroups them, so every card still
// opens its true AncestryModal and every special card (etcd intent store,
// controller/operator sets, realized Service/NetworkPolicy flows, MetalLB)
// renders exactly as on the normal canvas.
//
// Layout (buildNetworkView):
//   • the cluster-scoped singletons that aren't per-node — the guest control
//     plane namespace and metallb-system — sit as full-width zones up top.
//   • the bare-metal nodes are paired into THREE parallel columns: a master row
//     (master-1/2/3) above a worker row (worker-1/2/3). Column N reads as one
//     "pair": master-N over worker-N.
//   • the KubeVirt launcher / guest VM (with its app pods, Services and the
//     NetworkPolicy) is a full-width zone at the bottom — that is where the
//     guest SDN physically lives.
//
// The logical objects (NET_LOGICAL) are NOT zones. They render as free-floating
// objects in the gap between the master row and the worker row, spanning all
// three pairs — so it reads that one join switch / one cluster router is shared
// by every node — while sitting in the empty band so they never cover a card.
// NET_CONNECTORS wire each node's Open vSwitch (br-int) up to them.

import { ZONES } from './zones'

// ── Synthetic logical-object details (DeepDiveModal shape) ──────────────────

const MGMT_JOIN_DETAIL = {
  role: 'LOGICAL SWITCH · ROUTER INTERCONNECT (MGMT)',
  summary:
    'The management cluster’s "join" switch. It exists for one reason: OVN routers cannot peer directly, so this stub switch on 100.64.0.0/16 wires the distributed ovn_cluster_router to every bare-metal node’s gateway router. No pod ever lives here — its ports are router legs only, which is why it floats over every node rather than inside one.',
  sections: [
    { heading: 'At a glance', tags: ['router interconnect', '100.64.0.0/16', 'one per cluster', 'shared by every node'] },
    { heading: 'Facts', facts: [
      { k: 'subnet', v: '100.64.0.0/16 (RFC 6598 shared space — never routed)' },
      { k: 'ovn_cluster_router', v: '100.64.0.1' },
      { k: 'GR_<node>', v: '100.64.0.2 … one leg per bare-metal node' },
    ] },
    { heading: 'Explore', commands: [
      '# On a node, via the mgmt ovnkube pods:\noc -n openshift-ovn-kubernetes exec <ovnkube-node-…> -c nbdb -- ovn-nbctl lsp-list join',
    ] },
  ],
}

const MGMT_ROUTER_DETAIL = {
  role: 'DISTRIBUTED LOGICAL ROUTER (MGMT)',
  summary:
    'ovn_cluster_router — the router every bare-metal pod subnet hangs off. "Distributed" is the point: it runs nowhere. Every node’s ovn-controller compiles it into that node’s Open vSwitch (br-int), so routing between pod subnets happens on the source node and inter-node hops cross the machine network as Geneve frames.',
  sections: [
    { heading: 'At a glance', tags: ['distributed', 'runs nowhere', 'routed at the source node', 'one per cluster'] },
    { heading: 'Facts', facts: [
      { k: 'port to join', v: 'rtoj · 100.64.0.1/16' },
      { k: 'one rtos port per node', v: 'each node’s /23 pod subnet is its default gateway' },
      { k: 'realized by', v: 'every node’s br-int (the Open vSwitch cards below)' },
    ] },
    { heading: 'Explore', commands: [
      'oc -n openshift-ovn-kubernetes exec <ovnkube-node-…> -c nbdb -- ovn-nbctl lr-route-list ovn_cluster_router',
    ] },
  ],
}

const GUEST_JOIN_DETAIL = {
  role: 'LOGICAL SWITCH · ROUTER INTERCONNECT (GUEST)',
  summary:
    'The guest cluster’s own join switch — the same construct as the management one, even the same 100.64.0.0/16 default, but a row in the northbound database served by the OVN-K8s Master pod in the HCP namespace. The two SDNs reuse identical subnets because their packets never meet unencapsulated.',
  sections: [
    { heading: 'At a glance', tags: ['guest NB DB', 'same subnet as mgmt — never collides', 'router ports only'] },
    { heading: 'Explore', commands: [
      '# The guest’s NB DB lives in the HCP namespace on the mgmt cluster:\noc -n clusters-<guest> exec <ovnkube-master-…> -c nbdb -- ovn-nbctl lsp-list join',
    ] },
  ],
}

const GUEST_ROUTER_DETAIL = {
  role: 'DISTRIBUTED LOGICAL ROUTER (GUEST)',
  summary:
    'The guest cluster’s pod-subnet router. Declared up in the HCP namespace’s NB DB, realized down in the VM: the in-guest Open vSwitch compiles it locally. Guest "nodes" are VMs, so its inter-node tunnels run between VM addresses — which are themselves management-cluster pod IPs.',
  sections: [
    { heading: 'At a glance', tags: ['distributed', 'declared in the HCP namespace', 'realized in the VM'] },
    { heading: 'Explore', commands: [
      'oc -n clusters-<guest> exec <ovnkube-master-…> -c nbdb -- ovn-nbctl lr-route-list ovn_cluster_router',
    ] },
  ],
}

// ── The floating logical objects (rendered by LogicalOverlay, not as zones) ──

export const NET_LOGICAL = {
  // The mgmt SDN's shared core — floats in the band between the master and
  // worker rows, spanning all three pairs.
  mgmt: [
    { id: 'net-mjoin', title: 'LS "join"', typePrefix: 'Logical Switch', variant: 'switch',
      colorVar: 'k-orange', caption: '100.64.0.0/16 · shared by every node', detail: MGMT_JOIN_DETAIL },
    { id: 'net-mrouter', title: 'ovn_cluster_router', typePrefix: 'OVN Cluster Router', variant: 'ellipse',
      colorVar: 'k-orange', caption: 'distributed · runs on every node', detail: MGMT_ROUTER_DETAIL },
  ],
  // The guest SDN's core — floats over the guest VM zone at the bottom.
  guest: [
    { id: 'net-grouter', title: 'ovn_cluster_router', typePrefix: 'OVN Cluster Router', variant: 'ellipse',
      colorVar: 'k-purple', caption: 'guest · runs in the VM', detail: GUEST_ROUTER_DETAIL },
    { id: 'net-gjoin', title: 'LS "join" (guest)', typePrefix: 'Logical Switch', variant: 'switch',
      colorVar: 'k-purple', caption: 'guest NB DB · same subnet, own universe', detail: GUEST_JOIN_DETAIL },
  ],
}

// Always-on connectors (ReconLoopOverlay, idPrefix ''). Each bare-metal node's
// Open vSwitch (br-int) legs its gateway router up to the shared join switch;
// the cluster router peers across it. The guest core wires to the in-VM switch.
const grLeg = (n, ovsId) => ({
  id: `net-gr-${n}`, from: ovsId, to: 'net-mjoin', step: '',
  axis: 'vertical', solid: true, quiet: true, accent: 'k-orange',
  title: `GR_${n} on the join switch`,
  detail: {
    role: 'GATEWAY ROUTER LEG',
    summary: `${n}’s gateway router — compiled into this node’s Open vSwitch (br-int) — peers with the distributed cluster router across the join switch. It is pinned to the node because it holds NAT/conntrack state.`,
  },
})

export const NET_CONNECTORS = [
  {
    id: 'net-join-rtr', from: 'net-mjoin', to: 'net-mrouter', step: '',
    solid: true, quiet: true, accent: 'k-orange', label: 'rtoj · 100.64.0.1',
    title: 'join switch ↔ ovn_cluster_router (mgmt)',
    detail: {
      role: 'ROUTER INTERCONNECT',
      summary: 'The distributed router’s single leg on the join switch (100.64.0.1). OVN routers can’t peer directly; this stub subnet exists purely so they can next-hop to each other.',
    },
  },
  grLeg('master-1', 'ovs-master'),
  grLeg('master-2', 'ovs-master-2'),
  grLeg('master-3', 'ovs-master-3'),
  grLeg('worker-1', 'ovs-host'),
  grLeg('worker-2', 'ovs-worker-2'),
  grLeg('worker-3', 'ovs-worker-3'),
  // Guest SDN — over the VM zone.
  {
    id: 'net-gjoin-rtr', from: 'net-grouter', to: 'net-gjoin', step: '',
    solid: true, quiet: true, accent: 'k-purple', label: 'rtoj · 100.64.0.1',
    title: 'join switch ↔ ovn_cluster_router (guest)',
    detail: {
      role: 'ROUTER INTERCONNECT',
      summary: 'Same construct as the management layer’s, even the same default subnet — a row in the guest’s own northbound database. The two SDNs never collide: each is its own address universe, meeting only through encapsulation.',
    },
  },
  {
    id: 'net-gjoin-ovs', from: 'ovs-guest', to: 'net-gjoin', step: '',
    axis: 'vertical', solid: true, quiet: true, accent: 'k-purple',
    title: 'GR_guest-worker on the guest join switch',
    detail: {
      role: 'GATEWAY ROUTER LEG (GUEST)',
      summary: 'The guest node’s gateway router, compiled into the in-VM br-int. Guest egress is SNATed here to the VM’s address — which is itself a management pod IP.',
    },
  },
]

// Which connector ids belong to the guest layer (the rest are mgmt) — used by
// the SDN-layer focus dimmer.
export const NET_GUEST_EDGE_IDS = new Set(['net-gjoin-rtr', 'net-gjoin-ovs'])

export const NET_LAYERS = [
  { id: 'mgmt', label: 'Management SDN', accentVar: 'k-orange' },
  { id: 'guest', label: 'Guest SDN', accentVar: 'k-purple' },
]

// ── Build the rearranged view from the real zone tree ───────────────────────

const findZone = (zones, id) => {
  for (const z of zones || []) {
    if (z.id === id) return z
    const hit = findZone(z.zones, id)
    if (hit) return hit
  }
  return null
}

// A node-level copy of a bare-metal node zone: keep its own nodes (the host
// agents + network plane + any static pods), drop the child namespaces and the
// replica-row machinery — those are placed elsewhere in this view.
const nodeOnly = (zone, label) => ({
  ...zone, label: label || zone.label, zones: undefined, replicaNodes: undefined,
})

// Builds the network-mode layout once (the zone tree is static). Returns the
// pieces OverviewTab assembles: the full-width singleton zones, the two rows of
// three node columns, and the guest VM zone.
export function buildNetworkView() {
  const mgmtCtx = findZone(ZONES, 'management-context')
  const masterNode = findZone(ZONES, 'master-node')
  const workerNode = findZone(ZONES, 'worker-node')
  const [m2, m3] = masterNode.replicaNodes
  const [w2, w3] = workerNode.replicaNodes

  return {
    // Cluster-scoped management namespaces, lifted to the top.
    topZones: [
      findZone(ZONES, 'guest-cp-namespace'),
      findZone(ZONES, 'metallb-system'),
    ].filter(Boolean),
    // The three master+worker pairs, as aligned rows of columns.
    masters: [nodeOnly(masterNode, 'master-1 · bare metal'), m2, m3],
    workers: [nodeOnly(workerNode, 'worker-1 · bare metal'), w2, w3],
    // The guest VM (launcher → VMI with the app pods, Services, NetworkPolicy).
    bottomZones: [findZone(ZONES, 'kubevirt-launcher-zone')].filter(Boolean),
    ctxColor: mgmtCtx?.color || 'var(--k-blue)',
  }
}
