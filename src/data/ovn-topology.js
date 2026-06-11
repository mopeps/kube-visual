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

// ── Edge (link) details — the port pairs the IP chips open ──────────────────

const edgeDetail = (role, summary, commands) => ({
  role, summary,
  sections: commands?.length ? [{ heading: 'Explore', commands: [NBCTL_NOTE, ...commands] }] : [],
})

export const patchEdgeDetail = (w) => edgeDetail(
  'OVS PATCH PORT',
  `Not a cable — a patch port pair connecting the two OVS bridges on ${w.node}: br-ex (which owns eth0 and the node IP) and br-int (which owns the logical topology). Frames cross it in memory, no encapsulation.`,
  ['ovs-vsctl list-ports br-ex; ovs-vsctl list-ports br-int'],
)

export const localnetEdgeDetail = (w) => edgeDetail(
  'LOCALNET PORT',
  `ext_${w.node}'s localnet port — the declaration that this logical switch is bridged to a real network. ovn-controller maps it to br-ex via the bridge-mappings OVS config, which is what lets gateway-router traffic reach the physical wire.`,
  ['ovs-vsctl get Open_vSwitch . external_ids:ovn-bridge-mappings'],
)

export const etorEdgeDetail = (w) => edgeDetail(
  'ROUTER ↔ SWITCH PORT PAIR',
  `etor-GR_${w.node} (switch side) ↔ rtoe-GR_${w.node} (router side): the gateway router's external leg, carrying the node's own address ${w.hostIp}. Packets leaving here are already SNATed and look like host traffic.`,
  [`ovn-nbctl lrp-list GR_${w.node}`],
)

export const rtojEdgeDetail = (w) => edgeDetail(
  'JOIN-SWITCH PORT',
  `rtoj-GR_${w.node} · ${w.joinIp}/16 — the gateway router's leg on the "join" switch. The 100.64.0.0/16 addresses exist only so the routers can next-hop to each other; nothing else lives on this subnet.`,
  ['ovn-nbctl lsp-list join'],
)

export const JTOR_EDGE_DETAIL = edgeDetail(
  'JOIN-SWITCH PORT',
  'rtoj-ovn_cluster_router · 100.64.0.1/16 — the distributed router’s one leg on the join switch. Egress traffic next-hops from here to the local node’s gateway router; reply traffic comes back the same way.',
  ['ovn-nbctl lr-route-list ovn_cluster_router'],
)

export const rtosEdgeDetail = (w) => edgeDetail(
  'ROUTER ↔ SWITCH PORT PAIR',
  `rtos-${w.node} · ${w.routerPort}/24 (router side) ↔ stor-${w.node} (switch side): how the node's pod subnet hangs off ovn_cluster_router. ${w.routerPort} is every ${w.node} pod's default gateway — a router port, not a pod (a common misreading of this diagram).`,
  [`ovn-nbctl lrp-list ovn_cluster_router`],
)

export const UNDERLAY_EDGE_DETAIL = (w) => edgeDetail(
  'PHYSICAL ATTACHMENT',
  `${w.node}'s eth0 on the underlay at ${w.hostIp}. Both overlay stories terminate here: Geneve tunnels run eth0-to-eth0, and SNATed egress leaves with this source address.`,
  ['ip addr show br-ex', 'tcpdump -ni eth0 udp port 6081'],
)

// ── The deep-dive topic ──────────────────────────────────────────────────────

const nodeEdgeZone = (w) => ({
  id: `ovn-${w.id}-edge`,
  label: `${w.node} · ${w.hostIp}`,
  colorVar: 'k-teal',
  layout: 'stack',
  boxes: [
    { id: `${w.id}-eth0`, title: `eth0 · ${w.hostIp}`, typePrefix: 'netdev', detail: ethDetail(w) },
    { id: `${w.id}-brint`, title: 'br-int', typePrefix: 'OVS bridge', detail: brIntDetail(w) },
    { id: `${w.id}-ext`, title: `ext_${w.node}`, typePrefix: 'LogicalSwitch', detail: extSwitchDetail(w) },
    { id: `${w.id}-gr`, title: `GR_${w.node}`, typePrefix: 'LogicalRouter', detail: gatewayRouterDetail(w) },
  ],
})

const nodePodZone = (w, pods) => ({
  id: `ovn-${w.id}-pods`,
  label: `${w.node} pods · ${w.subnet}`,
  colorVar: 'k-green',
  layout: 'stack',
  boxes: [
    { id: `${w.id}-ls`, title: `LS ${w.node}`, typePrefix: 'LogicalSwitch', detail: nodeSwitchDetail(w) },
    ...pods.map((p) => ({
      id: `${w.id}-${p.id}`, title: `${p.name} · ${p.ip}`, typePrefix: 'Pod', detail: podDetail(p.name, p.ip, w),
    })),
  ],
})

