// Zone definitions — top-to-bottom layout of the cluster.
// Each zone references componentIds from components.json and pairs them with
// a short subtitle + badge list that surface what the box "is" at a glance.

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
        subtitle: 'curl / browser / external service\nTLS 1.3 to public Route hostname',
        badges: [
          { label: 'TCP :443', color: 'var(--k-cyan)' },
          { label: 'TLS 1.3', color: 'var(--k-cyan)' },
        ],
      },
    ],
  },
  {
    id: 'management',
    label: 'Mgmt Plane',
    color: 'var(--k-sky)',
    colorVar: 'k-sky',
    nodes: [
      {
        id: 'ingress-router-haproxy',
        title: 'Ingress Router',
        subtitle: 'HAProxy pod in openshift-ingress ns\nTerminates / re-encrypts TLS\nResolves Route → Service',
        badges: [
          { label: 'HAProxy', color: 'var(--k-sky)' },
          { label: 'Route CR', color: 'var(--k-sky)' },
        ],
      },
      {
        id: 'api-server',
        title: 'kube-apiserver',
        subtitle: 'REST front-end on :6443\nAuthN/AuthZ + admission\nWatches & persists state',
        badges: [
          { label: 'Deployment', color: 'var(--k-sky)' },
          { label: ':6443', color: 'var(--k-sky)' },
        ],
      },
      {
        id: 'scheduler',
        title: 'kube-scheduler',
        subtitle: 'Watches unscheduled Pods\nBinds to a node by capacity\nWrites binding back to API',
        badges: [
          { label: 'Deployment', color: 'var(--k-sky)' },
        ],
      },
      {
        id: 'kubelet',
        title: 'kubelet',
        subtitle: 'Node-local agent\nWatches API for its PodSpecs\nDrives CRI + reports status',
        badges: [
          { label: 'systemd', color: 'var(--k-sky)' },
          { label: 'CRI client', color: 'var(--k-sky)' },
        ],
      },
      {
        id: 'crio',
        title: 'CRI-O',
        subtitle: 'OCI runtime via runc/crun\nCalls CNI for pod netns\nSets up cgroup hierarchy',
        badges: [
          { label: 'gRPC', color: 'var(--k-sky)' },
          { label: 'OCI', color: 'var(--k-sky)' },
        ],
      },
    ],
  },
  {
    id: 'host-net',
    label: 'Host.Net',
    color: 'var(--k-amber)',
    colorVar: 'k-amber',
    nodes: [
      {
        id: 'ovs-bridge-br-int',
        title: 'OVS Bridge · br-int',
        subtitle: 'OVN-Kubernetes integration bridge\nAll pod veths + uplink as ports\nGeneve tunnels for inter-node',
        badges: [
          { label: 'OpenFlow', color: 'var(--k-amber)' },
          { label: 'Geneve', color: 'var(--k-amber)' },
        ],
      },
      {
        id: 'host-veth-pair',
        title: 'veth Pair (host end)',
        subtitle: 'Virtual Ethernet, host-side leg\nPlugged into br-int as a port\nPeer lives in pod netns',
        badges: [
          { label: 'CNI', color: 'var(--k-amber)' },
        ],
      },
    ],
  },
]

// Arrow rows sit between zones. Each entry describes what happens as the
// packet (or control-flow) crosses from the zone above into the one below.
export const ARROW_ROWS = [
  {
    between: ['client', 'management'],
    steps: [
      { n: 1, text: 'DNS → A-record for Route hostname → cluster LB' },
      { n: 2, text: 'TCP SYN → :443; TLS terminated at HAProxy Ingress Router pod' },
    ],
  },
  {
    between: ['management', 'host-net'],
    steps: [
      { n: 3, text: 'CNI plugin: provision veth pair, attach to OVS br-int' },
      { n: 4, text: 'kube-proxy / OVN flow rules program DNAT + forwarding' },
    ],
  },
]

// Map: componentId → zone color (for hop-list coloring etc.)
export const COMPONENT_COLOR = {
  ...ZONES.flatMap(z =>
    z.nodes.map(n => [n.id, z.color])
  ).reduce((acc, [k, v]) => { acc[k] = v; return acc }, {}),
  'pod-netns': 'var(--k-green)',
  'pod-cgroups': 'var(--k-green)',
  'container-process': 'var(--k-green)',
}

export const COMPONENT_ZONE = ZONES.flatMap(z =>
  z.nodes.map(n => [n.id, z])
).reduce((acc, [k, v]) => { acc[k] = v; return acc }, {})
