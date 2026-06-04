// Classifies a pipeline-tree row into the action keyword that leads its revealed
// description — Declared, Reconciles, Scheduled, Stored, Mounted, Routed, Filtered,
// Built, Runs, Isolated. The keyword names what the row's object *is, or does, in
// the band it sits in*, the same way the Interactions section tags each line by its
// verb (see interaction-kinds.js).
//
// Crucially this is BAND-AWARE, not just label-based: the same object reads
// differently depending on where it sits in the descent. In the Logical Intent
// band everything is declarative desired state, so it reads "Declared" — a Secret
// is not yet mounted there, a Service not yet routed; the concrete-action keywords
// (Mounted / Routed / Filtered / Stored) belong to the realization bands below,
// where that action literally happens. Two rows keep their own identity regardless
// of band: a Controller actively "Reconciles" (it drives intent into reality, it is
// not itself intent), and the Runtime Object band's instance is "Scheduled" (handed
// to a supervisor — building happens one band down, in the Translation Engine).
//
// Each keyword carries an accent so the action is colour-coded across the tree. A
// row we can't confidently place returns null, so the description renders without a
// keyword rather than a misleading one.

export const PIPELINE_ACTIONS = {
  declare:   { label: 'Declared',   accent: 'var(--k-amber)',  icon: 'document' },
  reconcile: { label: 'Reconciles', accent: 'var(--k-purple)', icon: 'loop' },
  store:     { label: 'Stored',     accent: 'var(--k-sky)',    icon: 'disk' },
  schedule:  { label: 'Scheduled',  accent: 'var(--k-sky)',    icon: 'cube' },
  mount:     { label: 'Mounted',    accent: 'var(--k-green)',  icon: 'mount' },
  route:     { label: 'Routed',     accent: 'var(--k-cyan)',   icon: 'route' },
  filter:    { label: 'Filtered',   accent: 'var(--k-orange)', icon: 'shield' },
  build:     { label: 'Built',      accent: 'var(--k-blue)',   icon: 'build' },
  run:       { label: 'Runs',       accent: 'var(--k-teal)',   icon: 'run' },
  isolate:   { label: 'Isolated',   accent: 'var(--k-purple)', icon: 'isolate' },
}

// [regex on the row label, action key] for the realization bands (everything below
// Logical Intent). Order matters: earlier wins, matched most-specific first. These
// only decide a row's keyword OUTSIDE the Logical Intent band — inside it every row
// is "Declared" (or "Reconciles" for a controller), handled in classifyRow before
// these rules are consulted. The `declare` fallback for bare controller-object
// labels is a safe default for the rare case one appears outside the intent band.
const RULES = [
  [/PersistentVolumeClaim|PersistentVolume\b/i, 'mount'],
  [/ConfigMap|Secret/i, 'mount'],
  [/tmpfs|kernel mount/i, 'mount'],
  [/EndpointSlice/i, 'route'],
  [/ClusterIP|MetalLB|L2 VIP|router-default LB|LoadBalancer|vhost/i, 'route'],
  [/\bService\b/i, 'route'],
  [/NetworkPolicy|OVN ACL/i, 'filter'],
  // The Translation Engine prepares, then crun creates. The kubelet and CRI-O
  // *build* — resolve the spec, assemble the OCI bundle — so they read "Built".
  // crun is the low-level runtime that actually *runs* that bundle (clone /
  // unshare / setns → exec PID 1), so it reads "Runs", marking the high-level
  // (prepare) → low-level (create) handoff right where it happens.
  [/\[systemd\] (Kubelet|CRI-O)/i, 'build'],
  [/\[OCI\] crun|\bcrun\b/i, 'run'],
  [/\[Pod\]|\[Static Pod\]|VirtualMachineInstance/i, 'build'],
  [/Process|PID 1|guest OS|RHCOS|KVM vCPU|vCPU/i, 'run'],
  [/Network Namespace|netns|mount ns|cgroup/i, 'isolate'],
  [/etcd record|CustomResource|MachineConfig/i, 'store'],
  [/Deployment|(Replica|Daemon|Stateful)Set/i, 'declare'],
]

// Returns the action meta { key, label, accent, icon } for a row, or null.
// `layerId` is the band the row sits in (see pipeline-layers.js) and drives the
// band-aware overrides described at the top of this file.
export function classifyRow(label, layerId) {
  if (!label) return null

  // A controller is the active reconcile loop wherever it appears — it drives the
  // declared intent into reality, so it reads "Reconciles", never "Declared".
  if (/^\[Controller\]/.test(label)) return { key: 'reconcile', ...PIPELINE_ACTIONS.reconcile }

  // Logical Intent band: declarative desired state. Every object here is "Declared",
  // whatever becomes of it downstream — the concrete actions (Mounted / Routed /
  // Stored …) are reserved for the realization bands where they actually happen.
  if (layerId === 'logical-intent') return { key: 'declare', ...PIPELINE_ACTIONS.declare }

  // Realization bands: classify by label.
  let key = null
  for (const [re, k] of RULES) {
    if (re.test(label)) { key = k; break }
  }
  if (!key) return null

  // Runtime Object band: the instance is *handed to a supervisor* — scheduled, not
  // yet built. Building is the Translation Engine's job (kubelet / CRI-O /
  // virt-launcher keep "Built"; crun, the low-level runtime, "Runs" it), one band
  // down.
  if (layerId === 'api-boundary' && key === 'build') key = 'schedule'

  return { key, ...PIPELINE_ACTIONS[key] }
}
