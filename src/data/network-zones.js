// ── The Overview's network-mode topology ────────────────────────────────────
// When the "Network" toggle is on (wide desktop), the Overview stops drawing
// the full component stack and instead renders THIS: a focused OVN logical
// topology, modelled on the `ovn-topology-full` deep dive but built from the
// REAL overview components, so every node card still opens its true component
// sheet (AncestryModal).
//
// Layout idea (the shape the OVN full-picture topic uses, applied here):
//   • a full-width *overarching* band at the top holds the management SDN's
//     shared logical core — the "join" switch + the distributed cluster router.
//     It spans ABOVE every node column and connects DOWN to each, so the core
//     reads as one thing shared by all nodes — never drawn on top of the
//     components inside a node.
//   • below it, the bare-metal nodes are laid out as PARALLEL COLUMNS
//     (master-1/2/3, worker-1/2/3), each a tidy node zone showing only its
//     network plane: the OVN-K8s Node agent over the Open vSwitch (br-int) it
//     programs — the data plane the per-node gateway router compiles into.
//   • the one worker that hosts the guest VMs nests the guest cluster's own
//     little OVN topology inside its column (its own join/router core + the
//     in-VM Open vSwitch and the application pods), since that is physically
//     where the guest SDN lives — one turtle down.
//
// Everything not part of the network story (the control-plane Pods, etcd,
// the operators, MetalLB, kubelet/CRI-O …) is simply omitted from this view.
//
// boxes  — NodeCards. A box with `mirror` opens that registered component's
//          real sheet; a box with `detail` (the synthetic logical switches /
//          routers) opens an OVN teaching popup (the DeepDiveModal sheet).
// edges  — always-on structural wiring, drawn by ReconLoopOverlay (idPrefix '')
//          against the boxes' raw DOM ids.

// ── Synthetic logical-object details (DeepDiveModal shape) ──────────────────

