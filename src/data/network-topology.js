// ── The Overview's network overlay ──────────────────────────────────────────
// Draws the OVN *logical* topology over the real components that realize it,
// so the link between "LS / GR / router" boxes in diagrams and actual
// OpenShift objects is visible. Two SDN layers exist in an HCP cluster and
// most packets traverse both, so the overlay models both and a layer switch
// only DIMS the non-focused one:
//
//   mgmt  — the management cluster's OVN, between the bare-metal nodes
//           (realized by ovs-master / ovs-host + the ovnkube node agents)
//   guest — the hosted cluster's OVN: control plane as Pods in the HCP
//           namespace (ovn-master-control), data plane inside each VM
//           (ovs-guest) — its "nodes" are the KubeVirt VMs
//
// chips  — synthetic logical objects, absolutely positioned over the canvas,
//          anchored to a real component's card: { to, at, dx, dy } where `at`
//          picks a point on the anchor's rect (above/below/left/right/center)
//          and the chip centres on that point + offsets.
// edges  — always-on labeled links (ReconLoopOverlay shape, idPrefix '') whose
//          from/to are raw DOM ids: chips and real components alike.
// trace  — a numbered cross-layer packet walk (guest pod → guest pod on
//          another node), toggled separately; every chip is clickable for the
//          hop's narration.

const NOTE_MGMT =
  '# On a bare-metal node, via the mgmt cluster’s ovnkube pods:\n' +
  '#   oc -n openshift-ovn-kubernetes exec <ovnkube-node-…> -c nbdb -- ovn-nbctl …'
const NOTE_GUEST =
  '# The guest’s NB DB lives in the HCP namespace on the *management* cluster:\n' +
  '#   oc -n clusters-<guest> exec <ovnkube-master-…> -c nbdb -- ovn-nbctl …'

export const NET_LAYERS = [
  { id: 'mgmt', label: 'Management SDN', accentVar: 'k-orange' },
  { id: 'guest', label: 'Guest SDN', accentVar: 'k-purple' },
]

// Real components that participate in the network story — they keep full
// opacity while the overlay dims the rest of the canvas into background.
export const NET_PARTICIPANTS = new Set([
  'ovs-master', 'ovn-node-master',
  'ovs-host', 'ovn-node-host',
  'ovs-guest', 'ovn-node-guest',
  'ovn-master-control',
  'frontend-application-pod', 'backend-application-pod',
])

