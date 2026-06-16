// ── Primitives-mode component internals (Overview v2) ───────────────────────
// In Primitives mode each runtime-instance box (a Pod / Static Pod, a [systemd]
// service, or a VirtualMachineInstance) opens *in place* to reveal the Linux
// kernel primitives behind it — but as a *containment tree*, not a flat list:
// the boxes nest the way the kernel objects actually nest, so the view teaches
// what-lives-inside-what rather than enumerating loose primitives.
//
//   • the Pod cgroup slice is the outer *constraint envelope* (the resource
//     ceiling for the whole Pod),
//   • the shared network namespace is the *containment* box every container
//     joins — the pod's eth0 is welded onto its rim as an interface port,
//   • each container is its own box where the PID-1 process lives, carrying its
//     listen socket and its per-container namespaces (mount/PID) + constraints
//     (cgroup, SELinux, seccomp, capabilities).
//
// The boxes are derived from:
//   • PRIMITIVES_BY_TYPE[typePrefix]   (src/data/primitives.js) — the per-type
//     kernel/OS/virt primitive set (id, label, description, interactions, commands)
//   • the component's `linuxPrimitive`  (components.json) — the per-instance
//     realisation, folded into the process box (matching pipeline-model.js)
//   • two synthetic grouping boxes authored here (the container box, the process
//     listen socket) that have no PRIMITIVES_BY_TYPE item of their own.
//
// Output shape matches PrimitiveBoxCard's `internal`:
//   { bands: [{ label?, boxes: [box] }] }  where each box may carry `children`,
// and a child with variant:'iface' peels onto its parent's rim as a port pill,
// variant:'socket' renders as a syscall jack — exactly like Network mode's
// hand-authored network-internals.js. detail = { role, summary, sections } —
// the shape DeepDiveModal renders.

import { PRIMITIVES_BY_TYPE } from './primitives'
import { findComponent } from './components-index'

const RUNTIME_TYPES = new Set(['Pod', 'Static Pod', 'systemd', 'VirtualMachineInstance'])

const typeOf = (node) => node?.typePrefix || findComponent(node?.id)?.typePrefix

// A node opens to its primitives only when it bottoms out in real kernel objects.
export const isRuntimeInstance = (node) => RUNTIME_TYPES.has(typeOf(node))

// Per-primitive presentation: a short execution-primitive tag (what runs here —
// never a desired-state kind), an accent, and a terse caption. `fold` marks the
// process box that carries the component's per-instance `linuxPrimitive`:
// 'title' rewrites the row to `PID 1 · <realisation>` (Pod / systemd, matching
// pipeline-model), 'caption' shows it as the subtitle (VMI, no PID-1 row).
const META = {
  'pod-netns':         { tag: 'netns',   colorVar: 'k-purple', caption: 'shared network stack' },
  'pod-veth':          { tag: 'netdev',  colorVar: 'k-teal',   caption: 'veth → br-int' },
  'pod-ipcns':         { tag: 'ipcns',   colorVar: 'k-purple', caption: 'shared shm / sem' },
  'pod-utsns':         { tag: 'utsns',   colorVar: 'k-purple', caption: 'shared hostname' },
  'pod-cgroup-slice':  { tag: 'cgroup',  colorVar: 'k-purple', caption: 'pod QoS resource ceiling' },
  'pod-mountns':       { tag: 'mountns', colorVar: 'k-purple', caption: 'private filesystem view' },
  'pod-pidns':         { tag: 'pidns',   colorVar: 'k-purple', caption: 'own PID 1' },
  'pod-cgroups':       { tag: 'cgroup',  colorVar: 'k-orange', caption: 'per-container limits' },
  'pod-selinux':       { tag: 'LSM',     colorVar: 'k-orange', caption: 'MCS isolation' },
  'pod-seccomp':       { tag: 'seccomp', colorVar: 'k-orange', caption: 'BPF syscall filter' },
  'pod-capabilities':  { tag: 'caps',    colorVar: 'k-orange', caption: 'dropped capabilities' },
  'container-process': { tag: 'process', colorVar: 'k-green',  caption: 'application binary', fold: 'title' },
  'systemd-unit':      { tag: 'unit',    colorVar: 'k-amber',  caption: '.service file' },
  'cgroup-slice':      { tag: 'cgroup',  colorVar: 'k-purple', caption: 'per-service accounting' },
  'service-process':   { tag: 'process', colorVar: 'k-green',  caption: 'host process', fold: 'title' },
  'kvm-vcpu':          { tag: 'KVM',     colorVar: 'k-purple', caption: '/dev/kvm vCPU thread' },
  'qemu-process':      { tag: 'process', colorVar: 'k-green',  caption: 'machine emulator', fold: 'caption' },
  'vhost-net':         { tag: 'vhost',   colorVar: 'k-purple', caption: 'in-kernel virtio' },
  'vmi-tap':           { tag: 'netdev',  colorVar: 'k-teal',   caption: 'tap0 ↔ k6t-eth0' },
}

