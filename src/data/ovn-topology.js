// ── OVN-Kubernetes logical topology — shared content ────────────────────────
// Single source of truth for the OVN teaching material. Two surfaces render it:
//   • the `ovn-topology` deep-dive topic (OVN_TOPOLOGY, included in DEEP_DIVES)
//   • the Overview's network overlay chips/edges (NetworkOverlay), whose detail
//     popups reuse the same detail objects so the two never drift.
//
// The model is the classic two-node kind cluster the ovn-kubernetes docs draw:
// an underlay L2 segment, per-node gateway routers behind localnet external
// switches, one logical "join" switch, one distributed ovn_cluster_router, and
// a per-node logical switch carrying the pods. Every box here is an object you
// can list with ovn-nbctl — except br-int, which is the punchline: the only
// thing that actually exists on a node.

// The two worker nodes of the reference topology. (ovn-kubernetes numbers the
// join-switch ports rtoj-: the distributed router takes 100.64.0.1, the
// gateway routers .2/.3 — diagrams often misread those as pod addresses.)
const W1 = {
  id: 'w1', node: 'ovn-worker', hostIp: '172.18.0.2',
  joinIp: '100.64.0.2', subnet: '10.244.0.0/24', routerPort: '10.244.0.1',
}
const W2 = {
  id: 'w2', node: 'ovn-worker2', hostIp: '172.18.0.4',
  joinIp: '100.64.0.3', subnet: '10.244.2.0/24', routerPort: '10.244.2.1',
}

const NBCTL_NOTE =
  '# ovn-nbctl / ovs-vsctl run inside the ovnkube pods on each node, e.g.:\n' +
  '#   kubectl exec -n ovn-kubernetes <ovnkube-node-pod> -c nb-ovsdb -- ovn-nbctl …'

// ── Box details (DeepDiveModal shape: { role, summary, sections }) ──────────

export const UNDERLAY_DETAIL = {
  role: 'PHYSICAL L2 SEGMENT',
  summary:
    'The one network that physically exists between the nodes — in a kind cluster the docker bridge (172.18.0.0/24), on bare metal the machine network. Every byte that leaves a node, pod traffic included, crosses it as a plain Ethernet frame: either a Geneve-encapsulated tunnel packet (east-west) or an SNATed packet from a gateway router (north-south).',
  sections: [
    { heading: 'What rides it', bullets: [
      'Node-to-node pod traffic — Geneve UDP :6081 frames between the nodes’ eth0 addresses.',
      'Egress traffic — already SNATed to the node IP by GR_<node>, indistinguishable from host traffic.',
      'Everything the hosts themselves do: API calls, image pulls, etcd peering.',
    ] },
    { heading: 'Facts', facts: [
      { k: 'subnet', v: '172.18.0.0/24 (kind’s docker network)' },
      { k: `${W1.node}`, v: W1.hostIp },
      { k: `${W2.node}`, v: W2.hostIp },
    ] },
    { heading: 'Explore', commands: [
      '# The underlay in kind is just a docker bridge network\ndocker network inspect kind | grep -E \'Subnet|IPv4\'',
      '# Geneve tunnel traffic between the nodes\ntcpdump -ni eth0 udp port 6081',
    ] },
  ],
}

export const ethDetail = (w) => ({
  role: 'NODE NIC',
  summary:
    `${w.node}'s physical interface on the underlay (${w.hostIp}). OVN-Kubernetes claims it at setup: the IP moves onto an external OVS bridge (br-ex / breth0) and eth0 becomes that bridge's uplink port — so OVN can bridge logical traffic onto the wire without owning the host's networking.`,
  sections: [
    { heading: 'Facts', facts: [
      { k: 'address', v: `${w.hostIp}/24` },
      { k: 'enslaved to', v: 'br-ex (the external OVS bridge)' },
      { k: 'tunnel endpoint', v: 'Geneve UDP :6081 terminates here' },
    ] },
    { heading: 'Explore', commands: [
      '# eth0 carries no IP anymore — br-ex does\nip addr show eth0; ip addr show br-ex',
      '# eth0 as a port of the external bridge\novs-vsctl list-ports br-ex',
    ] },
  ],
})

