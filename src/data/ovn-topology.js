// ── OVN-Kubernetes logical topology — shared content ────────────────────────
// Single source of truth for the OVN teaching material. Three surfaces render
// it:
//   • the `ovn-topology` deep-dive topic (OVN_TOPOLOGY, included in DEEP_DIVES)
//   • the "big view" twin topic (OVN_TOPOLOGY_BIG) — the same boxes inside the
//     greyed OpenShift components that contain them
//   • the guest-cluster twin (OVN_TOPOLOGY_GUEST) — the same wiring as run by
//     the hosted cluster, one turtle down: every "node" a KubeVirt VMI, the
//     underlay the management cluster's pod network
// The Overview's network overlay chips/edges (NetworkOverlay) tell the same
// story over the real components from src/data/network-topology.js.
//
// The model is the classic two-node kind cluster the ovn-kubernetes docs draw:
// an underlay L2 segment, per-node gateway routers behind localnet external
// switches, one logical "join" switch, one distributed ovn_cluster_router, and
// a per-node logical switch carrying the pods. Every box here is an object you
// can list with ovn-nbctl — except br-int, which is the punchline: the only
// thing that actually exists on a node.
//
// Popup style (the design-goal's keyword-first language): every box detail
// leads with an "At a glance" row of keyword chips (tags), keeps its data as
// accent-chip facts, and phrases bullets to LEAD WITH A VERB that
// interaction-kinds.js classifies — so each line renders as a glyph + keyword
// row (Carries / Receives / Routes / SNATs …), not a wall of prose.

