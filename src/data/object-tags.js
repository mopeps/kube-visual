// Recognizes OpenShift / Kubernetes object references inside free-text prose
// (the detail-modal "why it exists" callout and the interaction rows) and turns
// them into inline tag chips instead of leaving them as flat text. This way the
// objects a component talks about are cleanly highlighted — and when an object
// is itself a node on the topology, its chip becomes a shortcut that opens that
// node's modal.
//
// Every entry falls into one of THREE categories (the section banners below):
//   1. `componentId` → a TOPOLOGY CARD. The object is a box on the overview;
//      its chip is navigable and picks up the node's zone accent colour.
//   2. `componentId` → an ETCD INTENT-STORE RECORD. The object is a CR / API
//      object that has no overview card but is persisted inside an etcd node
//      (mgmt-etcd / guest-etcd); its chip opens that record's detail. Same
//      navigable behaviour as a card — "componentId" just means "openable".
//   3. `kind` → a GENERIC KIND with no single backing object (Cluster API,
//      NetworkPolicy). Its chip is a muted, non-clickable highlight only.
//
// CAVEAT — kind vs. instance is matched purely by text, so a generic mention
// ("a NetworkPolicy is namespace-scoped", "pull Secrets") matches the same
// alias as a specific one. Aliases that read generically in the prose are kept
// in category 3 on purpose; only put a kind in category 1/2 when essentially
// every mention of it refers to the one concrete object in this scenario.
//
// A reference to the component whose modal is already open is rendered as plain
// text (see ObjectText.jsx), not a chip — never tag a node inside its own modal.
//
// Matching is intentionally CASE-SENSITIVE. API object names are proper nouns
// and appear capitalised when used as object references ("Watches Route
// objects", "into Cluster API objects"); the lowercase forms ("generic machine
// lifecycle", "the control plane") are ordinary prose and must stay untagged.
// A trailing plural "s" is tolerated so "NodePools" / "Routes" still match.

