// ── Primitives-mode component internals (Overview v2) ───────────────────────
// In Primitives mode each runtime-instance box (a Pod / Static Pod, a [systemd]
// service, or a VirtualMachineInstance) opens *in place* to reveal the Linux
// kernel primitives behind it — partitioned into placement bands inside the
// component's OWN card (never a zone), exactly like Network mode's PrimitiveBoxCard,
// but generated from existing data rather than hand-authored per component.
//
// The bands/boxes are derived from:
//   • PRIMITIVES_BY_TYPE[typePrefix]   (src/data/primitives.js) — the per-type
//     kernel/OS/virt primitive set (id, label, description, interactions, commands)
//   • the component's `linuxPrimitive`  (components.json) — the per-instance
//     realisation, folded into the process box (matching pipeline-model.js)
//
// Output shape matches PrimitiveBoxCard's `internal`:
//   { bands: [{ label, boundary?, boxes: [{ id, title, typePrefix, colorVar,
//               caption, detail }] }] }
// where detail = { role, summary, sections:[{ heading, bullets|commands }] } —
// the shape DeepDiveModal renders.

import { PRIMITIVES_BY_TYPE } from './primitives'
import { findComponent } from './components-index'

const RUNTIME_TYPES = new Set(['Pod', 'Static Pod', 'systemd', 'VirtualMachineInstance'])

const typeOf = (node) => node?.typePrefix || findComponent(node?.id)?.typePrefix

// A node opens to its primitives only when it bottoms out in real kernel objects.
export const isRuntimeInstance = (node) => RUNTIME_TYPES.has(typeOf(node))

// Band layout per type: ordered groups of primitive-item ids, top (user space) to
// bottom (kernel). A `boundary` label draws the faded "── kernel boundary ──"
// divider above that band.
const BANDS_BY_TYPE = {
  // Three Pod bands so the kernel set (now 11 items) doesn't crowd one band and
  // the layout mirrors the pipeline tree's pod-sandbox vs per-container split.
  Pod: [
    { label: 'user space · container process', ids: ['container-process'] },
    { label: 'kernel · pod sandbox (shared)', boundary: 'kernel boundary',
      ids: ['pod-netns', 'pod-veth', 'pod-ipcns', 'pod-utsns', 'pod-cgroup-slice'] },
    { label: 'kernel · per container',
      ids: ['pod-mountns', 'pod-pidns', 'pod-cgroups', 'pod-selinux', 'pod-seccomp', 'pod-capabilities'] },
  ],
  systemd: [
    { label: 'unit · supervised by PID 1', ids: ['systemd-unit'] },
    { label: 'kernel · slice & process', boundary: 'kernel boundary',
      ids: ['cgroup-slice', 'service-process'] },
  ],
  VirtualMachineInstance: [
    { label: 'user space · QEMU', ids: ['qemu-process'] },
    { label: 'kernel · KVM & net', boundary: 'kernel boundary',
      ids: ['kvm-vcpu', 'vhost-net', 'vmi-tap'] },
  ],
}