// Per-node wiring: eth0 → br-int → ext switch → GR, plus the GR's leg up to
// the join switch. `side` biases the cross-zone curves apart.
const nodeEdges = (w, side) => [
  { id: `e-u-${w.id}`, from: 'ovn-underlay', to: `${w.id}-eth0`, step: '',
    axis: 'vertical', label: w.hostIp, accent: 'k-blue',
    title: `${w.node} on the underlay`, detail: UNDERLAY_EDGE_DETAIL(w) },
  { id: `e-${w.id}-patch`, from: `${w.id}-eth0`, to: `${w.id}-brint`, step: '',
    kindLabel: '⇄ patch', label: 'via br-ex', accent: 'k-teal',
    title: `br-ex ↔ br-int patch (${w.node})`, detail: patchEdgeDetail(w) },
  { id: `e-${w.id}-localnet`, from: `${w.id}-brint`, to: `${w.id}-ext`, step: '',
    kindLabel: '⌁ localnet', label: 'bridge-mapping', accent: 'k-teal',
    title: `localnet mapping (${w.node})`, detail: localnetEdgeDetail(w) },
  { id: `e-${w.id}-etor`, from: `${w.id}-ext`, to: `${w.id}-gr`, step: '',
    label: `rtoe · ${w.hostIp}`, accent: 'k-teal',
    title: `etor ↔ rtoe (GR_${w.node})`, detail: etorEdgeDetail(w) },
  { id: `e-${w.id}-rtoj`, from: `${w.id}-gr`, to: 'ovn-join', step: '',
    axis: 'vertical', bias: side, label: `rtoj · ${w.joinIp}/16`, accent: 'k-purple',
    title: `GR_${w.node} on the join switch`, detail: rtojEdgeDetail(w) },
]

export const OVN_TOPOLOGY = {
  topicId: 'ovn-topology',
  title: 'OVN-Kubernetes — the logical network topology',
  tagline:
    'How OVN-Kubernetes wires a cluster: per-node gateway routers behind localnet switches, one "join" switch gluing them to a distributed cluster router, and a logical switch per node carrying the pods. Everything here is a row in OVN’s northbound DB that you can list with ovn-nbctl — except br-int, the OVS bridge each node compiles all of it into. The same wiring runs twice in this app’s HCP topology: once on the bare-metal management cluster, once inside the guest VMs.',
  colorVar: 'k-teal',
  topology: {
    edges: [
      ...nodeEdges(W1, 'left'),
      ...nodeEdges(W2, 'right'),
      { id: 'e-join-rtr', from: 'ovn-join', to: 'ovn-cluster-router', step: '',
        label: 'rtoj · 100.64.0.1/16', accent: 'k-purple',
        title: 'ovn_cluster_router on the join switch', detail: JTOR_EDGE_DETAIL },
      { id: 'e-rtr-w1ls', from: 'ovn-cluster-router', to: 'w1-ls', step: '',
        axis: 'vertical', bias: 'left', labelT: 0.32, label: `rtos · ${W1.routerPort}/24`, accent: 'k-green',
        title: `rtos-${W1.node}`, detail: rtosEdgeDetail(W1) },
      { id: 'e-rtr-w2ls', from: 'ovn-cluster-router', to: 'w2-ls', step: '',
        axis: 'vertical', bias: 'right', labelT: 0.32, label: `rtos · ${W2.routerPort}/24`, accent: 'k-green',
        title: `rtos-${W2.node}`, detail: rtosEdgeDetail(W2) },
    ],
  },
  flows: [
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
  ],
  zones: [
    {
      id: 'ovn-underlay-zone',
      label: 'Underlay network · 172.18.0.0/24 — the only real wire',
      colorVar: 'k-blue',
      layout: 'stack',
      boxes: [
        { id: 'ovn-underlay', title: 'Underlay 172.18.0.0/24', typePrefix: 'L2 segment', detail: UNDERLAY_DETAIL },
      ],
    },
    {
      id: 'ovn-edge-zone',
      label: 'Node network edge — one stack per node',
      colorVar: 'k-teal',
      layout: 'columns',
      zones: [nodeEdgeZone(W1), nodeEdgeZone(W2)],
    },
    {
      id: 'ovn-core-zone',
      label: 'OVN logical core — shared & distributed',
      colorVar: 'k-purple',
      layout: 'stack',
      boxes: [
        { id: 'ovn-join', title: 'LS "join" · 100.64.0.0/16', typePrefix: 'LogicalSwitch', detail: JOIN_SWITCH_DETAIL },
        { id: 'ovn-cluster-router', title: 'ovn_cluster_router', typePrefix: 'LogicalRouter', detail: CLUSTER_ROUTER_DETAIL },
      ],
    },
    {
      id: 'ovn-pods-zone',
      label: 'Pod networks · 10.244.0.0/16 — a switch per node',
      colorVar: 'k-green',
      layout: 'columns',
      zones: [
        nodePodZone(W1, [
          { id: 'pod-a', name: 'pod-a', ip: '10.244.0.3' },
          { id: 'pod-b', name: 'pod-b', ip: '10.244.0.5' },
        ]),
        nodePodZone(W2, [
          { id: 'pod-a', name: 'pod-c', ip: '10.244.2.3' },
        ]),
      ],
    },
  ],
}