const ENTRIES = [
  // ── Navigable: objects that are nodes on the topology ──────────────────
  { componentId: 'hypershift-operator', aliases: ['HyperShift Operator'] },
  { componentId: 'hostedcluster-cr', aliases: ['HostedCluster'] },
  { componentId: 'nodepool-cr', aliases: ['NodePool'] },
  { componentId: 'cluster-version-operator', aliases: ['Cluster Version Operator', 'CVO'] },
  {
    componentId: 'control-plane-operator',
    aliases: ['Control Plane Operator', 'control-plane-operator', 'CPO'],
  },
  { componentId: 'capi-manager', aliases: ['Cluster API Manager', 'CAPI manager'] },
  {
    componentId: 'capk-provider',
    aliases: ['CAPI Provider (KubeVirt)', 'cluster-api-provider-kubevirt', 'CAPK'],
  },
  { componentId: 'guest-api-server', aliases: ['Guest API Server', 'guest API Server'] },
  { componentId: 'guest-oauth-server', aliases: ['Guest OAuth Server'] },
  { componentId: 'guest-controller-manager', aliases: ['Guest Controller Manager'] },
  { componentId: 'guest-kube-scheduler', aliases: ['Guest Scheduler', 'Guest Kube-Scheduler'] },
  { componentId: 'guest-etcd', aliases: ['Guest Etcd'] },
  { componentId: 'shared-ingress-proxy', aliases: ['Shared Ingress Proxy'] },
  { componentId: 'svc-ingress-lb-shared', aliases: ['Shared Ingress LoadBalancer'] },
  { componentId: 'ovn-master-control', aliases: ['OVN-Kubernetes Master', 'OVN-K8s Master'] },
  { componentId: 'cloud-controller-manager', aliases: ['Cloud Controller Manager', 'CCM'] },
  { componentId: 'konnectivity-server', aliases: ['Konnectivity Server'] },
  { componentId: 'ignition-server', aliases: ['Ignition Server'] },
  { componentId: 'cluster-monitoring', aliases: ['Cluster Monitoring'] },
  {
    componentId: 'mgmt-kube-apiserver',
    aliases: [
      'Management Kube API Server',
      'Management API Server',
      'management API Server',
      'Bare Metal API Server',
    ],
  },
  { componentId: 'mgmt-etcd', aliases: ['Management Etcd'] },
  { componentId: 'mgmt-controller-manager', aliases: ['Management Controller Manager'] },
  { componentId: 'mgmt-scheduler', aliases: ['Management Scheduler'] },
  { componentId: 'virt-handler', aliases: ['KubeVirt virt-handler', 'virt-handler', 'Virt-Handler'] },
  {
    componentId: 'kubevirt-launcher',
    aliases: ['KubeVirt Launcher Container', 'KubeVirt Launcher Pod', 'KubeVirt Launcher', 'virt-launcher'],
  },
  {
    componentId: 'guest-worker-node-vm',
    aliases: ['Guest Worker Node VM', 'Guest Worker Node Virtual Machine Instance'],
  },
  { componentId: 'konnectivity-agent', aliases: ['Konnectivity Agent'] },
  { componentId: 'coredns-node', aliases: ['CoreDNS Node'] },
  {
    componentId: 'openshift-ingress-router-guest',
    aliases: ['Guest Ingress Router', 'Ingress Router (Guest)', 'OpenShift Ingress Router'],
  },
  { componentId: 'svc-ingress-lb-guest', aliases: ['Ingress LoadBalancer'] },
  {
    componentId: 'frontend-workload-pod',
    aliases: ['Front-End Workload Pod', 'Front-End Workload Instance', 'Front-End Workload', 'Front-End Pod', 'frontend Pod'],
  },
  { componentId: 'svc-frontend', aliases: ['Front-End Service'] },
  {
    componentId: 'backend-workload-pod',
    aliases: ['Back-End Workload Pod', 'Back-End Workload', 'Back-End Pod', 'backend Pod'],
  },
  { componentId: 'svc-backend', aliases: ['Back-End ClusterIP Service', 'Back-End Service'] },
  { componentId: 'netpol-ecommerce', aliases: ['E-Commerce Network Policy'] },

  // ── API objects that live inside an etcd intent store (no overview card) ──
  // These resolve to the records persisted in the Management / Guest Etcd
  // stores, so a chip opens that object's detail just like a node chip does.
  { componentId: 'hostedcontrolplane-cr', aliases: ['HostedControlPlane'] },
  { componentId: 'clusterversion-cr', aliases: ['ClusterVersion'] },
  { componentId: 'clusteroperator-cr', aliases: ['ClusterOperator'] },
  { componentId: 'route-cr', aliases: ['Route'] },
  { componentId: 'machinedeployment-cr', aliases: ['MachineDeployment'] },
  { componentId: 'machineset-cr', aliases: ['MachineSet'] },
  { componentId: 'kubevirtmachine-cr', aliases: ['KubevirtMachine'] },
  { componentId: 'machine-cr', aliases: ['Machine'] },
  { componentId: 'guest-worker-node-vm', aliases: ['VirtualMachineInstance', 'VMI'] },
  { componentId: 'kubevirt-vm-cr', aliases: ['VirtualMachine'] },
  { componentId: 'endpointslice', aliases: ['EndpointSlice', 'Endpoint slice'] },
  { componentId: 'secret-workload', aliases: ['Secret'] },
  { componentId: 'configmap-workload', aliases: ['ConfigMap'] },
  { componentId: 'pvc-workload', aliases: ['PersistentVolumeClaim'] },
  { componentId: 'pv-workload', aliases: ['PersistentVolume'] },
  { componentId: 'replicaset-workload', aliases: ['ReplicaSet'] },

  // ── Highlight-only: kinds with no single backing object ────────────────
  { kind: 'Cluster API', aliases: ['Cluster API'] },
  { kind: 'NetworkPolicy', aliases: ['NetworkPolicy', 'Network Policy', 'Network Policies'] },
]

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// normalized (lower-cased) alias → entry, for resolving a match back to its
// entry regardless of an incidental trailing plural "s".
const aliasMap = new Map()
const aliasList = []
for (const entry of ENTRIES) {
  for (const alias of entry.aliases) {
    aliasMap.set(alias.toLowerCase(), entry)
    aliasList.push(alias)
  }
}
// Longest first so "Guest API Server" wins over "Cluster API", and
// "MachineDeployment" wins over "Machine".
aliasList.sort((a, b) => b.length - a.length)

// `(?<![\w-]) … s?(?![\w-])` brackets each alias on non-word/hyphen boundaries
// so we never tag a fragment inside a larger identifier (e.g. "Route" inside
// "Router"), while tolerating a trailing plural "s".
const PATTERN = new RegExp(`(?<![\\w-])(?:${aliasList.map(escapeRe).join('|')})s?(?![\\w-])`, 'g')

function resolve(matchText) {
  const lower = matchText.toLowerCase()
  if (aliasMap.has(lower)) return aliasMap.get(lower)
  if (lower.endsWith('s') && aliasMap.has(lower.slice(0, -1))) return aliasMap.get(lower.slice(0, -1))
  return null
}

// Split `text` into an ordered list of segments:
//   { type: 'text', value }
//   { type: 'ref',  value, componentId, kind }
// Plain strings (no recognised object) come back as a single text segment.
export function tokenizeObjectRefs(text) {
  if (!text) return [{ type: 'text', value: text || '' }]
  const out = []
  let last = 0
  PATTERN.lastIndex = 0
  let m
  while ((m = PATTERN.exec(text)) !== null) {
    const entry = resolve(m[0])
    if (!entry) continue
    if (m.index > last) out.push({ type: 'text', value: text.slice(last, m.index) })
    out.push({
      type: 'ref',
      value: m[0],
      componentId: entry.componentId || null,
      kind: entry.kind || null,
    })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ type: 'text', value: text.slice(last) })
  return out
}
