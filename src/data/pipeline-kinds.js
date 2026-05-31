// Classifies a pipeline-tree row by *what happens to it* — Stored, Reconciled,
// Mounted, Routed, Filtered, Built, Runs, Isolated — so the chip that leads a
// row's revealed description explains the mechanism, the same way the Interactions
// section tags each line by its verb (see interaction-kinds.js). This is the
// complement of the row label, not an echo of it: the label says *what the thing
// is* (an EndpointSlice, an etcd record), the chip says *what the pipeline does
// with it* (Routed, Stored).
//
// Each kind carries its own accent + icon so the action is colour-coded across the
// whole tree — every "Routed" reads cyan, every "Runs" teal — turning the chips
// into a scannable key. Heuristic and intentionally conservative: matched
// most-specific first, and a label we can't confidently place returns null, so the
// description simply renders without a chip rather than a misleading one.

export const PIPELINE_ACTIONS = {
  store:     { label: 'Stored',     accent: 'var(--k-sky)',    icon: 'disk' },
  reconcile: { label: 'Reconciled', accent: 'var(--k-amber)',  icon: 'loop' },
  mount:     { label: 'Mounted',    accent: 'var(--k-green)',  icon: 'mount' },
  route:     { label: 'Routed',     accent: 'var(--k-cyan)',   icon: 'route' },
  filter:    { label: 'Filtered',   accent: 'var(--k-orange)', icon: 'shield' },
  build:     { label: 'Built',      accent: 'var(--k-blue)',   icon: 'build' },
  run:       { label: 'Runs',       accent: 'var(--k-teal)',   icon: 'run' },
  isolate:   { label: 'Isolated',   accent: 'var(--k-purple)', icon: 'isolate' },
}

// [regex on the row label, action kind]. Order matters: earlier wins. `store` and
// `reconcile` sit late so the more concrete actions (a Secret is Mounted, a
// Service is Routed) win over the generic "it's declarative state" reading; and
// `store` precedes `reconcile` so a CustomResource like MachineDeployment is
// Stored, not caught by the bare /Deployment/ reconcile rule.
const RULES = [
  [/PersistentVolumeClaim|PersistentVolume\b/i, 'mount'],
  [/ConfigMap|Secret/i, 'mount'],
  [/tmpfs|kernel mount/i, 'mount'],
  [/EndpointSlice/i, 'route'],
  [/ClusterIP|MetalLB|L2 VIP|router-default LB|LoadBalancer|vhost/i, 'route'],
  [/\bService\b/i, 'route'],
  [/NetworkPolicy|OVN ACL/i, 'filter'],
  [/\[systemd\] (Kubelet|CRI-O)/i, 'build'],
  [/\[Pod\]|\[Static Pod\]|VirtualMachineInstance/i, 'build'],
  [/Process|PID 1|guest OS|RHCOS|KVM vCPU|vCPU/i, 'run'],
  [/Network Namespace|netns|mount ns|cgroup/i, 'isolate'],
  [/etcd record|CustomResource|MachineConfig/i, 'store'],
  [/Deployment|(Replica|Daemon|Stateful)Set/i, 'reconcile'],
]

// Returns the action meta { key, label, accent, icon } for a row label, or null.
export function classifyRow(label) {
  if (!label) return null
  for (const [re, key] of RULES) {
    if (re.test(label)) return { key, ...PIPELINE_ACTIONS[key] }
  }
  return null
}
