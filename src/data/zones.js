// Zone tree — top-to-bottom nested layout of the HCP cluster.
// Each zone may have `nodes` (rendered as NodeCards) and/or `zones` (nested sub-zones).

export const ZONES = [
  {
    id: 'client',
    label: 'Client',
    color: 'var(--k-cyan)',
    colorVar: 'k-cyan',
    // External to the cluster — hidden from the default overview, shown only
    // when an active trace flow involves a node inside this zone.
    traceOnly: true,
    nodes: [
      {
        id: 'external-client',
        title: 'External Client',
        typePrefix: 'Client',
        badges: [
          { label: 'HTTPS :443', color: 'var(--k-cyan)' },
          { label: 'TLS 1.3', color: 'var(--k-cyan)' },
        ],
      },
    ],
  },
  {
    id: 'management-context',
    label: 'Bare Metal Cluster',
    color: 'var(--k-blue)',
    colorVar: 'k-blue',
    hideWrapper: true,
    zones: [
      {
        id: 'master-node',
        label: 'Bare Metal Master Node',
        color: 'var(--k-blue)',
        colorVar: 'k-blue',
        // The master node's own host-level agents — the same node stack every
        // bare metal node runs (mirrors the worker node), distinct from the
        // guest control-plane Pods it also hosts.
        nodes: [
          {
            id: 'kubelet-master',
            title: 'Kubelet',
            typePrefix: 'systemd',
            badges: [{ label: 'CRI client', color: 'var(--k-blue)' }],
          },
          {
            id: 'crio-master',
            title: 'CRI-O',
            typePrefix: 'systemd',
            badges: [
              { label: 'OCI', color: 'var(--k-blue)' },
              { label: 'gRPC', color: 'var(--k-blue)' },
            ],
          },
          {
            id: 'ovs-master',
            title: 'Open vSwitch',
            typePrefix: 'systemd',
            badges: [
              { label: 'br-int', color: 'var(--k-blue)' },
              { label: 'OpenFlow', color: 'var(--k-blue)' },
            ],
          },
          {
            id: 'ovn-node-master',
            title: 'OVN-K8s Node',
            typePrefix: 'Pod',
            badges: [{ label: 'CNI', color: 'var(--k-blue)' }],
          },
          // The management (bare metal) cluster's OWN control plane, run by the
          // master kubelet from /etc/kubernetes/manifests — these sit directly
          // on the master node alongside its host agents.
          {
            id: 'mgmt-kube-apiserver',
            title: 'Kube API Server',
            typePrefix: 'Static Pod',
            badges: [
              { label: 'Static Manifest', color: 'var(--k-blue)' },
              { label: ':6443', color: 'var(--k-blue)' },
            ],
          },
          {
            id: 'mgmt-etcd',
            title: 'Etcd',
            typePrefix: 'Static Pod',
            badges: [
              { label: 'Static Manifest', color: 'var(--k-blue)' },
              { label: 'Raft', color: 'var(--k-blue)' },
            ],
            // Etcd is the single home for cluster *intent*: the Custom
            // Resources that declare desired infrastructure. These are
            // persisted records in the key-value store, not Linux
            // processes — so they live *inside* etcd rather than beside
            // real Pods. The overview renders this node as an expandable
            // "intent store" that reveals these objects on click.
            // Two intent threads persisted here: the HCP control-plane intent
            // (HostedCluster → HostedControlPlane) and the worker-provisioning
            // chain (NodePool → Cluster API → KubeVirt) that the operators
            // reconcile into the running control plane and guest worker VMs.
            // All are desired-state records, never rendered as cards.
            intentObjects: [
              {
                id: 'hostedcluster-cr',
                title: 'HostedCluster',
                typePrefix: 'Custom Resource',
                badges: [{ label: 'hypershift.openshift.io', color: 'var(--k-blue)' }],
              },
              {
                id: 'hostedcontrolplane-cr',
                title: 'HostedControlPlane',
                typePrefix: 'Custom Resource',
                badges: [{ label: 'hypershift.openshift.io', color: 'var(--k-blue)' }],
              },
              {
                id: 'nodepool-cr',
                title: 'NodePool',
                typePrefix: 'Custom Resource',
                badges: [{ label: 'hypershift.openshift.io', color: 'var(--k-blue)' }],
              },
              {
                id: 'capi-cluster-cr',
                title: 'Cluster (CAPI)',
                typePrefix: 'Custom Resource',
                badges: [{ label: 'cluster.x-k8s.io', color: 'var(--k-blue)' }],
              },
              {
                id: 'machinedeployment-cr',
                title: 'MachineDeployment',
                typePrefix: 'Custom Resource',
                badges: [{ label: 'cluster.x-k8s.io', color: 'var(--k-blue)' }],
              },
              {
                id: 'machineset-cr',
                title: 'MachineSet',
                typePrefix: 'Custom Resource',
                badges: [{ label: 'cluster.x-k8s.io', color: 'var(--k-blue)' }],
              },
              {
                id: 'machine-cr',
                title: 'Machine',
                typePrefix: 'Custom Resource',
                badges: [{ label: 'cluster.x-k8s.io', color: 'var(--k-blue)' }],
              },
              {
                id: 'kubevirtmachine-cr',
                title: 'KubevirtMachine',
                typePrefix: 'Custom Resource',
                badges: [{ label: 'infrastructure.cluster.x-k8s.io', color: 'var(--k-blue)' }],
              },
              {
                id: 'kubevirt-vm-cr',
                title: 'VirtualMachine',
                typePrefix: 'Custom Resource',
                badges: [{ label: 'kubevirt.io', color: 'var(--k-blue)' }],
              },
            ],
          },
          {
            id: 'mgmt-controller-manager',
            title: 'Controller Manager',
            typePrefix: 'Static Pod',
            badges: [
              { label: 'Static Manifest', color: 'var(--k-blue)' },
              { label: 'Controllers', color: 'var(--k-blue)' },
            ],
          },
          {
            id: 'mgmt-scheduler',
            title: 'Scheduler',
            typePrefix: 'Static Pod',
            badges: [
              { label: 'Static Manifest', color: 'var(--k-blue)' },
              { label: 'Bindings', color: 'var(--k-blue)' },
            ],
          },
          // Cluster-wide management operator. One HyperShift Operator serves
          // every HostedCluster on the mgmt cluster. The HostedCluster and
          // NodePool CRs it reconciles are intent records — they live inside
          // the Management Etcd "intent store", not beside the operator Pod.
          {
            id: 'hypershift-operator',
            title: 'HyperShift Operator',
            typePrefix: 'Pod',
            badges: [{ label: 'cluster-wide', color: 'var(--k-blue)' }],
          },
        ],
        zones: [
          {
            id: 'guest-cp-namespace',
            label: 'Guest Control Plane Namespace',
            color: 'var(--k-sky)',
            colorVar: 'k-sky',
            dashed: true,
            nodes: [
              {
                id: 'control-plane-operator',
                title: 'Control Plane Operator',
                typePrefix: 'Pod',
                badges: [{ label: 'per-HCP owner', color: 'var(--k-sky)' }],
              },
              {
                id: 'cluster-version-operator',
                title: 'Cluster Version Operator',
                typePrefix: 'Pod',
                badges: [{ label: 'ClusterVersion CR', color: 'var(--k-sky)' }],
              },
              {
                id: 'capi-manager',
                title: 'Cluster API Manager',
                typePrefix: 'Pod',
                badges: [{ label: 'Machines', color: 'var(--k-sky)' }],
              },
              {
                id: 'capk-provider',
                title: 'CAPI Provider (KubeVirt)',
                typePrefix: 'Pod',
                badges: [{ label: 'VirtualMachine', color: 'var(--k-sky)' }],
              },
              {
                id: 'guest-api-server',
                title: 'Guest API Server',
                typePrefix: 'Pod',
                badges: [
                  { label: ':6443', color: 'var(--k-sky)' },
                  { label: 'gRPC', color: 'var(--k-sky)' },
                ],
              },
              {
                id: 'guest-oauth-server',
                title: 'Guest OAuth Server',
                typePrefix: 'Pod',
                badges: [{ label: 'OAuth2', color: 'var(--k-sky)' }],
              },
              {
                id: 'guest-controller-manager',
                title: 'Guest Controller Manager',
                typePrefix: 'Pod',
                badges: [{ label: 'Controllers', color: 'var(--k-sky)' }],
              },
              {
                id: 'guest-kube-scheduler',
                title: 'Guest Scheduler',
                typePrefix: 'Pod',
                badges: [{ label: 'Bindings', color: 'var(--k-sky)' }],
              },
              {
                id: 'guest-etcd',
                title: 'Guest Etcd',
                typePrefix: 'Pod',
                badges: [
                  { label: 'StatefulSet', color: 'var(--k-sky)' },
                  { label: 'Raft', color: 'var(--k-sky)' },
                ],
                // Guest Etcd is also an intent store: it persists the guest
                // cluster's OWN API objects — the records that have no
                // data-plane card on the overview (ClusterVersion/Operator,
                // Route, the workload Deployment→ReplicaSet chain, its
                // Secrets/ConfigMaps/PVCs/PVs and the EndpointSlices behind its
                // Services). Realized Services & the NetworkPolicy keep their
                // own cards; these pure records live in here.
                intentObjects: [
                  {
                    id: 'clusterversion-cr',
                    title: 'ClusterVersion',
                    typePrefix: 'Custom Resource',
                    badges: [{ label: 'config.openshift.io', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'clusteroperator-cr',
                    title: 'ClusterOperator',
                    typePrefix: 'Custom Resource',
                    badges: [{ label: 'config.openshift.io', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'route-cr',
                    title: 'Route',
                    typePrefix: 'Custom Resource',
                    badges: [{ label: 'route.openshift.io', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'deployment-workload',
                    title: 'Deployment',
                    typePrefix: 'API Object',
                    badges: [{ label: 'apps/v1', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'replicaset-workload',
                    title: 'ReplicaSet',
                    typePrefix: 'API Object',
                    badges: [{ label: 'apps/v1', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'secret-workload',
                    title: 'Secret',
                    typePrefix: 'API Object',
                    badges: [{ label: 'core/v1', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'configmap-workload',
                    title: 'ConfigMap',
                    typePrefix: 'API Object',
                    badges: [{ label: 'core/v1', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'pvc-workload',
                    title: 'PersistentVolumeClaim',
                    typePrefix: 'API Object',
                    badges: [{ label: 'core/v1', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'pv-workload',
                    title: 'PersistentVolume',
                    typePrefix: 'API Object',
                    badges: [{ label: 'core/v1', color: 'var(--k-sky)' }],
                  },
                  {
                    id: 'endpointslice',
                    title: 'EndpointSlice',
                    typePrefix: 'API Object',
                    badges: [{ label: 'discovery.k8s.io', color: 'var(--k-sky)' }],
                  },
                ],
              },
              {
                id: 'shared-ingress-proxy',
                title: 'Shared Ingress Proxy',
                typePrefix: 'Pod',
                badges: [
                  { label: 'HAProxy', color: 'var(--k-sky)' },
                  { label: 'Route CR', color: 'var(--k-sky)' },
                ],
              },
              // MetalLB L2 LoadBalancer VIP fronting the shared ingress proxy.
              // CONTROL-PLANE / API ingress only (kube-apiserver, OAuth,
              // Konnectivity, Ignition) — NOT application/*.apps traffic, which
              // enters via the Apps Ingress LoadBalancer below. A Service is a
              // networking abstraction, not a process — allowed on the overview
              // per the 4th category of the First Overview rendering rule
              // (ARCHITECTURE.md §1).
              {
                id: 'svc-ingress-lb-shared',
                title: 'Shared Ingress LoadBalancer',
                typePrefix: 'Service',
                badges: [
                  { label: 'LoadBalancer', color: 'var(--k-sky)' },
                  { label: 'MetalLB L2', color: 'var(--k-sky)' },
                  { label: 'control-plane / API', color: 'var(--k-sky)' },
                ],
              },
              // APPLICATION (*.apps wildcard) ingress entry point on the bare
              // metal side: the infra-side LoadBalancer the kubevirt cloud
              // provider (CCM) mirrors from the guest's router-default LB. This
              // is the guest app-traffic path — it does NOT go through the
              // Shared Ingress Proxy above.
              {
                id: 'svc-apps-lb-infra',
                title: 'Apps Ingress LoadBalancer',
                typePrefix: 'Service',
                badges: [
                  { label: 'LoadBalancer', color: 'var(--k-sky)' },
                  { label: 'MetalLB L2', color: 'var(--k-sky)' },
                  { label: 'kubevirt CCM mirror', color: 'var(--k-sky)' },
                ],
              },
              {
                id: 'ovn-master-control',
                title: 'OVN-K8s Master',
                typePrefix: 'Pod',
                badges: [{ label: 'Northbound DB', color: 'var(--k-sky)' }],
              },
              {
                id: 'cloud-controller-manager',
                title: 'Cloud Controller Manager',
                typePrefix: 'Pod',
                badges: [{ label: 'Cloud API', color: 'var(--k-sky)' }],
              },
              {
                id: 'konnectivity-server',
                title: 'Konnectivity Server',
                typePrefix: 'Pod',
                badges: [{ label: 'Tunnel :8091', color: 'var(--k-sky)' }],
              },
              {
                id: 'ignition-server',
                title: 'Ignition Server',
                typePrefix: 'Pod',
                badges: [{ label: 'Bootstrap', color: 'var(--k-sky)' }],
              },
            ],
          },
        ],
      },
      {
        id: 'worker-node',
        label: 'Bare Metal Worker Node',
        color: 'var(--k-blue-worker)',
        colorVar: 'k-blue-worker',
        nodes: [
          {
            id: 'kubelet-host',
            title: 'Kubelet',
            typePrefix: 'systemd',
            badges: [{ label: 'CRI client', color: 'var(--k-blue-worker)' }],
          },
          {
            id: 'crio-host',
            title: 'CRI-O',
            typePrefix: 'systemd',
            badges: [
              { label: 'OCI', color: 'var(--k-blue-worker)' },
              { label: 'gRPC', color: 'var(--k-blue-worker)' },
            ],
          },
          {
            id: 'ovs-host',
            title: 'Open vSwitch',
            typePrefix: 'systemd',
            badges: [
              { label: 'br-int', color: 'var(--k-blue-worker)' },
              { label: 'OpenFlow', color: 'var(--k-blue-worker)' },
            ],
          },
          {
            id: 'ovn-node-host',
            title: 'OVN-K8s Node',
            typePrefix: 'Pod',
            badges: [{ label: 'CNI', color: 'var(--k-blue-worker)' }],
          },
          {
            id: 'virt-handler',
            title: 'KubeVirt virt-handler',
            typePrefix: 'Pod',
            badges: [{ label: 'VMI node agent', color: 'var(--k-blue-worker)' }],
          },
        ],
        zones: [
          {
            id: 'kubevirt-launcher-zone',
            // The launcher zone *is* the [Pod] — it doubles as the
            // `kubevirt-launcher` hop in events.json. The boundary itself is
            // the component (mirroring the VM zone below), so there is no
            // redundant inner Pod card: the box you see is the launcher Pod,
            // and the VMI nests directly inside it.
            componentId: 'kubevirt-launcher',
            label: 'KubeVirt Launcher · Pod',
            color: 'var(--k-teal)',
            colorVar: 'k-teal',
            badges: [
              { label: 'QEMU/KVM', color: 'var(--k-teal)' },
              { label: 'tap0', color: 'var(--k-teal)' },
            ],
            zones: [
              {
                id: 'guest-vm-zone',
                // The VM zone *is* a component: it doubles as the
                // `guest-worker-node-vm` hop in events.json. Its label carries
                // this id so ArrowOverlay can anchor connectors to it and
                // DetailPanel can open when the label is clicked.
                componentId: 'guest-worker-node-vm',
                label: 'Guest Worker Node · VirtualMachineInstance',
                color: 'var(--k-green)',
                colorVar: 'k-green',
                badges: [
                  { label: 'RHCOS', color: 'var(--k-green)' },
                  { label: 'virtio-net', color: 'var(--k-green)' },
                ],
                nodes: [
                  {
                    id: 'kubelet-guest',
                    title: 'Kubelet (Guest)',
                    typePrefix: 'systemd',
                    badges: [{ label: 'CRI client', color: 'var(--k-green)' }],
                  },
                  {
                    id: 'crio-guest',
                    title: 'CRI-O (Guest)',
                    typePrefix: 'systemd',
                    badges: [
                      { label: 'OCI', color: 'var(--k-green)' },
                      { label: 'CNI', color: 'var(--k-green)' },
                    ],
                  },
                  {
                    id: 'ovs-guest',
                    title: 'Open vSwitch (Guest)',
                    typePrefix: 'systemd',
                    badges: [
                      { label: 'br-int', color: 'var(--k-green)' },
                      { label: 'virtio-net', color: 'var(--k-green)' },
                    ],
                  },
                  {
                    id: 'ovn-node-guest',
                    title: 'OVN-K8s Guest Node',
                    typePrefix: 'Pod',
                    badges: [{ label: 'CNI', color: 'var(--k-green)' }],
                  },
                  {
                    id: 'konnectivity-agent',
                    title: 'Konnectivity Agent',
                    typePrefix: 'Pod',
                    badges: [{ label: 'Tunnel', color: 'var(--k-green)' }],
                  },
                  {
                    id: 'coredns-node',
                    title: 'CoreDNS Node',
                    typePrefix: 'Pod',
                    badges: [{ label: 'DNS :53', color: 'var(--k-green)' }],
                  },
                  {
                    id: 'openshift-ingress-router-guest',
                    title: 'Ingress Router (Guest)',
                    typePrefix: 'Pod',
                    badges: [
                      { label: 'HAProxy', color: 'var(--k-green)' },
                      { label: 'Route CR', color: 'var(--k-green)' },
                    ],
                  },
                  // The guest cluster's own router-default LoadBalancer — the
                  // guest-side half of the *.apps application ingress path. Its
                  // external IP is realised by the kubevirt cloud provider (CCM),
                  // which mirrors it to the infra-side Apps Ingress LoadBalancer
                  // on the bare metal side (where MetalLB advertises the VIP).
                  {
                    id: 'svc-ingress-lb-guest',
                    title: 'Ingress LoadBalancer',
                    typePrefix: 'Service',
                    badges: [
                      { label: 'LoadBalancer', color: 'var(--k-green)' },
                      { label: 'router-default', color: 'var(--k-green)' },
                      { label: 'kubevirt CCM', color: 'var(--k-green)' },
                    ],
                  },
                  {
                    id: 'frontend-workload-pod',
                    title: 'Front-End Workload',
                    typePrefix: 'Pod',
                    badges: [
                      { label: 'e-commerce-prod', color: 'var(--k-green)' },
                      { label: ':8080', color: 'var(--k-green)' },
                    ],
                  },
                  // ClusterIP Service giving the front-end Pods a stable in-cluster
                  // VIP (realized as OVN load-balancer flows / DNAT).
                  {
                    id: 'svc-frontend',
                    title: 'Front-End Service',
                    typePrefix: 'Service',
                    badges: [
                      { label: 'ClusterIP', color: 'var(--k-green)' },
                      { label: 'e-commerce-prod', color: 'var(--k-green)' },
                    ],
                  },
                  {
                    id: 'backend-workload-pod',
                    title: 'Back-End Workload',
                    typePrefix: 'Pod',
                    badges: [
                      { label: 'e-commerce-prod', color: 'var(--k-green)' },
                      { label: ':3000', color: 'var(--k-green)' },
                    ],
                  },
                  // ClusterIP Service the front-end calls east-west to reach the
                  // back-end Pods (stable VIP backed by OVN load-balancer flows).
                  {
                    id: 'svc-backend',
                    title: 'Back-End Service',
                    typePrefix: 'Service',
                    badges: [
                      { label: 'ClusterIP', color: 'var(--k-green)' },
                      { label: 'e-commerce-prod', color: 'var(--k-green)' },
                    ],
                  },
                  // Namespaced NetworkPolicy gating east-west traffic in
                  // e-commerce-prod: it denies ingress to the back-end Pods
                  // except from the front-end. Like a Service it is a
                  // declarative object, but it has a concrete data-plane
                  // realization — OVN compiles it into ACLs / allow-drop
                  // OpenFlow rules on the guest br-int — so it earns a card on
                  // the overview next to the workloads it guards (per the 4th
                  // category of the First Overview rendering rule, §1).
                  {
                    id: 'netpol-ecommerce',
                    title: 'E-Commerce Network Policy',
                    typePrefix: 'NetworkPolicy',
                    badges: [
                      { label: 'frontend → backend', color: 'var(--k-green)' },
                      { label: 'OVN ACL', color: 'var(--k-green)' },
                    ],
                  },
                  {
                    id: 'cluster-monitoring',
                    title: 'Cluster Monitoring',
                    typePrefix: 'Pod',
                    badges: [{ label: 'Prometheus', color: 'var(--k-green)' }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
]

// Recursively collect all nodes from the zone tree.
function collectNodes(zones, result = []) {
  for (const zone of zones) {
    // A zone that doubles as a component (e.g. the VM zone) registers its own
    // id so the color/zone/badge lookups below resolve it like any node.
    if (zone.componentId) {
      result.push({ node: { id: zone.componentId, badges: zone.badges }, zone })
    }
    if (zone.nodes) {
      for (const node of zone.nodes) {
        result.push({ node, zone })
        // Intent objects (CRs nested inside an etcd "intent store" node) are
        // not rendered as standalone cards, but still need their color / zone /
        // badge lookups resolved so the DetailPanel can open for them.
        if (node.intentObjects) {
          for (const obj of node.intentObjects) result.push({ node: obj, zone })
        }
      }
    }
    if (zone.zones) collectNodes(zone.zones, result)
  }
  return result
}

const allNodes = collectNodes(ZONES)

// Map componentId → zone accent color (for hop-list coloring, connector strokes, etc.)
export const COMPONENT_COLOR = Object.fromEntries(
  allNodes.map(({ node, zone }) => [node.id, zone.color])
)

// Map componentId → zone object (for DetailPanel zone label display)
export const COMPONENT_ZONE = Object.fromEntries(
  allNodes.map(({ node, zone }) => [node.id, zone])
)

// Map componentId → badge array (for DetailPanel tag chips)
export const COMPONENT_BADGES = Object.fromEntries(
  allNodes.map(({ node }) => [node.id, node.badges || []])
)

// First Overview rendering rule (ARCHITECTURE.md §1) — the primary canvas is a
// whitelist: a NodeCard may only be a systemd enforcer/service, a concrete
// workload instance (Pod / Static Pod / VMI), or a networking Service
// abstraction (ClusterIP / LoadBalancer). Zone boundaries are the zones
// themselves; pure-intent CRs render *inside* the etcd store, not as cards; and
// trace-only zones (the external Client) are not part of the default canvas.
// This dev-only guard flags any future node that drifts outside the rule.
const OVERVIEW_NODE_TYPES = new Set([
  'systemd', // Active Enforcers — systemd services
  'Pod', // Concrete workload / data-plane instances
  'Static Pod',
  'VirtualMachineInstance',
  'Service', // Networking / Service abstractions (ClusterIP, LoadBalancer)
  'NetworkPolicy', // Policy abstractions realized as OVN ACLs / OpenFlow rules
])

function assertOverviewWhitelist(zones) {
  const offenders = []
  const walk = (list) => {
    for (const zone of list) {
      if (zone.traceOnly) continue // not rendered on the default overview
      // intentObjects (CRs) live inside the etcd store, never as cards — skip.
      zone.nodes?.forEach((n) => {
        if (!OVERVIEW_NODE_TYPES.has(n.typePrefix)) {
          offenders.push(`${n.id} [${n.typePrefix}]`)
        }
      })
      if (zone.zones) walk(zone.zones)
    }
  }
  walk(zones)
  if (offenders.length) {
    console.warn(
      '[kube-visual] First Overview rendering-rule violation (ARCHITECTURE.md §1): ' +
        'these nodes are not zone boundaries, systemd enforcers, or concrete ' +
        'workload instances and must not render on the primary canvas:\n  ' +
        offenders.join('\n  ')
    )
  }
}

if (import.meta.env?.DEV) assertOverviewWhitelist(ZONES)
