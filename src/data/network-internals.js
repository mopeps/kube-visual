// ── Network-mode component internals (the "open the box" topology) ──────────
// In Network mode each drillable OpenShift component box opens to reveal its own
// Linux primitives + integrations *inside its own card* (never a zone). Boxes may
// nest: a bridge box draws its interfaces (ports) ON it, the Northbound DB box
// holds its rows INSIDE it. This module supplies, per componentId:
//   INTERNAL_TOPOLOGY[id] = { bands: [{ label, boundary?, boxes: [box…] }] }
// box = { id, title, typePrefix, variant, colorVar, caption, detail, children? }
// Sub-box ids are globally unique (`<componentId>__<local>`); OverviewTab
// namespaces them per column (`nt-c{N}-…`) so the canvas edge overlay can wire a
// port/row at any depth. EDGES answer "how is this implemented / where does it
// cross a boundary": ovn-controller → ovs-vswitchd over db.sock; the patch port
// between br-int and br-ex; a NB-DB Load_Balancer row realized as a br-int flow.

// — small helpers ————————————————————————————————————————————————————————————
const box = (id, title, typePrefix, { variant, colorVar = 'k-amber', caption, detail, children } = {}) =>
  ({ id, title, typePrefix, variant, colorVar, caption, detail, children })
const port = (id, title, opts = {}) => box(id, title, 'netdev', { variant: 'iface', colorVar: 'k-teal', ...opts })

const detail = (role, summary, sections = []) => ({ role, summary, sections })
const tags = (...t) => ({ heading: 'At a glance', tags: t })
const facts = (...f) => ({ heading: 'Facts', facts: f })
const explore = (...c) => ({ heading: 'Explore', commands: c })