// Per-primitive presentation: a short execution-primitive tag (what runs at this
// band — never a desired-state kind), a band-keyed accent, and a terse caption.
// `fold` marks the process box that carries the component's per-instance
// `linuxPrimitive`: 'title' rewrites the row to `PID 1 · <realisation>` (Pod /
// systemd, matching pipeline-model), 'caption' shows it as the subtitle (VMI,
// which has no PID-1 process row).
const META = {
  'pod-netns':         { tag: 'netns',   colorVar: 'k-purple', caption: 'private network stack' },
  'pod-veth':          { tag: 'netdev',  colorVar: 'k-teal',   caption: 'eth0 ↔ br-int' },
  'pod-ipcns':         { tag: 'ipcns',   colorVar: 'k-purple', caption: 'shared shm / sem' },
  'pod-utsns':         { tag: 'utsns',   colorVar: 'k-purple', caption: 'shared hostname' },
  'pod-cgroup-slice':  { tag: 'cgroup',  colorVar: 'k-purple', caption: 'pod QoS slice' },
  'pod-mountns':       { tag: 'mountns', colorVar: 'k-purple', caption: 'overlayfs rootfs' },
  'pod-pidns':         { tag: 'pidns',   colorVar: 'k-purple', caption: 'own PID 1' },
  'pod-cgroups':       { tag: 'cgroup',  colorVar: 'k-purple', caption: 'per-container limits' },
  'pod-selinux':       { tag: 'LSM',     colorVar: 'k-purple', caption: 'MCS isolation' },
  'pod-seccomp':       { tag: 'seccomp', colorVar: 'k-purple', caption: 'BPF syscall filter' },
  'pod-capabilities':  { tag: 'caps',    colorVar: 'k-purple', caption: 'dropped capabilities' },
  'container-process': { tag: 'process', colorVar: 'k-green',  caption: 'application binary', fold: 'title' },
  'systemd-unit':      { tag: 'unit',    colorVar: 'k-amber',  caption: '.service file' },
  'cgroup-slice':      { tag: 'cgroup',  colorVar: 'k-purple', caption: 'per-service accounting' },
  'service-process':   { tag: 'process', colorVar: 'k-purple', caption: 'host process', fold: 'title' },
  'kvm-vcpu':          { tag: 'KVM',     colorVar: 'k-purple', caption: '/dev/kvm vCPU thread' },
  'qemu-process':      { tag: 'process', colorVar: 'k-teal',   caption: 'machine emulator', fold: 'caption' },
  'vhost-net':         { tag: 'vhost',   colorVar: 'k-purple', caption: 'in-kernel virtio' },
  'vmi-tap':           { tag: 'netdev',  colorVar: 'k-teal',   caption: 'tap0 ↔ k6t-eth0' },
}

const buildBox = (componentId, item, meta, linuxPrimitive) => {
  let title = item.label
  let caption = meta.caption
  // Fold the per-instance realisation into the process row the same way
  // pipeline-model.js does: keep the primitive's own label prefix and swap its
  // generic tail for the realisation. A Pod's row keeps "PID 1" (its entrypoint
  // really is PID 1 *inside the container's* PID namespace) → "PID 1 · <binary>";
  // a systemd service keeps "systemd Process" (it is a CHILD of PID 1, never PID
  // 1 itself) → "systemd Process · <binary>".
  if (meta.fold === 'title' && linuxPrimitive) title = `${item.label.split(' · ')[0]} · ${linuxPrimitive}`
  else if (meta.fold === 'caption' && linuxPrimitive) caption = linuxPrimitive

  const sections = []
  if (item.interactions?.length) sections.push({ heading: 'Interactions', bullets: item.interactions })
  if (item.commands?.length) sections.push({ heading: 'Explore', commands: item.commands })

  return {
    id: `${componentId}__${item.id}`,
    title,
    typePrefix: meta.tag,
    colorVar: meta.colorVar,
    caption,
    detail: { role: item.label.toUpperCase(), summary: item.description, sections },
  }
}

// Build the in-place internals for a runtime-instance node, or null if the node
// is not a drillable instance. Resolves the registered component (for
// `linuxPrimitive`) by id, falling back to the zone node's own fields.
export function buildPrimitiveInternals(node) {
  const typePrefix = typeOf(node)
  if (!RUNTIME_TYPES.has(typePrefix)) return null

  const key = typePrefix === 'Static Pod' ? 'Pod' : typePrefix
  const set = PRIMITIVES_BY_TYPE[key]
  const bandDefs = BANDS_BY_TYPE[key]
  if (!set || !bandDefs) return null

  const component = findComponent(node?.id)
  const componentId = node?.id || component?.componentId
  const linuxPrimitive = component?.linuxPrimitive || node?.linuxPrimitive
  const byId = new Map(set.items.map((i) => [i.id, i]))

  const bands = bandDefs
    .map((bd) => ({
      label: bd.label,
      boundary: bd.boundary,
      boxes: bd.ids
        .map((id) => {
          const item = byId.get(id)
          if (!item) return null
          return buildBox(componentId, item, META[id] || { tag: 'kernel', colorVar: 'k-purple' }, linuxPrimitive)
        })
        .filter(Boolean),
    }))
    .filter((b) => b.boxes.length)

  return bands.length ? { bands } : null
}