export const NET_CHIPS = [
  // ── Management SDN: logical core parked in the empty band of the master
  //    replica strip (between the two detailed node zones) ──
  {
    id: 'net-m-join', layer: 'mgmt', kind: 'switch', label: 'LS "join"',
    anchor: { to: 'replica-master-3', at: 'right', dx: 200 },
    detail: {
      role: 'LOGICAL SWITCH · MGMT SDN',
      summary:
        'The management cluster’s router-interconnect switch (100.64.0.0/16): every bare-metal node’s gateway router and the distributed cluster router peer across it. No workload lives here — its ports are router legs only.',
      sections: [
        { heading: 'Facts', facts: [
          { k: 'subnet', v: '100.64.0.0/16' },
          { k: 'ovn_cluster_router', v: '100.64.0.1' },
          { k: 'GR_<node>', v: '100.64.0.2 … one per bare-metal node (6 here)' },
        ] },
        { heading: 'Explore', commands: [NOTE_MGMT, 'ovn-nbctl lsp-list join'] },
      ],
    },
  },
  {
    id: 'net-m-router', layer: 'mgmt', kind: 'router', label: 'ovn_cluster_router',
    anchor: { to: 'replica-master-3', at: 'right', dx: 470 },
    detail: {
      role: 'DISTRIBUTED ROUTER · MGMT SDN',
      summary:
        'The management cluster’s pod-subnet router. It runs nowhere: every bare-metal node’s ovn-controller compiles it into br-int’s OpenFlow rules (the Open vSwitch cards on this canvas), so routing happens on the source node and inter-node hops cross the machine network as Geneve frames.',
      sections: [
        { heading: 'Facts', facts: [
          { k: 'one rtos port per node', v: 'each bare-metal node’s /23 pod subnet hangs off it' },
          { k: 'realized by', v: 'ovs-master / ovs-host br-int flows, programmed by OVN-K8s Node' },
        ] },
        { heading: 'Explore', commands: [NOTE_MGMT, 'ovn-nbctl lr-route-list ovn_cluster_router'] },
      ],
    },
  },
  {
    id: 'net-m-ls-w1', layer: 'mgmt', kind: 'switch', label: 'LS worker-1',
    anchor: { to: 'kubevirt-launcher', at: 'above', dx: 320, dy: -47 },
    detail: {
      role: 'LOGICAL SWITCH · MGMT SDN',
      summary:
        'worker-1’s node switch, owning its /23 pod subnet. Every management-cluster pod on this node is a port here — including the KubeVirt launcher pod below, which means the guest VM’s "machine network" is, physically, a port on this switch. That is the seam the two SDN layers meet at.',
      sections: [
        { heading: 'Facts', facts: [
          { k: 'subnet', v: '10.128.2.0/23 (worker-1’s slice of 10.128.0.0/14)' },
          { k: 'gateway', v: '10.128.2.1 — an rtos port of ovn_cluster_router' },
          { k: 'notable port', v: 'the virt-launcher pod = the guest VM’s NIC' },
        ] },
        { heading: 'Explore', commands: [NOTE_MGMT, 'ovn-nbctl lsp-list worker-1'] },
      ],
    },
  },

  // ── Guest SDN: control plane beside the HCP namespace’s OVN-K8s Master,
  //    data-plane objects beside the workloads inside the VM ──
  {
    id: 'net-g-join', layer: 'guest', kind: 'switch', label: 'LS "join" (guest)',
    // Parked in the quiet band below the HCP namespace, still visually tied
    // to the OVN-K8s Master card above it (the NB DB the rows live in).
    anchor: { to: 'ovn-master-control', at: 'below', dx: 10, dy: 96 },
    detail: {
      role: 'LOGICAL SWITCH · GUEST SDN',
      summary:
        'The guest cluster’s own join switch — same construct as the management one, same 100.64.0.0/16 default, but a row in a different northbound database: the one served by the OVN-K8s Master pod in this HCP namespace. The two SDNs can reuse identical subnets because their packets never meet unencapsulated.',
      sections: [
        { heading: 'Explore', commands: [NOTE_GUEST, 'ovn-nbctl lsp-list join'] },
      ],
    },
  },
  {
    id: 'net-g-router', layer: 'guest', kind: 'router', label: 'ovn_cluster_router (guest)',
    anchor: { to: 'ovn-master-control', at: 'below', dx: 330, dy: 96 },
    detail: {
      role: 'DISTRIBUTED ROUTER · GUEST SDN',
      summary:
        'The guest cluster’s pod-subnet router. Declared up here (a row in the HCP namespace’s NB DB), realized down there: each VM’s ovs-guest br-int compiles it locally. Guest "nodes" are VMs, so its inter-node Geneve tunnels run between VM addresses — which are management-cluster pod IPs.',
      sections: [
        { heading: 'Explore', commands: [NOTE_GUEST, 'ovn-nbctl lr-route-list ovn_cluster_router'] },
      ],
    },
  },
  {
    id: 'net-g-ls', layer: 'guest', kind: 'switch', label: 'LS guest-worker-1',
    anchor: { to: 'backend-application-pod', at: 'right', dx: 320 },
    detail: {
      role: 'LOGICAL SWITCH · GUEST SDN',
      summary:
        'The guest worker’s node switch — the application pods in this VM are its ports, exactly as the launcher pod is a port on the management LS one layer down. Same construct, one turtle lower.',
      sections: [
        { heading: 'Facts', facts: [
          { k: 'subnet', v: '10.128.0.0/23 (the guest’s own 10.128.0.0/14 — a separate address universe)' },
          { k: 'ports', v: 'Front-End / Back-End pods, the guest DNS & router pods…' },
        ] },
        { heading: 'Explore', commands: [NOTE_GUEST, 'ovn-nbctl lsp-list <guest-node>'] },
      ],
    },
  },
  {
    id: 'net-g-gr', layer: 'guest', kind: 'router', label: 'GR_guest-worker-1',
    anchor: { to: 'backend-application-pod', at: 'right', dx: 320, dy: 56 },
    detail: {
      role: 'GATEWAY ROUTER · GUEST SDN',
      summary:
        'The guest node’s gateway router, pinned to this VM. Guest egress is SNATed here to the VM’s address — which is a management pod IP, so the packet then gets the management SDN’s own egress treatment (SNAT again at the bare-metal node’s GR). Two NATs out, two un-NATs back.',
      sections: [
        { heading: 'Explore', commands: [NOTE_GUEST, 'ovn-nbctl lr-nat-list GR_<guest-node>'] },
      ],
    },
  },
]