export const brIntDetail = (w) => ({
  role: 'OVS BRIDGE · THE DATA PLANE',
  summary:
    `The integration bridge on ${w.node} — and the punchline of this whole diagram: every switch and router above is *logical*, rows in OVN's northbound database. br-int is the only thing that actually exists on the node. ovn-controller compiles the entire logical topology into OpenFlow rules here, and one rule lookup does what the diagram draws as a multi-hop journey.`,
  sections: [
    { heading: 'Logical vs real', bullets: [
      'Pod veths, the Geneve tunnel port and the patch to br-ex are all ports of br-int.',
      'A pod-to-pod packet never "visits" a router — it matches OpenFlow rules in br-int that encode what the routers *would* do.',
      'ovn-controller on each node watches the southbound DB and keeps these flows in sync.',
    ] },
    { heading: 'Explore', commands: [
      NBCTL_NOTE,
      '# The real topology: br-int and its ports\novs-vsctl show',
      '# The compiled logical pipeline (thousands of rules)\novs-ofctl dump-flows br-int | head -40',
      '# Trace one imaginary packet through the rules\novs-appctl ofproto/trace br-int in_port=<port>,ip,nw_src=10.244.0.3,nw_dst=10.244.2.3',
    ] },
  ],
})

export const extSwitchDetail = (w) => ({
  role: 'LOGICAL SWITCH · LOCALNET',
  summary:
    `ext_${w.node} — a tiny logical switch whose job is to splice the gateway router onto the physical network. Its localnet port maps to the provider bridge (br-ex), so frames leaving GR_${w.node} hit the real wire with the node's own MAC and IP.`,
  sections: [
    { heading: 'Facts', facts: [
      { k: 'ports', v: `etor-GR_${w.node} (to the GR) · br-ex_${w.node} (localnet)` },
      { k: 'network', v: 'the underlay, untagged' },
    ] },
    { heading: 'Explore', commands: [
      NBCTL_NOTE,
      `ovn-nbctl ls-list | grep ext_`,
      `ovn-nbctl lsp-list ext_${w.node}`,
    ] },
  ],
})

export const gatewayRouterDetail = (w) => ({
  role: 'GATEWAY ROUTER · ONE PER NODE',
  summary:
    `GR_${w.node} — the node's door to the outside. Unlike the distributed cluster router it is pinned to ${w.node} (it owns real state: NAT table, conntrack). Egress pod traffic is SNATed here to the node IP ${w.hostIp}; NodePort/load-balancer traffic is DNATed here on the way in.`,
  sections: [
    { heading: 'Facts', facts: [
      { k: 'join port', v: `rtoj-GR_${w.node} · ${w.joinIp}/16` },
      { k: 'external port', v: `rtoe-GR_${w.node} · ${w.hostIp}/24` },
      { k: 'SNAT', v: `10.244.0.0/16 → ${w.hostIp}` },
    ] },
    { heading: 'Explore', commands: [
      NBCTL_NOTE,
      'ovn-nbctl lr-list',
      `# The NAT rules that rewrite pod sources to the node IP\novn-nbctl lr-nat-list GR_${w.node}`,
      `ovn-nbctl lrp-list GR_${w.node}`,
    ] },
  ],
})

export const JOIN_SWITCH_DETAIL = {
  role: 'LOGICAL SWITCH · ROUTER INTERCONNECT',
  summary:
    'The "join" switch exists for one reason: OVN routers cannot peer directly, so a stub switch on its own subnet (100.64.0.0/16) wires the distributed ovn_cluster_router to every per-node gateway router. No pod ever lives here — its addresses are router ports only.',
  sections: [
    { heading: 'Facts', facts: [
      { k: 'subnet', v: '100.64.0.0/16 (RFC 6598 shared space — never routed)' },
      { k: 'ovn_cluster_router', v: '100.64.0.1' },
      { k: `GR_${W1.node}`, v: W1.joinIp },
      { k: `GR_${W2.node}`, v: W2.joinIp },
    ] },
    { heading: 'Explore', commands: [
      NBCTL_NOTE,
      'ovn-nbctl ls-list | grep join',
      'ovn-nbctl lsp-list join',
    ] },
  ],
}

