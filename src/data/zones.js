// Zone tree — top-to-bottom nested layout of the HCP cluster.
// Each zone may have `nodes` (rendered as NodeCards) and/or `zones` (nested sub-zones).

export const ZONES = [
  {
    id: 'client',
    label: 'Client',
    color: 'var(--k-cyan)',
    colorVar: 'k-cyan',
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
    color: 'var(--k-sky)',
    colorVar: 'k-sky',
    zones: [
      {
        id: 'master-node',
        label: 'Bare Metal Master Node',
        color: 'var(--k-sky)',
        colorVar: 'k-sky',
        zones: [
          {
            id: 'guest-cp-namespace',
            label: 'Guest Control Plane Namespace',
            color: 'var(--k-orange)',
            colorVar: 'k-orange',
            dashed: true,
            nodes: [
              {
                id: 'hypershift-operator',
                title: 'HyperShift Operator',
                typePrefix: 'Pod',
                badges: [{ label: 'HostedCluster CR', color: 'var(--k-orange)' }],
              },
              {
                id: 'cluster-version-operator',
                title: 'Cluster Version Operator',
                typePrefix: 'Pod',
                badges: [{ label: 'ClusterVersion CR', color: 'var(--k-orange)' }],
              },
              {
                id: 'guest-api-server',
                title: 'Guest API Server',
                typePrefix: 'Pod',
                badges: [
                  { label: ':6443', color: 'var(--k-orange)' },
                  { label: 'gRPC', color: 'var(--k-orange)' },
                ],
              },
              {
                id: 'guest-oauth-server',
                title: 'Guest OAuth Server',
                typePrefix: 'Pod',
                badges: [{ label: 'OAuth2', color: 'var(--k-orange)' }],
              },
              {
                id: 'guest-controller-manager',
                title: 'Guest Controller Manager',
                typePrefix: 'Pod',
                badges: [{ label: 'Controllers', color: 'var(--k-orange)' }],
              },
              {
                id: 'guest-kube-scheduler',
                title: 'Guest Scheduler',
                typePrefix: 'Pod',
                badges: [{ label: 'Bindings', color: 'var(--k-orange)' }],
              },
              {
                id: 'etcd-static-pod',
                title: 'Etcd',
                typePrefix: 'Static Pod',
                badges: [
                  { label: 'State Store', color: 'var(--k-orange)' },
                  { label: 'Raft', color: 'var(--k-orange)' },
                ],
              },
              {
                id: 'shared-ingress-proxy',
                title: 'Shared Ingress Proxy',
                typePrefix: 'Pod',
                badges: [
                  { label: 'HAProxy', color: 'var(--k-orange)' },
                  { label: 'Route CR', color: 'var(--k-orange)' },
                ],
              },
              {
                id: 'ovn-master-control',
                title: 'OVN-K8s Master',
                typePrefix: 'Pod',
                badges: [{ label: 'Northbound DB', color: 'var(--k-orange)' }],
              },
              {
                id: 'cloud-controller-manager',
                title: 'Cloud Controller Manager',
                typePrefix: 'Pod',
                badges: [{ label: 'Cloud API', color: 'var(--k-orange)' }],
              },
              {
                id: 'konnectivity-server',
                title: 'Konnectivity Server',
                typePrefix: 'Pod',
                badges: [{ label: 'Tunnel :8091', color: 'var(--k-orange)' }],
              },
              {
                id: 'ignition-server',
                title: 'Ignition Server',
                typePrefix: 'Pod',
                badges: [{ label: 'Bootstrap', color: 'var(--k-orange)' }],
              },
              {
                id: 'guest-coredns',
                title: 'Guest CoreDNS',
                typePrefix: 'Pod',
                badges: [{ label: 'DNS :53', color: 'var(--k-orange)' }],
              },
              {
                id: 'cluster-monitoring',
                title: 'Cluster Monitoring',
                typePrefix: 'Pod',
                badges: [{ label: 'Prometheus', color: 'var(--k-orange)' }],
              },
            ],
          },
        ],
      },
      {
        id: 'worker-node',
        label: 'Bare Metal Worker Node',
        color: 'var(--k-amber)',
        colorVar: 'k-amber',
        nodes: [
          {
            id: 'kubelet-host',
            title: 'Kubelet',
            typePrefix: 'systemd',
            badges: [{ label: 'CRI client', color: 'var(--k-amber)' }],
          },
          {
            id: 'crio-host',
            title: 'CRI-O',
            typePrefix: 'systemd',
            badges: [
              { label: 'OCI', color: 'var(--k-amber)' },
              { label: 'gRPC', color: 'var(--k-amber)' },
            ],
          },
          {
            id: 'ovs-host',
            title: 'Open vSwitch',
            typePrefix: 'systemd',
            badges: [
              { label: 'br-int', color: 'var(--k-amber)' },
              { label: 'OpenFlow', color: 'var(--k-amber)' },
            ],
          },
          {
            id: 'ovn-node-host',
            title: 'OVN-K8s Node',
            typePrefix: 'Pod',
            badges: [{ label: 'CNI', color: 'var(--k-amber)' }],
          },
        ],
        zones: [
          {
            id: 'kubevirt-launcher-zone',
            label: 'KubeVirt Launcher Container',
            color: 'var(--k-green)',
            colorVar: 'k-green',
            nodes: [
              {
                id: 'kubevirt-launcher',
                title: 'KubeVirt Launcher',
                typePrefix: 'Pod',
                badges: [
                  { label: 'QEMU/KVM', color: 'var(--k-green)' },
                  { label: 'tap0', color: 'var(--k-green)' },
                ],
              },
            ],
            zones: [
              {
                id: 'guest-vm-zone',
                label: 'Guest Worker Node · VirtualMachineInstance',
                color: 'var(--k-cyan)',
                colorVar: 'k-cyan',
                nodes: [
                  {
                    id: 'kubelet-guest',
                    title: 'Kubelet (Guest)',
                    typePrefix: 'systemd',
                    badges: [{ label: 'CRI client', color: 'var(--k-cyan)' }],
                  },
                  {
                    id: 'crio-guest',
                    title: 'CRI-O (Guest)',
                    typePrefix: 'systemd',
                    badges: [
                      { label: 'OCI', color: 'var(--k-cyan)' },
                      { label: 'CNI', color: 'var(--k-cyan)' },
                    ],
                  },
                  {
                    id: 'ovs-guest',
                    title: 'Open vSwitch (Guest)',
                    typePrefix: 'systemd',
                    badges: [
                      { label: 'br-int', color: 'var(--k-cyan)' },
                      { label: 'virtio-net', color: 'var(--k-cyan)' },
                    ],
                  },
                  {
                    id: 'ovn-node-guest',
                    title: 'OVN-K8s Guest Node',
                    typePrefix: 'Pod',
                    badges: [{ label: 'CNI', color: 'var(--k-cyan)' }],
                  },
                  {
                    id: 'konnectivity-agent',
                    title: 'Konnectivity Agent',
                    typePrefix: 'Pod',
                    badges: [{ label: 'Tunnel', color: 'var(--k-cyan)' }],
                  },
                  {
                    id: 'coredns-node',
                    title: 'CoreDNS Node',
                    typePrefix: 'Pod',
                    badges: [{ label: 'DNS :53', color: 'var(--k-cyan)' }],
                  },
                  {
                    id: 'openshift-ingress-router-guest',
                    title: 'Ingress Router (Guest)',
                    typePrefix: 'Pod',
                    badges: [
                      { label: 'HAProxy', color: 'var(--k-cyan)' },
                      { label: 'Route CR', color: 'var(--k-cyan)' },
                    ],
                  },
                  {
                    id: 'frontend-workload-pod',
                    title: 'Front-End Workload',
                    typePrefix: 'Pod',
                    badges: [
                      { label: 'e-commerce-prod', color: 'var(--k-cyan)' },
                      { label: ':8080', color: 'var(--k-cyan)' },
                    ],
                  },
                  {
                    id: 'backend-workload-pod',
                    title: 'Back-End Workload',
                    typePrefix: 'Pod',
                    badges: [
                      { label: 'e-commerce-prod', color: 'var(--k-cyan)' },
                      { label: ':3000', color: 'var(--k-cyan)' },
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