// ── Always-on wiring ─────────────────────────────────────────────────────────

const edge = (id, layer, from, to, label, extra = {}) => ({
  id, layer, from, to, label, step: '', ...extra,
})

export const NET_EDGES = [
  // mgmt: each bare-metal node's GR (realized by its OVS) peers on the join
  // switch; the distributed router hangs the per-node pod switches off it.
  edge('ne-m-gr-m1', 'mgmt', 'ovs-master', 'net-m-join', 'GR_master-1 · rtoj', {
    axis: 'vertical', accent: 'k-orange', labelT: 0.84, labelDX: -60,
    title: 'GR_master-1 → join switch',
    detail: {
      role: 'GATEWAY ROUTER LEG',
      summary: 'master-1’s gateway router — pinned to the node because it holds NAT/conntrack state, compiled into this Open vSwitch’s br-int. Its rtoj port (100.64.0.x) peers with the cluster router across the join switch.',
    },
  }),
  edge('ne-m-gr-w1', 'mgmt', 'ovs-host', 'net-m-join', 'GR_worker-1 · rtoj', {
    axis: 'vertical', accent: 'k-orange', labelT: 0.78,
    title: 'GR_worker-1 → join switch',
    detail: {
      role: 'GATEWAY ROUTER LEG',
      summary: 'worker-1’s gateway router, realized in its Open vSwitch. North-south traffic from any pod on this node — the guest VM’s launcher pod included — is SNATed here to the node IP.',
    },
  }),
  edge('ne-m-gr-m2', 'mgmt', 'replica-master-2', 'net-m-join', 'GR_master-2', {
    accent: 'k-orange', labelT: 0.45,
    title: 'GR_master-2 → join switch',
    detail: { role: 'REPLICA NODE LEG', summary: 'Every node gets the same wiring: master-2 has its own gateway router, node switch and /23 pod subnet — drawn condensed here, identical to the detailed node’s.' },
  }),
  edge('ne-m-gr-m3', 'mgmt', 'replica-master-3', 'net-m-join', 'GR_master-3', {
    accent: 'k-orange', labelT: 0.72,
    title: 'GR_master-3 → join switch',
    detail: { role: 'REPLICA NODE LEG', summary: 'master-3’s gateway-router leg — same construct as every other node’s.' },
  }),
  edge('ne-m-gr-w2', 'mgmt', 'replica-worker-2', 'net-m-join', 'GR_worker-2', {
    axis: 'vertical', bias: 'right', accent: 'k-orange', labelT: 0.05, labelDY: -14,
    title: 'GR_worker-2 → join switch',
    detail: { role: 'REPLICA NODE LEG', summary: 'worker-2’s gateway-router leg. The cross-layer packet trace ends on this node: the other guest VM lives here.' },
  }),
  edge('ne-m-gr-w3', 'mgmt', 'replica-worker-3', 'net-m-join', 'GR_worker-3', {
    axis: 'vertical', bias: 'right', accent: 'k-orange', labelT: 0.05, labelDY: -42, labelDX: 60,
    title: 'GR_worker-3 → join switch',
    detail: { role: 'REPLICA NODE LEG', summary: 'worker-3’s gateway-router leg — same construct as every other node’s.' },
  }),
  edge('ne-m-join-rtr', 'mgmt', 'net-m-join', 'net-m-router', 'rtoj · 100.64.0.1', {
    accent: 'k-orange',
    title: 'join switch ↔ ovn_cluster_router (mgmt)',
    detail: { role: 'ROUTER INTERCONNECT', summary: 'The distributed router’s one leg on the join switch (100.64.0.1). OVN routers can’t peer directly; this stub subnet exists purely so they can next-hop to each other.' },
  }),
  edge('ne-m-rtr-ls', 'mgmt', 'net-m-router', 'net-m-ls-w1', 'rtos · 10.128.2.1/23', {
    axis: 'vertical', accent: 'k-orange', labelT: 0.5,
    title: 'rtos-worker-1 (mgmt)',
    detail: { role: 'ROUTER ↔ SWITCH PORT PAIR', summary: 'worker-1’s pod subnet hanging off the management cluster router. 10.128.2.1 is the default gateway of every mgmt pod on worker-1 — a router port realized as OpenFlow rules, not a device.' },
  }),
  edge('ne-m-ls-launcher', 'mgmt', 'net-m-ls-w1', 'kubevirt-launcher', 'pod port — the VM’s NIC', {
    accent: 'k-orange', labelT: 0.62,
    title: 'The launcher pod’s switch port',
    detail: {
      role: 'THE SEAM BETWEEN THE LAYERS',
      summary: 'The KubeVirt launcher pod is an ordinary port on LS worker-1 — and everything the guest VM sends or receives rides this one port. The guest cluster’s entire "machine network" is pod networking one layer down.',
    },
  }),

  // guest: control plane declares; the VM's data plane realizes.
  edge('ne-g-nb', 'guest', 'ovn-master-control', 'net-g-join', 'rows in the guest NB DB', {
    kindLabel: '⌑ data', accent: 'k-purple', labelT: 0.55,
    title: 'Where the guest topology lives',
    detail: {
      role: 'CONTROL PLANE → LOGICAL OBJECTS',
      summary: 'The guest’s switches and routers are rows in a northbound database served by this OVN-K8s Master pod — running in the HCP namespace on the management cluster. The guest SDN’s control plane never touches a guest node.',
    },
  }),
  edge('ne-g-join-rtr', 'guest', 'net-g-join', 'net-g-router', 'rtoj · 100.64.0.1', {
    accent: 'k-purple',
    title: 'join switch ↔ ovn_cluster_router (guest)',
    detail: { role: 'ROUTER INTERCONNECT', summary: 'Same construct as the management layer’s — even the same default subnet. The two never collide: each SDN is its own address universe, meeting only through encapsulation.' },
  }),
  edge('ne-g-rtr-ls', 'guest', 'net-g-router', 'net-g-ls', 'rtos · 10.128.0.1/23', {
    axis: 'vertical', accent: 'k-purple', labelT: 0.5, bias: 'right',
    title: 'rtos-guest-worker-1 (guest)',
    detail: { role: 'ROUTER ↔ SWITCH PORT PAIR', summary: 'The guest node’s pod subnet hanging off the guest cluster router — declared in the HCP namespace, compiled into br-int inside the VM.' },
  }),
  edge('ne-g-ls-pod', 'guest', 'net-g-ls', 'backend-application-pod', 'pod port', {
    accent: 'k-purple', labelT: 0.5,
    title: 'A guest pod’s switch port',
    detail: { role: 'POD = SWITCH PORT', summary: 'To the guest SDN an application pod is one logical switch port, exactly as the launcher pod is one port on the management LS — the same construct, one turtle lower.' },
  }),
  edge('ne-g-gr-join', 'guest', 'net-g-gr', 'net-g-join', 'rtoj · 100.64.0.2/16', {
    axis: 'vertical', bias: 'right', accent: 'k-purple', labelT: 0.5, labelDX: 110,
    title: 'GR_guest-worker-1 → join switch (guest)',
    detail: { role: 'GATEWAY ROUTER LEG', summary: 'The guest node’s gateway router peering with the guest cluster router. It is pinned to this VM and SNATs guest egress to the VM’s address — itself a management pod IP.' },
  }),

  // cross-layer: the one edge that says "most flows need both layers".
  edge('ne-x-geneve', 'cross', 'net-g-ls', 'replica-worker-2', 'rides the mgmt pod net', {
    kindLabel: '⌁ geneve²', accent: 'k-amber', axis: 'vertical', bias: 'right', labelT: 0.5, labelDY: 10,
    title: 'Cross-node guest traffic: encapsulation squared',
    detail: {
      role: 'WHY BOTH LAYERS MATTER',
      summary:
        'Guest pod → guest pod on another guest node: the guest SDN wraps it in Geneve between VM addresses. But those are management pod IPs — so if the VMs sit on different bare-metal nodes, the management SDN wraps that again in its own Geneve between node IPs. Two SDNs, two encapsulations, one packet.',
      sections: [
        { heading: 'On the wire', bullets: [
          'innermost: guest-pod IP → guest-pod IP',
          'wrapped: guest Geneve, VM IP → VM IP (= mgmt pod IPs)',
          'wrapped again: mgmt Geneve, node IP → node IP',
        ] },
      ],
    },
  }),
]

