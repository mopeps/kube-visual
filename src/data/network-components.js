// ── Network-mode component classification ───────────────────────────────────
// When the Overview's Big view has Network mode on, the parallel columns hide
// everything that isn't part of the network, so the SDN story reads on its own.
// Classification reuses the `role` field already carried by every entry in
// components.json (via findComponent) — no per-node flags in zones.js.

import { findComponent } from './components-index'

// The roles that ARE the network: the data path plus the in-namespace network
// control pods (OVN NB DB, Konnectivity tunnels, ingress proxy/router, the
// LoadBalancer/NodePort/ClusterIP Services and the NetworkPolicy).
const NETWORK_ROLES = new Set([
  'NODE NETWORKING',
  'VIRTUAL SWITCH',
  'LB SPEAKER',
  'LB CONTROLLER',
  'NETWORK CONTROL',
  'DNS',
  'TUNNEL',
  'INGRESS PROXY',
  'INGRESS ROUTER',
  'LOAD BALANCER',
  'NODEPORT',
  'SERVICE',
  'NETWORK POLICY',
])

// The network control plane — components that PROGRAM the data plane rather than
// move packets. Some carry a generic role (OPERATOR / CONTROLLER) that doesn't
// mark them as network, so they're kept by this explicit allow-list. The network
// filter surfaces them as standalone "control plane · configures" cards (dashed,
// not the realized datapath), wired to the data-plane component each programs by a
// "configures" edge (network-internals.js).
//
// Inclusion test (see ARCHITECTURE.md "Network-mode internals"): a card earns a
// place only if it sits on the intent→flow→packet path — either it moves/switches
// packets, or it PROGRAMS something that does. These render config / Services that
// become the data plane: CNO → OVN-K, Ingress → the in-VM router, DNS → CoreDNS,
// the kubevirt CCM → the app-ingress LoadBalancer, MetalLB Controller → the VIPs
// its speaker announces. The Multus *admission controller* is deliberately NOT
// here: a validating webhook that gates net-attach-def admission neither moves
// packets nor programs the datapath, so it stays in the operator set and off the map.
export const NETWORK_CONTROL_PLANE_IDS = new Set([
  'cluster-network-operator', // CPO's set → configures the guest OVN-K control plane
  'ingress-operator',         // CVO's set → deploys the in-VM router
  'dns-operator',             // CVO's set → deploys CoreDNS
  'cloud-controller-manager', // kubevirt cloud provider → the app-ingress LoadBalancer
  'metallb-controller',       // allocates each LB Service a VIP the speaker announces
])

// Is this zone node part of the network? (Unknown ids — e.g. condensed replica
// nodes that aren't in components.json — are treated as non-network; they're not
// rendered in Big view anyway.)
export const isNetworkComponent = (node) => {
  if (!node) return false
  const id = node.mirror || node.id
  if (NETWORK_CONTROL_PLANE_IDS.has(id)) return true
  const role = findComponent(id)?.role
  return role ? NETWORK_ROLES.has(role) : false
}
