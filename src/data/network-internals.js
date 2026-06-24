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
// `realized: true` marks a box as a realized datapath object a packet actually
// traverses (br-int / br-ex and the OpenFlow flows on them) — drawn solid + lit,
// vs the OVN logical objects which are "just rows" (drawn dashed/logical). See the
// "Network-mode internals" labeling rules in ARCHITECTURE.md.
const box = (id, title, typePrefix, { variant, colorVar = 'k-amber', caption, detail, children, realized } = {}) =>
  ({ id, title, typePrefix, variant, colorVar, caption, detail, children, realized })
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
      detail: detail('PATCH PORT', 'The internal patch port pair that splices br-int to br-ex, so logical traffic reaches the provider bridge and the wire.', [
        { heading: 'Interactions', bullets: [
          'Splices br-int to br-ex so logical traffic reaches the provider bridge.',
          'Carries the localnet on-ramp out toward the physical uplink.',
        ] },
      ]) }),
    port(`${ovsId}__geneve`, 'genev_sys :6081', { caption: 'inter-node overlay',
      detail: detail('GENEVE TUNNEL PORT', 'Wraps node-to-node pod traffic in Geneve UDP :6081 stamped with the destination logical port, shipped out br-ex to the peer node.', [
        { heading: 'Interactions', bullets: [
          'Encapsulates inter-node pod traffic in Geneve UDP :6081 to the peer node.',
          'Wraps each frame with the destination logical port metadata for OVN.',
          'Ships the tunnelled packet out br-ex toward the remote node’s zone.',
        ] },
      ]) }),
    port(`${ovsId}__veth`, 'pod veths', { caption: 'one per local pod',
      detail: detail('POD PORTS', 'Each local pod’s host-side veth is an OVS port on br-int — the CNI plugs it here and registers it as the pod’s logical switch port.', [
        { heading: 'Interactions', bullets: [
          'Attaches each local pod’s host-side veth as an OVS port on br-int.',
          'Registers the port as the pod’s logical switch port in OVN.',
          'Programmed by ovn-controller with the pod’s OpenFlow forwarding rules.',
        ] },
      ]) }),
  ]
  if (guest) {
    brintPorts.push(port(`${ovsId}__tap0`, 'tap0', { colorVar: 'k-purple', caption: 'the VM NIC',
      detail: detail('VM TAP PORT', 'The VirtualMachineInstance’s tap0, plugged into br-int by Multus/ovn-k8s-cni — so the VM lands on the same OVN logical network as a pod.', [
        { heading: 'Interactions', bullets: [
          'Attaches the VirtualMachineInstance’s tap0 to br-int as an OVS port.',
          'Programmed by Multus/ovn-k8s-cni so the VM joins the OVN logical network.',
          'Carries the VM’s NIC traffic onto the same data plane as any pod.',
        ] },
      ]) }))
  }
  // Services / NetworkPolicy have no datapath of their own — they're realized as
  // OpenFlow on br-int. Shown here (guest) as the flows they compile to; declared
  // as rows in the OVN-K8s Master NB DB (wired by a "realized as" edge).
  const brintFlows = guest ? [
    box(`${ovsId}__lbflows`, 'Service LB flows', 'OpenFlow', { colorVar: 'k-green', caption: 'ClusterIP → DNAT', realized: true,
      detail: detail('REALIZED · LOAD-BALANCER FLOWS', 'The ClusterIP Services compiled into OVN Load_Balancer flows on br-int: a single rule DNATs the virtual IP to a backing pod IP. No process, just flows.', [
        { heading: 'Interactions', bullets: [
          'DNATs each Service ClusterIP to a chosen backing pod IP on br-int.',
          'Compiled by ovn-controller from the Load_Balancer rows in the NB DB.',
          'Realises the Service load-balancing as OpenFlow with no process behind it.',
        ] },
      ]) }),
    box(`${ovsId}__aclflows`, 'NetworkPolicy ACLs', 'OpenFlow', { colorVar: 'k-green', caption: 'allow / drop', realized: true,
      detail: detail('REALIZED · ACL FLOWS', 'The NetworkPolicy compiled into OVN ACLs — allow/drop OpenFlow rules checked on the pod ports before the veth, dropping non-matching east-west traffic.', [
        { heading: 'Interactions', bullets: [
          'Enforces NetworkPolicy as allow/drop OpenFlow on the pod ports.',
          'Compiled by ovn-controller from the ACL rows in the NB DB.',
          'Drops non-matching east-west traffic before it reaches the veth.',
        ] },
      ]) }),
  ] : []

  return {
    bands: [
      {
        label: `user space · ${where}`,
        boxes: [
          box(`${ovsId}__ovsdb`, 'ovsdb-server', 'systemd', { caption: 'conf.db',
            detail: detail('OVS CONFIG DB · USER SPACE', 'Holds the switch’s own configuration — bridges, ports, interfaces — in conf.db and serves it over a Unix socket. Distinct from the OVN northbound DB of logical intent.', [
              { heading: 'Interactions', bullets: [
                'Holds the switch’s bridges, ports, and interfaces in conf.db.',
                'Serves that configuration to ovs-vswitchd over a Unix socket.',
                'Persists the OVS config locally, distinct from OVN’s logical intent.',
              ] },
            ]) }),
          box(`${ovsId}__vswitchd`, 'ovs-vswitchd', 'systemd', { caption: 'OpenFlow → datapath',
            detail: detail('OPENFLOW ENGINE · USER SPACE', 'The forwarding brain: receives OpenFlow (compiled by ovn-controller, pushed over /var/run/openvswitch/db.sock) and programs the kernel datapath flow cache so the fast path forwards without it.', [
              { heading: 'Interactions', bullets: [
                'Receives OpenFlow from ovn-controller over /var/run/openvswitch/db.sock.',
                'Programs the kernel datapath flow cache so the fast path forwards alone.',
                'Maintains the realized flows on br-int and br-ex.',
              ] },
            ]) }),
        ],
      },
      {
        label: 'kernel datapath · openvswitch.ko',
        boundary: 'kernel boundary',
        boxes: [
          box(`${ovsId}__brex`, 'br-ex', 'OVS bridge', {
            variant: 'bridge', colorVar: 'k-sky', caption: 'provider bridge', realized: true,
            detail: detail('EXTERNAL BRIDGE · ON-RAMP TO THE WIRE', 'The host IP moves onto br-ex and the NIC becomes its uplink, so OVN can splice logical traffic onto the L2 segment. Egress SNAT leaves here; MetalLB GARPs are injected here.', [
              { heading: 'Interactions', bullets: [
                'Enslaves the host NIC as its uplink onto the physical L2 segment.',
                'Holds the host IP so OVN can splice logical traffic onto the wire.',
                'SNATs egress traffic and carries MetalLB’s injected VIP GARPs.',
              ] },
            ]),
            children: [
              port(`${ovsId}__eth0`, 'eth0 (NIC)', { caption: 'uplink port',
                detail: detail('PHYSICAL NIC · UPLINK', 'The host’s physical interface, enslaved to br-ex as its uplink port — the on-ramp between the overlay and the physical wire.', [
                  { heading: 'Interactions', bullets: [
                    'Enslaved by br-ex as its single uplink port to the physical wire.',
                    'Carries all overlay egress and ingress between the node and the network.',
                  ] },
                ]) }),
            ],
          }),
          box(`${ovsId}__brint`, 'br-int', 'OVS bridge', {
            variant: 'bridge', colorVar: 'k-amber', caption: 'the data plane', realized: true,
            detail: detail('INTEGRATION BRIDGE · THE DATA PLANE', 'The punchline: every switch and router is just rows in OVN’s DB — br-int is the only thing that actually exists on the node. ovn-controller compiles the whole logical topology into OpenFlow here; one lookup does what the diagram draws as a multi-hop journey.', [
              { heading: 'Interactions', bullets: [
                'Holds the only real datapath on the node — every switch and router is a row.',
                'Programmed by ovn-controller with the whole logical topology as OpenFlow.',
                'Hosts the pod veths, the patch, the geneve port, and the realized flows.',
              ] },
            ]),
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
        box(`${prefix}__clustermgr`, 'cluster manager', 'process', {
          colorVar: 'k-sky', caption: 'allocates each node a /23',
          detail: detail('CLUSTER MANAGER · SUBNET ALLOCATION', 'The interconnect control plane is lightweight: it carves the cluster pod CIDR into a per-node /23 and hands each ovnkube-node its slice. It does NOT hold the cluster NB/SB DB — that lives on each node.', [
            { heading: 'Interactions', bullets: [
              'Carves the cluster pod CIDR into a per-node /23 subnet.',
              'Hands each ovnkube-node its slice and interconnect config.',
              'Keeps no central NB/SB DB — that lives on each node.',
            ] },
          ]) }),
        box(`${prefix}__ic`, 'interconnect coordinator', 'process', {
          colorVar: 'k-sky', caption: 'stitches the per-node zones',
          detail: detail('INTERCONNECT COORDINATOR', 'Each node is its own OVN "zone". This coordinates the transit switch / remote-port info so the zones interconnect, without a central database every node must reach.', [
            { heading: 'Interactions', bullets: [
              'Coordinates the transit-switch and remote-port info across the zones.',
              'Wires each node’s OVN zone to the others without a shared central DB.',
              'Maintains the interconnect so cross-node traffic routes zone-to-zone.',
            ] },
          ]) }),
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
          detail: detail('OVNKUBE-CONTROLLER', 'Watches Pods / Services / NetworkPolicies on the API server and writes the matching rows into THIS node’s local Northbound DB.', [
            { heading: 'Interactions', bullets: [
              'Watches Pods, Services, and NetworkPolicies on the API server.',
              'Writes the matching logical rows into this node’s local Northbound DB.',
              'Translates Kubernetes intent into OVN’s northbound logical topology.',
            ] },
          ]) }),
        box(`${nodeId}__nbdb`, 'Northbound DB', 'OVSDB', {
          variant: 'bridge', colorVar: 'k-purple', caption: 'node-local · this zone',
          detail: detail('NODE-LOCAL NORTHBOUND DB', 'In interconnect mode every node runs its own nbdb. Its rows describe this node’s zone — the cluster router, the join switch, this node’s logical switch, a transit switch to the other zones, and the cluster-scoped Load_Balancer / ACL rows it needs.', [
            { heading: 'Interactions', bullets: [
              'Holds the logical rows describing this node’s own OVN zone.',
              'Provides the cluster router, join, logical, and transit switches as rows.',
              'Read by northd, which renders the rows into this node’s southbound DB.',
            ] },
          ]),
          children: [
            box(`${nodeId}__router`, 'ovn_cluster_router', 'OVN Cluster Router', {
              variant: 'ellipse', colorVar: 'k-green', caption: '100.64.0.1 · distributed',
              detail: detail('DISTRIBUTED LOGICAL ROUTER · A ROW', 'A row in every node’s local nbdb; ovn-controller instantiates it as OpenFlow in this node’s br-int, so routing happens on the source node.', [
                { heading: 'Interactions', bullets: [
                  'Routes pod traffic between the node logical switches and the gateway.',
                  'Programmed by ovn-controller as OpenFlow on this node’s br-int.',
                  'Realises distributed routing so each source node routes locally.',
                ] },
              ]) }),
            box(`${nodeId}__join`, 'LS "join"', 'Logical Switch', {
              variant: 'switch', colorVar: 'k-sky', caption: '100.64.0.0/16',
              detail: detail('ROUTER INTERCONNECT · A ROW', 'Wires the distributed cluster router to the node’s gateway router. Router ports only — no pod lives here.', [
                { heading: 'Interactions', bullets: [
                  'Wires the distributed cluster router to the node’s gateway router.',
                  'Holds router ports only — no pod logical port lives here.',
                  'Carries north-south traffic between the cluster router and gateway.',
                ] },
              ]) }),
            box(`${nodeId}__ls`, 'LS (this node)', 'Logical Switch', {
              variant: 'switch', colorVar: 'k-sky', caption: 'this node’s pod subnet',
              detail: detail('NODE LOGICAL SWITCH · A ROW', 'Owns this node’s /23 pod subnet; the local pods’ logical ports hang off it.', [
                { heading: 'Interactions', bullets: [
                  'Holds this node’s /23 pod subnet as its logical L2 domain.',
                  'Hosts the local pods’ logical switch ports off this switch.',
                  'Attaches to the cluster router for north-south egress.',
                ] },
              ]) }),
            box(`${nodeId}__gr`, 'gateway router', 'OVN Gateway Router', {
              variant: 'ellipse', colorVar: 'k-green', caption: 'GR_<node> · N-S edge',
              detail: detail('GATEWAY ROUTER · A ROW', 'The node’s north-south edge router: a row in this node’s nbdb, bound to this node (centralized on its chassis). SNAT for egress and the DNAT landing for ingress happen here; ovn-controller realizes it as OpenFlow on this node’s br-int / br-ex.', [
                { heading: 'Interactions', bullets: [
                  'Pins the node’s north-south gateway to this chassis.',
                  'SNATs egress and terminates ingress DNAT for the node.',
                  'Realised by ovn-controller as OpenFlow across br-int and br-ex.',
                ] },
              ]) }),
            box(`${nodeId}__ext`, 'external switch', 'Logical Switch', {
              variant: 'switch', colorVar: 'k-sky', caption: 'ext_<node> · localnet → br-ex',
              detail: detail('EXTERNAL SWITCH · A ROW', 'A logical switch with a localnet port that maps onto br-ex, joining the gateway router to the physical L2 segment. A row in the nbdb; realized as the localnet/patch flows on this node’s br-int ↔ br-ex.', [
                { heading: 'Interactions', bullets: [
                  'Bridges the gateway router onto the physical network via a localnet port.',
                  'Maps to br-ex so OVN can place logical traffic on the wire.',
                  'Realised as the localnet/patch flows between br-int and br-ex.',
                ] },
              ]) }),
            box(`${nodeId}__transit`, 'transit switch', 'Logical Switch', {
              variant: 'switch', colorVar: 'k-teal', caption: 'IC · to the other zones',
              detail: detail('TRANSIT SWITCH · INTERCONNECT', 'The interconnect construct: a logical switch with a remote port for every other node’s zone, so cross-node traffic is routed zone-to-zone over Geneve without a shared central DB.', [
                { heading: 'Interactions', bullets: [
                  'Holds a remote port for every other node’s OVN zone.',
                  'Routes cross-node traffic zone-to-zone over Geneve tunnels.',
                  'Maintains the interconnect mesh without a shared central DB.',
                ] },
              ]) }),
            box(`${nodeId}__lb`, 'Load_Balancer rows', 'OVN LB', {
              variant: 'switch', colorVar: 'k-green', caption: 'ClusterIP Services',
              detail: detail('SERVICE DECLARATION · LOAD_BALANCER ROWS', 'Each Service is a Load_Balancer row (replicated into every node’s nbdb). No datapath of its own — realized as DNAT flows on this node’s br-int.', [
                { heading: 'Interactions', bullets: [
                  'Holds each ClusterIP Service as a Load_Balancer row in the nbdb.',
                  'Replicates the row into every node’s northbound DB.',
                  'Realised as DNAT OpenFlow on this node’s br-int by ovn-controller.',
                ] },
              ]) }),
            box(`${nodeId}__acl`, 'ACL rows', 'OVN ACL', {
              variant: 'switch', colorVar: 'k-green', caption: 'NetworkPolicy',
              detail: detail('NETWORKPOLICY DECLARATION · ACL ROWS', 'NetworkPolicy compiles to ACL rows + address sets, realized as allow/drop OpenFlow on this node’s br-int.', [
                { heading: 'Interactions', bullets: [
                  'Holds each NetworkPolicy as ACL rows plus address sets in the nbdb.',
                  'Compiled by northd into southbound logical ACL flows.',
                  'Realised as allow/drop OpenFlow on this node’s br-int.',
                ] },
              ]) }),
          ],
        }),
        box(`${nodeId}__northd`, 'ovn-northd', 'container', {
          colorVar: 'k-purple', caption: 'NB → SB',
          detail: detail('NORTHD · TRANSLATOR', 'Renders this node’s NB DB rows into concrete logical flows in its local SB DB.', [
            { heading: 'Interactions', bullets: [
              'Watches this node’s northbound DB rows for changes.',
              'Translates the logical topology into concrete southbound logical flows.',
              'Writes the rendered flows into this node’s local SB DB.',
            ] },
          ]) }),
        box(`${nodeId}__sbdb`, 'Southbound DB', 'OVSDB', {
          variant: 'bridge', colorVar: 'k-purple', caption: 'node-local logical flows',
          detail: detail('NODE-LOCAL SOUTHBOUND DB', 'The logical flows northd produced for this zone; ovn-controller watches it and compiles them into OpenFlow on the local br-int.', [
            { heading: 'Interactions', bullets: [
              'Holds the logical flows northd produced for this node’s zone.',
              'Compiled by northd from the northbound rows.',
              'Read by ovn-controller to compile OpenFlow onto the local br-int.',
            ] },
          ]) }),
        box(`${nodeId}__controller`, 'ovn-controller', 'container', {
          colorVar: 'k-teal', caption: 'SB → OpenFlow',
          detail: detail('OVN-CONTROLLER', 'Watches the local SB DB and compiles its flows into OpenFlow on the local br-int, pushed over /var/run/openvswitch/db.sock.', [
            { heading: 'Interactions', bullets: [
              'Watches the local southbound DB for logical flow changes.',
              'Compiles those logical flows into OpenFlow for the local br-int.',
              'Pushes the OpenFlow to ovs-vswitchd over /var/run/openvswitch/db.sock.',
            ] },
          ]) }),
        box(`${nodeId}__cni`, 'ovn-k8s-cni-overlay', 'CNI', {
          colorVar: 'k-blue', caption: 'pod veth → br-int',
          detail: detail('CNI PLUGIN', 'Invoked per pod by the kubelet/CRI-O: creates the veth pair and plugs the host end into br-int as the pod’s logical switch port.', [
            { heading: 'Interactions', bullets: [
              'Invoked by the kubelet/CRI-O once per pod sandbox.',
              'Creates the veth pair for the pod’s network namespace.',
              'Attaches the host-side veth to br-int as the pod’s logical switch port.',
            ] },
          ]) }),
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
          detail: detail('L2 LEADER ELECTION', 'Speakers gossip over memberlist and elect one node as the L2 leader for each LoadBalancer VIP, so only one node answers for it.', [
            { heading: 'Interactions', bullets: [
              'Elects one node as the L2 leader for each LoadBalancer VIP.',
              'Coordinates that election by gossiping over memberlist.',
              'Keeps a single node answering for the VIP to avoid ARP conflicts.',
            ] },
          ]) }),
        box(`${id}__rawsock`, 'AF_PACKET raw socket', 'syscall', {
          variant: 'socket', colorVar: 'k-orange', caption: 'socket(AF_PACKET, SOCK_RAW)',
          detail: detail('GRATUITOUS ARP INJECTION', 'When this node owns a VIP, the speaker bypasses the host IP stack and pushes a Gratuitous ARP for the VIP out br-ex and the NIC, so upstream switches steer the VIP to this node’s MAC.', [
            { heading: 'Interactions', bullets: [
              'Injects a Gratuitous ARP for the owned VIP out br-ex and the NIC.',
              'Sends the frame via a raw AF_PACKET socket, bypassing the host IP stack.',
              'Advertises the VIP to this node’s MAC so upstream switches steer to it.',
            ] },
          ]) }),
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
          detail: detail('VM NIC · TAP DEVICE', 'The VirtualMachineInstance’s NIC. QEMU/KVM drives tap0 with read(2)/write(2); it lives in the launcher’s isolated network namespace (CLONE_NEWNET).', [
            { heading: 'Interactions', bullets: [
              'Backs the VirtualMachineInstance’s virtio-net NIC as a tap device.',
              'Carries VM frames to QEMU/KVM via read(2)/write(2).',
              'Isolated inside the launcher pod’s network namespace (CLONE_NEWNET).',
            ] },
          ]) }),
        box('multus-guest__delegate', 'ovn-k8s delegation', 'CNI', {
          colorVar: 'k-purple', caption: 'meta-CNI → OVN plugin',
          detail: detail('CNI DELEGATION', 'Multus delegates the primary attachment to ovn-k8s-cni-overlay, which plugs tap0’s host side into br-int as an OVS port.', [
            { heading: 'Interactions', bullets: [
              'Delegates the primary attachment to the ovn-k8s-cni-overlay plugin.',
              'Attaches tap0’s host side to br-int as an OVS port via that plugin.',
              'Wires the VM onto the OVN logical network like any pod.',
            ] },
          ]) }),
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
          variant: 'tunnel', colorVar: 'k-sky', caption: 'HTTP/2 · :8091',
          detail: detail('CONTROL TUNNEL · SERVER SIDE', 'Holds persistent HTTP/2 tunnels opened from the agents and proxies API-originated traffic (kubectl exec, metrics scrape) down them — so no host management port is ever exposed.', [
            { heading: 'Interactions', bullets: [
              'Holds the persistent HTTP/2 tunnels opened from the node agents.',
              'Proxies API-originated traffic like kubectl exec and metrics scrapes down them.',
              'Keeps the node reachable without exposing any host management port.',
            ] },
          ]) }),
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
  title, detail: summary
    ? detail('INTEGRATION', summary, [{ heading: 'Interactions', bullets: [summary] }])
    : undefined,
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
// through other boxes, so they route down the side rail (interface-level anchors:
// each link leaves the actual interface/daemon it flows through, not the card —
// ovn-controller's db.sock, the CNI's veth, the NB DB rows realized on br-int).
const ovnNodeToOvsEdges = (nodeId, ovsId) => [
  railEdge(`${nodeId}__controller`, `${ovsId}__vswitchd`, 'db.sock', 'k-teal',
    'ovn-controller → ovs-vswitchd', 'ovn-controller compiles SB flows into OpenFlow and pushes them into ovs-vswitchd over /var/run/openvswitch/db.sock.'),
  railEdge(`${nodeId}__cni`, `${ovsId}__veth`, 'veth', 'k-blue',
    'CNI → br-int', 'The CNI plugin plugs each pod’s host-side veth into br-int as its logical switch port.'),
  railEdge(`${nodeId}__nbdb`, `${ovsId}__brint`, 'realized as', 'k-green',
    'NB-DB rows → br-int flows', 'This node’s own Load_Balancer / ACL rows are realized as DNAT / allow-drop OpenFlow on its br-int — declaration and datapath on the same node.'),
]