// The two worker nodes of the reference topology. (ovn-kubernetes numbers the
// join-switch ports rtoj-: the distributed router takes 100.64.0.1, the
// gateway routers .2/.3 — diagrams often misread those as pod addresses.)
const W1 = {
  id: 'w1', node: 'ovn-worker', hostIp: '172.18.0.2',
  joinIp: '100.64.0.2', subnet: '10.244.0.0/24', routerPort: '10.244.0.1', mask: 24,
}
const W2 = {
  id: 'w2', node: 'ovn-worker2', hostIp: '172.18.0.4',
  joinIp: '100.64.0.3', subnet: '10.244.2.0/24', routerPort: '10.244.2.1', mask: 24,
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
    { heading: 'At a glance', tags: ['the only real network', 'plain Ethernet frames', 'Geneve UDP :6081', 'everything crosses it'] },
    { heading: 'What rides it', bullets: [
      'Carries node-to-node pod traffic as Geneve UDP :6081 frames between the nodes’ eth0 addresses.',
      'Carries egress traffic already SNATed to the node IP by GR_<node> — indistinguishable from host traffic.',
      'Carries everything the hosts themselves do: API calls, image pulls, etcd peering.',
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
    { heading: 'At a glance', tags: ['claimed by OVN at setup', 'IP moves to br-ex', 'uplink port', 'tunnel endpoint'] },
    { heading: 'What it does', bullets: [
      'Enslaved by OVN-Kubernetes to br-ex — the bridge takes the IP, eth0 becomes its uplink port.',
      'Carries every frame the node sends: Geneve tunnels, SNATed egress and plain host traffic alike.',
      'Terminates the node’s Geneve tunnels — UDP :6081 starts and ends here.',
    ] },
    { heading: 'Facts', facts: [
      { k: 'address', v: `${w.hostIp}/24` },
      { k: 'enslaved to', v: 'br-ex (the external OVS bridge)' },
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
    { heading: 'At a glance', tags: ['the punchline', 'only real object on the node', 'OpenFlow rules', 'one lookup = whole journey'] },
    { heading: 'Logical vs real', bullets: [
      'Owns every data-plane port: the pod veths, the Geneve tunnel port and the patch to br-ex.',
      'Executes as a single OpenFlow lookup what the diagram draws as a multi-hop journey — a packet never "visits" a router.',
      'Receives its flows from ovn-controller, which watches the southbound DB and recompiles them on every change.',
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
    { heading: 'At a glance', tags: ['localnet', 'logical → physical', 'untagged'] },
    { heading: 'Job', bullets: [
      `Wires GR_${w.node} onto the physical network — its localnet port maps to the provider bridge (br-ex).`,
      'Carries frames out of logical space wearing the node’s own MAC and IP.',
    ] },
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
    `GR_${w.node} — the node's door to the outside. Unlike the distributed cluster router it is pinned to ${w.node}, because it owns real state: a NAT table and conntrack entries that must live in exactly one place.`,
  sections: [
    { heading: 'At a glance', tags: ['pinned to the node', 'stateful', 'NAT + conntrack', 'north-south only'] },
    { heading: 'What it does', bullets: [
      `SNATs egress pod traffic to the node IP ${w.hostIp} — conntrack remembers the mapping for the reply.`,
      'DNATs NodePort and load-balancer traffic on the way in.',
    ] },
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
    { heading: 'At a glance', tags: ['router interconnect', '100.64.0.0/16', 'router ports only', 'one per cluster'] },
    { heading: 'Job', bullets: [
      'Connects the distributed ovn_cluster_router to every per-node gateway router — OVN routers cannot peer directly.',
    ] },
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
    { heading: 'At a glance', tags: ['distributed', 'runs nowhere', 'routed at the source node', 'one per cluster'] },
    { heading: 'What it does', bullets: [
      'Routes between the pod subnets — one rtos port per node switch hangs off it.',
      'Compiled into every node’s br-int by ovn-controller, so each node routes locally.',
      'Routes egress traffic toward the *local* node’s gateway router via policy routes.',
    ] },
    { heading: 'Facts', facts: [
      { k: 'port to join', v: 'rtoj-ovn_cluster_router · 100.64.0.1/16' },
      { k: `rtos-${W1.node}`, v: `${W1.routerPort}/24 (the ${W1.subnet} default gw)` },
      { k: `rtos-${W2.node}`, v: `${W2.routerPort}/24 (the ${W2.subnet} default gw)` },
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
    `The logical switch named after ${w.node}, owning the node's pod subnet ${w.subnet}. Every pod scheduled here gets a port on it (its veth, by another name) and uses the cluster router's rtos port ${w.routerPort} as default gateway.`,
  sections: [
    { heading: 'At a glance', tags: ['one per node', 'owns the pod subnet', 'L2 domain'] },
    { heading: 'What it does', bullets: [
      `Owns the node’s pod subnet ${w.subnet} — every pod scheduled here gets a port on it.`,
      'Delivers same-node pod traffic directly — it never leaves this switch (or the machine).',
    ] },
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
    `${name} on ${w.node} (${ip}). To Kubernetes it's a pod; to OVN it's exactly one logical switch port on LS ${w.node}.`,
  sections: [
    { heading: 'At a glance', tags: ['one pod = one switch port', 'veth pair', 'eth0 in the netns'] },
    { heading: 'Wiring', bullets: [
      `Attaches to LS ${w.node} as exactly one logical switch port — OVN’s whole view of the pod.`,
      'Connects through a CNI-created veth pair: one end is eth0 in the pod’s netns, the other is plugged into br-int.',
    ] },
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

const edgeDetail = (role, summary, commands, tags, note = NBCTL_NOTE) => ({
  role, summary,
  sections: [
    ...(tags?.length ? [{ tags }] : []),
    ...(commands?.length ? [{ heading: 'Explore', commands: [note, ...commands] }] : []),
  ],
})

export const rtojEdgeDetail = (w, note) => edgeDetail(
  'JOIN-SWITCH PORT',
  `rtoj-GR_${w.node} · ${w.joinIp}/16 — the gateway router's leg on the "join" switch. The 100.64.0.0/16 addresses exist only so the routers can next-hop to each other; nothing else lives on this subnet (the cluster router holds 100.64.0.1).`,
  ['ovn-nbctl lsp-list join'],
  ['router leg', '100.64.0.0/16', 'next-hop only'],
  note,
)

export const rtosEdgeDetail = (w, note) => edgeDetail(
  'ROUTER ↔ SWITCH PORT PAIR',
  `rtos-${w.node} · ${w.routerPort}/${w.mask} (router side) ↔ stor-${w.node} (switch side): how the node's pod subnet hangs off ovn_cluster_router. ${w.routerPort} is every ${w.node} pod's default gateway — a router port, not a pod (a common misreading of this diagram).`,
  [`ovn-nbctl lrp-list ovn_cluster_router`],
  ['port pair', 'the default gateway', 'a router port — not a pod'],
  note,
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
// OpenShift components that contain them. (The guest-cluster twin further
// down builds its own boxes — same shapes, different ids and content.)
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

// The shared-core box ids + command note a node column wires up to. The plain
// view and the big view use MGMT_CORE; the guest twin passes its own.
const MGMT_CORE = { underlay: 'ovn-underlay', join: 'ovn-join', router: 'ovn-cluster-router', note: NBCTL_NOTE }

// Per-node wiring — solid plain lines, like the picture's. Only the links the
// diagram labels carry text (the rtoj / rtos addresses); the rest are bare.
const nodeEdges = (w, pods, core = MGMT_CORE) => [
  // The underlay box is a full-width bus; `spread` drops each node's line out
  // of it at the node's own x, so the two drops read as the diagram's two
  // separate lines off the cloud instead of diagonals crossing the labels.
  { id: `e-u-${w.id}`, from: core.underlay, to: `${w.id}-eth0`, step: '',
    axis: 'vertical', spread: true, solid: true, quiet: true, accent: 'k-blue' },
  { id: `e-${w.id}-patch`, from: `${w.id}-eth0`, to: `${w.id}-brint`, step: '', solid: true, quiet: true, accent: 'k-teal' },
  { id: `e-${w.id}-localnet`, from: `${w.id}-brint`, to: `${w.id}-ext`, step: '', solid: true, quiet: true, accent: 'k-teal' },
  { id: `e-${w.id}-etor`, from: `${w.id}-ext`, to: `${w.id}-gr`, step: '', solid: true, quiet: true, accent: 'k-teal' },
  // mobileHide: in the phone layout the GR↔join gap is a sliver, so these two
  // chips would sit on the join switch's text — the lines stay, the labels go.
  { id: `e-${w.id}-rtoj`, from: `${w.id}-gr`, to: core.join, step: '',
    solid: true, quiet: true, mobileHide: true, label: `${w.joinIp}/16`, accent: 'k-sky',
    title: `GR_${w.node} on the join switch`, detail: rtojEdgeDetail(w, core.note) },
  { id: `e-rtr-${w.id}ls`, from: core.router, to: `${w.id}-ls`, step: '',
    axis: 'vertical', solid: true, quiet: true, label: `${w.routerPort}/${w.mask}`, accent: 'k-sky', labelT: 0.45,
    title: `rtos-${w.node}`, detail: rtosEdgeDetail(w, core.note) },
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
const underlayZone = (boxes = [UNDERLAY_BOX], id = 'ovn-underlay-zone') => ({
  id,
  bare: true,
  layout: 'stack',
  colorVar: 'k-blue',
  boxes,
})

export const OVN_TOPOLOGY = {
  topicId: 'ovn-topology',
  title: 'OVN-Kubernetes — the logical network topology',
  tagline:
    'How OVN-Kubernetes wires a cluster: per-node gateway routers behind localnet switches, one "join" switch gluing them to a distributed cluster router, and a logical switch per node carrying the pods. Everything here is a row in OVN’s northbound DB that you can list with ovn-nbctl — except br-int, the OVS bridge each node compiles all of it into. The same wiring runs twice in this app’s HCP topology: once on the bare-metal management cluster, once inside the guest VMs — the guest-cluster twin topic draws that second run.',
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
    `Open vSwitch — the layer that is actually real on ${w.node}. Two systemd units on the RHCOS host (ovs-vswitchd.service + ovsdb-server.service) own every bridge and port. Everything logical in this diagram ends up as OpenFlow rules inside this process — which is why it runs on the host, not as a pod: the network must come up before, and outlive, the pods.`,
  sections: [
    { heading: 'At a glance', tags: ['systemd units — not pods', 'up before kubelet', 'outlives the pods'] },
    { heading: 'What it does', bullets: [
      'Owns every bridge and port on the node: br-int, br-ex, the Geneve tunnel port, every pod veth.',
      'Forwards every packet through the kernel datapath — pod, tunnel and host traffic alike.',
      'Enslaves eth0 to br-ex so OVN can bridge logical traffic onto the wire.',
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
    `ovnkube-node — the DaemonSet pod (namespace openshift-ovn-kubernetes) through which every logical object on ${w.node} becomes real. Since OpenShift moved to OVN's interconnect mode, the pod also runs the node's own nbdb, sbdb and northd, so the node's slice of the logical space lives entirely on the node.`,
  sections: [
    { heading: 'At a glance', tags: ['DaemonSet', 'interconnect mode', 'DB rows → OpenFlow'] },
    { heading: 'Containers', facts: [
      { k: 'ovn-controller', v: `compiles the SB DB rows — ext_${w.node}, GR_${w.node}, LS ${w.node} — into OpenFlow in br-int` },
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
    `The CNI half of OVN-Kubernetes — the moment a pod becomes a row in this diagram. When the kubelet (via CRI-O) creates a pod on ${w.node}, the ovn-k8s-cni-overlay plugin wires it into the logical network.`,
  sections: [
    { heading: 'At a glance', tags: ['CNI plugin', 'invoked per pod', 'veth pair'] },
    { heading: 'What it does', bullets: [
      'Creates the veth pair when the kubelet (via CRI-O) sets up the pod sandbox.',
      'Wires one end into the pod’s netns as eth0 and plugs the other into br-int.',
      `Registers the br-int end as the pod’s logical switch port on LS ${w.node}.`,
    ] },
    { heading: 'Explore', commands: [
      '# What the CNI recorded for a pod\nkubectl get pod <pod> -o jsonpath=\'{.metadata.annotations.k8s\\.ovn\\.org/pod-networks}\'',
    ] },
  ],
})

const CTLPLANE_GHOST_DETAIL = {
  role: 'OPENSHIFT · CONTROL PLANE',
  summary:
    'The machinery that owns the logical space itself. Every switch and router in this diagram is a row in the OVN Northbound database — written by ovnkube, translated by northd, consumed by every node\'s ovn-controller.',
  sections: [
    { heading: 'At a glance', tags: ['NB DB = the logical space', 'cluster-scoped', 'CNO-deployed'] },
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

// ── The guest-cluster twin — the same wiring, one turtle down ────────────────
// The hosted cluster runs the exact same OVN topology, with every piece one
// level up: a "node" is a KubeVirt VMI, its eth0 is a virtio NIC backed by the
// virt-launcher pod's tap device, the "underlay" between the VMs is the
// management cluster's pod network, and the NB DB the rows live in is served
// from the HCP namespace on the management cluster. Same diagram geometry as
// the plain view, so the two can be read side by side.

// The two guest worker VMIs (this app's HCP topology: guest-worker-1 runs on
// bare-metal worker-1, guest-worker-2 on worker-2). hostIp is the VM's address
// on its "machine network" — which is a management-cluster pod IP. The guest's
// pod subnets are carved from the guest's *own* 10.128.0.0/14: a separate
// address universe that deliberately overlaps the management cluster's ranges,
// because the two SDNs only ever meet through encapsulation.
const G1 = {
  id: 'g1', node: 'guest-worker-1', hostIp: '10.128.2.15',
  joinIp: '100.64.0.2', subnet: '10.128.0.0/23', routerPort: '10.128.0.1', mask: 23,
  metal: 'worker-1',
}
const G2 = {
  id: 'g2', node: 'guest-worker-2', hostIp: '10.128.4.21',
  joinIp: '100.64.0.3', subnet: '10.128.2.0/23', routerPort: '10.128.2.1', mask: 23,
  metal: 'worker-2',
}

const GUEST_NB_NOTE =
  '# The guest’s NB DB lives in the HCP namespace on the *management* cluster:\n' +
  '#   oc -n clusters-<guest> exec <ovnkube-control-plane-…> -c nbdb -- ovn-nbctl …'
const GUEST_VM_NOTE =
  '# Data-plane commands run *inside* the VM:\n' +
  '#   virtctl ssh core@<guest-node> -n clusters-<guest> -- sudo …'

const GUEST_CORE = { underlay: 'ovng-underlay', join: 'ovng-join', router: 'ovng-cluster-router', note: GUEST_NB_NOTE }

export const GUEST_UNDERLAY_DETAIL = {
  role: '“PHYSICAL” NETWORK · THE MGMT POD SDN',
  summary:
    'The network the guest cluster treats as its underlay is not a wire — it is the management cluster’s pod network. Each guest node is a KubeVirt VMI whose NIC is a virt-launcher pod’s port on a management node switch, so every byte the guest puts "on the wire" is, one layer down, ordinary mgmt pod-to-pod traffic. The plain-view diagram runs again underneath this one.',
  sections: [
    { heading: 'At a glance', tags: ['an underlay that is an overlay', 'VM address = mgmt pod IP', 'the plain view, one turtle down'] },
    { heading: 'What rides it', bullets: [
      'Carries the guest’s Geneve tunnels (UDP :6081 between VM addresses) as plain mgmt pod-to-pod traffic.',
      'Carries guest egress already SNATed to the VM address by GR_<guest-node> — which the mgmt SDN then SNATs again at the bare-metal node.',
      'Routes between the VMs with the management cluster’s own switches and router — wrapping a second Geneve around the packet when the VMs sit on different metal.',
    ] },
    { heading: 'Facts', facts: [
      { k: 'guest-worker-1', v: '10.128.2.15 — a pod IP on LS worker-1 (mgmt)' },
      { k: 'guest-worker-2', v: '10.128.4.21 — a pod IP on LS worker-2 (mgmt)' },
      { k: 'one layer down', v: 'the management OVN topology — the plain view of this diagram' },
    ] },
    { heading: 'Explore', commands: [
      '# The "machine network" the guest sees is the launcher pods\noc get pods -n clusters-<guest> -l kubevirt.io=virt-launcher -o wide',
      '# Guest Geneve riding the mgmt pod network (inside either VM)\ntcpdump -ni eth0 udp port 6081',
    ] },
  ],
}

const gEthDetail = (w) => ({
  role: 'VM NIC · VIRTIO-NET',
  summary:
    `${w.node}'s eth0 (${w.hostIp}) is a virtio-net device — the front half of a paravirtual pair whose back half is the tap device inside the virt-launcher pod on ${w.metal}. The guest's OVN claims it exactly like the plain view's eth0: the IP moves to br-ex, eth0 becomes the uplink. The "wire" it drops onto is a logical switch port one layer down.`,
  sections: [
    { heading: 'At a glance', tags: ['virtio-net', 'backed by the launcher pod', 'VM address = mgmt pod IP'] },
    { heading: 'What it does', bullets: [
      'Carries every frame the guest node sends — guest Geneve tunnels and SNATed guest egress alike.',
      `Terminates the guest SDN’s Geneve tunnels at the VM address ${w.hostIp}.`,
      'Enslaved by the in-VM OVN-Kubernetes to br-ex at setup — the same move as on a bare-metal node.',
    ] },
    { heading: 'Facts', facts: [
      { k: 'address', v: `${w.hostIp}/23 — assigned by the *management* SDN` },
      { k: 'backed by', v: `the tap device in ${w.node}'s virt-launcher pod on ${w.metal}` },
    ] },
    { heading: 'Explore', commands: [
      GUEST_VM_NOTE,
      '# Inside the VM: br-ex holds the IP, exactly like the plain view\nip addr show eth0; ip addr show br-ex',
      '# The other half of this NIC, seen from the mgmt cluster\noc exec -n clusters-<guest> <launcher-pod> -- ip link show',
    ] },
  ],
})

const gBrIntDetail = (w) => ({
  role: 'OVS BRIDGE · IN-VM DATA PLANE',
  summary:
    `The integration bridge inside the ${w.node} VM — the plain view's punchline, one level up: every guest switch and router in this diagram is a row in the guest's NB DB, and this in-VM br-int is the only thing that exists on the guest node. Open vSwitch runs as a systemd unit inside the VM's RHCOS, and the ovn-controller running in the VM compiles the guest's logical topology into OpenFlow rules here.`,
  sections: [
    { heading: 'At a glance', tags: ['only real object in the VM', 'systemd unit — not a pod', 'OpenFlow rules'] },
    { heading: 'Logical vs real', bullets: [
      'Owns the guest pod veths, the guest Geneve tunnel port and the patch to the in-VM br-ex.',
      'Executes the guest’s logical pipeline as rule lookups — while the bare-metal br-int below does the same for the mgmt SDN.',
      'Receives its flows from the ovn-controller running inside this VM.',
    ] },
    { heading: 'Explore', commands: [
      GUEST_VM_NOTE,
      '# The real topology inside the VM\novs-vsctl show',
      '# The guest’s compiled logical pipeline\novs-ofctl dump-flows br-int | head -40',
    ] },
  ],
})

const gExtDetail = (w) => ({
  role: 'LOGICAL SWITCH · LOCALNET (GUEST)',
  summary:
    `ext_${w.node} — the guest's splice onto its "physical" network. Same construct as the plain view: a localnet port maps to the in-VM br-ex, so frames leaving GR_${w.node} hit eth0 with the VM's own MAC and IP. The difference is what the wire is: a mgmt pod network.`,
  sections: [
    { heading: 'At a glance', tags: ['localnet', 'logical → "physical"', 'same construct, different wire'] },
    { heading: 'Job', bullets: [
      `Wires GR_${w.node} onto the VM’s uplink — its localnet port maps to the in-VM provider bridge (br-ex).`,
      'Carries guest frames out of guest-logical space — into a network that is itself logical, one layer down.',
    ] },
    { heading: 'Explore', commands: [
      GUEST_NB_NOTE,
      `ovn-nbctl ls-list | grep ext_`,
      `ovn-nbctl lsp-list ext_${w.node}`,
    ] },
  ],
})

const gGrDetail = (w) => ({
  role: 'GATEWAY ROUTER · ONE PER GUEST NODE',
  summary:
    `GR_${w.node} — pinned to this VM because it holds NAT state, exactly like its bare-metal counterpart. Guest egress is SNATed here to the VM address ${w.hostIp} — which is itself a mgmt pod IP, so the packet immediately earns the mgmt SDN's own egress treatment one layer down. Two NATs out, two un-NATs back.`,
  sections: [
    { heading: 'At a glance', tags: ['pinned to the VM', 'stateful', 'first of two NATs'] },
    { heading: 'What it does', bullets: [
      `SNATs guest pod sources (${w.subnet}) to the VM address ${w.hostIp}.`,
      'DNATs guest NodePort traffic on the way in — how the guest’s own ingress router is reached.',
    ] },
    { heading: 'Facts', facts: [
      { k: 'join port', v: `rtoj-GR_${w.node} · ${w.joinIp}/16` },
      { k: 'external port', v: `rtoe-GR_${w.node} · ${w.hostIp}/23` },
      { k: 'NAT № 2', v: `the mgmt GR on ${w.metal} SNATs again, ${w.hostIp} → the bare-metal node IP` },
    ] },
    { heading: 'Explore', commands: [
      GUEST_NB_NOTE,
      'ovn-nbctl lr-list',
      `ovn-nbctl lr-nat-list GR_${w.node}`,
    ] },
  ],
})

export const GUEST_JOIN_DETAIL = {
  role: 'LOGICAL SWITCH · ROUTER INTERCONNECT (GUEST)',
  summary:
    'The guest cluster’s own join switch — same construct, same job, even the same 100.64.0.0/16 default as the management one. They never collide: each SDN is its own address universe, and a row in its own northbound database. This one’s rows are served from the HCP namespace on the management cluster.',
  sections: [
    { heading: 'At a glance', tags: ['same subnet as mgmt — never collides', 'rows in the guest NB DB', 'router ports only'] },
    { heading: 'Job', bullets: [
      'Connects the guest’s distributed cluster router to each VM-pinned gateway router — routers still cannot peer directly, one turtle up or down.',
    ] },
    { heading: 'Facts', facts: [
      { k: 'subnet', v: '100.64.0.0/16 — yes, the same as the mgmt join switch' },
      { k: 'ovn_cluster_router', v: '100.64.0.1' },
      { k: `GR_${G1.node}`, v: G1.joinIp },
      { k: `GR_${G2.node}`, v: G2.joinIp },
    ] },
    { heading: 'Explore', commands: [
      GUEST_NB_NOTE,
      'ovn-nbctl ls-list | grep join',
      'ovn-nbctl lsp-list join',
    ] },
  ],
}

export const GUEST_ROUTER_DETAIL = {
  role: 'DISTRIBUTED LOGICAL ROUTER (GUEST)',
  summary:
    'ovn_cluster_router, guest edition. "Distributed" means the same thing one level up: it runs nowhere — declared as rows in the HCP namespace’s NB DB, compiled by each VM’s ovn-controller into the in-VM br-int. Routing between guest pod subnets happens on the source VM, and the packet crosses the "underlay" — the mgmt pod network — already addressed to its destination.',
  sections: [
    { heading: 'At a glance', tags: ['runs nowhere', 'declared in the HCP namespace', 'routed at the source VM'] },
    { heading: 'What it does', bullets: [
      'Routes between the guest pod subnets — one rtos port per guest node switch.',
      'Compiled into every VM’s br-int by the ovn-controller inside that VM.',
      'Routes guest egress toward the *local* VM’s gateway router via policy routes.',
    ] },
    { heading: 'The whole picture', ascii:
`     Mgmt pod network · "the underlay"
   ──────────┬─────────────────┬──────────
        eth0 │ 10.128.2.15     │ 10.128.4.21   ← mgmt pod IPs
      ┌──────┴───────┐  ┌──────┴────────┐
      │   br-int     │  │    br-int     │
      │guest-worker-1│  │ guest-worker-2│
      └──────┬───────┘  └──────┬────────┘
    ext_guest-worker-1   ext_guest-worker-2
             │                 │
    GR_guest-worker-1    GR_guest-worker-2
         .2  └── LS "join" ──┘  .3
             100.64.0.0/16 · .1
                    │
            ovn_cluster_router
           ┌────────┴────────┐
     rtos · 10.128.0.1   rtos · 10.128.2.1
           │                 │
   LS guest-worker-1   LS guest-worker-2
   10.128.0.0/23       10.128.2.0/23
      │        │             │
   router-  frontend      backend
   default    .7            .9
     .4` },
    { heading: 'Explore', commands: [
      GUEST_NB_NOTE,
      '# Same command as the plain view — different database\novn-nbctl lr-route-list ovn_cluster_router',
    ] },
  ],
}

const gLsDetail = (w) => ({
  role: 'LOGICAL SWITCH · ONE PER GUEST NODE',
  summary:
    `The guest node switch for ${w.node}, owning the guest pod subnet ${w.subnet} — carved from the guest's own 10.128.0.0/14, a separate address universe that may (and here does) overlap the management cluster's ranges. The application pods in this VM are its ports.`,
  sections: [
    { heading: 'At a glance', tags: ['the guest’s own 10.128.0.0/14', 'overlap with mgmt is harmless', 'pod ports'] },
    { heading: 'What it does', bullets: [
      `Owns the guest pod subnet ${w.subnet} — every application pod scheduled to this VM gets a port.`,
      'Delivers same-VM pod traffic directly — one in-VM br-int lookup; the mgmt SDN never sees the packet.',
    ] },
    { heading: 'Facts', facts: [
      { k: 'subnet', v: w.subnet },
      { k: 'gateway', v: `${w.routerPort} (rtos-${w.node} on the guest ovn_cluster_router)` },
      { k: 'ports', v: 'one per guest pod + stor (to the router) + a mgmt port' },
    ] },
    { heading: 'Explore', commands: [
      GUEST_NB_NOTE,
      `ovn-nbctl lsp-list ${w.node}`,
      `# The guest node carries the same annotation as any OVN node\noc --kubeconfig <guest-kubeconfig> get node ${w.node} -o jsonpath='{.metadata.annotations.k8s\\.ovn\\.org/node-subnets}'`,
    ] },
  ],
})

const gPodDetail = (name, ip, w) => ({
  role: 'POD · LOGICAL SWITCH PORT (GUEST)',
  summary:
    `${name} on ${w.node} (${ip}). An ordinary pod on an ordinary node, as far as the guest cluster can tell — the node just happens to be a VM, and the SDN it plugs into happens to ride another SDN. To the guest OVN it is one logical switch port on LS ${w.node}.`,
  sections: [
    { heading: 'At a glance', tags: ['one pod = one switch port', 'wired by the in-VM CNI', 'unaware of the layer below'] },
    { heading: 'Wiring', bullets: [
      `Attaches to LS ${w.node} as one logical switch port — created by the CNI plugin inside the VM.`,
      'Connects through a veth pair into the in-VM br-int, exactly like the plain view’s pods.',
    ] },
    { heading: 'Facts', facts: [
      { k: 'address', v: `${ip}/23` },
      { k: 'gateway', v: w.routerPort },
      { k: 'logical port', v: `e-commerce-prod_${name}` },
    ] },
    { heading: 'Explore', commands: [
      `# From the guest cluster's point of view — a plain pod\noc --kubeconfig <guest-kubeconfig> get pod -n e-commerce-prod -l app=${name} -o wide`,
      `# OVN's record of its networking — same annotation, different NB DB\noc --kubeconfig <guest-kubeconfig> get pod <pod> -n e-commerce-prod -o jsonpath='{.metadata.annotations.k8s\\.ovn\\.org/pod-networks}'`,
    ] },
  ],
})

// Guest box definitions — same shapes and colour code as the plain view, so
// the two diagrams read as the same picture at two depths.
const guestNodeBoxes = (w) => ({
  eth0: { id: `${w.id}-eth0`, title: 'eth0', typePrefix: 'virtio-net', variant: 'iface', detail: gEthDetail(w) },
  brint: { id: `${w.id}-brint`, title: 'br-int', typePrefix: 'OVS bridge', colorVar: 'k-amber', variant: 'bridge', detail: gBrIntDetail(w) },
  ext: { id: `${w.id}-ext`, title: `ext_${w.node}`, typePrefix: 'External Switch', colorVar: 'k-sky', variant: 'switch', detail: gExtDetail(w) },
  gr: { id: `${w.id}-gr`, title: `GR_${w.node}`, typePrefix: 'Gateway Router', colorVar: 'k-green',
    variant: 'ellipse', detail: gGrDetail(w) },
  ls: { id: `${w.id}-ls`, title: `LS ${w.node}`, typePrefix: 'Logical Switch', colorVar: 'k-sky', variant: 'switch', detail: gLsDetail(w) },
})
const guestPodBox = (w, p) => ({
  id: `${w.id}-${p.id}`, title: p.name, caption: p.ip, typePrefix: 'Pod',
  colorVar: 'k-amber', variant: 'pod', inline: true, detail: gPodDetail(p.name, p.ip, w),
})
const GUEST_UNDERLAY_BOX = {
  id: 'ovng-underlay', title: 'Mgmt pod network · 10.128.0.0/14', typePrefix: 'pod SDN', colorVar: 'k-blue',
  variant: 'bus', caption: 'the "wire" between the VMs — itself the mgmt SDN’s overlay', detail: GUEST_UNDERLAY_DETAIL,
}
const GUEST_JOIN_BOX = {
  id: 'ovng-join', title: 'join · 100.64.0.0/16', typePrefix: 'Logical Switch', colorVar: 'k-sky',
  variant: 'switch', caption: 'the guest’s own — same subnet as mgmt’s, never collides', detail: GUEST_JOIN_DETAIL,
}
const GUEST_ROUTER_BOX = {
  id: 'ovng-cluster-router', title: 'ovn_cluster_router', typePrefix: 'OVN Cluster Router', colorVar: 'k-green',
  variant: 'ellipse', caption: 'distributed · rows in the HCP namespace’s NB DB', detail: GUEST_ROUTER_DETAIL,
}

// One guest node column — the plain view's chain, run inside a VMI (zone label
// says which bare-metal worker hosts it; node cards take the guest-VMI green).
const guestNodeZone = (w, pods) => {
  const b = guestNodeBoxes(w)
  return {
    id: `ovng-${w.id}-node`,
    label: `${w.node} · VMI on ${w.metal} · ${w.hostIp}`,
    colorVar: 'k-green',
    dashed: true,
    layout: 'stack',
    boxes: [
      b.eth0, b.brint, b.ext, b.gr,
      { id: `${w.id}-gap`, spacer: true },
      b.ls,
      ...pods.map((p) => guestPodBox(w, p)),
    ],
  }
}

// guest-worker-1 carries the guest's own ingress router next to the app's
// front end; the back end lives on the other VM so the cross-node flow is the
// app's real east-west call.
const G1_PODS = [
  { id: 'pod-rtr', name: 'router-default', ip: '10.128.0.4' },
  { id: 'pod-fe', name: 'frontend', ip: '10.128.0.7' },
]
const G2_PODS = [
  { id: 'pod-be', name: 'backend', ip: '10.128.2.9' },
]

const GUEST_EDGES = [
  ...nodeEdges(G1, G1_PODS, GUEST_CORE),
  ...nodeEdges(G2, G2_PODS, GUEST_CORE),
  { id: 'e-gjoin-rtr', from: 'ovng-join', to: 'ovng-cluster-router', step: '',
    axis: 'vertical', solid: true, quiet: true, label: '100.64.0.1/16', labelT: 0.5, accent: 'k-sky' },
]

const GUEST_FLOWS = [
  {
    flowId: 'ovng-pp-same',
    flowName: 'Pod → Pod, same VM',
    description:
      'Identical to the plain view’s same-node hop — proof the guest SDN is just OVN. The guest’s ingress router forwards a request to the frontend pod beside it: one logical switch, one OpenFlow lookup in the in-VM br-int. The packet never leaves the VM, so the layer below never even carries it.',
    steps: [
      { step: 1, sourceBoxId: 'g1-pod-rtr', targetBoxId: 'g1-ls',
        description: 'router-default forwards the request to 10.128.0.7. Same guest subnet → no gateway: OVN answers the ARP from its logical data and the frame enters the router pod’s port on LS guest-worker-1.' },
      { step: 2, sourceBoxId: 'g1-ls', targetBoxId: 'g1-pod-fe',
        description: 'The switch delivers to frontend’s port — one rule lookup in the in-VM br-int. The packet never leaves the VM, never touches the mgmt SDN.' },
    ],
  },
  {
    flowId: 'ovng-pp-cross',
    flowName: 'Pod → Pod, across VMs (Geneve in Geneve)',
    description:
      'frontend calls backend on the other guest node — the plain view’s cross-node story, except the "wire" between the nodes is the mgmt pod network. The VMs sit on different bare-metal workers, so the guest’s Geneve frame gets wrapped again in the mgmt SDN’s own Geneve. Two SDNs, two encapsulations, one packet.',
    steps: [
      { step: 1, sourceBoxId: 'g1-pod-fe', targetBoxId: 'g1-ls',
        description: 'frontend sends to 10.128.2.9 — a different guest subnet, so it targets its gateway 10.128.0.1, the guest cluster router’s rtos port on this switch.' },
      { step: 2, sourceBoxId: 'g1-ls', targetBoxId: 'ovng-cluster-router',
        description: 'Into the guest router — logically. Physically this is the br-int *inside guest-worker-1*: the distributed router is compiled into the VM’s own OpenFlow rules, so routing happens on the source VM.' },
      { step: 3, sourceBoxId: 'ovng-cluster-router', targetBoxId: 'g2-ls',
        description: 'The route says 10.128.2.0/23 lives on guest-worker-2, so the source VM encapsulates in guest Geneve between VM addresses: 10.128.2.15 → 10.128.4.21. Those are mgmt pod IPs on different bare-metal nodes — one layer down the mgmt SDN routes that packet like any other and wraps it again in its own Geneve between node IPs. guest-worker-2’s br-int decapsulates the inner frame straight into LS guest-worker-2.' },
      { step: 4, sourceBoxId: 'g2-ls', targetBoxId: 'g2-pod-be',
        description: 'Normal L2 delivery to backend’s port. On the physical wire this packet was: node IP → node IP, carrying mgmt Geneve, carrying guest Geneve, carrying pod IP → pod IP.' },
    ],
  },
  {
    flowId: 'ovng-egress',
    flowName: 'Pod → internet (SNAT, twice)',
    description:
      'Guest egress runs the plain view’s egress story twice, once per SDN: the guest’s gateway router SNATs the pod address to the VM address — and because that VM address is a mgmt pod IP, the mgmt SDN’s own gateway router SNATs it again to the bare-metal node IP. Two NATs out, two un-NATs back.',
    steps: [
      { step: 1, sourceBoxId: 'g1-pod-fe', targetBoxId: 'g1-ls',
        description: 'frontend sends to 1.1.1.1 — off-cluster, so via its gateway 10.128.0.1.' },
      { step: 2, sourceBoxId: 'g1-ls', targetBoxId: 'ovng-cluster-router',
        description: 'The guest cluster router matches no guest pod subnet. Policy routes send the packet toward the *local* VM’s gateway router — guest egress never crosses to another VM first.' },
      { step: 3, sourceBoxId: 'ovng-cluster-router', targetBoxId: 'ovng-join',
        description: 'Out the rtoj port (100.64.0.1) onto the guest’s join switch — the same stub network as the plain view’s, in a different NB DB.' },
      { step: 4, sourceBoxId: 'ovng-join', targetBoxId: 'g1-gr',
        description: 'Next hop 100.64.0.2: GR_guest-worker-1, pinned to this VM because what happens next is stateful.' },
      { step: 5, sourceBoxId: 'g1-gr', targetBoxId: 'g1-ext',
        description: 'SNAT № 1: source 10.128.0.7 becomes 10.128.2.15 — the VM’s address, which is a mgmt pod IP. Conntrack inside the VM remembers the mapping for the reply.' },
      { step: 6, sourceBoxId: 'g1-ext', targetBoxId: 'g1-brint',
        description: 'ext_guest-worker-1’s localnet port maps to the in-VM provider bridge — leaving guest-logical space. In the VM’s br-int the whole journey was a handful of rule lookups.' },
      { step: 7, sourceBoxId: 'g1-brint', targetBoxId: 'g1-eth0',
        description: 'Across the patch to br-ex and out the virtio NIC — which is the virt-launcher pod’s interface on worker-1.' },
      { step: 8, sourceBoxId: 'g1-eth0', targetBoxId: 'ovng-underlay',
        description: 'Now it is ordinary mgmt pod egress: the mgmt SDN routes it to worker-1’s own gateway router, which SNATs it again — 10.128.2.15 becomes the bare-metal node IP — and the packet finally hits a real wire. The reply un-NATs twice on the way back.' },
    ],
  },
]

export const OVN_TOPOLOGY_GUEST = {
  topicId: 'ovn-topology-guest',
  title: 'OVN-Kubernetes in the guest cluster — the same wiring, one turtle down',
  tagline:
    'The hosted cluster runs the exact same OVN topology as the plain view — gateway routers, join switch, distributed cluster router, a logical switch per node carrying the pods — with every piece one level up: each "node" is a KubeVirt VMI, the underlay is the management cluster’s pod network, the node NIC is a virt-launcher pod’s port, and the NB DB rows live in the HCP namespace on the management cluster. Cross-node guest traffic is Geneve wrapped in Geneve; guest egress is SNATed twice. Same constructs, same commands — different turtle.',
  colorVar: 'k-purple',
  topology: { edges: GUEST_EDGES },
  flows: GUEST_FLOWS,
  zones: [
    underlayZone([GUEST_UNDERLAY_BOX], 'ovng-underlay-zone'),
    {
      id: 'ovng-nodes-zone',
      bare: true,
      layout: 'columns',
      zones: [
        guestNodeZone(G1, G1_PODS),
        {
          id: 'ovng-core',
          bare: true,
          layout: 'stack',
          colorVar: 'k-purple',
          boxes: [GUEST_JOIN_BOX, GUEST_ROUTER_BOX],
        },
        guestNodeZone(G2, G2_PODS),
      ],
    },
  ],
}
