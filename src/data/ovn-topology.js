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
//
// Reuse over copies: a box may carry `componentId` naming the registered
// overview object it IS. With no `detail` of its own (the OpenShift-machinery
// ghost chips) clicking it opens the component's real sheet (AncestryModal);
// with a `detail` (the pods, the launcher) the popup keeps its OVN teaching
// and adds an "object card ↗" chip to the same sheet — one object everywhere.

import { findComponent } from './components-index'

// The two worker nodes of the reference topology. (ovn-kubernetes numbers the
// join-switch ports rtoj-: the distributed router takes 100.64.0.1, the
// gateway routers .2/.3 — diagrams often misread those as pod addresses.)
const W1 = {
  id: 'w1', node: 'ovn-worker', hostIp: '172.18.0.2',
  joinIp: '100.64.0.2', subnet: '10.244.0.0/24', routerPort: '10.244.0.1', mask: 24,
  cidr: '10.244.0.0/16',
}
const W2 = {
  id: 'w2', node: 'ovn-worker2', hostIp: '172.18.0.4',
  joinIp: '100.64.0.3', subnet: '10.244.2.0/24', routerPort: '10.244.2.1', mask: 24,
  cidr: '10.244.0.0/16',
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

export const brIntDetail = (w, note = NBCTL_NOTE) => ({
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
      note,
      '# The real topology: br-int and its ports\novs-vsctl show',
      '# The compiled logical pipeline (thousands of rules)\novs-ofctl dump-flows br-int | head -40',
      '# Trace one imaginary packet through the rules\novs-appctl ofproto/trace br-int in_port=<port>,ip,nw_src=10.244.0.3,nw_dst=10.244.2.3',
    ] },
  ],
})

export const extSwitchDetail = (w, note = NBCTL_NOTE) => ({
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
      note,
      `ovn-nbctl ls-list | grep ext_`,
      `ovn-nbctl lsp-list ext_${w.node}`,
    ] },
  ],
})

