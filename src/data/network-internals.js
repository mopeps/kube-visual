// ── Network-mode component internals (the "open the box" topology) ──────────
// In Network mode each drillable OpenShift component box opens to reveal its own
// Linux primitives + integrations *inside its own card* (never as a zone). This
// module supplies, per componentId:
//   INTERNAL_TOPOLOGY[id] = { bands: [{ label, boundary?, boxes: [box…] }] }
// where a box is the deep-dive shape { id, title, typePrefix, variant, colorVar,
// caption, detail }. Sub-box ids are globally unique (`<componentId>__<local>`)
// so the canvas-level edge overlay can wire them; OverviewTab namespaces them per
// column (`nt-c{N}-…`) at render time.
//
// EDGES are the integrations between boxes (a component card or a sub-box). They
// answer "how is this abstraction implemented / where does it cross a boundary":
// OVN-K8s Node → ovs-vswitchd over db.sock; MetalLB Speaker → br-ex as a raw
// GARP; the VM's tap0 → br-int via Multus; Konnectivity Server → Agent tunnel.

// — small helpers ————————————————————————————————————————————————————————————
const box = (id, title, typePrefix, { variant, colorVar = 'k-amber', caption, detail } = {}) =>
  ({ id, title, typePrefix, variant, colorVar, caption, detail })

const detail = (role, summary, sections = []) => ({ role, summary, sections })
const tags = (...t) => ({ heading: 'At a glance', tags: t })
const facts = (...f) => ({ heading: 'Facts', facts: f })
const explore = (...c) => ({ heading: 'Explore', commands: c })

// ── Open vSwitch — the same box on master, worker and in the guest VM ────────
// Partitioned into user-space daemons over the kernel datapath (openvswitch.ko),
// the only thing on the node that actually forwards a packet.
const ovsInternal = (ovsId, where) => ({
  bands: [
    {
      label: `user space · ${where}`,
      boxes: [
        box(`${ovsId}__ovsdb`, 'ovsdb-server', 'systemd', {
          colorVar: 'k-amber', caption: 'conf.db (OVSDB schema)',
          detail: detail(
            'OVS CONFIG DB · USER SPACE',
            'Holds the switch’s own configuration — bridges, ports, interfaces — in conf.db, and serves it over a Unix socket. It is the database of what OVS itself is wired like, distinct from the OVN northbound DB of logical intent.',
            [tags('conf.db', 'local schema', 'Unix socket'),
             explore('systemctl status ovsdb-server', 'ovs-vsctl show')],
          ),
        }),
        box(`${ovsId}__vswitchd`, 'ovs-vswitchd', 'systemd', {
          colorVar: 'k-amber', caption: 'OpenFlow → datapath',
          detail: detail(
            'OPENFLOW ENGINE · USER SPACE',
            'The forwarding brain. It receives OpenFlow rules (compiled by ovn-controller from the OVN southbound DB, pushed in over /var/run/openvswitch/db.sock) and programs the kernel datapath flow cache so the fast path can forward without it.',
            [tags('OpenFlow 1.3', 'programs openvswitch.ko', 'db.sock from ovn-controller'),
             explore('ovs-ofctl dump-flows br-int | head', 'ovs-appctl ofproto/trace br-int in_port=…')],
          ),
        }),
      ],
    },
    {
      label: 'kernel datapath · openvswitch.ko',
      boundary: 'kernel boundary',
      boxes: [
        box(`${ovsId}__brint`, 'br-int', 'OVS bridge', {
          variant: 'bridge', colorVar: 'k-amber', caption: 'every pod veth / tap / patch',
          detail: detail(
            'INTEGRATION BRIDGE · THE DATA PLANE',
            'The punchline: every logical switch and router is just rows in OVN’s DB — br-int is the only thing that actually exists on the node. ovn-controller compiles the whole logical topology into OpenFlow here, and one rule lookup does what the diagram draws as a multi-hop journey. Owns the pod veths, the tap0 of any local VM, the Geneve tunnel port and the patch to br-ex.',
            [tags('the only real object', 'OpenFlow rules', 'one lookup = whole journey'),
             explore('ovs-vsctl list-ports br-int', 'ovs-ofctl dump-flows br-int | head -40')],
          ),
        }),
        box(`${ovsId}__brex`, 'br-ex', 'OVS bridge', {
          variant: 'bridge', colorVar: 'k-sky', caption: 'uplink to the host NIC',
          detail: detail(
            'EXTERNAL BRIDGE · ON-RAMP TO THE WIRE',
            'The provider bridge. The host IP moves onto br-ex and the physical NIC becomes its uplink port, so OVN can splice logical traffic onto the L2 segment — egress SNAT leaves here, and MetalLB’s gratuitous ARPs are injected straight onto it.',
            [tags('enslaves the NIC', 'localnet on-ramp', 'GARP injection point'),
             explore('ip addr show br-ex', 'ovs-vsctl list-ports br-ex')],
          ),
        }),
        box(`${ovsId}__geneve`, 'genev_sys :6081', 'tunnel', {
          variant: 'iface', colorVar: 'k-teal', caption: 'inter-node pod traffic',
          detail: detail(
            'GENEVE TUNNEL PORT',
            'Carries node-to-node pod traffic. When br-int routes a packet to a pod on another node, the datapath wraps it in a Geneve UDP :6081 envelope stamped with the destination’s logical port, and ships it out br-ex to the peer node.',
            [tags('UDP :6081', 'encapsulation', 'overlay → underlay'),
             explore('tcpdump -ni br-ex udp port 6081')],
          ),
        }),
      ],
    },
  ],
})