// ── Open vSwitch — daemons over a kernel datapath of wired bridges ──────────
// br-ex carries its NIC uplink; br-int carries its ports (patch / geneve / pod
// veth / VM tap0) and, in the guest, the realized Service / NetworkPolicy flows.
const ovsInternal = (ovsId, where, { guest = false } = {}) => {
  const brintPorts = [
    port(`${ovsId}__patch`, 'patch → br-ex', { caption: 'localnet on-ramp',
      detail: detail('PATCH PORT', 'The internal patch port pair that splices br-int to br-ex, so logical traffic reaches the provider bridge and the wire.') }),
    port(`${ovsId}__geneve`, 'genev_sys :6081', { caption: 'inter-node overlay',
      detail: detail('GENEVE TUNNEL PORT', 'Wraps node-to-node pod traffic in Geneve UDP :6081 stamped with the destination logical port, shipped out br-ex to the peer node.') }),
    port(`${ovsId}__veth`, 'pod veths', { caption: 'one per local pod',
      detail: detail('POD PORTS', 'Each local pod’s host-side veth is an OVS port on br-int — the CNI plugs it here and registers it as the pod’s logical switch port.') }),
  ]
  if (guest) {
    brintPorts.push(port(`${ovsId}__tap0`, 'tap0', { colorVar: 'k-purple', caption: 'the VM NIC',
      detail: detail('VM TAP PORT', 'The VirtualMachineInstance’s tap0, plugged into br-int by Multus/ovn-k8s-cni — so the VM lands on the same OVN logical network as a pod.') }))
  }
  // Services / NetworkPolicy have no datapath of their own — they're realized as
  // OpenFlow on br-int. Shown here (guest) as the flows they compile to; declared
  // as rows in the OVN-K8s Master NB DB (wired by a "realized as" edge).
  const brintFlows = guest ? [
    box(`${ovsId}__lbflows`, 'Service LB flows', 'OpenFlow', { colorVar: 'k-green', caption: 'ClusterIP → DNAT',
      detail: detail('REALIZED · LOAD-BALANCER FLOWS', 'The ClusterIP Services compiled into OVN Load_Balancer flows on br-int: a single rule DNATs the virtual IP to a backing pod IP. No process, just flows.') }),
    box(`${ovsId}__aclflows`, 'NetworkPolicy ACLs', 'OpenFlow', { colorVar: 'k-green', caption: 'allow / drop',
      detail: detail('REALIZED · ACL FLOWS', 'The NetworkPolicy compiled into OVN ACLs — allow/drop OpenFlow rules checked on the pod ports before the veth, dropping non-matching east-west traffic.') }),
  ] : []

  return {
    bands: [
      {
        label: `user space · ${where}`,
        boxes: [
          box(`${ovsId}__ovsdb`, 'ovsdb-server', 'systemd', { caption: 'conf.db',
            detail: detail('OVS CONFIG DB · USER SPACE', 'Holds the switch’s own configuration — bridges, ports, interfaces — in conf.db and serves it over a Unix socket. Distinct from the OVN northbound DB of logical intent.') }),
          box(`${ovsId}__vswitchd`, 'ovs-vswitchd', 'systemd', { caption: 'OpenFlow → datapath',
            detail: detail('OPENFLOW ENGINE · USER SPACE', 'The forwarding brain: receives OpenFlow (compiled by ovn-controller, pushed over /var/run/openvswitch/db.sock) and programs the kernel datapath flow cache so the fast path forwards without it.') }),
        ],
      },
      {
        label: 'kernel datapath · openvswitch.ko',
        boundary: 'kernel boundary',
        boxes: [
          box(`${ovsId}__brex`, 'br-ex', 'OVS bridge', {
            variant: 'bridge', colorVar: 'k-sky', caption: 'provider bridge',
            detail: detail('EXTERNAL BRIDGE · ON-RAMP TO THE WIRE', 'The host IP moves onto br-ex and the NIC becomes its uplink, so OVN can splice logical traffic onto the L2 segment. Egress SNAT leaves here; MetalLB GARPs are injected here.'),
            children: [
              port(`${ovsId}__eth0`, 'eth0 (NIC)', { caption: 'uplink port',
                detail: detail('PHYSICAL NIC · UPLINK', 'The host’s physical interface, enslaved to br-ex as its uplink port — the on-ramp between the overlay and the physical wire.') }),
            ],
          }),
          box(`${ovsId}__brint`, 'br-int', 'OVS bridge', {
            variant: 'bridge', colorVar: 'k-amber', caption: 'the data plane',
            detail: detail('INTEGRATION BRIDGE · THE DATA PLANE', 'The punchline: every switch and router is just rows in OVN’s DB — br-int is the only thing that actually exists on the node. ovn-controller compiles the whole logical topology into OpenFlow here; one lookup does what the diagram draws as a multi-hop journey.'),
            children: [...brintPorts, ...brintFlows],
          }),
        ],
      },
    ],
  }
}

// ── OVN-K8s Master = ovnkube-control-plane (interconnect: lightweight) ───────
// In OVN interconnect mode the control plane no longer holds the cluster NB/SB
// DB — that lives per-node (see ovnNodeInternal). It just hands each node a pod
// subnet and coordinates the interconnect. The SAME box exists for the management
// cluster (on the bare-metal master) and the guest cluster (in its HCP namespace).
const ovnControlPlaneInternal = (prefix, where) => ({
  bands: [
    {
      label: `ovnkube-control-plane · ${where}`,
      boxes: [
        box(`${prefix}__clustermgr`, 'cluster manager', 'Deployment', {
          colorVar: 'k-sky', caption: 'allocates each node a /23',
          detail: detail('CLUSTER MANAGER · SUBNET ALLOCATION', 'The interconnect control plane is lightweight: it carves the cluster pod CIDR into a per-node /23 and hands each ovnkube-node its slice. It does NOT hold the cluster NB/SB DB — that lives on each node.') }),
        box(`${prefix}__ic`, 'interconnect coordinator', 'process', {
          colorVar: 'k-sky', caption: 'stitches the per-node zones',
          detail: detail('INTERCONNECT COORDINATOR', 'Each node is its own OVN "zone". This coordinates the transit switch / remote-port info so the zones interconnect, without a central database every node must reach.') }),
      ],
    },
  ],
})