export const gatewayRouterDetail = (w, note = NBCTL_NOTE) => ({
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
      { k: 'SNAT', v: `${w.cidr} → ${w.hostIp}` },
    ] },
    { heading: 'Explore', commands: [
      note,
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

export const nodeSwitchDetail = (w, note = NBCTL_NOTE) => ({
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
      note,
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
const nodeBoxes = (w, note = NBCTL_NOTE) => ({
  eth0: { id: `${w.id}-eth0`, title: 'eth0', typePrefix: 'netdev', variant: 'iface', detail: ethDetail(w) },
  brint: { id: `${w.id}-brint`, title: 'br-int', typePrefix: 'OVS bridge', colorVar: 'k-amber', variant: 'bridge', detail: brIntDetail(w, note) },
  ext: { id: `${w.id}-ext`, title: `ext_${w.node}`, typePrefix: 'External Switch', colorVar: 'k-sky', variant: 'switch', detail: extSwitchDetail(w, note) },
  gr: { id: `${w.id}-gr`, title: `GR_${w.node}`, typePrefix: 'Gateway Router', colorVar: 'k-green',
    variant: 'ellipse', detail: gatewayRouterDetail(w, note) },
  ls: { id: `${w.id}-ls`, title: `LS ${w.node}`, typePrefix: 'Logical Switch', colorVar: 'k-sky', variant: 'switch', detail: nodeSwitchDetail(w, note) },
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
    boundaryKind: 'machine',
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
// Split into pieces so the full-picture topic can rewire a guest column off a
// launcher pod instead of an underlay bus.
const chainEdges = (w) => [
  { id: `e-${w.id}-patch`, from: `${w.id}-eth0`, to: `${w.id}-brint`, step: '', solid: true, quiet: true, accent: 'k-teal' },
  { id: `e-${w.id}-localnet`, from: `${w.id}-brint`, to: `${w.id}-ext`, step: '', solid: true, quiet: true, accent: 'k-teal' },
  { id: `e-${w.id}-etor`, from: `${w.id}-ext`, to: `${w.id}-gr`, step: '', solid: true, quiet: true, accent: 'k-teal' },
]
// mobileHide: in the phone layout the GR↔join gap is a sliver, so these two
// chips would sit on the join switch's text — the lines stay, the labels go.
const rtojEdge = (w, core) => ({
  id: `e-${w.id}-rtoj`, from: `${w.id}-gr`, to: core.join, step: '',
  solid: true, quiet: true, mobileHide: true, label: `${w.joinIp}/16`, accent: 'k-sky',
  title: `GR_${w.node} on the join switch`, detail: rtojEdgeDetail(w, core.note),
})
const rtosEdge = (w, core) => ({
  id: `e-rtr-${w.id}ls`, from: core.router, to: `${w.id}-ls`, step: '',
  axis: 'vertical', solid: true, quiet: true, label: `${w.routerPort}/${w.mask}`, accent: 'k-sky', labelT: 0.45,
  title: `rtos-${w.node}`, detail: rtosEdgeDetail(w, core.note),
})
const podEdges = (w, pods) => pods.map((p) => ({
  id: `e-${w.id}-ls-${p.id}`, from: `${w.id}-ls`, to: `${w.id}-${p.id}`, step: '',
  solid: true, quiet: true, accent: 'k-amber',
}))
const nodeEdges = (w, pods, core = MGMT_CORE) => [
  // The underlay box is a full-width bus; `spread` drops each node's line out
  // of it at the node's own x, so the two drops read as the diagram's two
  // separate lines off the cloud instead of diagonals crossing the labels.
  { id: `e-u-${w.id}`, from: core.underlay, to: `${w.id}-eth0`, step: '',
    axis: 'vertical', spread: true, solid: true, quiet: true, accent: 'k-blue' },
  ...chainEdges(w),
  rtojEdge(w, core),
  rtosEdge(w, core),
  ...podEdges(w, pods),
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
    'The cluster-wide machinery — but NOT a central database. Since OpenShift moved to OVN interconnect (≥ 4.14) there is no cluster NB/SB DB: every node is its own OVN zone with its own node-local NB DB, SB DB and northd (run by that node\'s ovnkube-node pod). The switches and routers in this shared core are the per-node logical topology — replicated in every node\'s own NB DB and stitched across nodes by a transit switch (the IC remote ports). The diagram folds those identical per-node copies into one box for legibility.',
  sections: [
    { heading: 'At a glance', tags: ['interconnect — no central DB', 'rows live per node', 'transit switch stitches the zones', 'CNO-deployed'] },
    { heading: 'What ovnkube-control-plane actually does', facts: [
      { k: 'cluster manager', v: 'allocates each node its pod subnet (10.244.0.0/24 → ovn-worker …) — it does NOT hold the NB DB or run northd' },
      { k: 'node-local NB DB', v: 'where these rows really live — one per node, inside the ovnkube-node pod' },
      { k: 'CNO', v: 'rolls the stack out from Network.operator "cluster"' },
    ] },
    { heading: 'Explore', commands: [
      '# The cluster manager (subnet allocation) — lightweight under interconnect\noc get pods -n openshift-ovn-kubernetes | grep control-plane',
      '# The real NB DB rows live in each node\'s pod, not here\noc rsh -n openshift-ovn-kubernetes -c nbdb <ovnkube-node-pod> ovn-nbctl show',
    ] },
  ],
}

// A grey container: a dashed slate zone holding topology boxes + a ghost chip
// naming the OpenShift component (last, like a signature).
const ghostZone = (id, label, boxes) => ({
  id, label, ghost: true, boundaryKind: 'group', layout: 'stack', colorVar: 'k-ghost', boxes,
})
const ghostChip = (id, title, typePrefix, caption, detail) => ({
  id, title, typePrefix, caption, variant: 'ghost', colorVar: 'k-ghost', detail,
})
// A ghost chip that IS a registered overview object: title and [typePrefix]
// come straight from components.json (so the two views can never drift), and
// clicking it opens the component's real detail sheet — interactions, the
// Manifest → Kernel pipeline, primitives, commands — instead of a duplicate
// deep-dive popup.
const ghostChipFor = (id, componentId, caption) => {
  const c = findComponent(componentId)
  return {
    id, componentId, title: c.displayName, typePrefix: c.typePrefix,
    caption, variant: 'ghost', colorVar: 'k-ghost',
  }
}

// The same node column, with its boxes re-parented into the three grey
// containers: OVS on the metal, the logical objects realized by ovn-controller,
// and the pod wiring done by the CNI.
const nodeZoneBig = (w, pods) => {
  const b = nodeBoxes(w)
  return {
    id: `ovnb-${w.id}-node`,
    label: `${w.node} · ${w.hostIp}`,
    colorVar: 'k-teal',
    boundaryKind: 'machine',
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
    'The exact same diagram, zoomed out one level: every box of the OVN topology, unchanged, now drawn inside the greyed OpenShift component that contains it — Open vSwitch on the metal, the ovnkube-node pod whose ovn-controller realizes the logical objects, the CNI that wires the pods, and the Northbound database the logical space is rows in — which under interconnect is node-local (one NB DB per node), not a single cluster database. Grey is machinery; colour is the topology it carries. The trace flows are the same three packets as the plain view.',
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
            ghostZone('ovnb-core-db', 'OVN logical topology · rows in every node’s NB DB (interconnect)', [
              JOIN_BOX, ROUTER_BOX,
              ghostChip('ovn-ctlplane', 'ovnkube-control-plane', 'Deployment', 'cluster manager · allocates subnets (no central DB)', CTLPLANE_GHOST_DETAIL),
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
  '# Under interconnect the guest NB DB is node-local — one per guest VM, in that\n' +
  '# node’s ovnkube-node pod (NOT central in the HCP namespace; the control-plane\n' +
  '# pod there is only the cluster manager that allocates subnets):\n' +
  '#   oc --kubeconfig <guest> rsh -n openshift-ovn-kubernetes -c nbdb <ovnkube-node-pod> ovn-nbctl …'
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
    'The guest cluster’s own join switch — same construct, same job, even the same 100.64.0.0/16 default as the management one. They never collide: each SDN is its own address universe. Like the mgmt SDN it runs interconnect, so this row lives in each guest VM’s node-local NB DB (inside the VM); the guest’s cluster manager — ovnkube-control-plane in the HCP namespace on the management cluster — only allocates the subnets.',
  sections: [
    { heading: 'At a glance', tags: ['same subnet as mgmt — never collides', 'rows in each VM’s node-local NB DB', 'router ports only'] },
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
    'ovn_cluster_router, guest edition. "Distributed" means the same thing one level up: it runs nowhere — under interconnect its rows live in each guest VM’s own node-local NB DB and are compiled by that VM’s northd + ovn-controller into the in-VM br-int (the HCP-namespace control-plane pod only allocates the subnets). Routing between guest pod subnets happens on the source VM, and the packet crosses the "underlay" — the mgmt pod network — already addressed to its destination.',
  sections: [
    { heading: 'At a glance', tags: ['runs nowhere', 'rows in each VM’s node-local NB DB', 'routed at the source VM'] },
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
  colorVar: 'k-amber', variant: 'pod', inline: true, componentId: p.componentId,
  detail: gPodDetail(p.name, p.ip, w),
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
  variant: 'ellipse', caption: 'distributed · rows in each VM’s node-local NB DB', detail: GUEST_ROUTER_DETAIL,
}

// One guest node column — the plain view's chain, run inside a VMI (zone label
// says which bare-metal worker hosts it; node cards take the guest-VMI green).
const guestNodeZone = (w, pods) => {
  const b = guestNodeBoxes(w)
  return {
    id: `ovng-${w.id}-node`,
    label: `${w.node} · VMI on ${w.metal} · ${w.hostIp}`,
    colorVar: 'k-green',
    boundaryKind: 'machine',
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
  { id: 'pod-rtr', name: 'router-default', ip: '10.128.0.4', componentId: 'openshift-ingress-router-guest' },
  { id: 'pod-fe', name: 'frontend', ip: '10.128.0.7', componentId: 'frontend-application-pod' },
]
const G2_PODS = [
  { id: 'pod-be', name: 'backend', ip: '10.128.2.9', componentId: 'backend-application-pod' },
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
    'The hosted cluster runs the exact same OVN topology as the plain view — gateway routers, join switch, distributed cluster router, a logical switch per node carrying the pods — with every piece one level up: each "node" is a KubeVirt VMI, the underlay is the management cluster’s pod network, the node NIC is a virt-launcher pod’s port. Like the mgmt SDN it runs interconnect, so the NB DB rows live in each guest VM’s node-local NB DB; the guest’s cluster manager in the HCP namespace only allocates the subnets. Cross-node guest traffic is Geneve wrapped in Geneve; guest egress is SNATed twice. Same constructs, same commands — different turtle.',
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

// ── The full HCP picture — both SDNs, inside their OpenShift objects ────────
// Everything at once: the management cluster's OVN topology on the two
// bare-metal workers that host the guest VMs, the guest cluster's identical
// topology nested inside each worker's VMI, and the big view's grey-container
// treatment applied to BOTH layers — every group of boxes drawn inside the
// OpenShift component that owns it, with the virt-launcher pod as the seam
// where the layers meet (its tap device and the VM's eth0 are one NIC).

// The two bare-metal workers (machine network 192.168.1.0/24 — the MetalLB
// pool in manifests.js lives at the top of it). Their /23 pod subnets come
// from the mgmt cluster's 10.128.0.0/14, matching network-topology.js.
const FM1 = {
  id: 'fm1', node: 'worker-1', hostIp: '192.168.1.11',
  joinIp: '100.64.0.2', subnet: '10.128.2.0/23', routerPort: '10.128.2.1', mask: 23,
  cidr: '10.128.0.0/14',
}
const FM2 = {
  id: 'fm2', node: 'worker-2', hostIp: '192.168.1.12',
  joinIp: '100.64.0.3', subnet: '10.128.4.0/23', routerPort: '10.128.4.1', mask: 23,
  cidr: '10.128.0.0/14',
}
// The same guest VMIs as the guest twin, under full-picture ids so both
// topics' box ids stay distinct in the search index.
const FG1 = { ...G1, id: 'fg1' }
const FG2 = { ...G2, id: 'fg2' }

const MGMT_NB_NOTE =
  '# The mgmt SDN’s NB DB lives in the ovnkube pods on each bare-metal node:\n' +
  '#   oc -n openshift-ovn-kubernetes exec <ovnkube-node-…> -c nbdb -- ovn-nbctl …'

const FULL_M_CORE = { underlay: 'ovnf-underlay', join: 'ovnf-mjoin', router: 'ovnf-mrouter', note: MGMT_NB_NOTE }
const FULL_G_CORE = { join: 'ovnf-gjoin', router: 'ovnf-grouter', note: GUEST_NB_NOTE }

// ── Full-picture details (the boxes the shared factories don't cover) ───────

const MACHINE_UNDERLAY_DETAIL = {
  role: 'PHYSICAL L2 SEGMENT · BARE METAL',
  summary:
    'The machine network between the bare-metal nodes — the only network in this entire picture that physically exists. Both SDNs above it are rows in databases; every byte either of them moves eventually crosses this wire as a plain Ethernet frame from one node IP to another.',
  sections: [
    { heading: 'At a glance', tags: ['the only real wire', 'two SDNs ride it', 'mgmt Geneve UDP :6081'] },
    { heading: 'What rides it', bullets: [
      'Carries the mgmt SDN’s Geneve tunnels between the node IPs — guest Geneve frames riding inside them included.',
      'Carries egress already SNATed (twice, if it started in a guest pod) to a node IP.',
      'Carries everything the hosts themselves do: API calls, image pulls, etcd peering, the MetalLB VIPs.',
    ] },
    { heading: 'Facts', facts: [
      { k: 'subnet', v: '192.168.1.0/24 (the machine network)' },
      { k: `${FM1.node}`, v: FM1.hostIp },
      { k: `${FM2.node}`, v: FM2.hostIp },
    ] },
    { heading: 'Explore', commands: [
      '# The node addresses on the machine network\noc get nodes -o wide',
      '# mgmt Geneve between the nodes (oc debug node/<node> → chroot /host)\ntcpdump -ni br-ex udp port 6081',
    ] },
  ],
}

// The mgmt node switch — nodeSwitchDetail plus the seam: the launcher pod
// port that IS the guest VM's NIC.
const mLsDetail = (w, g) => ({
  role: 'LOGICAL SWITCH · ONE PER BARE-METAL NODE',
  summary:
    `The mgmt node switch for ${w.node}, owning its pod subnet ${w.subnet}. Every management pod on this node is a port here — including the virt-launcher pod below, which means the guest VM's entire "machine network" is, physically, one port on this switch. That port is the seam the two SDN layers meet at.`,
  sections: [
    { heading: 'At a glance', tags: ['one per node', 'owns the pod subnet', 'notable port: the VM’s NIC'] },
    { heading: 'What it does', bullets: [
      `Owns ${w.node}’s pod subnet ${w.subnet} — every mgmt pod here gets a port on it.`,
      `Carries the guest node ${g.node} as the launcher pod’s port (${g.hostIp}) — the guest’s whole underlay, one row in this switch.`,
    ] },
    { heading: 'Facts', facts: [
      { k: 'subnet', v: w.subnet },
      { k: 'gateway', v: `${w.routerPort} — rtos-${w.node} on the mgmt ovn_cluster_router` },
      { k: 'notable port', v: `the virt-launcher pod = ${g.node}'s NIC` },
    ] },
    { heading: 'Explore', commands: [
      MGMT_NB_NOTE,
      `ovn-nbctl lsp-list ${w.node}`,
    ] },
  ],
})

const launcherPodDetail = (w, g) => ({
  role: 'POD · THE SEAM BETWEEN THE LAYERS',
  summary:
    `The virt-launcher pod on ${w.node} — to the mgmt SDN an ordinary port on LS ${w.node}, to the guest cluster its entire physical world. Inside it qemu-kvm runs the ${g.node} VM and bridges the VM's virtio-net eth0 to a tap device in the pod's netns: one NIC, two SDNs.`,
  sections: [
    { heading: 'At a glance', tags: ['one pod = one VM', 'pod IP = VM address', 'tap ↔ virtio'] },
    { heading: 'What it does', bullets: [
      `Carries everything ${g.node} sends or receives — the guest cluster’s whole "machine network" is this one switch port.`,
      'Runs the qemu-kvm process whose virtio-net frontend is the VM’s eth0; the backend is a tap device in this pod’s netns.',
    ] },
    { heading: 'Facts', facts: [
      { k: 'pod IP', v: `${g.hostIp} — exactly the address ${g.node} sees on its eth0` },
      { k: 'namespace', v: 'clusters-<guest> (the HCP namespace)' },
    ] },
    { heading: 'Explore', commands: [
      '# The launcher pods — their IPs are the guest "machine network"\noc get pods -n clusters-<guest> -l kubevirt.io=virt-launcher -o wide',
      '# The tap device backing the VM NIC\noc exec -n clusters-<guest> <launcher-pod> -- ip link show',
    ] },
  ],
})

const FULL_MJOIN_DETAIL = {
  role: 'LOGICAL SWITCH · ROUTER INTERCONNECT (MGMT)',
  summary:
    'The management cluster’s join switch — the same construct as every other view of this diagram, in the mgmt NB DB. Every bare-metal node’s gateway router (six in this cluster; the two drawn here) peers with the mgmt distributed router across it.',
  sections: [
    { heading: 'At a glance', tags: ['router interconnect', '100.64.0.0/16', 'one per cluster — six legs'] },
    { heading: 'Job', bullets: [
      'Connects the mgmt ovn_cluster_router to every bare-metal node’s gateway router.',
    ] },
    { heading: 'Facts', facts: [
      { k: 'subnet', v: '100.64.0.0/16 — the guest core below holds the same range, in its own universe' },
      { k: 'ovn_cluster_router', v: '100.64.0.1' },
      { k: `GR_${FM1.node}`, v: FM1.joinIp },
      { k: `GR_${FM2.node}`, v: FM2.joinIp },
    ] },
    { heading: 'Explore', commands: [MGMT_NB_NOTE, 'ovn-nbctl lsp-list join'] },
  ],
}

const FULL_MROUTER_DETAIL = {
  role: 'DISTRIBUTED LOGICAL ROUTER (MGMT)',
  summary:
    'The management cluster’s pod-subnet router. It runs nowhere: every bare-metal node’s ovn-controller compiles it into that node’s br-int, so mgmt routing — launcher-pod-to-launcher-pod traffic included — happens on the source node and crosses the machine network as Geneve frames.',
  sections: [
    { heading: 'At a glance', tags: ['distributed', 'runs nowhere', 'routed at the source node'] },
    { heading: 'What it does', bullets: [
      'Routes between the bare-metal nodes’ /23 pod subnets — one rtos port per node switch.',
      'Compiled into every node’s br-int by ovn-controller.',
      'Routes the guest VMs’ tunnel traffic without knowing it: to this router a guest Geneve frame is just pod-to-pod UDP.',
    ] },
    { heading: 'Facts', facts: [
      { k: `rtos-${FM1.node}`, v: `${FM1.routerPort}/23 (the ${FM1.subnet} default gw)` },
      { k: `rtos-${FM2.node}`, v: `${FM2.routerPort}/23 (the ${FM2.subnet} default gw)` },
    ] },
    { heading: 'Explore', commands: [MGMT_NB_NOTE, 'ovn-nbctl lr-route-list ovn_cluster_router'] },
  ],
}

const FULL_MNB_GHOST_DETAIL = {
  role: 'OPENSHIFT · MGMT NETWORK CONTROL PLANE',
  summary:
    'The mgmt SDN’s logical topology. Under interconnect there is no central database: these rows live in each bare-metal node’s own node-local NB DB (in its ovnkube-node pod), replicated per zone and stitched by a transit switch. The ovnkube-control-plane Deployment in openshift-ovn-kubernetes is only the cluster manager — it allocates each node its /23; every node’s northd + ovn-controller then realize that node’s slice.',
  sections: [
    { heading: 'At a glance', tags: ['interconnect — per-node NB DBs', 'cluster manager only', 'openshift-ovn-kubernetes', 'CNO-deployed'] },
    { heading: 'Facts', facts: [
      { k: 'ovnkube-control-plane', v: 'cluster manager — allocates node subnets (10.128.2.0/23 → worker-1 …); holds no DB' },
      { k: 'scope', v: 'the bare-metal cluster only — it knows nothing of the guest SDN' },
    ] },
    { heading: 'Explore', commands: [
      'oc get pods -n openshift-ovn-kubernetes | grep control-plane',
    ] },
  ],
}

const gCniGhostDetail = (g) => ({
  role: 'OPENSHIFT · IN-VM POD WIRING',
  summary:
    `The CNI half of the guest's OVN-Kubernetes. When the guest kubelet (via the in-VM CRI-O) creates an application pod on ${g.node}, the plugin wires it into the guest's logical network — the same three moves as on bare metal, one turtle up.`,
  sections: [
    { heading: 'At a glance', tags: ['CNI plugin in the VM', 'invoked per guest pod'] },
    { heading: 'What it does', bullets: [
      'Creates the veth pair when the guest kubelet sets up the pod sandbox.',
      'Wires one end into the pod’s netns as eth0 and plugs the other into the in-VM br-int.',
      `Registers the br-int end as the pod’s logical switch port on LS ${g.node}.`,
    ] },
    { heading: 'Explore', commands: [
      '# What the guest CNI recorded for a pod\noc --kubeconfig <guest-kubeconfig> get pod <pod> -n e-commerce-prod -o jsonpath=\'{.metadata.annotations.k8s\\.ovn\\.org/pod-networks}\'',
    ] },
  ],
})

const seamEdgeDetail = (g) => ({
  role: 'TAP ↔ VIRTIO · ONE NIC, TWO SDNS',
  summary:
    `${g.node}'s eth0 and the launcher pod's tap device are two halves of one NIC: qemu bridges the virtio frontend inside the VM to the tap in the pod's netns. Every frame the guest cluster sends crosses this line — and becomes, with no translation and no NAT, management pod traffic from ${g.hostIp}.`,
  sections: [
    { tags: ['one NIC', 'no translation, no NAT', 'where the layers meet'] },
    { heading: 'Explore', commands: [
      '# The tap side, from the mgmt cluster\noc exec -n clusters-<guest> <launcher-pod> -- ip link show',
      '# The virtio side, from inside the VM\nvirtctl ssh core@<guest-node> -n clusters-<guest> -- ip addr show eth0',
    ] },
  ],
})

// ── Full-picture boxes & zones ───────────────────────────────────────────────

const MACHINE_UNDERLAY_BOX = {
  id: 'ovnf-underlay', title: 'Machine network · 192.168.1.0/24', typePrefix: 'L2 segment', colorVar: 'k-blue',
  variant: 'bus', caption: 'bare metal — the only network that physically exists', detail: MACHINE_UNDERLAY_DETAIL,
}
const FULL_MJOIN_BOX = {
  id: 'ovnf-mjoin', title: 'join · 100.64.0.0/16', typePrefix: 'Logical Switch', colorVar: 'k-sky',
  variant: 'switch', caption: 'mgmt — one leg per bare-metal node', detail: FULL_MJOIN_DETAIL,
}
const FULL_MROUTER_BOX = {
  id: 'ovnf-mrouter', title: 'ovn_cluster_router', typePrefix: 'OVN Cluster Router', colorVar: 'k-green',
  variant: 'ellipse', caption: 'mgmt · runs on every bare-metal node', detail: FULL_MROUTER_DETAIL,
}
const FULL_GJOIN_BOX = {
  id: 'ovnf-gjoin', title: 'join · 100.64.0.0/16', typePrefix: 'Logical Switch', colorVar: 'k-sky',
  variant: 'switch', caption: 'guest — same subnet, its own universe', detail: GUEST_JOIN_DETAIL,
}
const FULL_GROUTER_BOX = {
  id: 'ovnf-grouter', title: 'ovn_cluster_router', typePrefix: 'OVN Cluster Router', colorVar: 'k-green',
  variant: 'ellipse', caption: 'guest · runs in every VM', detail: GUEST_ROUTER_DETAIL,
}

const launcherBox = (m, g) => ({
  id: `${m.id}-launcher`, title: 'virt-launcher', caption: `${g.hostIp} · the VM’s NIC`, typePrefix: 'Pod',
  colorVar: 'k-amber', variant: 'pod', inline: true, componentId: 'kubevirt-launcher',
  detail: launcherPodDetail(m, g),
})

// The guest VMI nested inside its bare-metal host's column, wearing the same
// grey containers as the metal: in-VM OVS, the guest ovnkube-node, in-VM CNI.
const fullVmZone = (g, pods) => {
  const b = guestNodeBoxes(g)
  return {
    id: `ovnf-${g.id}-vm`,
    label: `${g.node} · VirtualMachineInstance`,
    colorVar: 'k-green',
    boundaryKind: 'machine',
    layout: 'stack',
    // The zone's own identity chip: the VMI is itself a registered overview
    // object — clicking opens its real sheet.
    boxes: [ghostChipFor(`${g.id}-vmi`, 'guest-worker-node-vm', 'the node, as the mgmt cluster sees it')],
    zones: [
      ghostZone(`ovnf-${g.id}-ovs`, 'Open vSwitch · systemd in the VM', [
        b.eth0, b.brint,
        ghostChipFor(`${g.id}-ovs`, 'ovs-guest', 'the in-VM data plane'),
      ]),
      ghostZone(`ovnf-${g.id}-ovnkube`, 'realized by the guest ovn-controller', [
        b.ext, b.gr,
        ghostChipFor(`${g.id}-ovnkube`, 'ovn-node-guest', 'guest DB rows → OpenFlow'),
      ]),
      { id: `ovnf-${g.id}-gap`, spacer: true },
      ghostZone(`ovnf-${g.id}-cni`, 'pod wiring · in-VM CNI', [
        b.ls,
        ...pods.map((p) => guestPodBox(g, p)),
        ghostChip(`${g.id}-cni`, 'ovn-k8s-cni-overlay', 'CNI', 'plugs veths into the in-VM br-int', gCniGhostDetail(g)),
      ]),
    ],
  }
}

// One bare-metal column: the mgmt chain in its grey containers, then the
// nested VMI carrying the guest chain in its own.
const fullMetalZone = (m, g, gPods) => {
  const b = nodeBoxes(m, MGMT_NB_NOTE)
  b.ls = { ...b.ls, detail: mLsDetail(m, g) }
  return {
    id: `ovnf-${m.id}-node`,
    label: `${m.node} · bare metal · ${m.hostIp}`,
    colorVar: 'k-blue',
    boundaryKind: 'machine',
    layout: 'stack',
    zones: [
      ghostZone(`ovnf-${m.id}-ovs`, 'Open vSwitch · systemd on RHCOS', [
        b.eth0, b.brint,
        ghostChipFor(`${m.id}-ovs`, 'ovs-host', 'forwards every packet'),
      ]),
      ghostZone(`ovnf-${m.id}-ovnkube`, 'realized by ovn-controller', [
        b.ext, b.gr,
        ghostChipFor(`${m.id}-ovnkube`, 'ovn-node-host', 'DB rows → OpenFlow'),
      ]),
      { id: `ovnf-${m.id}-gap`, spacer: true },
      ghostZone(`ovnf-${m.id}-cni`, 'pod wiring · CNI', [
        b.ls, launcherBox(m, g),
        ghostChip(`${m.id}-cni`, 'ovn-k8s-cni-overlay', 'CNI', 'plugs veths into br-int', cniGhostDetail(m)),
      ]),
      fullVmZone(g, gPods),
    ],
  }
}

// Guest wiring hangs off the launcher pod instead of an underlay bus — the
// seam edge replaces the bus drop, everything else is the standard per-node
// wiring against the guest core.
const fullGuestEdges = (g, pods, launcherId) => [
  { id: `e-seam-${g.id}`, from: launcherId, to: `${g.id}-eth0`, step: '',
    axis: 'vertical', solid: true, quiet: true, label: 'tap ↔ virtio', accent: 'k-amber', labelT: 0.5,
    title: 'One NIC, two SDNs', detail: seamEdgeDetail(g) },
  ...chainEdges(g),
  rtojEdge(g, FULL_G_CORE),
  rtosEdge(g, FULL_G_CORE),
  ...podEdges(g, pods),
]

const LAUNCHER_POD = [{ id: 'launcher' }]
const FULL_EDGES = [
  ...nodeEdges(FM1, LAUNCHER_POD, FULL_M_CORE),
  ...nodeEdges(FM2, LAUNCHER_POD, FULL_M_CORE),
  { id: 'e-fmjoin-rtr', from: 'ovnf-mjoin', to: 'ovnf-mrouter', step: '',
    axis: 'vertical', solid: true, quiet: true, label: '100.64.0.1/16', labelT: 0.5, accent: 'k-sky' },
  ...fullGuestEdges(FG1, G1_PODS, 'fm1-launcher'),
  ...fullGuestEdges(FG2, G2_PODS, 'fm2-launcher'),
  { id: 'e-fgjoin-rtr', from: 'ovnf-gjoin', to: 'ovnf-grouter', step: '',
    axis: 'vertical', solid: true, quiet: true, label: '100.64.0.1/16', labelT: 0.5, accent: 'k-sky' },
]

const FULL_FLOWS = [
  {
    flowId: 'ovnf-pp-cross',
    flowName: 'Guest pod → guest pod — down through both SDNs and back up',
    description:
      'The whole point of this view in one packet: frontend (guest-worker-1) calls backend (guest-worker-2). The guest SDN routes and tunnels it between VM addresses; those are mgmt pod IPs on different metal, so the mgmt SDN routes and tunnels it again between node IPs. Down through two SDNs, across the one real wire, up through both again.',
    steps: [
      { step: 1, sourceBoxId: 'fg1-pod-fe', targetBoxId: 'fg1-ls',
        description: 'frontend sends to 10.128.2.9 — another guest subnet, so it targets its gateway 10.128.0.1, the guest cluster router’s rtos port.' },
      { step: 2, sourceBoxId: 'fg1-ls', targetBoxId: 'ovnf-grouter',
        description: 'Routed by the guest’s distributed router *on the source VM* — its table is compiled into the in-VM br-int from that VM’s own node-local NB DB (the HCP-namespace control plane only allocated the subnets).' },
      { step: 3, sourceBoxId: 'ovnf-grouter', targetBoxId: 'fg1-eth0',
        description: 'The route says 10.128.2.0/23 lives on guest-worker-2, so the VM encapsulates in guest Geneve between VM addresses (10.128.2.15 → 10.128.4.21) and the frame leaves the virtio NIC.' },
      { step: 4, sourceBoxId: 'fg1-eth0', targetBoxId: 'fm1-launcher',
        description: 'Out of the VM without leaving the machine: eth0’s other half is the tap device in the virt-launcher pod. The packet is now ordinary mgmt pod traffic from 10.128.2.15.' },
      { step: 5, sourceBoxId: 'fm1-launcher', targetBoxId: 'fm1-ls',
        description: 'Enters the launcher pod’s port on LS worker-1 — the guest’s whole "machine network" is this switch, one layer down.' },
      { step: 6, sourceBoxId: 'fm1-ls', targetBoxId: 'ovnf-mrouter',
        description: 'The mgmt SDN runs the same play: destination 10.128.4.21 is on worker-2’s pod subnet, so the mgmt distributed router routes it — on worker-1, in the bare-metal br-int.' },
      { step: 7, sourceBoxId: 'ovnf-mrouter', targetBoxId: 'fm2-ls',
        description: 'Second encapsulation: mgmt Geneve between machine addresses (192.168.1.11 → 192.168.1.12) crosses the only real wire in the picture. worker-2’s br-int decapsulates into LS worker-2.' },
      { step: 8, sourceBoxId: 'fm2-ls', targetBoxId: 'fm2-launcher',
        description: 'Delivered to the other launcher pod’s port — still carrying the intact guest Geneve frame inside.' },
      { step: 9, sourceBoxId: 'fm2-launcher', targetBoxId: 'fg2-eth0',
        description: 'Through the tap ↔ virtio pair into guest-worker-2 — the packet climbs back up a layer.' },
      { step: 10, sourceBoxId: 'fg2-eth0', targetBoxId: 'fg2-ls',
        description: 'The in-VM br-int decapsulates the guest Geneve straight into LS guest-worker-2.' },
      { step: 11, sourceBoxId: 'fg2-ls', targetBoxId: 'fg2-pod-be',
        description: 'Normal L2 delivery to backend’s port. On the wire this was: machine IP → machine IP, carrying mgmt Geneve, carrying guest Geneve, carrying pod IP → pod IP.' },
    ],
  },
  {
    flowId: 'ovnf-egress',
    flowName: 'Guest pod → internet — SNAT at each layer',
    description:
      'The egress story told twice, once per SDN: the guest’s gateway router SNATs the pod address to the VM address; the mgmt cluster’s gateway router SNATs that to the bare-metal node IP. Each layer’s GR holds its own conntrack table, and the reply un-NATs through both in reverse.',
    steps: [
      { step: 1, sourceBoxId: 'fg1-pod-fe', targetBoxId: 'fg1-ls',
        description: 'frontend sends to 1.1.1.1 — off-cluster, via its gateway 10.128.0.1.' },
      { step: 2, sourceBoxId: 'fg1-ls', targetBoxId: 'ovnf-grouter',
        description: 'No guest pod subnet matches. Policy routes steer the packet toward the *local* VM’s gateway router.' },
      { step: 3, sourceBoxId: 'ovnf-grouter', targetBoxId: 'ovnf-gjoin',
        description: 'Out the guest rtoj port (100.64.0.1) onto the guest’s join switch.' },
      { step: 4, sourceBoxId: 'ovnf-gjoin', targetBoxId: 'fg1-gr',
        description: 'Next hop 100.64.0.2: GR_guest-worker-1, pinned to this VM — the first conntrack table this packet meets.' },
      { step: 5, sourceBoxId: 'fg1-gr', targetBoxId: 'fg1-eth0',
        description: 'SNAT № 1: 10.128.0.7 becomes 10.128.2.15 — the VM address, a mgmt pod IP. Out via ext_guest-worker-1 and the in-VM br-ex; in br-int all of it was rule lookups.' },
      { step: 6, sourceBoxId: 'fg1-eth0', targetBoxId: 'fm1-launcher',
        description: 'Out the virtio NIC into the launcher pod: from here on the packet is plain mgmt pod egress.' },
      { step: 7, sourceBoxId: 'fm1-launcher', targetBoxId: 'fm1-ls',
        description: 'Enters the launcher’s port on LS worker-1.' },
      { step: 8, sourceBoxId: 'fm1-ls', targetBoxId: 'ovnf-mrouter',
        description: 'The mgmt cluster router matches no mgmt pod subnet — policy routes steer toward worker-1’s own gateway router. Egress still never crosses to another node first.' },
      { step: 9, sourceBoxId: 'ovnf-mrouter', targetBoxId: 'ovnf-mjoin',
        description: 'Out the mgmt rtoj port — 100.64.0.1 again, but the *other* 100.64.0.1: same range, different universe, never in the same packet header.' },
      { step: 10, sourceBoxId: 'ovnf-mjoin', targetBoxId: 'fm1-gr',
        description: 'Next hop 100.64.0.2: GR_worker-1, pinned to the metal — the second conntrack table.' },
      { step: 11, sourceBoxId: 'fm1-gr', targetBoxId: 'fm1-eth0',
        description: 'SNAT № 2: 10.128.2.15 becomes 192.168.1.11. Out via ext_worker-1 and br-ex onto the uplink.' },
      { step: 12, sourceBoxId: 'fm1-eth0', targetBoxId: 'ovnf-underlay',
        description: 'Onto the machine network toward the default gateway — a plain frame from the node IP. The reply un-NATs at GR_worker-1, rides back into the VM, and un-NATs again at GR_guest-worker-1.' },
    ],
  },
]

export const OVN_TOPOLOGY_FULL = {
  topicId: 'ovn-topology-full',
  title: 'OVN-Kubernetes — the full HCP picture: both SDNs in their OpenShift objects',
  tagline:
    'Everything at once: the management cluster’s OVN topology on the bare-metal workers, the guest cluster’s identical topology nested inside each worker’s VMI, and the grey OpenShift container around every group of boxes — Open vSwitch units on the metal and in each VM, the ovnkube-node pods that realize each layer, the CNIs that wire the pods, the two SDNs’ logical topologies (each interconnect — node-local NB DBs per node/VM, with only the cluster managers in openshift-ovn-kubernetes and the HCP namespace), and the virt-launcher pod where the layers meet: its tap device and the VM’s eth0 are one NIC. Grey is machinery; colour is topology. The two trace flows walk a packet down through both SDNs and back up.',
  colorVar: 'k-orange',
  canvasClass: 'recon-stack--ovnfull',
  topology: { edges: FULL_EDGES },
  flows: FULL_FLOWS,
  zones: [
    underlayZone([MACHINE_UNDERLAY_BOX], 'ovnf-underlay-zone'),
    {
      id: 'ovnf-nodes-zone',
      bare: true,
      layout: 'columns',
      zones: [
        fullMetalZone(FM1, FG1, G1_PODS),
        // The middle column stacks the two logical cores: the mgmt core up at
        // gateway-router height, the guest core down at the VMIs' height, with
        // a growing gap between — each inside the grey container naming the
        // database its rows live in.
        {
          id: 'ovnf-core',
          bare: true,
          layout: 'stack',
          colorVar: 'k-purple',
          zones: [
            // Top spacer drops the mgmt core toward the metal GRs' height; the
            // mid spacer holds the guest core down at the nested VMIs' band.
            { id: 'ovnf-core-top', spacer: true },
            ghostZone('ovnf-core-m', 'mgmt logical topology · per-node NB DBs (cluster manager: openshift-ovn-kubernetes)', [
              FULL_MJOIN_BOX, FULL_MROUTER_BOX,
              ghostChip('ovnf-mnb', 'ovnkube-control-plane', 'Deployment', 'cluster manager · no central DB', FULL_MNB_GHOST_DETAIL),
            ]),
            { id: 'ovnf-core-gap', spacer: true },
            ghostZone('ovnf-core-g', 'guest logical topology · per-VM NB DBs (cluster manager in the HCP namespace)', [
              FULL_GJOIN_BOX, FULL_GROUTER_BOX,
              ghostChipFor('ovnf-gnb', 'ovn-master-control', 'guest cluster manager — on the mgmt cluster'),
            ]),
          ],
        },
        fullMetalZone(FM2, FG2, G2_PODS),
      ],
    },
  ],
}