export const CLUSTER_ROUTER_DETAIL = {
  role: 'DISTRIBUTED LOGICAL ROUTER',
  summary:
    'ovn_cluster_router — the router every pod subnet hangs off. "Distributed" is the key idea: it is not running anywhere. Every node’s ovn-controller instantiates it locally in br-int’s OpenFlow rules, so routing between pod subnets happens on the *source* node and the packet crosses the underlay already addressed to its destination.',
  sections: [
    { heading: 'Facts', facts: [
      { k: 'port to join', v: 'rtoj-ovn_cluster_router · 100.64.0.1/16' },
      { k: `rtos-${W1.node}`, v: `${W1.routerPort}/24 (the ${W1.subnet} default gw)` },
      { k: `rtos-${W2.node}`, v: `${W2.routerPort}/24 (the ${W2.subnet} default gw)` },
      { k: 'egress routes', v: 'policy-routes pod traffic to the local node’s GR' },
    ] },
    { heading: 'The whole picture', ascii:
`          Underlay · 172.18.0.0/24
     ──────────┬─────────────────┬──────────
          eth0 │ .2         eth0 │ .4
        ┌──────┴───────┐  ┌──────┴───────┐
        │   br-int     │  │   br-int     │
        │  ovn-worker  │  │  ovn-worker2 │
        └──────┬───────┘  └──────┬───────┘
        ext_ovn-worker     ext_ovn-worker2
               │                 │
        GR_ovn-worker      GR_ovn-worker2
           .2  └── LS "join" ──┘  .3
               100.64.0.0/16 · .1
                      │
              ovn_cluster_router
             ┌────────┴────────┐
       rtos · 10.244.0.1   rtos · 10.244.2.1
             │                 │
       LS ovn-worker     LS ovn-worker2
       10.244.0.0/24     10.244.2.0/24
         │       │             │
       pod-a   pod-b         pod-c
        .3      .5            .3` },
    { heading: 'Explore', commands: [
      NBCTL_NOTE,
      '# Its routing table — one rtos port per node switch\novn-nbctl lr-route-list ovn_cluster_router',
      'ovn-nbctl lrp-list ovn_cluster_router',
    ] },
  ],
}

export const nodeSwitchDetail = (w) => ({
  role: 'LOGICAL SWITCH · ONE PER NODE',
  summary:
    `The logical switch named after ${w.node}, owning the node's pod subnet ${w.subnet}. Every pod scheduled here gets a port on it (its veth, by another name) and uses the cluster router's rtos port ${w.routerPort} as default gateway. Same-node pod traffic never leaves this switch.`,
  sections: [
    { heading: 'Facts', facts: [
      { k: 'subnet', v: w.subnet },
      { k: 'gateway', v: `${w.routerPort} (rtos-${w.node} on ovn_cluster_router)` },
      { k: 'ports', v: 'one per pod + stor (to the router) + a mgmt port' },
    ] },
    { heading: 'Explore', commands: [
      NBCTL_NOTE,
      `# Every pod on ${w.node} is a port here\novn-nbctl lsp-list ${w.node}`,
      `# The subnet annotation the node carries\nkubectl get node ${w.node} -o jsonpath='{.metadata.annotations.k8s\\.ovn\\.org/node-subnets}'`,
    ] },
  ],
})

export const podDetail = (name, ip, w) => ({
  role: 'POD · LOGICAL SWITCH PORT',
  summary:
    `${name} on ${w.node} (${ip}). To Kubernetes it's a pod; to OVN it's exactly one logical switch port on LS ${w.node}. The CNI plugin created a veth pair — one end in the pod's netns as eth0, the other plugged into br-int and bound to this port.`,
  sections: [
    { heading: 'Facts', facts: [
      { k: 'address', v: `${ip}/24` },
      { k: 'gateway', v: w.routerPort },
      { k: 'logical port', v: `<namespace>_${name}` },
    ] },
    { heading: 'Explore', commands: [
      `# OVN's record of this pod's networking\nkubectl get pod ${name} -o jsonpath='{.metadata.annotations.k8s\\.ovn\\.org/pod-networks}'`,
      `# From inside: one NIC, gateway ${w.routerPort}\nkubectl exec ${name} -- ip addr; kubectl exec ${name} -- ip route`,
    ] },
  ],
})

// ── Edge (link) details — the port pairs the labeled links open ─────────────
// Only the links the classic diagram labels carry a clickable annotation (the
// rtoj / rtos addresses); the unlabeled structural lines explain themselves
// through the box popups on either end.

const edgeDetail = (role, summary, commands) => ({
  role, summary,
  sections: commands?.length ? [{ heading: 'Explore', commands: [NBCTL_NOTE, ...commands] }] : [],
})

