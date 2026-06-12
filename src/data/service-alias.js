// Compact aliases for the Kubernetes Service types — they replace the generic
// [Service] card prefix so a card names its exposure model directly:
// [SVC_LB] (LoadBalancer), [SVC_CIP] (ClusterIP), [SVC_NP] (NodePort).
// Driven by the node's `serviceType` field in zones.js.
export const SERVICE_ALIAS = {
  LoadBalancer: 'svc_lb',
  ClusterIP: 'svc_cip',
  NodePort: 'svc_np',
}

export const serviceAlias = (node) =>
  node?.typePrefix === 'Service' ? SERVICE_ALIAS[node.serviceType] : undefined