const MGMT_JOIN_DETAIL = {
  role: 'LOGICAL SWITCH · ROUTER INTERCONNECT (MGMT)',
  summary:
    'The management cluster’s "join" switch. It exists for one reason: OVN routers cannot peer directly, so this stub switch on 100.64.0.0/16 wires the distributed ovn_cluster_router to every bare-metal node’s gateway router. No pod ever lives here — its ports are router legs only, which is why it floats above every node column rather than inside one.',
  sections: [
    { heading: 'At a glance', tags: ['router interconnect', '100.64.0.0/16', 'one per cluster', 'spans every node'] },
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
    'ovn_cluster_router — the router every bare-metal pod subnet hangs off. "Distributed" is the point: it runs nowhere. Every node’s ovn-controller compiles it into that node’s Open vSwitch (br-int) below, so routing between pod subnets happens on the source node and inter-node hops cross the machine network as Geneve frames.',
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
    'The guest cluster’s own join switch — the same construct as the management one above, even the same 100.64.0.0/16 default, but a row in a different northbound database: the one served by the OVN-K8s Master pod in the HCP namespace. The two SDNs reuse identical subnets because their packets never meet unencapsulated.',
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
    'The guest cluster’s pod-subnet router. Declared up in the HCP namespace’s NB DB, realized down here: the VM’s in-guest Open vSwitch compiles it locally. Guest "nodes" are VMs, so its inter-node tunnels run between VM addresses — which are themselves management-cluster pod IPs.',
  sections: [
    { heading: 'At a glance', tags: ['distributed', 'declared in the HCP namespace', 'realized in the VM'] },
    { heading: 'Explore', commands: [
      'oc -n clusters-<guest> exec <ovnkube-master-…> -c nbdb -- ovn-nbctl lr-route-list ovn_cluster_router',
    ] },
  ],
}

// ── Box factories ───────────────────────────────────────────────────────────

// A synthetic logical object (switch / router) — no real component behind it,
// so it opens the OVN teaching popup. `kind: 'chip'` flags it for NetworkCanvas.
const chip = (id, title, typePrefix, variant, colorVar, caption, detail) => ({
  id, kind: 'chip', title, typePrefix, variant, colorVar, caption, detail,
})

// A box that IS a real overview component — clicking opens its AncestryModal.
// `id` is the unique DOM anchor (so edges can target it); `mirror` is the
// canonical componentId whose sheet opens (replicas reuse the primary's).
const real = (id, title, typePrefix, colorVar, extra = {}) => ({
  id, mirror: extra.mirror || id, title, typePrefix, colorVar, ...extra,
})

// One bare-metal node column. The Open vSwitch (br-int) sits at the TOP — it is
// the data plane that faces the shared core above, so its leg can rise straight
// up to the join switch without crossing any card. The OVN-K8s Node agent that
// programs it sits below. The node's gateway router is compiled into that
// br-int, so the column names it in the switch's caption.
const metalColumn = ({ id, label, colorVar, ovnId, ovnMirror, ovsId, ovsMirror, gr }) => ({
  id, label, colorVar, dashed: true, layout: 'stack',
  boxes: [
    real(ovsId, 'Open vSwitch', 'systemd', 'k-amber', { mirror: ovsMirror, variant: 'bridge', caption: gr }),
    real(ovnId, 'OVN-K8s Node', 'Pod', colorVar, { mirror: ovnMirror }),
  ],
})

// ── The management SDN core band + the six node columns ─────────────────────

// A labelled, bordered band that spans the full width above the node columns —
// the "overarching" shared core. Its two logical objects sit side by side.
const MGMT_CORE = {
  id: 'nz-mgmt-core', label: 'Management SDN · shared logical core (every node hangs off it)',
  colorVar: 'k-orange', layout: 'stack',
  boxes: [
    { ...chip('nz-mjoin', 'LS "join"', 'Logical Switch', 'switch', 'k-sky',
      '100.64.0.0/16 · spans every node', MGMT_JOIN_DETAIL), inline: true },
    { ...chip('nz-mrouter', 'ovn_cluster_router', 'OVN Cluster Router', 'ellipse', 'k-green',
      'distributed · runs on every node', MGMT_ROUTER_DETAIL), inline: true },
  ],
}

// The guest cluster's little OVN topology, nested inside the worker that hosts
// the VM (worker-1 in this app's model). Its own core + in-VM data plane + the
// application pods — the whole guest SDN, one turtle down.
// Box order mirrors the metal columns: the shared core at the top (router then
// join switch, so the switch sits adjacent to the br-int it legs into), then
// the in-VM Open vSwitch, then the pods, then the agents at the bottom. Every
// edge connects adjacent boxes, so none crosses a card.
const GUEST_VM_ZONE = {
  id: 'nz-guest-vm', label: 'guest-worker · VirtualMachineInstance', colorVar: 'k-green',
  dashed: true, layout: 'stack',
  boxes: [
    chip('nz-grouter', 'ovn_cluster_router', 'OVN Cluster Router', 'ellipse', 'k-purple',
      'distributed · runs in the VM', GUEST_ROUTER_DETAIL),
    chip('nz-gjoin', 'LS "join" (guest)', 'Logical Switch', 'switch', 'k-purple',
      'guest NB DB · same subnet, own universe', GUEST_JOIN_DETAIL),
    real('ovs-guest', 'Open vSwitch', 'systemd', 'k-amber', { variant: 'bridge', caption: 'in-VM br-int · GR_guest-worker' }),
    { ...real('frontend-application-pod', 'Front-End', 'Pod', 'k-green'), inline: true },
    { ...real('backend-application-pod', 'Back-End', 'Pod', 'k-green'), inline: true },
    real('openshift-ingress-router-guest', 'Ingress Router', 'Pod', 'k-green'),
    real('ovn-node-guest', 'OVN-K8s Node', 'Pod', 'k-green'),
  ],
}

const WORKER_1_COLUMN = {
  id: 'nz-col-worker-1', label: 'worker-1 · bare metal', colorVar: 'k-blue-worker',
  dashed: true, layout: 'stack',
  boxes: [
    real('ovs-host', 'Open vSwitch', 'systemd', 'k-amber', { variant: 'bridge', caption: 'br-int · GR_worker-1' }),
    real('ovn-node-host', 'OVN-K8s Node', 'Pod', 'k-blue-worker'),
  ],
  zones: [GUEST_VM_ZONE],
}

const NODE_COLUMNS = {
  id: 'nz-mgmt-nodes', bare: true, layout: 'columns',
  zones: [
    metalColumn({ id: 'nz-col-master-1', label: 'master-1 · bare metal', colorVar: 'k-blue',
      ovnId: 'ovn-node-master', ovsId: 'ovs-master', gr: 'br-int · GR_master-1' }),
    metalColumn({ id: 'nz-col-master-2', label: 'master-2 · bare metal', colorVar: 'k-blue',
      ovnId: 'ovn-node-master-2', ovnMirror: 'ovn-node-master',
      ovsId: 'ovs-master-2', ovsMirror: 'ovs-master', gr: 'br-int · GR_master-2' }),
    metalColumn({ id: 'nz-col-master-3', label: 'master-3 · bare metal', colorVar: 'k-blue',
      ovnId: 'ovn-node-master-3', ovnMirror: 'ovn-node-master',
      ovsId: 'ovs-master-3', ovsMirror: 'ovs-master', gr: 'br-int · GR_master-3' }),
    WORKER_1_COLUMN,
    metalColumn({ id: 'nz-col-worker-2', label: 'worker-2 · bare metal', colorVar: 'k-blue-worker',
      ovnId: 'ovn-node-worker-2', ovnMirror: 'ovn-node-host',
      ovsId: 'ovs-worker-2', ovsMirror: 'ovs-host', gr: 'br-int · GR_worker-2' }),
    metalColumn({ id: 'nz-col-worker-3', label: 'worker-3 · bare metal', colorVar: 'k-blue-worker',
      ovnId: 'ovn-node-worker-3', ovnMirror: 'ovn-node-host',
      ovsId: 'ovs-worker-3', ovsMirror: 'ovs-host', gr: 'br-int · GR_worker-3' }),
  ],
}

// The whole network-mode canvas: the overarching core band on top, the row of
// parallel node columns below (the OVN full-picture topic's geometry).
export const NET_ZONES = [MGMT_CORE, NODE_COLUMNS]

// ── Always-on structural wiring ──────────────────────────────────────────────
// Plain solid lines (a textbook diagram's geometry); only a couple carry a
// label so the canvas stays quiet. Each node's br-int hangs off the shared
// core above; the guest core wires up inside the VM column.

const grLeg = (n, ovsId) => ({
  id: `nz-gr-${n}`, from: ovsId, to: 'nz-mjoin', step: '',
  axis: 'vertical', solid: true, quiet: true, accent: 'k-orange',
  title: `GR_${n} on the join switch`,
  detail: {
    role: 'GATEWAY ROUTER LEG',
    summary: `${n}’s gateway router — compiled into this node’s Open vSwitch (br-int) — peers with the distributed cluster router across the join switch. It is pinned to the node because it holds NAT/conntrack state.`,
  },
})

export const NET_EDGES = [
  // The shared core's own interconnect.
  {
    id: 'nz-join-rtr', from: 'nz-mjoin', to: 'nz-mrouter', step: '',
    solid: true, quiet: true, accent: 'k-orange', label: 'rtoj · 100.64.0.1',
    title: 'join switch ↔ ovn_cluster_router (mgmt)',
    detail: {
      role: 'ROUTER INTERCONNECT',
      summary: 'The distributed router’s single leg on the join switch (100.64.0.1). OVN routers can’t peer directly; this stub subnet exists purely so they can next-hop to each other.',
    },
  },
  // Every bare-metal node's br-int hangs its gateway router off the join switch.
  grLeg('master-1', 'ovs-master'),
  grLeg('master-2', 'ovs-master-2'),
  grLeg('master-3', 'ovs-master-3'),
  grLeg('worker-1', 'ovs-host'),
  grLeg('worker-2', 'ovs-worker-2'),
  grLeg('worker-3', 'ovs-worker-3'),

  // ── Guest SDN, inside the VM column ──
  {
    id: 'nz-gjoin-rtr', from: 'nz-gjoin', to: 'nz-grouter', step: '',
    solid: true, quiet: true, accent: 'k-purple', label: 'rtoj · 100.64.0.1',
    title: 'join switch ↔ ovn_cluster_router (guest)',
    detail: {
      role: 'ROUTER INTERCONNECT',
      summary: 'Same construct as the management layer’s, even the same default subnet — a row in the guest’s own northbound database. The two SDNs never collide: each is its own address universe, meeting only through encapsulation.',
    },
  },
  {
    id: 'nz-gjoin-ovs', from: 'nz-gjoin', to: 'ovs-guest', step: '',
    axis: 'vertical', solid: true, quiet: true, accent: 'k-purple',
    title: 'GR_guest-worker on the guest join switch',
    detail: {
      role: 'GATEWAY ROUTER LEG (GUEST)',
      summary: 'The guest node’s gateway router, compiled into the in-VM br-int. Guest egress is SNATed here to the VM’s address — which is itself a management pod IP.',
    },
  },
  {
    id: 'nz-ovs-fe', from: 'ovs-guest', to: 'frontend-application-pod', step: '',
    axis: 'vertical', solid: true, quiet: true, accent: 'k-green',
  },
  {
    id: 'nz-ovs-be', from: 'ovs-guest', to: 'backend-application-pod', step: '',
    axis: 'vertical', solid: true, quiet: true, accent: 'k-green',
  },
]

// Which SDN layer each box/edge belongs to (the layer-focus dimmer). Anything
// not listed as 'guest' is treated as 'mgmt'.
export const NET_GUEST_IDS = new Set([
  'nz-guest-vm', 'nz-gjoin', 'nz-grouter', 'ovn-node-guest', 'ovs-guest',
  'openshift-ingress-router-guest', 'frontend-application-pod', 'backend-application-pod',
  'nz-gjoin-rtr', 'nz-gjoin-ovs', 'nz-ovs-fe', 'nz-ovs-be',
])

export const NET_LAYERS = [
  { id: 'mgmt', label: 'Management SDN', accentVar: 'k-orange' },
  { id: 'guest', label: 'Guest SDN', accentVar: 'k-purple' },
]