// Synthetic boxes with no PRIMITIVES_BY_TYPE item — defined here so the change
// stays scoped to this view (no new primitives.js items that other consumers
// like pipeline-model.js / the DetailPanel would have to account for).
//
// The container box *is* the container's cgroup envelope: rather than drawing
// the per-container cgroup as one more box inside the container, we merge the
// two — the container's outer boundary is the cgroup that bounds it (mirroring
// how the Pod cgroup slice is the Pod's outer boundary). Its detail folds in the
// per-container cgroup explore commands.
const CONTAINER_BOX = {
  id: 'container', title: 'container', tag: 'container', colorVar: 'k-teal',
  caption: 'cgroup-bounded · its own mount + PID ns',
  detail: {
    role: 'CONTAINER · CGROUP-BOUNDED',
    summary:
      "One container in the Pod, drawn as its own cgroup boundary: crun creates its cgroup nested under the Pod slice (kubepods.slice/…/crio-<id>) with its own CPU/memory limits, gives it a private mount and PID namespace, and applies the SELinux label, seccomp filter, and capability set — then execs the entrypoint as PID 1. It joins the network, IPC, and UTS namespaces the pause (sandbox) container already holds open, so every container in the Pod shares one network identity.",
    sections: [
      { heading: 'Explore', commands: [
        '# Find the container cgroup (nested under the Pod slice)\ncrictl inspect <id> | jq .info.runtimeSpec.linux.cgroupsPath',
        '# Its CPU / memory ceiling\ncat /sys/fs/cgroup/<cgroup_path>/memory.max\ncat /sys/fs/cgroup/<cgroup_path>/cpu.max',
      ] },
    ],
  },
}
// What the mount namespace isolates: the container's private filesystem view.
const ROOTFS_BOX = {
  id: 'rootfs', title: 'overlayfs /', tag: 'rootfs', colorVar: 'k-sky',
  caption: 'image layers + tmpfs secrets',
  detail: {
    role: 'CONTAINER ROOTFS',
    summary:
      "The root filesystem the mount namespace isolates: an overlayfs assembled from the image layers, with each volume bind-mounted in — Secrets and ConfigMaps as in-memory tmpfs, PersistentVolumeClaims as real block devices. Private to this container, invisible to the host and other Pods.",
    sections: [],
  },
}
const LOOPBACK_BOX = {
  id: 'lo', title: 'lo', tag: 'netdev', colorVar: 'k-sky',
  caption: '127.0.0.1 · loopback',
  detail: {
    role: 'LOOPBACK INTERFACE',
    summary:
      "The loopback net_device every network namespace is born with: it carries 127.0.0.1 traffic that never leaves the namespace. Because all containers in the Pod share this one network namespace, a sidecar can reach the app over localhost — the co-location guarantee a Pod gives you — while staying completely invisible to other Pods.",
    sections: [],
  },
}
const LISTEN_SOCKET_BOX = {
  id: 'listen-sock', title: 'listen socket', tag: 'socket', colorVar: 'k-orange',
  caption: 'AF_INET · Pod IP',
  detail: {
    role: 'LISTEN SOCKET',
    summary:
      "The process binds an AF_INET socket on the Pod's private Pod IP and listens for inbound connections. Because it lives in the Pod's shared network namespace, a packet that arrives on eth0 is delivered straight to this socket — a ClusterIP is only a Service VIP that ultimately resolves to this Pod IP.",
    sections: [
      { heading: 'Explore', commands: ['# List the listening sockets in the container\noc exec <pod> -n <ns> -- ss -tlnp'] },
    ],
  },
}

