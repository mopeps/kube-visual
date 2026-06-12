// Compact aliases for the Kubernetes Service types, shown as a small tag
// beside the [Service] prefix so a card declares its exposure model at a
// glance: svc_lb (LoadBalancer), svc_cip (ClusterIP), svc_np (NodePort).
// Driven by the node's `serviceType` field in zones.js.
export const SERVICE_ALIAS = {
  LoadBalancer: 'svc_lb',
  ClusterIP: 'svc_cip',
  NodePort: 'svc_np',
}

export const serviceAlias = (node) =>
  node?.typePrefix === 'Service' ? SERVICE_ALIAS[node.serviceType] : undefined