export const rtojEdgeDetail = (w) => edgeDetail(
  'JOIN-SWITCH PORT',
  `rtoj-GR_${w.node} · ${w.joinIp}/16 — the gateway router's leg on the "join" switch. The 100.64.0.0/16 addresses exist only so the routers can next-hop to each other; nothing else lives on this subnet (the cluster router holds 100.64.0.1).`,
  ['ovn-nbctl lsp-list join'],
)

export const rtosEdgeDetail = (w) => edgeDetail(
  'ROUTER ↔ SWITCH PORT PAIR',
  `rtos-${w.node} · ${w.routerPort}/24 (router side) ↔ stor-${w.node} (switch side): how the node's pod subnet hangs off ovn_cluster_router. ${w.routerPort} is every ${w.node} pod's default gateway — a router port, not a pod (a common misreading of this diagram).`,
  [`ovn-nbctl lrp-list ovn_cluster_router`],
)

// ── The deep-dive topic ──────────────────────────────────────────────────────
// The canvas mirrors the classic diagram's geometry AND its drawing language:
// two tall dashed node columns (each the full chain — eth0 → br-int → ext
// switch → GR, then a gap, then the node switch with its pods at the bottom),
// the shared join switch + cluster router floating between them at mid-height,
// and the underlay as one wide bus bar both nodes' eth0 lines drop out of.
// Boxes are colour-coded like the picture (switches sky, routers green,
// br-int and the pods amber), routers are ellipses (variant), and the
// cluster-spanning core boxes carry a caption saying so ("one per cluster",
// "runs on every node"). All structural links are solid plain lines; only the
// ones the diagram labels carry text (the rtoj/rtos addresses, quiet style).

// Shared box definitions — the topology boxes exist once (same ids, details,
// colours and shapes) and two topics arrange them: the classic diagram, and
// the "big view" that re-parents the very same boxes into the greyed
// OpenShift components that contain them.
const nodeBoxes = (w) => ({
  eth0: { id: `${w.id}-eth0`, title: 'eth0', typePrefix: 'netdev', variant: 'iface', detail: ethDetail(w) },
  brint: { id: `${w.id}-brint`, title: 'br-int', typePrefix: 'OVS bridge', colorVar: 'k-amber', variant: 'bridge', detail: brIntDetail(w) },
  ext: { id: `${w.id}-ext`, title: `ext_${w.node}`, typePrefix: 'External Switch', colorVar: 'k-sky', variant: 'switch', detail: extSwitchDetail(w) },
  gr: { id: `${w.id}-gr`, title: `GR_${w.node}`, typePrefix: 'Gateway Router', colorVar: 'k-green',
    variant: 'ellipse', detail: gatewayRouterDetail(w) },
  ls: { id: `${w.id}-ls`, title: `LS ${w.node}`, typePrefix: 'Logical Switch', colorVar: 'k-sky', variant: 'switch', detail: nodeSwitchDetail(w) },
})
const podBox = (w, p) => ({
  id: `${w.id}-${p.id}`, title: p.name, caption: p.ip, typePrefix: 'Pod',
  colorVar: 'k-amber', variant: 'pod', inline: true, detail: podDetail(p.name, p.ip, w),
})
const UNDERLAY_BOX = {
  id: 'ovn-underlay', title: 'Underlay · 172.18.0.0/24', typePrefix: 'L2 segment', colorVar: 'k-blue',
  variant: 'bus', caption: 'the only network that physically exists', detail: UNDERLAY_DETAIL,
}
const JOIN_BOX = {
  id: 'ovn-join', title: 'join · 100.64.0.0/16', typePrefix: 'Logical Switch', colorVar: 'k-sky',
  variant: 'switch', caption: 'one per cluster · joins every router', detail: JOIN_SWITCH_DETAIL,
}
const ROUTER_BOX = {
  id: 'ovn-cluster-router', title: 'ovn_cluster_router', typePrefix: 'OVN Cluster Router', colorVar: 'k-green',
  variant: 'ellipse', caption: 'distributed · runs on every node', detail: CLUSTER_ROUTER_DETAIL,
}

// One node column: the full per-node chain inside one dashed boundary.
const nodeZone = (w, pods) => {
  const b = nodeBoxes(w)
  return {
    id: `ovn-${w.id}-node`,
    label: `${w.node} · ${w.hostIp}`,
    colorVar: 'k-teal',
    dashed: true,
    layout: 'stack',
    boxes: [
      b.eth0, b.brint, b.ext, b.gr,
      // The diagram's empty mid-section: the shared core's links cross here.
      { id: `${w.id}-gap`, spacer: true },
      b.ls,
      ...pods.map((p) => podBox(w, p)),
    ],
  }
}