// The containment tree per type. Every node is one of a small visual vocabulary
// keyed by `variant`, so a primitive's *kind* is legible at a glance:
//   (default)         → a solid leaf card — the thing that runs / is isolated
//   variant:'envelope'→ a dashed frame: a cgroup, a resource *ceiling* (pod slice,
//                        and the container, which we draw AS its own cgroup)
//   variant:'ns'      → a hatched solid frame: a namespace *isolation boundary*
//                        that nests whatever it isolates (pid ns → process,
//                        mount ns → rootfs, net ns → interfaces + the container)
//   variant:'guard'   → a small shield chip: a filter applied to the container
//                        (SELinux label, seccomp profile, capability set)
//   variant:'iface'   → a port pill welded onto a namespace's rim (lo / eth0)
//   variant:'socket'  → a syscall jack endpoint (the process's listen socket)
// Spec node forms: 'id' | { id, variant?, title?, children } | { synthetic, variant?, children }
const LAYOUT_BY_TYPE = {
  Pod: [
    // Pod cgroup slice = the outer resource ceiling (dashed envelope) …
    { id: 'pod-cgroup-slice', variant: 'envelope', children: [
      // … wrapping the shared network namespace (the isolation boundary every
      // container joins). lo + eth0 are welded onto its rim; the other pod-shared
      // namespaces and the container sit inside it.
      { id: 'pod-netns', variant: 'ns', children: [
        { synthetic: LOOPBACK_BOX, variant: 'iface' },
        { id: 'pod-veth', variant: 'iface', title: 'eth0' },
        { id: 'pod-ipcns', variant: 'ns' },
        { id: 'pod-utsns', variant: 'ns' },
        // The container = its own cgroup boundary. Inside: the guards applied to
        // it (chips), then the two namespaces it owns — mount ns nesting the
        // rootfs it isolates, PID ns nesting the PID-1 process (+ its socket).
        { synthetic: CONTAINER_BOX, variant: 'envelope', children: [
          { id: 'pod-selinux', variant: 'guard' },
          { id: 'pod-seccomp', variant: 'guard' },
          { id: 'pod-capabilities', variant: 'guard' },
          { id: 'pod-mountns', variant: 'ns', children: [
            { synthetic: ROOTFS_BOX },
          ] },
          { id: 'pod-pidns', variant: 'ns', children: [
            'container-process',
            { synthetic: LISTEN_SOCKET_BOX, variant: 'socket' },
          ] },
        ] },
      ] },
    ] },
  ],
  systemd: [
    // The .service declaration, then the cgroup slice the process actually lives
    // in (the host-service analogue of the container's cgroup boundary). A host
    // service runs in the root namespaces, so there is no namespace nesting.
    'systemd-unit',
    { id: 'cgroup-slice', variant: 'envelope', children: ['service-process'] },
  ],
  VirtualMachineInstance: [
    // The QEMU process owns the VM: its vCPU threads and vhost offload live
    // inside it, and tap0 is the guest NIC welded onto its rim.
    { id: 'qemu-process', children: [
      { id: 'vmi-tap', variant: 'iface', title: 'tap0' },
      'kvm-vcpu', 'vhost-net',
    ] },
  ],
}

const buildBox = (ctx, id, opts = {}) => {
  const item = ctx.byId.get(id)
  if (!item) return null
  const meta = META[id] || { tag: 'kernel', colorVar: 'k-purple' }
  let title = opts.title || item.label
  let caption = meta.caption
  // Fold the per-instance realisation into the process row the same way
  // pipeline-model.js does (skipped when an explicit title override is given,
  // e.g. an interface relabelled to 'eth0'). A Pod's row keeps "PID 1" (its
  // entrypoint really is PID 1 inside the container's PID namespace); a systemd
  // service keeps "systemd Process" (a CHILD of PID 1, never PID 1 itself).
  if (!opts.title && meta.fold === 'title' && ctx.linuxPrimitive) title = `${item.label.split(' · ')[0]} · ${ctx.linuxPrimitive}`
  else if (meta.fold === 'caption' && ctx.linuxPrimitive) caption = ctx.linuxPrimitive

  const sections = []
  if (item.interactions?.length) sections.push({ heading: 'Interactions', bullets: item.interactions })
  if (item.commands?.length) sections.push({ heading: 'Explore', commands: item.commands })

  return {
    id: `${ctx.componentId}__${item.id}`,
    title,
    typePrefix: meta.tag,
    variant: opts.variant,
    colorVar: meta.colorVar,
    caption,
    detail: { role: item.label.toUpperCase(), summary: item.description, sections },
  }
}

const buildSynthetic = (ctx, syn, variant) => ({
  id: `${ctx.componentId}__${syn.id}`,
  title: syn.title,
  typePrefix: syn.tag,
  variant: variant || syn.variant,
  colorVar: syn.colorVar,
  caption: syn.caption,
  detail: syn.detail,
})

// Resolve one spec node (and its subtree) into the box shape PrimitiveBoxCard's
// renderBox consumes. Returns null if a referenced primitive is absent.
const buildNode = (spec, ctx) => {
  if (typeof spec === 'string') return buildBox(ctx, spec)

  if (spec.synthetic) {
    const box = buildSynthetic(ctx, spec.synthetic, spec.variant)
    if (spec.children) box.children = spec.children.map((c) => buildNode(c, ctx)).filter(Boolean)
    return box
  }

  const box = buildBox(ctx, spec.id, { title: spec.title, variant: spec.variant })
  if (box && spec.children) box.children = spec.children.map((c) => buildNode(c, ctx)).filter(Boolean)
  return box
}

// Build the in-place internals for a runtime-instance node, or null if the node
// is not a drillable instance. Resolves the registered component (for
// `linuxPrimitive`) by id, falling back to the zone node's own fields.
export function buildPrimitiveInternals(node) {
  const typePrefix = typeOf(node)
  if (!RUNTIME_TYPES.has(typePrefix)) return null

  const key = typePrefix === 'Static Pod' ? 'Pod' : typePrefix
  const set = PRIMITIVES_BY_TYPE[key]
  const layout = LAYOUT_BY_TYPE[key]
  if (!set || !layout) return null

  const component = findComponent(node?.id)
  const componentId = node?.id || component?.componentId
  const linuxPrimitive = component?.linuxPrimitive || node?.linuxPrimitive
  const ctx = { componentId, byId: new Map(set.items.map((i) => [i.id, i])), linuxPrimitive }

  const boxes = layout.map((spec) => buildNode(spec, ctx)).filter(Boolean)
  return boxes.length ? { bands: [{ boxes }] } : null
}