// ── The cross-layer packet trace (numbered, toggled separately) ─────────────

export const NET_TRACE = {
  id: 'net-trace-guest-pp',
  name: 'Guest pod → guest pod on another node',
  description:
    'One packet, both SDNs: a guest pod talks to a pod on the other guest node. Click the numbered chips in order — the walk crosses from the guest’s logical wiring into the VM’s br-int, out the launcher pod port into the management SDN, and over to worker-2.',
  edges: [
    edge('nt-1', 'trace', 'frontend-application-pod', 'net-g-ls', 'leaves the pod', {
      step: 1, accent: 'k-amber',
      title: '1 · Out of the guest pod',
      detail: { role: 'GUEST SDN', summary: 'The Front-End pod sends to a pod IP on the other guest node — a different /23, so it targets its gateway 10.128.0.1, the guest cluster router’s rtos port on this switch.' },
    }),
    edge('nt-2', 'trace', 'net-g-ls', 'net-g-router', 'routed at the source', {
      step: 2, accent: 'k-amber',
      title: '2 · The guest router — on this VM',
      detail: { role: 'GUEST SDN', summary: 'The guest’s distributed router routes the packet *on the source guest node*: its routing table is compiled into the local br-int. The destination subnet belongs to the other guest node, so the next step is a tunnel.' },
    }),
    edge('nt-3', 'trace', 'net-g-router', 'ovs-guest', 'compiled into br-int', {
      step: 3, accent: 'k-amber', axis: 'vertical', labelDX: -70,
      title: '3 · Logical → real, inside the VM',
      detail: { role: 'GUEST DATA PLANE', summary: 'Everything so far was a description. The VM’s Open vSwitch executes it: br-int rules route the packet and queue it for the guest Geneve tunnel toward the other guest node (a VM address).' },
    }),
    edge('nt-4', 'trace', 'ovs-guest', 'kubevirt-launcher', 'guest Geneve out the VM NIC', {
      step: 4, accent: 'k-amber', labelT: 0.78,
      title: '4 · Out the VM — into a pod interface',
      detail: { role: 'THE SEAM', summary: 'The Geneve frame leaves the VM’s virtio NIC… which is the launcher pod’s interface. From the management cluster’s point of view this is ordinary pod traffic: UDP :6081 between two pod IPs on LS worker-1’s subnet and its sibling on worker-2.' },
    }),
    edge('nt-5', 'trace', 'kubevirt-launcher', 'net-m-ls-w1', 'now mgmt pod traffic', {
      step: 5, accent: 'k-amber', labelT: 0.45,
      title: '5 · Same story, one layer down',
      detail: { role: 'MGMT SDN', summary: 'The launcher pod’s port on LS worker-1 carries the tunnel packet into the management SDN. Destination: the other VM’s pod IP — which lives on worker-2’s node switch.' },
    }),
    edge('nt-6', 'trace', 'net-m-ls-w1', 'net-m-router', 'routed by the mgmt SDN', {
      step: 6, accent: 'k-amber', axis: 'vertical', labelT: 0.55,
      title: '6 · The management router — on worker-1',
      detail: { role: 'MGMT SDN', summary: 'The management cluster router (also distributed, also local to the source node) routes toward worker-2’s pod subnet and wraps the packet in the *management* Geneve — encapsulation number two.' },
    }),
    edge('nt-7', 'trace', 'net-m-router', 'replica-worker-2', 'mgmt Geneve → worker-2 → VM → pod', {
      step: 7, accent: 'k-amber', axis: 'vertical', bias: 'right', labelT: 0.5,
      title: '7 · Across the wire and back up the layers',
      detail: { role: 'ARRIVAL', summary: 'On the physical wire: node IP → node IP. worker-2’s br-int unwraps the mgmt Geneve and delivers to the launcher pod of the VM there; inside that VM, br-int unwraps the guest Geneve and delivers to the destination pod’s port. Down through two SDNs, up through both again.' },
    }),
  ],
}
