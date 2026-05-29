// The five pipeline-layer tags that classify every component on its journey
// from declarative manifest to running Linux kernel primitive. Each component
// in components.json carries exactly one `pipelineLayer` matching an `id` below.
//
// The colors deliberately track the existing top-to-bottom zone gradient
// (cyan → green) so the modal's tree reads as a descent through the stack.
// `--packet` (red) is reserved for active trace and never appears here.

export const PIPELINE_LAYERS = [
  {
    id: 'logical-intent',
    order: 1,
    label: 'Logical Intent',
    colorVar: '--k-cyan',
    icon: '📜',
    blurb: 'Declarative desired state — Deployments, ReplicaSets, Custom Resources, and the operators that reconcile them.',
  },
  {
    id: 'api-boundary',
    order: 2,
    label: 'API Boundary',
    colorVar: '--k-sky',
    icon: '🔌',
    blurb: 'The Pod object metadata and API surfaces (API servers, Services, ingress, etcd) that accept and persist intent.',
  },
  {
    id: 'translation-engine',
    order: 3,
    label: 'Translation Engine',
    colorVar: '--k-amber',
    icon: '⚙️',
    blurb: 'Host daemons — systemd Kubelet, CRI-O, OVN/OVS — that translate API objects into running processes and wiring.',
  },
  {
    id: 'consumed-resource',
    order: 3.5,
    label: 'Consumed Resources',
    colorVar: '--k-purple',
    icon: '🧩',
    blurb: 'API objects injected into the Pod — Secrets, ConfigMaps, PersistentVolumeClaims — materialized as host files.',
  },
  {
    id: 'linux-primitive',
    order: 4,
    label: 'Linux Kernel Primitives',
    colorVar: '--k-green',
    icon: '🧬',
    blurb: 'The kernel realization — cgroups, namespaces, tmpfs RAM mounts, and block-device mounts under PID 1.',
  },
]

// Quick lookup: pipelineLayer id → definition object.
export const PIPELINE_LAYER_BY_ID = Object.fromEntries(
  PIPELINE_LAYERS.map((l) => [l.id, l]),
)

// Resolve a layer tag to its CSS color value (e.g. 'var(--k-sky)'); falls back
// to muted text for unknown/missing tags.
export function pipelineLayerColor(id) {
  const layer = PIPELINE_LAYER_BY_ID[id]
  return layer ? `var(${layer.colorVar})` : 'var(--tx-muted)'
}