// ── OVN-K8s Master — the logical objects live here, as DB rows ──────────────
const ovnMasterInternal = {
  bands: [
    {
      label: 'OVN Northbound DB · rows, not devices',
      boxes: [
        box('ovn-master-control__router', 'ovn_cluster_router', 'OVN Cluster Router', {
          variant: 'ellipse', colorVar: 'k-green', caption: '100.64.0.1 · distributed',
          detail: detail(
            'DISTRIBUTED LOGICAL ROUTER · A DB ROW',
            'ovn_cluster_router is the router every pod subnet hangs off — but it is not a device anywhere. It is a row in this northbound DB; every node’s ovn-controller instantiates it locally as OpenFlow in br-int, so routing happens on the source node and the packet crosses the underlay already addressed to its destination.',
            [tags('distributed', 'runs nowhere', 'realized as OpenFlow in br-int'),
             facts({ k: 'port to join', v: 'rtoj · 100.64.0.1/16' }),
             explore('ovn-nbctl lr-route-list ovn_cluster_router')],
          ),
        }),
        box('ovn-master-control__join', 'LS "join"', 'Logical Switch', {
          variant: 'switch', colorVar: 'k-sky', caption: '100.64.0.0/16 · router ports only',
          detail: detail(
            'ROUTER INTERCONNECT · A DB ROW',
            'OVN routers can’t peer directly, so the join switch — a stub on 100.64.0.0/16 — wires the distributed cluster router to every per-node gateway router. No pod ever lives here; its addresses are router ports only.',
            [tags('100.64.0.0/16', 'router ports only', 'one per cluster'),
             explore('ovn-nbctl lsp-list join')],
          ),
        }),
        box('ovn-master-control__sbdb', 'Southbound DB', 'OVSDB', {
          colorVar: 'k-purple', caption: 'logical flows · read by every node',
          detail: detail(
            'SOUTHBOUND DB',
            'northd translates the NB DB rows above into logical flows in the SB DB; each node’s ovn-controller watches it and compiles those flows into OpenFlow on its local br-int.',
            [tags('logical flows', 'northd output', 'consumed by ovn-controller'),
             explore('ovn-sbctl lflow-list | head -30')],
          ),
        }),
      ],
    },
  ],
}

// ── MetalLB Speaker — L2 mode: a raw GARP out br-ex ─────────────────────────
const metallbSpeakerInternal = (where) => ({
  bands: [
    {
      label: `host netns · ${where}`,
      boxes: [
        box(`${where}__memberlist`, 'memberlist gossip', 'process', {
          colorVar: 'k-orange', caption: 'leader election per VIP',
          detail: detail(
            'L2 LEADER ELECTION',
            'Speakers gossip over a memberlist protocol and elect exactly one node as the L2 leader for each LoadBalancer VIP, so only one node ever answers for it.',
            [tags('one leader per VIP', 'gossip', 'no BGP in L2 mode')],
          ),
        }),
        box(`${where}__rawsock`, 'AF_PACKET raw socket', 'syscall', {
          variant: 'iface', colorVar: 'k-orange', caption: 'socket(AF_PACKET, SOCK_RAW)',
          detail: detail(
            'GRATUITOUS ARP INJECTION',
            'When this node owns a VIP, the speaker bypasses the host IP stack: it opens socket(AF_PACKET, SOCK_RAW) and pushes a Gratuitous ARP for the VIP straight out br-ex and the physical NIC, so upstream top-of-rack switches update their CAM tables to steer that VIP to this node’s MAC.',
            [tags('raw L2 frame', 'maps VIP → node MAC', 'out via br-ex'),
             explore('tcpdump -ni br-ex arp')],
          ),
        }),
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
          detail: detail(
            'VM NIC · TAP DEVICE',
            'The virtual NIC of the VirtualMachineInstance. QEMU/KVM in the virt-launcher pod drives tap0 with read(2)/write(2); it sits inside the launcher’s isolated network namespace (CLONE_NEWNET).',
            [tags('tap device', 'QEMU file descriptor', 'in the launcher netns'),
             explore('nsenter -t $(pgrep -f qemu) -n ip link show tap0')],
          ),
        }),
        box('multus-guest__delegate', 'ovn-k8s delegation', 'CNI', {
          colorVar: 'k-purple', caption: 'meta-CNI → OVN plugin',
          detail: detail(
            'CNI DELEGATION',
            'Multus is a meta-CNI: it reads the pod’s networks and delegates the primary attachment to ovn-k8s-cni-overlay, which plugs tap0’s host side into br-int as an OVS port — so the VM lands on the very same OVN logical network as a normal pod.',
            [tags('delegates to OVN', 'tap0 → br-int OVS port', 'net-attach-def for extras')],
          ),
        }),
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
          detail: detail(
            'CONTROL TUNNEL · SERVER SIDE',
            'The control plane can’t reach worker endpoints directly. The Konnectivity Server holds persistent HTTP/2 tunnels opened from the agents, and proxies API-originated traffic (kubectl exec, metrics scrape) down them — so no host management port is ever exposed.',
            [tags('reverse tunnel', 'API → kubelet', 'agent-initiated'),
             explore('oc -n <hcp-ns> logs deploy/konnectivity-server')],
          ),
        }),
      ],
    },
  ],
}