// ── OVN-K8s Node = ovnkube-node (interconnect: the node IS its own OVN zone) ─
// Holds the node-local nbdb (with this zone's rows), northd, sbdb, ovn-controller
// and the CNI — the logical topology lives here, and ovn-controller realizes it
// as OpenFlow on this node's br-int.
const ovnNodeInternal = (nodeId, where) => ({
  bands: [
    {
      label: `ovnkube-node pod · ${where} · its own OVN zone`,
      boxes: [
        box(`${nodeId}__kube`, 'ovnkube-controller', 'container', {
          colorVar: 'k-teal', caption: 'K8s API → NB rows',
          detail: detail('OVNKUBE-CONTROLLER', 'Watches Pods / Services / NetworkPolicies on the API server and writes the matching rows into THIS node’s local Northbound DB.') }),
        box(`${nodeId}__nbdb`, 'Northbound DB', 'OVSDB', {
          variant: 'bridge', colorVar: 'k-purple', caption: 'node-local · this zone',
          detail: detail('NODE-LOCAL NORTHBOUND DB', 'In interconnect mode every node runs its own nbdb. Its rows describe this node’s zone — the cluster router, the join switch, this node’s logical switch, a transit switch to the other zones, and the cluster-scoped Load_Balancer / ACL rows it needs.'),
          children: [
            box(`${nodeId}__router`, 'ovn_cluster_router', 'OVN Cluster Router', {
              variant: 'ellipse', colorVar: 'k-green', caption: '100.64.0.1 · distributed',
              detail: detail('DISTRIBUTED LOGICAL ROUTER · A ROW', 'A row in every node’s local nbdb; ovn-controller instantiates it as OpenFlow in this node’s br-int, so routing happens on the source node.') }),
            box(`${nodeId}__join`, 'LS "join"', 'Logical Switch', {
              variant: 'switch', colorVar: 'k-sky', caption: '100.64.0.0/16',
              detail: detail('ROUTER INTERCONNECT · A ROW', 'Wires the distributed cluster router to the node’s gateway router. Router ports only — no pod lives here.') }),
            box(`${nodeId}__ls`, 'LS (this node)', 'Logical Switch', {
              variant: 'switch', colorVar: 'k-sky', caption: 'this node’s pod subnet',
              detail: detail('NODE LOGICAL SWITCH · A ROW', 'Owns this node’s /23 pod subnet; the local pods’ logical ports hang off it.') }),
            box(`${nodeId}__transit`, 'transit switch', 'Logical Switch', {
              variant: 'switch', colorVar: 'k-teal', caption: 'IC · to the other zones',
              detail: detail('TRANSIT SWITCH · INTERCONNECT', 'The interconnect construct: a logical switch with a remote port for every other node’s zone, so cross-node traffic is routed zone-to-zone over Geneve without a shared central DB.') }),
            box(`${nodeId}__lb`, 'Load_Balancer rows', 'OVN LB', {
              variant: 'switch', colorVar: 'k-green', caption: 'ClusterIP Services',
              detail: detail('SERVICE DECLARATION · LOAD_BALANCER ROWS', 'Each Service is a Load_Balancer row (replicated into every node’s nbdb). No datapath of its own — realized as DNAT flows on this node’s br-int.') }),
            box(`${nodeId}__acl`, 'ACL rows', 'OVN ACL', {
              variant: 'switch', colorVar: 'k-green', caption: 'NetworkPolicy',
              detail: detail('NETWORKPOLICY DECLARATION · ACL ROWS', 'NetworkPolicy compiles to ACL rows + address sets, realized as allow/drop OpenFlow on this node’s br-int.') }),
          ],
        }),
        box(`${nodeId}__northd`, 'ovn-northd', 'process', {
          colorVar: 'k-purple', caption: 'NB → SB',
          detail: detail('NORTHD · TRANSLATOR', 'Renders this node’s NB DB rows into concrete logical flows in its local SB DB.') }),
        box(`${nodeId}__sbdb`, 'Southbound DB', 'OVSDB', {
          variant: 'bridge', colorVar: 'k-purple', caption: 'node-local logical flows',
          detail: detail('NODE-LOCAL SOUTHBOUND DB', 'The logical flows northd produced for this zone; ovn-controller watches it and compiles them into OpenFlow on the local br-int.') }),
        box(`${nodeId}__controller`, 'ovn-controller', 'container', {
          colorVar: 'k-teal', caption: 'SB → OpenFlow',
          detail: detail('OVN-CONTROLLER', 'Watches the local SB DB and compiles its flows into OpenFlow on the local br-int, pushed over /var/run/openvswitch/db.sock.') }),
        box(`${nodeId}__cni`, 'ovn-k8s-cni-overlay', 'CNI', {
          colorVar: 'k-blue', caption: 'pod veth → br-int',
          detail: detail('CNI PLUGIN', 'Invoked per pod by the kubelet/CRI-O: creates the veth pair and plugs the host end into br-int as the pod’s logical switch port.') }),
      ],
    },
  ],
})