// The lightweight control plane hands each ovnkube-node its pod subnet — written
// into the node's own Northbound DB.
const subnetEdge = (cpId, nodeId) =>
  railEdge(`${cpId}__clustermgr`, `${nodeId}__nbdb`, 'pod subnet', 'k-sky',
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
  // MetalLB L2: the elected speaker injects the VIP's GARP out br-ex — from the
  // raw AF_PACKET socket onto the provider bridge.
  railEdge('metallb-speaker-master__rawsock', 'ovs-master__brex', 'GARP', 'k-orange',
    'MetalLB Speaker → br-ex', 'A Gratuitous ARP for the VIP, injected onto br-ex via a raw AF_PACKET socket, claiming the VIP for this node’s MAC.'),
  railEdge('metallb-speaker-worker__rawsock', 'ovs-host__brex', 'GARP', 'k-orange',
    'MetalLB Speaker → br-ex', 'The elected worker injects the VIP’s Gratuitous ARP onto br-ex.'),
  // The VM's tap0 is plugged into the guest br-int as an OVS port (tap0 → tap0).
  railEdge('multus-guest__tap0', 'ovs-guest__tap0', 'tap0 → br-int', 'k-purple',
    'Multus → br-int', 'Multus delegates to ovn-k8s-cni, which plugs the VM’s tap0 into br-int — the VM joins the OVN logical network like any pod.'),
  // ── Long cross-column link — also down the side rail ─────────────────────
  railEdge('konnectivity-server__tunnel', 'konnectivity-agent', 'control tunnel', 'k-sky',
    'Konnectivity Server → Agent', 'A persistent encrypted HTTP/2 tunnel opened by the agent up to the server; control traffic for the node rides back down it.'),
  // ── Control plane → data plane: the operators that PROGRAM the SDN ─────────
  // These operators don't move packets and don't drill to a kernel datapath —
  // they render config / deploy the components that do. Drawn as "configures"
  // rail edges so they read as the control plane UPSTREAM of the data path, not
  // as datapath boxes (see the network-internals labeling rule in ARCHITECTURE.md).
  railEdge('cluster-network-operator', 'ovn-master-control', 'configures', 'k-purple',
    'Cluster Network Operator → OVN-K control plane', 'CNO reads the Network CR and renders the guest OVN-Kubernetes control-plane Deployment + node DaemonSet manifests; the OVN control plane it deploys runs here in the HCP namespace.'),
  railEdge('ingress-operator', 'openshift-ingress-router-guest', 'configures', 'k-purple',
    'Ingress Operator → router-default', 'The Ingress Operator reconciles the default IngressController and creates the router-default Deployment that runs as the OpenShift router inside the guest VMs.'),
  railEdge('dns-operator', 'coredns-node', 'configures', 'k-purple',
    'DNS Operator → CoreDNS', 'The DNS Operator reconciles the DNS CR and deploys the CoreDNS (dns-default) DaemonSet onto the guest worker nodes.'),
  railEdge('cloud-controller-manager', 'openshift-ingress-router-guest', 'NodePort path', 'k-purple',
    'Cloud Controller Manager → router (NodePort)', 'The guest router-default is published as a NodePort on the worker VMs — there is no in-guest LoadBalancer. The infra-side Apps Ingress LoadBalancer (a LoadBalancer Service on the management cluster, VIP advertised by MetalLB) forwards to that NodePort; the kubevirt cloud provider supplies the guest node addresses it targets. The control-plane API path uses the Shared Ingress Proxy instead.'),
  railEdge('metallb-controller', 'metallb-speaker-master', 'assigns VIP', 'k-orange',
    'MetalLB Controller → Speaker', 'The controller allocates each LoadBalancer Service a VIP from the IPAddressPool and writes it back to the Service; the elected speaker then announces that VIP with a Gratuitous ARP.'),
  railEdge('metallb-controller', 'metallb-speaker-worker', 'assigns VIP', 'k-orange',
    'MetalLB Controller → Speaker', 'The controller allocates each LoadBalancer Service a VIP from the IPAddressPool; the elected worker speaker announces it.'),
]

// Build the per-column edge list (one canvas-level overlay, idPrefix=''); each
// edge only draws when both endpoints are in the DOM (the owning cards expanded).
// The id carries the source index `j` because several edges share the same
// from/to pair (the OVN-K8s Node → OVS rail carries db.sock + veth + realized-as);
// without it those siblings would collide on their React key in the overlay.
export const buildNetworkEdges = (pairs) =>
  pairs.flatMap((i) =>
    BASE_EDGES.map((e, j) => ({
      ...e,
      id: `nt-c${i}-${e.from}__${e.to}__${j}`,
      from: `nt-c${i}-${e.from}`,
      to: `nt-c${i}-${e.to}`,
    })),
  )