export const INTERNAL_TOPOLOGY = {
  'ovs-master': ovsInternal('ovs-master', 'systemd on the master node'),
  'ovs-host': ovsInternal('ovs-host', 'systemd on the worker node'),
  'ovs-guest': ovsInternal('ovs-guest', 'systemd inside the VM'),
  'ovn-master-control': ovnMasterInternal,
  'metallb-speaker-master': metallbSpeakerInternal('metallb-speaker-master'),
  'metallb-speaker-worker': metallbSpeakerInternal('metallb-speaker-worker'),
  'multus-guest': multusGuestInternal,
  'konnectivity-server': konnectivityServerInternal,
}

// ── Integration edges (the "how it crosses a boundary" wiring) ──────────────
const edge = (from, to, label, accent, title, summary) => ({
  from, to, label, accent, step: '', solid: true, quiet: true,
  title, detail: summary ? detail('INTEGRATION', summary) : undefined,
})

const BASE_EDGES = [
  edge('ovn-node-master', 'ovs-master__vswitchd', 'db.sock', 'k-teal',
    'OVN-K8s Node → ovs-vswitchd',
    'ovn-controller compiles the OVN southbound flows into OpenFlow and pushes them into ovs-vswitchd over /var/run/openvswitch/db.sock — this is where logical intent becomes a real forwarding rule.'),
  edge('ovn-node-host', 'ovs-host__vswitchd', 'db.sock', 'k-teal',
    'OVN-K8s Node → ovs-vswitchd', 'Same compilation step on the worker node.'),
  edge('ovn-node-guest', 'ovs-guest__vswitchd', 'db.sock', 'k-teal',
    'OVN-K8s Node → ovs-vswitchd', 'Same compilation step, inside the guest VM.'),
  edge('metallb-speaker-master', 'ovs-master__brex', 'GARP', 'k-orange',
    'MetalLB Speaker → br-ex',
    'In L2 mode the speaker injects a Gratuitous ARP for the VIP straight onto br-ex (via a raw AF_PACKET socket), claiming the VIP for this node’s MAC.'),
  edge('metallb-speaker-worker', 'ovs-host__brex', 'GARP', 'k-orange',
    'MetalLB Speaker → br-ex', 'The elected worker injects the VIP’s Gratuitous ARP onto br-ex.'),
  edge('multus-guest', 'ovs-guest__brint', 'tap0 → br-int', 'k-purple',
    'Multus → br-int',
    'Multus delegates to ovn-k8s-cni, which plugs the VM’s tap0 into br-int as an OVS port — the VM joins the OVN logical network like any pod.'),
  edge('konnectivity-server', 'konnectivity-agent', 'control tunnel', 'k-sky',
    'Konnectivity Server → Agent',
    'A persistent encrypted HTTP/2 tunnel, opened by the agent in the VM up to the server in the control-plane namespace; control traffic for the node rides back down it.'),
  edge('ovn-master-control', 'ovn-node-master', 'NB → SB → node', 'k-green',
    'OVN-K8s Master → OVN-K8s Node',
    'The master writes logical intent into the NB DB; northd renders it to the SB DB; every node’s ovn-controller reads it and realizes it locally.'),
]

// Build the per-column edge list: every base edge, namespaced for each pair so
// the three columns never collide. Rendered by one canvas-level ReconLoopOverlay
// (idPrefix=''); an edge only draws when both endpoints are in the DOM (i.e. the
// owning boxes are present / expanded).
export const buildNetworkEdges = (pairs) =>
  pairs.flatMap((i) =>
    BASE_EDGES.map((e) => ({
      ...e,
      id: `nt-c${i}-${e.from}__${e.to}`,
      from: `nt-c${i}-${e.from}`,
      to: `nt-c${i}-${e.to}`,
    })),
  )