// Per-node wiring — solid plain lines, like the picture's. Only the links the
// diagram labels carry text (the rtoj / rtos addresses); the rest are bare.
const nodeEdges = (w, pods) => [
  // The underlay box is a full-width bus; `spread` drops each node's line out
  // of it at the node's own x, so the two drops read as the diagram's two
  // separate lines off the cloud instead of diagonals crossing the labels.
  { id: `e-u-${w.id}`, from: 'ovn-underlay', to: `${w.id}-eth0`, step: '',
    axis: 'vertical', spread: true, solid: true, quiet: true, accent: 'k-blue' },
  { id: `e-${w.id}-patch`, from: `${w.id}-eth0`, to: `${w.id}-brint`, step: '', solid: true, quiet: true, accent: 'k-teal' },
  { id: `e-${w.id}-localnet`, from: `${w.id}-brint`, to: `${w.id}-ext`, step: '', solid: true, quiet: true, accent: 'k-teal' },
  { id: `e-${w.id}-etor`, from: `${w.id}-ext`, to: `${w.id}-gr`, step: '', solid: true, quiet: true, accent: 'k-teal' },
  // mobileHide: in the phone layout the GR↔join gap is a sliver, so these two
  // chips would sit on the join switch's text — the lines stay, the labels go.
  { id: `e-${w.id}-rtoj`, from: `${w.id}-gr`, to: 'ovn-join', step: '',
    solid: true, quiet: true, mobileHide: true, label: `${w.joinIp}/16`, accent: 'k-sky',
    title: `GR_${w.node} on the join switch`, detail: rtojEdgeDetail(w) },
  { id: `e-rtr-${w.id}ls`, from: 'ovn-cluster-router', to: `${w.id}-ls`, step: '',
    axis: 'vertical', solid: true, quiet: true, label: `${w.routerPort}/24`, accent: 'k-sky', labelT: 0.45,
    title: `rtos-${w.node}`, detail: rtosEdgeDetail(w) },
  ...pods.map((p) => ({
    id: `e-${w.id}-ls-${p.id}`, from: `${w.id}-ls`, to: `${w.id}-${p.id}`, step: '',
    solid: true, quiet: true, accent: 'k-amber',
  })),
]

const W1_PODS = [
  { id: 'pod-a', name: 'pod-a', ip: '10.244.0.3' },
  { id: 'pod-b', name: 'pod-b', ip: '10.244.0.5' },
]
const W2_PODS = [
  { id: 'pod-a', name: 'pod-c', ip: '10.244.2.3' },
]

// The wiring and the trace flows are shared verbatim by both topics — the box
// ids they reference are identical in either arrangement.
const EDGES = [
  ...nodeEdges(W1, W1_PODS),
  ...nodeEdges(W2, W2_PODS),
  { id: 'e-join-rtr', from: 'ovn-join', to: 'ovn-cluster-router', step: '',
    axis: 'vertical', solid: true, quiet: true, label: '100.64.0.1/16', labelT: 0.5, accent: 'k-sky' },
]