// ── MetalLB Speaker — L2 mode: a raw GARP out br-ex ─────────────────────────
const metallbSpeakerInternal = (id) => ({
  bands: [
    {
      label: 'host netns · user space',
      boxes: [
        box(`${id}__memberlist`, 'memberlist gossip', 'process', {
          colorVar: 'k-orange', caption: 'leader election per VIP',
          detail: detail('L2 LEADER ELECTION', 'Speakers gossip over memberlist and elect one node as the L2 leader for each LoadBalancer VIP, so only one node answers for it.') }),
        box(`${id}__rawsock`, 'AF_PACKET raw socket', 'syscall', {
          variant: 'iface', colorVar: 'k-orange', caption: 'socket(AF_PACKET, SOCK_RAW)',
          detail: detail('GRATUITOUS ARP INJECTION', 'When this node owns a VIP, the speaker bypasses the host IP stack and pushes a Gratuitous ARP for the VIP out br-ex and the NIC, so upstream switches steer the VIP to this node’s MAC.') }),
      ],
    },
  ],
})

// ── Multus — the meta-CNI that splices the VM's tap0 into br-int ────────────
const multusGuestInternal = {
  bands: [
    {
      label: 'isolated netns · CLONE_NEWNET (launcher pod)',
      boxes: [
        box('multus-guest__tap0', 'tap0', 'netdev', {
          variant: 'iface', colorVar: 'k-purple', caption: 'QEMU virtio-net backend',
          detail: detail('VM NIC · TAP DEVICE', 'The VirtualMachineInstance’s NIC. QEMU/KVM drives tap0 with read(2)/write(2); it lives in the launcher’s isolated network namespace (CLONE_NEWNET).') }),
        box('multus-guest__delegate', 'ovn-k8s delegation', 'CNI', {
          colorVar: 'k-purple', caption: 'meta-CNI → OVN plugin',
          detail: detail('CNI DELEGATION', 'Multus delegates the primary attachment to ovn-k8s-cni-overlay, which plugs tap0’s host side into br-int as an OVS port.') }),
      ],
    },
  ],
}

// ── Konnectivity Server — the control tunnel endpoint ───────────────────────
const konnectivityServerInternal = {
  bands: [
    {
      label: 'guest control-plane namespace',
      boxes: [
        box('konnectivity-server__tunnel', 'gRPC tunnel endpoint', 'process', {
          variant: 'iface', colorVar: 'k-sky', caption: 'HTTP/2 · :8091',
          detail: detail('CONTROL TUNNEL · SERVER SIDE', 'Holds persistent HTTP/2 tunnels opened from the agents and proxies API-originated traffic (kubectl exec, metrics scrape) down them — so no host management port is ever exposed.') }),
      ],
    },
  ],
}

