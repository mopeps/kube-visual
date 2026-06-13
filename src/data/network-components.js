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

// The network control-plane operators carry a generic OPERATOR / ADMISSION role
// that doesn't distinguish them from the dozens of non-network operators, so
// they're kept by an explicit allow-list. They live nested inside the CPO/CVO
// operator-set cards; the network filter surfaces them as standalone cards.
export const NETWORK_OPERATOR_IDS = new Set([
  'cluster-network-operator',    // in control-plane-operator's set
  'multus-admission-controller', // in control-plane-operator's set
  'ingress-operator',            // in cluster-version-operator's set
  'dns-operator',                // in cluster-version-operator's set
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