const FLOWS = [
    {
      flowId: 'ovn-pp-same',
      flowName: 'Pod → Pod, same node',
      description:
        'The shortest path in the cluster: two pods on the same node share a logical switch, so the packet is one L2 hop — in reality a single OpenFlow lookup in br-int. No router, no tunnel, no wire.',
      steps: [
        { step: 1, sourceBoxId: 'w1-pod-a', targetBoxId: 'w1-ls',
          description: 'pod-a sends to 10.244.0.5. Same subnet → no gateway: it ARPs (OVN answers from its logical data) and the frame enters pod-a’s port on LS ovn-worker.' },
        { step: 2, sourceBoxId: 'w1-ls', targetBoxId: 'w1-pod-b',
          description: 'The switch delivers to pod-b’s port. On the node this is one br-int rule matching source and destination veths — the packet never leaves the machine.' },
      ],
    },
    {
      flowId: 'ovn-pp-cross',
      flowName: 'Pod → Pod, across nodes (Geneve)',
      description:
        'Different nodes, different pod subnets — so the packet routes through ovn_cluster_router. The trick: that router is distributed, instantiated in every node’s br-int, so routing happens on the source node and the packet crosses the underlay as a Geneve frame.',
      steps: [
        { step: 1, sourceBoxId: 'w1-pod-a', targetBoxId: 'w1-ls',
          description: 'pod-a sends to 10.244.2.3 — a different subnet, so it targets its gateway 10.244.0.1, the cluster router’s rtos port on this switch.' },
        { step: 2, sourceBoxId: 'w1-ls', targetBoxId: 'ovn-cluster-router',
          description: 'Into the router — logically. Physically this is still br-int on ovn-worker: the distributed router’s routing table is compiled into local OpenFlow rules.' },
        { step: 3, sourceBoxId: 'ovn-cluster-router', targetBoxId: 'w2-ls',
          description: 'The route says 10.244.2.0/24 lives on ovn-worker2. The source node encapsulates the routed packet in Geneve (UDP :6081, eth0 → eth0, carrying the logical port IDs) and ovn-worker2’s br-int decapsulates it straight into LS ovn-worker2.' },
        { step: 4, sourceBoxId: 'w2-ls', targetBoxId: 'w2-pod-a',
          description: 'Normal L2 delivery to pod-c’s port. End to end: two br-int rule lookups and one tunnel — the routers and switches in between were never running processes.' },
      ],
    },
    {
      flowId: 'ovn-egress',
      flowName: 'Pod → internet (SNAT at the gateway router)',
      description:
        'North-south leaves the distributed world: egress traffic detours through the join switch to the node-pinned gateway router, which SNATs the pod address to the node IP before handing the packet to the physical network.',
      steps: [
        { step: 1, sourceBoxId: 'w1-pod-a', targetBoxId: 'w1-ls',
          description: 'pod-a sends to 1.1.1.1 — off-cluster, so again via its gateway 10.244.0.1.' },
        { step: 2, sourceBoxId: 'w1-ls', targetBoxId: 'ovn-cluster-router',
          description: 'The cluster router matches no pod subnet. Policy routes send external traffic toward the *local* node’s gateway router — egress never crosses to another node first.' },
        { step: 3, sourceBoxId: 'ovn-cluster-router', targetBoxId: 'ovn-join',
          description: 'Out the rtoj port (100.64.0.1) onto the join switch — the stub network that exists only to let routers next-hop to each other.' },
        { step: 4, sourceBoxId: 'ovn-join', targetBoxId: 'w1-gr',
          description: 'Next hop 100.64.0.2: GR_ovn-worker. Unlike everything so far this router is pinned to the node, because what happens next is stateful.' },
        { step: 5, sourceBoxId: 'w1-gr', targetBoxId: 'w1-ext',
          description: 'SNAT: source 10.244.0.3 becomes 172.18.0.2, conntrack remembers the mapping for the reply. The packet exits rtoe onto the external switch.' },
        { step: 6, sourceBoxId: 'w1-ext', targetBoxId: 'w1-brint',
          description: 'ext_ovn-worker’s localnet port maps to the provider bridge — leaving logical space. In br-int this whole journey was a handful of rule lookups.' },
        { step: 7, sourceBoxId: 'w1-brint', targetBoxId: 'w1-eth0',
          description: 'Across the patch to br-ex and out the uplink: a plain frame from 172.18.0.2, indistinguishable from host traffic.' },
        { step: 8, sourceBoxId: 'w1-eth0', targetBoxId: 'ovn-underlay',
          description: 'Onto the wire toward the default gateway. The reply hits 172.18.0.2, conntrack un-NATs it at GR_ovn-worker, and the path runs in reverse.' },
      ],
    },
]

// The underlay floats at the top like the diagram's cloud — no zone box.
const underlayZone = (boxes = [UNDERLAY_BOX]) => ({
  id: 'ovn-underlay-zone',
  bare: true,
  layout: 'stack',
  colorVar: 'k-blue',
  boxes,
})

