// The five pipeline layers that describe a component's descent from declarative
// manifest to running Linux kernel primitive. These are *stages of a journey*,
// not per-component classifications: a single component (e.g. a Pod) travels
// through several of them. They surface only as the ordered bands of the
// Manifest → Kernel pipeline tree (see pipeline-model.js / PipelineTree.jsx),
// never as a standalone tag on an object.
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
    icon: 'document',
    blurb: 'Declarative desired state — Deployments, ReplicaSets, MachineConfigs, Custom Resources, and the operators that reconcile them. The host plane lives here too: a systemd service\'s intent is a MachineConfig reconciled by the Machine Config Operator.',
  },
  {
    id: 'api-boundary',
    order: 2,
    label: 'Runtime Object',
    colorVar: '--k-sky',
    icon: 'cube',
    blurb: 'The concrete, named instance the engine actually runs — a Pod, a VirtualMachineInstance, or an on-disk .service unit. Distinct from band 1 not by being an API object (the controllers above are too) but by being the single thing handed to a supervisor.',
  },
  {
    id: 'translation-engine',
    order: 3,
    label: 'Translation Engine',
    colorVar: '--k-amber',
    icon: 'gear',
    blurb: 'Host systemd services — Kubelet, CRI-O, OVN/OVS — that translate API objects into running processes and wiring.',
  },
  {
    id: 'linux-primitive',
    order: 4,
    label: 'Linux Kernel Primitives',
    colorVar: '--k-green',
    icon: 'chip',
    blurb: 'The kernel realization — cgroups, namespaces, tmpfs RAM mounts, and block-device mounts under PID 1.',
  },
]

// Quick lookup: layer id → definition object. Consumed by PipelineTree to
// render each band's number, icon, label, and color.
export const PIPELINE_LAYER_BY_ID = Object.fromEntries(
  PIPELINE_LAYERS.map((l) => [l.id, l]),
)
