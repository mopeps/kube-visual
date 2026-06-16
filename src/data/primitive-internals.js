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
  id: 'container', title: 'container cgroup', tag: 'cgroup', colorVar: 'k-teal',
  caption: 'under the Pod slice · its own mount + PID ns',
  detail: {
    role: 'CONTAINER CGROUP',
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
// The PID-1 process is not "inside" one namespace — it holds one membership per
// namespace type at once and sits at their intersection. We surface that as a row
// of membership chips on the process card: each points at the box of the
// namespace it joins, so hovering a chip lights up that frame (the [mnt] chip →
// the mount-ns box that holds the rootfs is the "this process sees those files"
// link). `view` is the lens that namespace grants the process.
const POD_PROCESS_NS = [
  { tag: 'mnt',    ref: 'pod-mountns', view: 'sees its files',  colorVar: 'k-purple' },
  { tag: 'pid',    ref: 'pod-pidns',   view: 'is PID 1',        colorVar: 'k-purple' },
  { tag: 'net',    ref: 'pod-netns',   view: 'binds sockets',   colorVar: 'k-purple' },
  { tag: 'ipc',    ref: 'pod-ipcns',   view: 'shares /dev/shm', colorVar: 'k-purple' },
  { tag: 'uts',    ref: 'pod-utsns',   view: 'its hostname',    colorVar: 'k-purple' },
  { tag: 'cgroup', ref: 'container',   view: 'resource caps',   colorVar: 'k-teal' },
]

// What the mount namespace isolates: the container's private filesystem, drawn
// as the boxes mounted into it — the overlayfs root plus one box per Kubernetes
// volume, each tagged by what backs it. The teaching point is the backing: a
// Secret / ConfigMap is tmpfs (RAM, never on disk) while a PVC is real block
// storage, and /proc is a procfs whose *contents* come from the PID namespace.
const FS_MOUNTS = [
  {
    id: 'fs-root', title: '/', tag: 'overlayfs', colorVar: 'k-green',
    caption: 'image layers + writable upper',
    detail: {
      role: 'OVERLAYFS ROOT (/)',
      summary:
        "The container's root filesystem: an overlayfs merging the read-only image layers (lowerdir) with a per-container writable layer (upperdir). Ephemeral — the writable layer is discarded when the container is removed.",
      sections: [{ heading: 'Explore', commands: ['# The overlay mount and its layers\nnsenter -t <pid> -m mount | grep overlay'] }],
    },
  },
  {
    id: 'fs-secret', title: '/etc/tls', tag: 'tmpfs', colorVar: 'k-sky',
    caption: 'Secret "app-tls" → tls.crt · tls.key',
    detail: {
      role: 'SECRET MOUNT · tmpfs',
      summary:
        "A tmpfs (RAM-backed) mount projecting a Secret's keys as files. Because it's tmpfs the secret never touches disk; the kubelet materialises it and CRI-O bind-mounts it in before the container starts, and it's updated in place when the Secret changes.",
      sections: [{ heading: 'Explore', commands: ['# Confirm the mount is tmpfs (RAM)\nnsenter -t <pid> -m findmnt /etc/tls'] }],
    },
  },
  {
    id: 'fs-configmap', title: '/etc/config', tag: 'tmpfs', colorVar: 'k-sky',
    caption: 'ConfigMap "app-config" → app.yaml · log-level',
    detail: {
      role: 'CONFIGMAP MOUNT · tmpfs',
      summary:
        "A tmpfs mount projecting a ConfigMap's keys as files — the same RAM-backed mechanism as a Secret volume, for non-sensitive configuration.",
      sections: [],
    },
  },
  {
    id: 'fs-sa', title: '…/serviceaccount', tag: 'projected', colorVar: 'k-sky',
    caption: 'projected → token · ca.crt · namespace',
    detail: {
      role: 'PROJECTED SA TOKEN · tmpfs',
      summary:
        "A projected volume (tmpfs) at /var/run/secrets/kubernetes.io/serviceaccount the kubelet keeps fresh: a short-lived, audience-bound ServiceAccount token plus the cluster CA and namespace. This is how the process authenticates to the API server.",
      sections: [],
    },
  },
  {
    id: 'fs-pvc', title: '/data', tag: 'ext4 · block', colorVar: 'k-amber',
    caption: 'PVC "app-data" → durable disk',
    detail: {
      role: 'PERSISTENT VOLUME · block',
      summary:
        "A PersistentVolumeClaim mounted as a real filesystem on a block (or network) device — unlike Secrets/ConfigMaps this is durable storage that survives the container. Attached and mounted by the kubelet / CSI driver before start.",
      sections: [{ heading: 'Explore', commands: ['# The backing device and fs type\nnsenter -t <pid> -m findmnt /data'] }],
    },
  },
  {
    id: 'fs-proc', title: '/proc', tag: 'procfs', colorVar: 'k-ghost',
    caption: 'contents from the PID ns',
    links: ['pod-pidns'],
    detail: {
      role: 'PROCFS',
      summary:
        "A procfs mount the mount namespace provides — but what you see inside it (which PIDs) is decided by the PID namespace, not the mount namespace. The classic example of two orthogonal namespaces combining: the mount supplies the directory, the pid ns supplies the contents.",
      sections: [],
    },
  },
]
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
// The listen socket is a netns object, not a container one: a struct socket the
// process created and bound in the Pod's network namespace. It lives beside
// lo/eth0 (its links light them + the process, drawing residence + termination +
// fd-ownership) and is held by the process as a file descriptor.
const LISTEN_SOCKET_BOX = {
  id: 'listen-sock', title: 'listen :port', tag: 'socket', colorVar: 'k-orange',
  caption: 'TCP · bound on the Pod IP',
  links: ['pod-veth', 'lo', 'container-process'],
  detail: {
    role: 'TCP LISTEN SOCKET',
    summary:
      "A struct socket the process created with socket() and pinned to the Pod's network namespace. bind() reserved its port in that netns (0.0.0.0:<port>, so it answers on the Pod IP via eth0 and on 127.0.0.1 via lo); listen() moved it to TCP_LISTEN with a SYN + accept queue. The process holds it as a file descriptor — it shows up as socket:[inode] in /proc/<pid>/fd. A packet arriving on eth0 is demuxed to it by its (proto, local IP, local port, peer) tuple; accept() then forks one connected socket per client.",
    sections: [
      { heading: 'Explore', commands: [
        '# The listening sockets and the pids holding them\noc exec <pod> -n <ns> -- ss -tlnp',
        "# The socket inodes in the process's fd table\nls -l /proc/<pid>/fd | grep socket",
      ] },
    ],
  },
}
// The process holds the socket as a file descriptor (distinct from a namespace
// membership): the [fd] chip points back at the socket so the ownership link is
// visible alongside the namespace-membership chips.
const POD_PROCESS_FD = [
  { tag: 'fd → socket', ref: 'listen-sock', view: 'the listen socket it bound (an fd in /proc/<pid>/fd)', colorVar: 'k-orange' },
]

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
        // lo + eth0 are the netns's L2/L3 edges (rim ports); the listen socket is
        // its L4 endpoint — all three live in the netns. The socket sits in the
        // body (not the rim) and its links cross-light lo/eth0 + the owning process.
        { synthetic: LOOPBACK_BOX, variant: 'iface', links: ['listen-sock'] },
        { id: 'pod-veth', variant: 'iface', title: 'eth0', links: ['listen-sock'] },
        { synthetic: LISTEN_SOCKET_BOX, variant: 'listen' },
        { id: 'pod-ipcns', variant: 'ns' },
        { id: 'pod-utsns', variant: 'ns' },
        // The container = its own cgroup boundary. Inside: the guards applied to
        // it (chips), then the two namespaces it owns — mount ns nesting the
        // rootfs it isolates, PID ns nesting the PID-1 process. The process holds
        // the (netns-level) socket via its fd chip.
        { synthetic: CONTAINER_BOX, variant: 'envelope', children: [
          { id: 'pod-selinux', variant: 'guard' },
          { id: 'pod-seccomp', variant: 'guard' },
          { id: 'pod-capabilities', variant: 'guard' },
          { id: 'pod-mountns', variant: 'ns', children: FS_MOUNTS.map((m) => ({ synthetic: m })) },
          { id: 'pod-pidns', variant: 'ns', children: [
            { id: 'container-process', memberships: POD_PROCESS_NS, holds: POD_PROCESS_FD },
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
    // Resolve cross-highlight refs to the logical box ids the renderer compares
    // against: namespace memberships + held fds (process), and link targets
    // (eth0/lo → the socket they reach; the socket → its interfaces + process).
    memberships: resolveRefs(ctx, opts.memberships),
    holds: resolveRefs(ctx, opts.holds),
    linkIds: opts.links?.map((r) => `${ctx.componentId}__${r}`),
    detail: { role: item.label.toUpperCase(), summary: item.description, sections },
  }
}

// Resolve a chip list's `ref` (a local primitive id) to the logical box id its
// hover should light, keeping the chip's display fields.
const resolveRefs = (ctx, refs) =>
  refs?.map((m) => ({ tag: m.tag, view: m.view, colorVar: m.colorVar, boxId: `${ctx.componentId}__${m.ref}` }))

const buildSynthetic = (ctx, syn, variant) => ({
  id: `${ctx.componentId}__${syn.id}`,
  title: syn.title,
  typePrefix: syn.tag,
  variant: variant || syn.variant,
  colorVar: syn.colorVar,
  caption: syn.caption,
  linkIds: syn.links?.map((r) => `${ctx.componentId}__${r}`),
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

  const box = buildBox(ctx, spec.id, { title: spec.title, variant: spec.variant, memberships: spec.memberships, holds: spec.holds, links: spec.links })
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