export const OVN_TOPOLOGY = {
  topicId: 'ovn-topology',
  title: 'OVN-Kubernetes — the logical network topology',
  tagline:
    'How OVN-Kubernetes wires a cluster: per-node gateway routers behind localnet switches, one "join" switch gluing them to a distributed cluster router, and a logical switch per node carrying the pods. Everything here is a row in OVN’s northbound DB that you can list with ovn-nbctl — except br-int, the OVS bridge each node compiles all of it into. The same wiring runs twice in this app’s HCP topology: once on the bare-metal management cluster, once inside the guest VMs.',
  colorVar: 'k-teal',
  topology: { edges: EDGES },
  flows: FLOWS,
  zones: [
    underlayZone(),
    // Two node columns flanking the shared logical core, which floats between
    // them at mid-height (a bare, vertically-centred column).
    {
      id: 'ovn-nodes-zone',
      bare: true,
      layout: 'columns',
      zones: [
        nodeZone(W1, W1_PODS),
        {
          id: 'ovn-core',
          bare: true,
          layout: 'stack',
          colorVar: 'k-purple',
          boxes: [JOIN_BOX, ROUTER_BOX],
        },
        nodeZone(W2, W2_PODS),
      ],
    },
  ],
}

// ── The "big view" — the same topology inside its OpenShift containers ──────
// A 1:1 copy of the diagram above (same boxes, same wiring, same flows), with
// one level zoomed out: every group of topology abstractions is drawn inside
// the greyed OpenShift (network) component that holds it. Grey = machinery;
// colour = the topology it carries. Each grey container also holds a small
// ghost chip naming the component, clickable like any box.

const ovsGhostDetail = (w) => ({
  role: 'OPENSHIFT · HOST DATA PLANE',
  summary:
    `Open vSwitch — the layer that is actually real on ${w.node}. Two systemd units on the RHCOS host (ovs-vswitchd.service + ovsdb-server.service) own every bridge and port: they enslave eth0 to br-ex, run br-int, and forward every packet through the kernel datapath. Everything logical in this diagram ends up as OpenFlow rules inside this process — which is why it runs on the host, not as a pod: the network must come up before, and outlive, the pods.`,
  sections: [
    { heading: 'Facts', facts: [
      { k: 'runs as', v: 'systemd units on the host — not pods' },
      { k: 'owns', v: 'br-int · br-ex · the Geneve tunnel port · every pod veth' },
    ] },
    { heading: 'Explore', commands: [
      '# On the node (oc debug node/<node> → chroot /host)\nsystemctl status ovs-vswitchd ovsdb-server',
      'ovs-vsctl show',
    ] },
  ],
})

const ovnkubeGhostDetail = (w) => ({
  role: 'OPENSHIFT · NODE AGENT POD',
  summary:
    `ovnkube-node — the DaemonSet pod (namespace openshift-ovn-kubernetes) through which every logical object on ${w.node} becomes real. Its ovn-controller container watches the OVN database and compiles the rows — ext_${w.node}, GR_${w.node}, LS ${w.node} — into OpenFlow rules in br-int. Since OpenShift moved to OVN's interconnect mode, the pod also runs the node's own nbdb, sbdb and northd, so the node's slice of the logical space lives entirely on the node.`,
  sections: [
    { heading: 'Containers', facts: [
      { k: 'ovn-controller', v: 'SB DB rows → OpenFlow in br-int' },
      { k: 'ovnkube-controller', v: 'watches Pods/Services/NetworkPolicies → writes NB DB rows' },
      { k: 'nbdb · sbdb · northd', v: 'the node-local OVN databases (interconnect mode)' },
    ] },
    { heading: 'Explore', commands: [
      `oc get pods -n openshift-ovn-kubernetes -o wide --field-selector spec.nodeName=${w.node}`,
      '# The logical rows this pod realizes\noc rsh -n openshift-ovn-kubernetes -c nbdb <ovnkube-node-pod> ovn-nbctl show',
    ] },
  ],
})

const cniGhostDetail = (w) => ({
  role: 'OPENSHIFT · POD WIRING',
  summary:
    `The CNI half of OVN-Kubernetes. When the kubelet (via CRI-O) creates a pod on ${w.node}, the ovn-k8s-cni-overlay plugin makes the veth pair, moves one end into the pod's netns as eth0, plugs the other into br-int, and binds it to the pod's logical switch port on LS ${w.node} — the moment a pod becomes a row in this diagram.`,
  sections: [
    { heading: 'Explore', commands: [
      '# What the CNI recorded for a pod\nkubectl get pod <pod> -o jsonpath=\'{.metadata.annotations.k8s\\.ovn\\.org/pod-networks}\'',
    ] },
  ],
})

