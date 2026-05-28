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
        ],
        zones: [
          {
            // The management (bare metal) cluster's OWN control plane, run by
            // the master kubelet as Static Pods from /etc/kubernetes/manifests.
            // Not to be confused with the per-guest control plane namespace.
            id: 'management-control-plane',
            label: 'Management Control Plane · Static Pods',
            color: 'var(--k-blue)',
            colorVar: 'k-blue',
            nodes: [
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
            ],
          },
          {
            id: 'guest-cp-namespace',
            label: 'Guest Control Plane Namespace',
            color: 'var(--k-sky)',
            colorVar: 'k-sky',
            dashed: true,
            nodes: [
              {
                id: 'hypershift-operator',
                title: 'HyperShift Operator',
                typePrefix: 'Pod',
                badges: [{ label: 'HostedCluster CR', color: 'var(--k-sky)' }],
              },
              {
                id: 'cluster-version-operator',
                title: 'Cluster Version Operator',
                typePrefix: 'Pod',
                badges: [{ label: 'ClusterVersion CR', color: 'var(--k-sky)' }],
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
                id: 'etcd-static-pod',
                title: 'Etcd',
                typePrefix: 'Static Pod',
                badges: [
                  { label: 'State Store', color: 'var(--k-sky)' },
                  { label: 'Raft', color: 'var(--k-sky)' },
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
              {
                id: 'guest-coredns',
                title: 'Guest CoreDNS',
                typePrefix: 'Pod',
                badges: [{ label: 'DNS :53', color: 'var(--k-sky)' }],
              },
              {
                id: 'cluster-monitoring',
                title: 'Cluster Monitoring',
                typePrefix: 'Pod',
                badges: [{ label: 'Prometheus', color: 'var(--k-sky)' }],
              },
            ],
          },
        ],
      },
      {
        id: 'worker-node',
        label: 'Bare Metal Worker Node',
        color: 'var(--k-blue)',
        colorVar: 'k-blue',
        nodes: [
          {
            id: 'kubelet-host',
            title: 'Kubelet',
            typePrefix: 'systemd',
            badges: [{ label: 'CRI client', color: 'var(--k-blue)' }],
          },
          {
            id: 'crio-host',
            title: 'CRI-O',
            typePrefix: 'systemd',
            badges: [
              { label: 'OCI', color: 'var(--k-blue)' },
              { label: 'gRPC', color: 'var(--k-blue)' },
            ],
          },
          {
            id: 'ovs-host',
            title: 'Open vSwitch',
            typePrefix: 'systemd',
            badges: [
              { label: 'br-int', color: 'var(--k-blue)' },
              { label: 'OpenFlow', color: 'var(--k-blue)' },
            ],
          },
          {
            id: 'ovn-node-host',
            title: 'OVN-K8s Node',
            typePrefix: 'Pod',
            badges: [{ label: 'CNI', color: 'var(--k-blue)' }],
          },
        ],
        zones: [
          {
            id: 'kubevirt-launcher-zone',
            label: 'KubeVirt Launcher Container',
            color: 'var(--k-teal)',
            colorVar: 'k-teal',
            nodes: [
              {
                id: 'kubevirt-launcher',
                title: 'KubeVirt Launcher',
                typePrefix: 'Pod',
                badges: [
                  { label: 'QEMU/KVM', color: 'var(--k-teal)' },
                  { label: 'tap0', color: 'var(--k-teal)' },
                ],
              },
            ],
            zones: [
              {
                id: 'guest-vm-zone',
                label: 'Guest Worker Node · VirtualMachineInstance',
                color: 'var(--k-green)',
                colorVar: 'k-green',
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
                  {
                    id: 'frontend-workload-pod',
                    title: 'Front-End Workload',
                    typePrefix: 'Pod',
                    badges: [
                      { label: 'e-commerce-prod', color: 'var(--k-green)' },
                      { label: ':8080', color: 'var(--k-green)' },
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
    if (zone.nodes) {
      for (const node of zone.nodes) result.push({ node, zone })
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
