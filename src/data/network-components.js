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

// The network control-plane operators carry a generic OPERATOR role that doesn't
// distinguish them from the dozens of non-network operators, so they're kept by an
// explicit allow-list. They live nested inside the CPO/CVO operator-set cards; the
// network filter surfaces them as standalone "control plane" cards, wired to the
// data-plane components they program by "configures" edges (network-internals.js).
//
// Inclusion test (see ARCHITECTURE.md "Network-mode internals"): a card earns a
// place only if it sits on the intent→flow→packet path — either it moves/switches
// packets, or it PROGRAMS something that does. These three render config that
// becomes the data plane (CNO → OVN-K, Ingress → the in-VM router, DNS → CoreDNS).
// The Multus *admission controller* is deliberately NOT here: it is a validating
// webhook that gates net-attach-def admission — it neither moves packets nor
// programs the datapath, so it stays in the operator set and off the network map.
export const NETWORK_OPERATOR_IDS = new Set([
  'cluster-network-operator', // CPO's set → configures the guest OVN-K control plane
  'ingress-operator',         // CVO's set → deploys the in-VM router
  'dns-operator',             // CVO's set → deploys CoreDNS
])

// Is this zone node part of the network? (Unknown ids — e.g. condensed replica
// nodes that aren't in components.json — are treated as non-network; they're not
// rendered in Big view anyway.)
export const isNetworkComponent = (node) => {
  if (!node) return false
  if (NETWORK_OPERATOR_IDS.has(node.id)) return true
  const role = findComponent(node.id)?.role
  return role ? NETWORK_ROLES.has(role) : false
}