const CTLPLANE_GHOST_DETAIL = {
  role: 'OPENSHIFT · CONTROL PLANE',
  summary:
    'The machinery that owns the logical space itself. Every switch and router in this diagram is a row in the OVN Northbound database — written by ovnkube, translated by northd, consumed by every node\'s ovn-controller. ovnkube-control-plane (a Deployment in openshift-ovn-kubernetes) does the cluster-scoped part — allocating each node its pod subnet — and the Cluster Network Operator deploys the whole stack from the Network.operator config.',
  sections: [
    { heading: 'Facts', facts: [
      { k: 'NB DB', v: 'the desired logical network — what ovn-nbctl lists' },
      { k: 'ovnkube-control-plane', v: 'allocates node subnets (10.244.0.0/24 → ovn-worker …)' },
      { k: 'CNO', v: 'rolls the stack out from Network.operator "cluster"' },
    ] },
    { heading: 'Explore', commands: [
      'oc get pods -n openshift-ovn-kubernetes | grep control-plane',
      'oc get network.operator cluster -o yaml | head -20',
    ] },
  ],
}

// A grey container: a dashed slate zone holding topology boxes + a ghost chip
// naming the OpenShift component (last, like a signature).
const ghostZone = (id, label, boxes) => ({
  id, label, ghost: true, dashed: true, layout: 'stack', colorVar: 'k-ghost', boxes,
})
const ghostChip = (id, title, typePrefix, caption, detail) => ({
  id, title, typePrefix, caption, variant: 'ghost', colorVar: 'k-ghost', detail,
})

// The same node column, with its boxes re-parented into the three grey
// containers: OVS on the metal, the logical objects realized by ovn-controller,
// and the pod wiring done by the CNI.
const nodeZoneBig = (w, pods) => {
  const b = nodeBoxes(w)
  return {
    id: `ovnb-${w.id}-node`,
    label: `${w.node} · ${w.hostIp}`,
    colorVar: 'k-teal',
    dashed: true,
    layout: 'stack',
    zones: [
      ghostZone(`ovnb-${w.id}-ovs`, 'Open vSwitch · on the metal', [
        b.eth0, b.brint,
        ghostChip(`${w.id}-ovs`, 'ovs-vswitchd.service', 'systemd', 'forwards every packet', ovsGhostDetail(w)),
      ]),
      ghostZone(`ovnb-${w.id}-ovnkube`, 'realized by ovn-controller', [
        b.ext, b.gr,
        ghostChip(`${w.id}-ovnkube`, 'ovnkube-node', 'Pod', 'DB rows → OpenFlow', ovnkubeGhostDetail(w)),
      ]),
      { id: `ovnb-${w.id}-gap`, spacer: true },
      ghostZone(`ovnb-${w.id}-cni`, 'pod wiring · CNI', [
        b.ls,
        ...pods.map((p) => podBox(w, p)),
        ghostChip(`${w.id}-cni`, 'ovn-k8s-cni-overlay', 'CNI', 'plugs veths into br-int', cniGhostDetail(w)),
      ]),
    ],
  }
}

export const OVN_TOPOLOGY_BIG = {
  topicId: 'ovn-topology-big',
  title: 'OVN-Kubernetes in OpenShift — where the topology lives',
  tagline:
    'The exact same diagram, zoomed out one level: every box of the OVN topology, unchanged, now drawn inside the greyed OpenShift component that contains it — Open vSwitch on the metal, the ovnkube-node pod whose ovn-controller realizes the logical objects, the CNI that wires the pods, and the Northbound database the whole logical space is rows in. Grey is machinery; colour is the topology it carries. The trace flows are the same three packets as the plain view.',
  colorVar: 'k-teal',
  canvasClass: 'recon-stack--ovnbig',
  topology: { edges: EDGES },
  flows: FLOWS,
  zones: [
    underlayZone(),
    {
      id: 'ovnb-nodes-zone',
      bare: true,
      layout: 'columns',
      zones: [
        nodeZoneBig(W1, W1_PODS),
        {
          id: 'ovnb-core',
          bare: true,
          layout: 'stack',
          colorVar: 'k-purple',
          zones: [
            ghostZone('ovnb-core-db', 'OVN Northbound DB · rows, not devices', [
              JOIN_BOX, ROUTER_BOX,
              ghostChip('ovn-ctlplane', 'ovnkube-control-plane', 'Deployment', 'allocates the node subnets', CTLPLANE_GHOST_DETAIL),
            ]),
          ],
        },
        nodeZoneBig(W2, W2_PODS),
      ],
    },
  ],
}
