// ── The Overview's network-mode "bigger picture" ────────────────────────────
// When the "Network" toggle is on (wide desktop), the Overview renders the SAME
// normal canvas THREE times in parallel columns — one per node pair — and floats
// the OVN logical objects over the top. The columns are built by OverviewTab from
// the real zone tree (so every card still opens its true AncestryModal and every
// special card renders unchanged); this file supplies only the floating logical
// objects and the connectors that tie the three columns to them.
//
// Layout:
//   • three identical full-overview columns side by side (#net-col-0/1/2), each
//     the whole management context — control-plane static pods, the guest control
//     plane & metallb namespaces, and the guest VM.
//   • the management SDN core (NET_LOGICAL.mgmt: join switch + cluster router)
//     floats in a reserved strip ABOVE the columns; the guest SDN core
//     (NET_LOGICAL.guest) floats in a reserved strip BELOW them.
//
// The logical objects are NOT zones — they're free-floating objects in the empty
// strips, spanning all three columns, so it reads that one join switch / one
// cluster router is shared by every pair. NET_CONNECTORS leg each column up to
// the mgmt core (net-col-top-N) and down to the guest core (net-col-bot-N).

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

// Always-on connectors (ReconLoopOverlay, idPrefix ''). The three parallel node
// pairs each leg up to the one shared SDN core that floats above them; the join
// switch and cluster router peer across the stub subnet. The guest SDN core
// floats below and wires to each pair likewise.
export const NET_PAIRS = [0, 1, 2]

const mgmtLeg = (i) => ({
  id: `net-mleg-${i}`, from: `net-col-top-${i}`, to: 'net-mjoin', step: '',
  axis: 'vertical', solid: true, quiet: true, accent: 'k-orange',
  title: `node pair ${i + 1} → shared join switch`,
  detail: {
    role: 'GATEWAY ROUTER LEG',
    summary: `Node pair ${i + 1}'s gateway router — compiled into its Open vSwitch (br-int) — peers with the distributed cluster router across the shared join switch. Every pair holds its own leg; the switch itself is one logical object for the whole cluster.`,
  },
})

const guestLeg = (i) => ({
  id: `net-gleg-${i}`, from: `net-col-bot-${i}`, to: 'net-gjoin', step: '',
  axis: 'vertical', solid: true, quiet: true, accent: 'k-purple',
  title: `node pair ${i + 1} → guest join switch`,
  detail: {
    role: 'GATEWAY ROUTER LEG (GUEST)',
    summary: `The guest node's gateway router, compiled into the in-VM br-int on pair ${i + 1}. Guest egress is SNATed here to the VM's address — which is itself a management pod IP.`,
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
  ...NET_PAIRS.map(mgmtLeg),
  {
    id: 'net-gjoin-rtr', from: 'net-grouter', to: 'net-gjoin', step: '',
    solid: true, quiet: true, accent: 'k-purple', label: 'rtoj · 100.64.0.1',
    title: 'join switch ↔ ovn_cluster_router (guest)',
    detail: {
      role: 'ROUTER INTERCONNECT',
      summary: 'Same construct as the management layer’s, even the same default subnet — a row in the guest’s own northbound database. The two SDNs never collide: each is its own address universe, meeting only through encapsulation.',
    },
  },
  ...NET_PAIRS.map(guestLeg),
]

export const NET_LAYERS = [
  { id: 'mgmt', label: 'Management SDN', accentVar: 'k-orange' },
  { id: 'guest', label: 'Guest SDN', accentVar: 'k-purple' },
]