export const INTERNAL_TOPOLOGY = {
  'ovs-master': ovsInternal('ovs-master', 'systemd on the master node'),
  'ovs-host': ovsInternal('ovs-host', 'systemd on the worker node'),
  'ovs-guest': ovsInternal('ovs-guest', 'systemd inside the VM', { guest: true }),
  'ovn-control-mgmt': ovnControlPlaneInternal('ovn-control-mgmt', 'management cluster · on the master node'),
  'ovn-master-control': ovnControlPlaneInternal('ovn-master-control', 'guest control-plane namespace'),
  'ovn-node-master': ovnNodeInternal('ovn-node-master', 'master node'),
  'ovn-node-host': ovnNodeInternal('ovn-node-host', 'worker node'),
  'ovn-node-guest': ovnNodeInternal('ovn-node-guest', 'inside the VM'),
  'metallb-speaker-master': metallbSpeakerInternal('metallb-speaker-master'),
  'metallb-speaker-worker': metallbSpeakerInternal('metallb-speaker-worker'),
  'multus-guest': multusGuestInternal,
  'konnectivity-server': konnectivityServerInternal,
}

// ── Integration / topology edges ────────────────────────────────────────────
const edge = (from, to, label, accent, title, summary) => ({
  from, to, label, accent, step: '', solid: true, quiet: true,
  title, detail: summary ? detail('INTEGRATION', summary) : undefined,
})
// A "rail" edge is a long cross-column link that routes down the column's side
// gutter (orthogonal) instead of crashing diagonally through the boxes. It wires
// the two COMPONENT cards (not deep sub-boxes) so its stubs stay at the edge.
const railEdge = (from, to, label, accent, title, summary) => ({
  ...edge(from, to, label, accent, title, summary), rail: true,
})

// Intra-OVS wiring: the daemons program the datapath; the bridges patch together.
const ovsEdges = (ovsId) => [
  edge(`${ovsId}__vswitchd`, `${ovsId}__brint`, 'OpenFlow', 'k-amber',
    'ovs-vswitchd → br-int', 'ovs-vswitchd programs the kernel datapath flow cache on br-int from the OpenFlow it receives.'),
  edge(`${ovsId}__brint`, `${ovsId}__brex`, 'patch port', 'k-teal',
    'br-int ↔ br-ex', 'The patch-port pair splicing the integration bridge to the provider bridge.'),
]

// The realization chain INSIDE an ovnkube-node (node-local, stays in the card):
// K8s objects → this node's NB DB → northd → SB DB → ovn-controller.
const ovnNodeEdges = (nodeId) => [
  edge(`${nodeId}__kube`, `${nodeId}__nbdb`, 'writes NB rows', 'k-teal',
    'ovnkube-controller → nbdb', 'Translates Pods/Services/NetworkPolicies into rows in this node’s local Northbound DB.'),
  edge(`${nodeId}__nbdb`, `${nodeId}__northd`, 'NB rows', 'k-purple',
    'nbdb → northd', 'northd watches this node’s northbound rows.'),
  edge(`${nodeId}__northd`, `${nodeId}__sbdb`, 'logical flows', 'k-purple',
    'northd → sbdb', 'northd renders the rows into this node’s southbound logical flows.'),
  edge(`${nodeId}__sbdb`, `${nodeId}__controller`, 'SB flows', 'k-purple',
    'sbdb → ovn-controller', 'ovn-controller consumes this node’s SB flows.'),
]

// Cross-card links between an ovnkube-node and its OVS — these would thread
// through other boxes, so they route down the side rail (card-level anchors).
const ovnNodeToOvsEdges = (nodeId, ovsId) => [
  railEdge(nodeId, ovsId, 'db.sock', 'k-teal',
    'ovn-controller → ovs-vswitchd', 'ovn-controller compiles SB flows into OpenFlow and pushes them into ovs-vswitchd over /var/run/openvswitch/db.sock.'),
  railEdge(nodeId, ovsId, 'veth', 'k-blue',
    'CNI → br-int', 'The CNI plugin plugs each pod’s host-side veth into br-int as its logical switch port.'),
  railEdge(nodeId, ovsId, 'realized as', 'k-green',
    'NB-DB rows → br-int flows', 'This node’s own Load_Balancer / ACL rows are realized as DNAT / allow-drop OpenFlow on its br-int — declaration and datapath on the same node.'),
]

// The lightweight control plane hands each ovnkube-node its pod subnet.
const subnetEdge = (cpId, nodeId) =>
  railEdge(cpId, nodeId, 'pod subnet', 'k-sky',
    'ovnkube-control-plane → node', 'The cluster manager assigns this node its /23 pod subnet and interconnect config; the node’s own nbdb does the rest.')

const BASE_EDGES = [
  ...ovsEdges('ovs-master'),
  ...ovsEdges('ovs-host'),
  ...ovsEdges('ovs-guest'),
  ...ovnNodeEdges('ovn-node-master'),
  ...ovnNodeEdges('ovn-node-host'),
  ...ovnNodeEdges('ovn-node-guest'),
  // ── Cross-card links — routed down the side rail so they don't thread boxes ──
  ...ovnNodeToOvsEdges('ovn-node-master', 'ovs-master'),
  ...ovnNodeToOvsEdges('ovn-node-host', 'ovs-host'),
  ...ovnNodeToOvsEdges('ovn-node-guest', 'ovs-guest'),
  // Each cluster's lightweight control plane allocates its nodes' subnets:
  // the management ovnkube-control-plane for the bare-metal nodes, the guest's
  // (in the HCP namespace) for the VM.
  subnetEdge('ovn-control-mgmt', 'ovn-node-master'),
  subnetEdge('ovn-control-mgmt', 'ovn-node-host'),
  subnetEdge('ovn-master-control', 'ovn-node-guest'),
  // MetalLB L2: the elected speaker injects the VIP's GARP out br-ex.
  railEdge('metallb-speaker-master', 'ovs-master', 'GARP', 'k-orange',
    'MetalLB Speaker → br-ex', 'A Gratuitous ARP for the VIP, injected onto br-ex via a raw AF_PACKET socket, claiming the VIP for this node’s MAC.'),
  railEdge('metallb-speaker-worker', 'ovs-host', 'GARP', 'k-orange',
    'MetalLB Speaker → br-ex', 'The elected worker injects the VIP’s Gratuitous ARP onto br-ex.'),
  // The VM's tap0 is plugged into the guest br-int as an OVS port.
  railEdge('multus-guest', 'ovs-guest', 'tap0 → br-int', 'k-purple',
    'Multus → br-int', 'Multus delegates to ovn-k8s-cni, which plugs the VM’s tap0 into br-int — the VM joins the OVN logical network like any pod.'),
  // ── Long cross-column link — also down the side rail ─────────────────────
  railEdge('konnectivity-server', 'konnectivity-agent', 'control tunnel', 'k-sky',
    'Konnectivity Server → Agent', 'A persistent encrypted HTTP/2 tunnel opened by the agent up to the server; control traffic for the node rides back down it.'),
]

// Build the per-column edge list (one canvas-level overlay, idPrefix=''); each
// edge only draws when both endpoints are in the DOM (the owning cards expanded).
export const buildNetworkEdges = (pairs) =>
  pairs.flatMap((i) =>
    BASE_EDGES.map((e) => ({
      ...e,
      id: `nt-c${i}-${e.from}__${e.to}`,
      from: `nt-c${i}-${e.from}`,
      to: `nt-c${i}-${e.to}`,
    })),
  )
